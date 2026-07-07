#!/usr/bin/env node
// RFC-034 (Pillar C, Phase 2) / ADR-010 — the onboard-agent daemon. Boots a
// persistent, read-only Claude Agent SDK session per WebSocket connection,
// binds 127.0.0.1 ONLY, registers the in-process `show_on_map` tool, and
// relays SDK stream events <-> WS frames using agent/lib/protocol.mjs's
// versioned schema. Launched exclusively via the core package's spawn-only
// `bin/ onboard-agent` subcommand (Phase 3) — never imported by it (rule 23 /
// ADR-010: the SDK dependency lives ONLY in this separate package).
//
// Health/probe choice (documented per RFC-034 task hand-off): this daemon
// exposes BOTH a plain `GET /health` (via the same http.Server the
// WebSocketServer attaches to) AND a per-connection `{type:"ready"}` WS
// frame. `/health` is what the browser's cheap Tier-0→Tier-1 upgrade probe
// (agent-client.ts#probeDaemon, Phase 3) uses — a plain fetch with no
// socket lifecycle to manage, safe to poll on an interval. The `{ready}`
// frame is what a CONNECTED client uses to confirm protocol/model
// compatibility before sending its first `user_message`. Two signals, two
// purposes: liveness (HTTP) vs. session-ready (WS).

import { createServer } from "node:http";
import { existsSync, statSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import {
  query,
  tool,
  createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { buildOptions } from "../lib/profile.mjs";
import {
  PROTOCOL_VERSION,
  decodeClientMessage,
  encode,
  readyMessage,
  sessionMessage,
  tokenMessage,
  showOnMapMessage,
  usageMessage,
  doneMessage,
  errorMessage,
} from "../lib/protocol.mjs";
import {
  registerAgent,
  heartbeatAgent,
  deregisterAgent,
  readOtherLiveInstances,
} from "../lib/registry.mjs";

const DEFAULT_PORT = 7431;
// Localhost-bind is an ADR-010 invariant, not a runtime option — there is no
// --host flag by design (see RFC-034 Risks: "Localhost WS reachable by any
// local process / other browser tab").
const HOST = "127.0.0.1";
const AGENT_LABEL = "forgeplan-web-agent (claude-agent-sdk)";
// RFC-035 (Wave 2, FR-5/FR-6) — advertised on every `ready` frame so an
// older web client feature-detects instead of assuming these frames exist.
const DAEMON_CAPABILITIES = ["usage", "instances"];
// RFC-035 (Wave 2, FR-6) — this process's own row id in the shared
// instance registry, set once `main()`'s `registerAgent()` call succeeds.
// Module-level rather than threaded through createDaemon/handleConnection:
// there is exactly one daemon per process (agent/scripts/smoke.mjs spawns
// each test daemon as its own child process), and every WS connection's
// `ready` frame needs the CURRENT value to report other live instances.
// Stays `null` if registration hasn't run yet or failed (fail-open —
// readOtherLiveInstances(null) degrades to "no self to exclude", which is
// harmless since no row can exist yet in that case).
let currentAgentId = null;
// RFC-035 (Wave 2, FR-6) — heartbeat ticker, unref'd so it never holds the
// process open; cleared on shutdown by cleanupRegistry() in main().
let heartbeatTimer = null;

function fail(line, code = 1) {
  process.stderr.write(`onboard-agent: ${line}\n`);
  process.exit(code);
}

export function parseArgs(argv) {
  const args = { cwd: process.cwd(), port: DEFAULT_PORT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--cwd") {
      const v = argv[++i];
      if (!v) throw new Error("--cwd requires a value");
      args.cwd = v;
    } else if (a === "--port") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 1 || v > 65_535) {
        throw new RangeError(`invalid --port value; expected 1..65535`);
      }
      args.port = v;
    }
  }
  return args;
}

// RFC-034 Phase 4c — a resumed session id is only ever compared/threaded
// through as an opaque string (never shell-interpolated, never used in a
// filesystem path); this charset is a defensive sanity check against a
// pathologically malformed query param, not an attempt to pin the exact
// format the Agent SDK issues.
const RESUME_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Extracts and validates a `?resume=<sessionId>` query param from the raw
 * HTTP upgrade request URL (`request.url`, e.g. `/?resume=abc-123`).
 * Returns `null` for a missing param, an empty value, a value outside
 * `RESUME_SESSION_ID_PATTERN`, or an unparseable URL — every one of these
 * degrades to "start a fresh session" rather than throwing, matching the
 * live-continue contract ("never break").
 */
