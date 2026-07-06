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
  tokenMessage,
  showOnMapMessage,
  doneMessage,
  errorMessage,
} from "../lib/protocol.mjs";

const DEFAULT_PORT = 7431;
// Localhost-bind is an ADR-010 invariant, not a runtime option — there is no
// --host flag by design (see RFC-034 Risks: "Localhost WS reachable by any
// local process / other browser tab").
const HOST = "127.0.0.1";
const AGENT_LABEL = "forgeplan-web-agent (claude-agent-sdk)";

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

/**
 * A per-connection async message queue: `enqueue(text)` is called from the
 * WS `message` handler; `generator()` is the async generator handed to
 * `query({ prompt })` as its STREAMING INPUT. The generator stays open for
 * the life of the connection — it awaits a promise that resolves the moment
 * a new message is enqueued, so the SDK session accrues context across every
 * question on this connection instead of being torn down per-turn.
 */
export function createMessageQueue() {
  const pending = [];
  let wake = null;

  function enqueue(text) {
    pending.push(text);
    if (wake) {
      const resolve = wake;
      wake = null;
      resolve();
    }
  }

  async function* generator() {
    for (;;) {
      while (pending.length === 0) {
        await new Promise((resolve) => {
          wake = resolve;
        });
      }
      const text = pending.shift();
      yield {
        type: "user",
        session_id: "",
        parent_tool_use_id: null,
        message: { role: "user", content: text },
      };
    }
  }

  return { enqueue, generator };
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

function handleConnection(socket, { cwd }) {
  const { enqueue, generator } = createMessageQueue();
  const onboardServer = buildOnboardServer(socket);
  const options = {
    ...buildOptions({ cwd }),
    mcpServers: { onboard: onboardServer },
  };

  let closed = false;
  socket.on("close", () => {
    closed = true;
  });
  socket.on("error", () => {
    // TODO(ws-error-swallow): a transport-level error already implies the
    // connection is going away; the subsequent `close` event does cleanup.
    // Never let a per-connection transport fault crash the daemon.
  });

  socket.send(encode(readyMessage(AGENT_LABEL)));

  (async () => {
    try {
      for await (const message of query({ prompt: generator(), options })) {
        if (closed) break;
        if (message.type === "assistant") {
          const blocks = message.message?.content ?? [];
          for (const block of blocks) {
            if (block?.type === "text" && typeof block.text === "string") {
              socket.send(encode(tokenMessage(block.text)));
            }
          }
        } else if (message.type === "result") {
          socket.send(encode(doneMessage()));
        }
      }
    } catch (err) {
      if (!closed) {
        try {
          socket.send(encode(errorMessage(err?.message ?? String(err))));
        } catch {
          // socket already gone — nothing left to notify.
        }
      }
    }
  })();

  socket.on("message", (raw) => {
    const msg = decodeClientMessage(raw.toString());
    if (!msg) return; // malformed/unknown frame — dropped per protocol contract
    if (msg.type === "user_message") {
      enqueue(msg.text);
    }
    // TODO(cancel-not-wired): {type:"cancel"} has no cancellation hook into
    // the streaming generator yet — the in-flight SDK turn runs to
    // completion. Wiring a real abort is deferred to a follow-up (Phase 4
    // hardening); it does not block the Phase 2 smoke contract.
  });
}

export function createDaemon({ cwd }) {
  const httpServer = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
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
  wss.on("connection", (socket) => {
    handleConnection(socket, { cwd });
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