export function parseResumeSessionId(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl, "http://localhost");
  } catch {
    return null;
  }
  const value = parsed.searchParams.get("resume");
  if (!value || !RESUME_SESSION_ID_PATTERN.test(value)) return null;
  return value;
}

/**
 * A per-connection async message queue: `enqueue(text)` is called from the
 * WS `message` handler; `generator()` is the async generator handed to
 * `query({ prompt })` as its STREAMING INPUT. The generator stays open for
 * the life of the connection — it awaits a promise that resolves the moment
 * a new message is enqueued, so the SDK session accrues context across every
 * question on this connection instead of being torn down per-turn. `close()`
 * (bugfix — leaked subprocess) ends that life: it wakes any parked
 * `generator()` and makes it `return` instead of yielding again, completing
 * the SDK's input async-iterable so `query()` can tear down its underlying
 * `claude` subprocess instead of leaking it — see `socket.on("close")` in
 * `handleConnection` below.
 */
export function createMessageQueue() {
  const pending = [];
  let wake = null;
  // Bugfix (leaked subprocess) — set by `close()` when the owning
  // WebSocket disconnects; makes `generator()` return instead of parking
  // forever on an unresolved wake promise, which is what let the
  // underlying `claude` subprocess leak on every dropped connection.
  let done = false;

  function enqueue(text) {
    pending.push(text);
    if (wake) {
      const resolve = wake;
      wake = null;
      resolve();
    }
  }

  /**
   * Terminates the queue: any generator currently parked awaiting a new
   * message wakes up and returns instead of yielding another value. Safe to
   * call even if the generator was never iterated (lazy query start below)
   * or was already closed.
   */
  function close() {
    done = true;
    if (wake) {
      const resolve = wake;
      wake = null;
      resolve();
    }
  }

  async function* generator() {
    for (;;) {
      while (pending.length === 0 && !done) {
        await new Promise((resolve) => {
          wake = resolve;
        });
      }
      if (done) return;
      const text = pending.shift();
      yield {
        type: "user",
        session_id: "",
        parent_tool_use_id: null,
        message: { role: "user", content: text },
      };
    }
  }

  return { enqueue, generator, close };
}

/**
 * Builds the ONE registered SDK tool for this connection: `show_on_map`.
 * Bound to `socket` so its handler can relay the call to the browser as a
 * `{type:"show_on_map"}` WS frame — this is the entire RFC-034 camera relay.
 */
export function buildOnboardServer(socket) {
  return createSdkMcpServer({
    name: "onboard",
    version: "1.0.0",
    tools: [
      tool(
        "show_on_map",
        "Move the map camera to a zone, node, or flow so the user can see what you are explaining",
        {
          kind: z.enum(["zone", "node", "flow"]),
          id: z.string(),
        },
        async (args) => {
          try {
            socket.send(
              encode(showOnMapMessage({ kind: args.kind, id: args.id })),
            );
          } catch {
            // TODO(socket-closed-mid-tool-call): the WS may have closed
            // between the tool call starting and this send. The SDK still
            // gets its ack below so the model's turn completes normally —
            // the browser simply misses that one camera move.
          }
          return {
            content: [
              {
                type: "text",
                text: `Shown ${args.kind} ${args.id} on the map.`,
              },
            ],
          };
        },
      ),
    ],
  });
}

function handleConnection(socket, { cwd, request }) {
  const { enqueue, generator, close: closeQueue } = createMessageQueue();
  const onboardServer = buildOnboardServer(socket);
  const resumeSessionId = parseResumeSessionId(request?.url);

  function buildConnectionOptions(resume) {
    return {
      ...buildOptions({ cwd }),
      mcpServers: { onboard: onboardServer },
      ...(resume ? { resume } : {}),
    };
  }

  let closed = false;
  // Tracks whether the connection currently has a user turn in flight —
  // set on the `user_message` that starts it, cleared once the matching
  // `result` message closes it out. Drives the {type:"cancel"} guard below
  // ("cancel with no in-flight turn is a no-op") without depending on the
  // SDK to tell us anything about idle state.
  let turnActive = false;
  // Held onto (rather than iterated anonymously) so the `cancel` handler
  // below can call `activeQuery.interrupt()` on the SAME persistent Query
  // object the for-await loop is draining — this is the Agent SDK's
  // documented way to stop the current turn without tearing down the
  // session (Query#interrupt(): Promise<void>; the session's async
  // generator prompt keeps accepting further `user_message`s afterward).
  // Reassigned by `startQuery` (Phase 4c retry-fresh fallback below), so
  // this must be `let`, not `const`.
  let activeQuery = null;
  // RFC-034 Phase 4c — guards the one-shot "resume failed before any SDK
  // message arrived, retry fresh" fallback from looping forever.
  let retriedFreshAfterResume = false;
  // Bugfix (leaked subprocess) — true once `startQuery` has actually been
  // called for this connection. Guards against spawning a `claude`
  // subprocess for EVERY WebSocket connection, including the browser's
  // liveness probe (which opens and drops a fresh WS every
  // PROBE_INTERVAL_MS with no `user_message` ever sent): the subprocess is
  // now started LAZILY, on the first `user_message`, never on connect.
  let queryStarted = false;

  socket.on("close", () => {
    closed = true;
    closeQueue();
    // Bugfix (leaked subprocess) — ACTIVE teardown. Previously the only
    // signal a closed socket gave the in-flight `for await` loop was the
    // passive `if (closed) break` below, which only re-evaluates when the
    // SDK yields a NEW message — a connection with no more turns coming
    // (an idle chat, or a probe that never sent a user_message) would
    // never hit it, and the underlying `claude` subprocess leaked forever
    // (10-20+ orphaned processes observed in minutes, pegging CPU).
    // interrupt() stops any in-flight turn; return() ends the Query
    // AsyncGenerator, which tears down the subprocess. Every rejection is
    // swallowed — a per-connection teardown fault must never crash the
    // daemon.
    try {
      const ir = activeQuery?.interrupt?.();
      if (ir && typeof ir.catch === "function") ir.catch(() => {});
    } catch {
      // interrupt() threw synchronously — return() below still runs.
    }
    try {
      const r = activeQuery?.return?.(undefined);
      if (r && typeof r.catch === "function") r.catch(() => {});
    } catch {
      // return() threw synchronously — nothing further to do here.
    }
    activeQuery = null;
  });
  socket.on("error", () => {
    // TODO(ws-error-swallow): a transport-level error already implies the
    // connection is going away; the subsequent `close` event does cleanup.
    // Never let a per-connection transport fault crash the daemon.
  });

  // RFC-035 (Wave 2, FR-5/FR-6) — advertise capabilities + a snapshot of
  // other live instances at connect time. readOtherLiveInstances is
  // fail-open (returns [] on any registry fault), so this send is never
  // gated on the registry being writable.
  socket.send(
    encode(
      readyMessage(AGENT_LABEL, {
        capabilities: DAEMON_CAPABILITIES,
        otherInstances: readOtherLiveInstances(currentAgentId),
      }),
    ),
  );

  function startQuery(resume) {
    // True once ANY message (including the first `system`/`init`) has been
    // observed from this attempt's query() stream — used below to decide
    // whether an early failure is plausibly "the requested resume target
    // doesn't exist" (nothing arrived yet) vs. a fault mid-conversation
    // (something already arrived; resuming again would just repeat it).
    let anyMessageSeen = false;
    const options = buildConnectionOptions(resume);
    activeQuery = query({ prompt: generator(), options });

    (async () => {
      try {
        for await (const message of activeQuery) {
          if (closed) break;
          anyMessageSeen = true;
          if (message.type === "system" && message.subtype === "init") {
            // RFC-034 Phase 4c — the SDK's authoritative session id for
            // THIS query(), whether freshly started or resumed. Always
            // relayed (never assumed to equal the requested `resume`
            // value) so the browser's persisted id self-corrects to
            // whatever the daemon/SDK actually used.
            try {
              socket.send(encode(sessionMessage(message.session_id)));
            } catch {
              // socket already gone — nothing left to notify.
            }
          } else if (message.type === "stream_event") {
            // Token-level streaming (requires options.includePartialMessages,
            // see lib/profile.mjs). `event` is Anthropic's raw
            // RawMessageStreamEvent; a text token arrives as a
            // content_block_delta carrying a text_delta. The complete
            // `assistant` message that follows at end-of-turn carries the
            // SAME text in full blocks — it is intentionally NOT re-sent as
            // `token` frames below, or every answer would render twice.
            const ev = message.event;
            if (
              ev?.type === "content_block_delta" &&
              ev.delta?.type === "text_delta" &&
              typeof ev.delta.text === "string"
            ) {
              socket.send(encode(tokenMessage(ev.delta.text)));
            }
          } else if (message.type === "result") {
            turnActive = false;
            // RFC-035 (Wave 2, FR-5) — forward the SDK's own usage/cost
            // figures for this turn, BEFORE `done`, so the web client can
            // attribute the usage frame to the turn that just completed.
            // Guard: an absent `usage` (never observed from the SDK today,
            // but not guaranteed by its types) skips the usage frame
            // entirely rather than sending zeros that would look like a
            // real (if empty) turn.
            if (message.usage) {
              const inputTokens = message.usage?.input_tokens ?? 0;
              const outputTokens = message.usage?.output_tokens ?? 0;
              const costUsd = message.total_cost_usd ?? 0;
              socket.send(
                encode(usageMessage({ inputTokens, outputTokens, costUsd })),
              );
            }
            socket.send(encode(doneMessage()));
          }
        }
      } catch (err) {
        turnActive = false;
        // TODO(resume-fallback-heuristic): this project has no live-model
        // harness to exercise an actual "resume target no longer exists"
        // failure (agent/scripts/smoke.mjs deliberately never starts a
        // real SDK turn — see its file header), so the exact shape of that
        // failure from `query({options:{resume}})` is untested. The
        // heuristic below is deliberately conservative: only retry fresh
        // when (a) this attempt USED resume, (b) NOTHING arrived yet (not
        // even `system/init`), and (c) we have not already retried once.
        // Any failure after the session was actually established is
        // reported as a normal `{error}` frame instead, same as before
        // Phase 4c.
        if (resume && !anyMessageSeen && !retriedFreshAfterResume) {
          retriedFreshAfterResume = true;
          startQuery(undefined);
          return;
        }
        if (!closed) {
          try {
            socket.send(encode(errorMessage(err?.message ?? String(err))));
          } catch {
            // socket already gone — nothing left to notify.
          }
        }
      }
    })();
  }

  socket.on("message", (raw) => {
    const msg = decodeClientMessage(raw.toString());
    if (!msg) return; // malformed/unknown frame — dropped per protocol contract
    if (msg.type === "user_message") {
      turnActive = true;
      // Bugfix (leaked subprocess) — LAZY query start. A connection that
      // only ever probes (never sends a user_message, e.g. the browser's
      // liveness probe) now spawns NO `claude` subprocess at all; the
      // first real `user_message` on this connection is what starts it.
      if (!queryStarted) {
        queryStarted = true;
        startQuery(resumeSessionId);
      }
      enqueue(msg.text);
    } else if (msg.type === "cancel") {
      if (!turnActive || !activeQuery) return; // nothing in flight — no-op per protocol contract
      if (typeof activeQuery.interrupt === "function") {
        activeQuery.interrupt().catch(() => {
          // interrupt() rejected — the client already reset its own
          // pending state locally (chat-store.cancelCurrent) regardless of
          // what the daemon does, so there is nothing further to relay;
          // the connection is left open per the cancel contract.
        });
      } else {
        // TODO(sdk-interrupt-unavailable): defensive fallback for an SDK
        // build without Query#interrupt() (the pinned
        // @anthropic-ai/claude-agent-sdk ^0.3.201 always has it). Can't stop
        // the in-flight turn server-side, but still tell the client it's
        // over so its UI never waits on a done/error frame that this
        // connection's for-await loop won't otherwise send until the
        // (uninterrupted) turn eventually finishes on its own.
        turnActive = false;
        try {
          socket.send(encode(doneMessage()));
        } catch {
          // socket already gone — nothing left to notify.
        }
      }
    }
  });
}

export function createDaemon({ cwd }) {
  const httpServer = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, {
        "content-type": "application/json",
        // Bugfix (CORS) — the daemon binds 127.0.0.1 ONLY (ADR-010), so a
        // wildcard CORS origin on this read-only liveness endpoint is
        // safe: only a local browser tab can reach it, and the response
        // leaks nothing beyond { ok, protocolVersion, model }. This lets
        // the web client's probe use a plain `fetch` (no WS lifecycle to
        // manage, safe to poll on an interval) instead of opening a full
        // WebSocket per probe tick — see agent-client.ts#probeDaemon.
        "access-control-allow-origin": "*",
      });
      res.end(
        JSON.stringify({
          ok: true,
          protocolVersion: PROTOCOL_VERSION,
          model: AGENT_LABEL,
        }),
      );
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not found" }));
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (socket, request) => {
    // RFC-034 Phase 4c — `request` is the HTTP upgrade request; its `.url`
    // carries an optional `?resume=<sessionId>` the browser sets when
    // continuing a past chat session (see parseResumeSessionId above).
    handleConnection(socket, { cwd, request });
  });
  wss.on("error", (err) => {
    process.stderr.write(
      `onboard-agent: WS server error: ${err?.message ?? err}\n`,
    );
  });

  return { httpServer, wss };
}

function main() {
  let cwd;
  let port;
  try {
    ({ cwd, port } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    fail(err?.message ?? String(err));
    return;
  }

  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
    fail(`--cwd "${cwd}" is not an existing directory`);
    return;
  }

  const { httpServer } = createDaemon({ cwd });

  // A per-connection SDK/WS fault must never take the whole daemon down
  // (RFC-034 contract: "Handle errors as {error} frames, never crash the
  // daemon"). These are the last-resort safety nets above the per-connection
  // try/catch in handleConnection.
  process.on("uncaughtException", (err) => {
    process.stderr.write(
      `onboard-agent: uncaught exception: ${err?.stack ?? err}\n`,
    );
  });
  process.on("unhandledRejection", (reason) => {
    process.stderr.write(`onboard-agent: unhandled rejection: ${reason}\n`);
  });

  // RFC-035 (Wave 2, FR-6) — undoes registerAgent's registry row and stops
  // the heartbeat ticker. Idempotent (guarded on currentAgentId) so it is
  // safe to call from both a signal handler and the httpServer 'close'
  // event without double-deregistering. Never throws — deregisterAgent is
  // itself fail-open (agent/lib/registry.mjs).
  function cleanupRegistry() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (currentAgentId) {
      deregisterAgent(currentAgentId);
      currentAgentId = null;
    }
  }

  // Registering a SIGINT/SIGTERM listener suppresses Node's default
  // immediate-exit behaviour for that signal, so this handler MUST call
  // process.exit() itself once cleanup is done.
  process.on("SIGINT", () => {
    cleanupRegistry();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanupRegistry();
    process.exit(0);
  });
  httpServer.on("close", cleanupRegistry);

  httpServer.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      fail(
        `port ${port} is already in use on ${HOST}. Pass a different --port.`,
      );
      return;
    }
    fail(`http server error: ${err?.message ?? err}`);
  });

  httpServer.listen(port, HOST, () => {
    process.stdout.write(
      `onboard-agent live on ws://${HOST}:${port} (cwd ${cwd})\n`,
    );
    // RFC-035 (Wave 2, FR-6) — register once listening, then re-heartbeat
    // every 30s (unref'd — must never hold the process open on its own).
    // registerAgent/heartbeatAgent are fail-open; the try/catch here is
    // defense-in-depth against anything else in this block throwing.
    try {
      currentAgentId = registerAgent({
        port,
        cwd,
        protocolVersion: PROTOCOL_VERSION,
      });
      heartbeatTimer = setInterval(() => {
        if (currentAgentId) heartbeatAgent(currentAgentId);
      }, 30_000);
      heartbeatTimer.unref();
    } catch (err) {
      process.stderr.write(
        `onboard-agent: registry setup failed (non-fatal): ${err?.message ?? err}\n`,
      );
    }
  });
}

// `process.argv[1]` is the path npm/npx invoked, which for an installed
// package's node_modules/.bin/<name> is a SYMLINK to this file. A strict
// `===` against the resolved import.meta.url path silently fails through
// that symlink (npx never reaches the daemon-boot branch below), so this
// guard compares the REAL path on both sides.
const invokedPath = process.argv[1];
const isMainModule =
  invokedPath !== undefined &&
  realpathSync(invokedPath) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
