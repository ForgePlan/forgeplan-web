#!/usr/bin/env node
// RFC-034 (Pillar C, Phase 2) — smoke test for @forgeplan/web-agent that
// runs WITHOUT a live model turn (no Claude Code session needs to actually
// answer a question). Covers exactly what the task hand-off asked for:
//   1. protocol.mjs encode/decode round-trips for every message shape.
//   2. profile.mjs#buildOptions denies Write/Edit/Bash and allows the
//      onboard tool.
//   3. The daemon module imports cleanly, its message queue generator
//      yields the documented shape, and its `show_on_map` tool relays over
//      a fake socket.
//   4. The daemon process actually binds 127.0.0.1:<port>, answers
//      `GET /health` (with an access-control-allow-origin: * header —
//      bugfix, CORS), and sends a `{type:"ready"}` frame on WS connect.
//   5. (Phase 4a) A stray {type:"cancel"} with no in-flight turn on a
//      connection is a no-op — no crash, daemon stays healthy afterward.
//   6. (bugfix — leaked subprocess) createMessageQueue()'s close() makes
//      generator() return, both when parked awaiting a message and when
//      called before the generator is ever iterated.
//   7. (bugfix — leaked subprocess) a connection that never sends a
//      user_message receives ONLY the synchronous {type:"ready"} frame —
//      the black-box signal that lazy query start never spawned a query
//      for it.
// A full live-model turn (including cancelling one mid-stream via
// Query#interrupt()) needs the user's own Claude Code session and is
// verified later (Phase 4) — this script deliberately does not attempt one.

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

import {
  PROTOCOL_VERSION,
  decodeClientMessage,
  decodeServerMessage,
  doneMessage,
  encode,
  errorMessage,
  readyMessage,
  sessionMessage,
  showOnMapMessage,
  tokenMessage,
  usageMessage,
} from "../lib/protocol.mjs";
import {
  ALLOWED_TOOLS,
  DISALLOWED_TOOLS,
  buildOptions,
} from "../lib/profile.mjs";
import {
  buildOnboardServer,
  createMessageQueue,
  parseResumeSessionId,
} from "../bin/agent.mjs";
import {
  deregisterAgent,
  heartbeatAgent,
  makeAgentId,
  readOtherLiveInstances,
  registerAgent,
} from "../lib/registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AGENT_BIN = join(ROOT, "bin", "agent.mjs");

let failed = false;

function log(line) {
  process.stdout.write(`[agent-smoke] ${line}\n`);
}

function assert(cond, message) {
  if (!cond) {
    failed = true;
    process.stderr.write(`[agent-smoke] FAIL: ${message}\n`);
  }
}

function checkProtocolRoundTrip() {
  log("protocol: encode/decode round-trip");

  const ready = readyMessage("test-model");
  assert(
    decodeServerMessage(encode(ready))?.model === "test-model",
    "ready message did not round-trip",
  );

  const token = tokenMessage("hello");
  assert(
    decodeServerMessage(encode(token))?.delta === "hello",
    "token message did not round-trip",
  );

  const show = showOnMapMessage({ kind: "zone", id: "z1" });
  const decodedShow = decodeServerMessage(encode(show));
  assert(
    decodedShow?.type === "show_on_map" &&
      decodedShow.target.kind === "zone" &&
      decodedShow.target.id === "z1",
    "show_on_map message did not round-trip",
  );

  const done = doneMessage();
  assert(
    decodeServerMessage(encode(done))?.type === "done",
    "done message did not round-trip",
  );

  const err = errorMessage("boom");
  assert(
    decodeServerMessage(encode(err))?.message === "boom",
    "error message did not round-trip",
  );

  // RFC-034 Phase 4c — {type:"session"} is the server-only frame carrying
  // the SDK's own session id, sent once captured from `system`/`init`.
  const session = sessionMessage("abc-123");
  const decodedSession = decodeServerMessage(encode(session));
  assert(
    decodedSession?.type === "session" &&
      decodedSession.sessionId === "abc-123",
    "session message did not round-trip",
  );
  assert(
    decodeServerMessage(encode({ type: "session", sessionId: 42 })) === null,
    "a session message with a non-string sessionId should decode to null",
  );

  const userMsg = decodeClientMessage(
    encode({ type: "user_message", text: "where is X" }),
  );
  assert(
    userMsg?.type === "user_message" && userMsg.text === "where is X",
    "user_message did not round-trip",
  );

  const cancelMsg = decodeClientMessage(encode({ type: "cancel" }));
  assert(cancelMsg?.type === "cancel", "cancel message did not round-trip");

  assert(
    decodeClientMessage("not json") === null,
    "malformed client JSON should decode to null",
  );
  assert(
    decodeClientMessage(encode({ type: "unknown_type" })) === null,
    "unknown client message type should decode to null",
  );
  assert(
    decodeServerMessage(
      encode({ type: "show_on_map", target: { kind: "bogus", id: "x" } }),
    ) === null,
    "show_on_map with an invalid kind should decode to null",
  );

  assert(
    typeof PROTOCOL_VERSION === "number",
    "PROTOCOL_VERSION must be a number",
  );

  // RFC-035 (Wave 2, FR-5) — usage frame round-trip.
  const usage = usageMessage({
    inputTokens: 12,
    outputTokens: 34,
    costUsd: 0.0056,
  });
  const decodedUsage = decodeServerMessage(encode(usage));
  assert(
    decodedUsage?.type === "usage" &&
      decodedUsage.inputTokens === 12 &&
      decodedUsage.outputTokens === 34 &&
      decodedUsage.costUsd === 0.0056,
    "usage message did not round-trip",
  );
  assert(
    decodeServerMessage(
      encode({
        type: "usage",
        inputTokens: "12",
        outputTokens: 34,
        costUsd: 0,
      }),
    ) === null,
    "a usage message with a non-number inputTokens should decode to null",
  );
  assert(
    decodeServerMessage(encode({ type: "usage", inputTokens: 1 })) === null,
    "a usage message missing outputTokens/costUsd should decode to null",
  );

  // RFC-035 (Wave 2, FR-5/FR-6) — ready frame carries capabilities +
  // otherInstances, additively (default [] when absent, e.g. an older peer).
  const readyWithExtras = readyMessage("test-model", {
    capabilities: ["usage", "instances"],
    otherInstances: [{ projectName: "other-proj", port: 5555, kind: "web" }],
  });
  const decodedReady = decodeServerMessage(encode(readyWithExtras));
  assert(
    Array.isArray(decodedReady?.capabilities) &&
      decodedReady.capabilities.includes("usage") &&
      decodedReady.capabilities.includes("instances"),
    "ready message should carry capabilities",
  );
  assert(
    Array.isArray(decodedReady?.otherInstances) &&
      decodedReady.otherInstances.length === 1 &&
      decodedReady.otherInstances[0].projectName === "other-proj" &&
      decodedReady.otherInstances[0].port === 5555 &&
      decodedReady.otherInstances[0].kind === "web",
    "ready message should carry otherInstances",
  );
  const decodedBareReady = decodeServerMessage(
    encode({ type: "ready", protocolVersion: 1, model: "old-daemon" }),
  );
  assert(
    Array.isArray(decodedBareReady?.capabilities) &&
      decodedBareReady.capabilities.length === 0 &&
      Array.isArray(decodedBareReady?.otherInstances) &&
      decodedBareReady.otherInstances.length === 0,
    "a ready frame missing capabilities/otherInstances (older daemon) should still decode, defaulting both to []",
  );
}

function checkProfileDeniesWriteEditBash() {
  log("profile: buildOptions denies Write/Edit/Bash, allows the onboard tool");

  const options = buildOptions({ cwd: ROOT });
  assert(options.cwd === ROOT, "buildOptions did not thread cwd through");
  assert(
    options.permissionMode === "default",
    "permissionMode should be default",
  );
  assert(
    Array.isArray(options.disallowedTools) &&
      ["Write", "Edit", "Bash"].every((t) =>
        options.disallowedTools.includes(t),
      ),
    "disallowedTools must include Write, Edit, and Bash",
  );
  assert(
    Array.isArray(options.allowedTools) &&
      options.allowedTools.includes("mcp__onboard__show_on_map"),
    "allowedTools must include mcp__onboard__show_on_map",
  );
  assert(
    !("mcpServers" in options),
    "buildOptions must not set mcpServers itself",
  );
  assert(
    options.includePartialMessages === true,
    "buildOptions must set includePartialMessages: true for token-level streaming",
  );
  assert(
    DISALLOWED_TOOLS.includes("Write") &&
      DISALLOWED_TOOLS.includes("Edit") &&
      DISALLOWED_TOOLS.includes("Bash"),
    "DISALLOWED_TOOLS constant drifted from the read-only contract",
  );
  assert(
    ALLOWED_TOOLS.includes("Read") &&
      ALLOWED_TOOLS.includes("Glob") &&
      ALLOWED_TOOLS.includes("Grep"),
    "ALLOWED_TOOLS constant missing a read-only primitive",
  );

  let threw = false;
  try {
    buildOptions({});
  } catch {
    threw = true;
  }
  assert(threw, "buildOptions({}) (no cwd) must throw, not silently proceed");
}

function checkResumeSessionIdParsing() {
  log("agent.mjs: parseResumeSessionId — RFC-034 Phase 4c live-continue");

  assert(
    parseResumeSessionId("/?resume=abc-123_XYZ") === "abc-123_XYZ",
    "a well-formed resume param should be extracted verbatim",
  );
  assert(
    parseResumeSessionId("/") === null,
    "a URL with no resume param should return null",
  );
  assert(
    parseResumeSessionId("/?resume=") === null,
    "an empty resume value should return null",
  );
  assert(
    parseResumeSessionId("/?other=1") === null,
    "a URL missing the resume param entirely should return null",
  );
  assert(
    parseResumeSessionId("/?resume=" + "a".repeat(500)) === null,
    "a pathologically long resume value should be rejected, not throw",
  );
  assert(
    parseResumeSessionId("/?resume=has%20space") === null,
    "a resume value outside the allow-listed charset should be rejected",
  );
  assert(
    parseResumeSessionId(undefined) === null,
    "an undefined request URL (e.g. a missing upgrade request) should return null, not throw",
  );
  assert(
    parseResumeSessionId("not a url \0") === null,
    "an unparseable URL should return null, not throw",
  );
}

async function checkMessageQueueAndToolRelay() {
  log("daemon module: message queue shape + show_on_map tool relay");

  const { enqueue, generator } = createMessageQueue();
  const gen = generator();
  const pending = gen.next(); // starts awaiting — queue is empty
  enqueue("hello agent");
  const { value, done } = await pending;
  assert(done !== true, "generator should not be done after first message");
  assert(value?.type === "user", "queued message should have type 'user'");
  assert(
    value?.message?.role === "user" &&
      value?.message?.content === "hello agent",
    "queued message content did not match what was enqueued",
  );

  const sent = [];
  const fakeSocket = { send: (raw) => sent.push(raw) };
  const server = buildOnboardServer(fakeSocket);
  assert(
    server?.name === "onboard" || server?.type != null,
    "buildOnboardServer should return an SDK MCP server config object",
  );
}

async function checkMessageQueueClose() {
  log("daemon module: message queue close() — bugfix (leaked subprocess)");

  // Case 1: close() while a generator is PARKED awaiting a message (the
  // steady-state shape for an idle connection) must wake it up and make it
  // return, rather than leaving it awaiting forever — this is what lets
  // query()'s input async-iterable COMPLETE on socket close so the
  // underlying `claude` subprocess can exit instead of leaking.
  const parked = createMessageQueue();
  const parkedGen = parked.generator();
  const parkedNext = parkedGen.next(); // starts awaiting — queue is empty
  parked.close();
  const parkedResult = await parkedNext;
  assert(
    parkedResult.done === true,
    "generator() must be done after close() while parked awaiting a message",
  );

  // Case 2: close() called before the generator is ever iterated (the
  // shape for a probe-only connection under lazy query start — the queue
  // is created but generator() never gets pulled by query()) must still
  // leave the generator well-behaved: the first .next() after close()
  // resolves done immediately instead of hanging.
  const neverStarted = createMessageQueue();
  neverStarted.close();
  const neverStartedGen = neverStarted.generator();
  const neverStartedResult = await neverStartedGen.next();
  assert(
    neverStartedResult.done === true,
    "generator() must resolve done immediately when close() preceded the first iteration",
  );
}

// RFC-035 (Wave 2, FR-6) — since the daemon now writes into
// `<HOME>/.forgeplan-web/instances.json` on start and removes it on
// SIGTERM (see agent/bin/agent.mjs's cleanupRegistry), every test below
// that points HOME at its own `scratch` dir must wait for the child to
// actually finish exiting before recursively removing that same
// directory — otherwise the child's in-flight deregister write (or its
// tmp-file rename) races the parent's rmSync and intermittently fails
// with ENOTEMPTY/ENOENT. A timeout fallback keeps a hung child from
// wedging the suite.
async function waitForExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
}

async function waitForLine(child, predicate, timeoutMs = 15_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    let buf = "";
    const timer = setTimeout(() => {
      rejectPromise(new Error(`timed out waiting for daemon stdout: ${buf}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      if (predicate(buf)) {
        clearTimeout(timer);
        resolvePromise(buf);
      }
    });
    child.stderr.on("data", (chunk) => {
      buf += chunk.toString();
    });
  });
}

async function checkDaemonProcess() {
  log("daemon process: binds 127.0.0.1, /health responds, WS sends ready");

  const scratch = mkdtempSync(join(tmpdir(), "fpw-agent-smoke-"));
  const port = 17400 + Math.floor(Math.random() * 200);

  const child = spawn(
    process.execPath,
    [AGENT_BIN, "--cwd", scratch, "--port", String(port)],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      // RFC-035 (Wave 2, FR-6) — the daemon now registers itself in
      // `~/.forgeplan-web/instances.json` on start. Point HOME/USERPROFILE
      // at this test's own scratch dir so the smoke suite never touches
      // the developer's real registry file.
      env: { ...process.env, HOME: scratch, USERPROFILE: scratch },
    },
  );

  try {
    await waitForLine(child, (buf) => buf.includes("onboard-agent live on"));
    log(`daemon reported live on port ${port}`);

    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    assert(
      healthResponse.headers.get("access-control-allow-origin") === "*",
      "GET /health must carry access-control-allow-origin: * (bugfix — " +
        "CORS, lets the web client's probe use a plain fetch)",
    );
    const health = await healthResponse.json();
    assert(health.ok === true, "/health should report ok: true");
    assert(
      health.protocolVersion === PROTOCOL_VERSION,
      "/health protocolVersion should match PROTOCOL_VERSION",
    );

    const readyFrame = await new Promise((resolvePromise, rejectPromise) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const timer = setTimeout(() => {
        ws.terminate();
        rejectPromise(new Error("timed out waiting for {type:ready} frame"));
      }, 5_000);
      ws.on("message", (raw) => {
        clearTimeout(timer);
        const msg = decodeServerMessage(raw.toString());
        ws.close();
        resolvePromise(msg);
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        rejectPromise(err);
      });
    });
    assert(
      readyFrame?.type === "ready",
      "first WS frame should be {type:'ready'}",
    );
    assert(
      readyFrame?.protocolVersion === PROTOCOL_VERSION,
      "ready frame protocolVersion should match PROTOCOL_VERSION",
    );
    log(`WS ready frame: model="${readyFrame?.model}"`);
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function checkCancelIsNoOpWithoutInFlightTurn() {
  log(
    "daemon process: cancel(RFC-034 Phase 4a) — a stray cancel with no in-flight turn is a no-op",
  );

  const scratch = mkdtempSync(join(tmpdir(), "fpw-agent-smoke-cancel-"));
  const port = 17700 + Math.floor(Math.random() * 200);

  const child = spawn(
    process.execPath,
    [AGENT_BIN, "--cwd", scratch, "--port", String(port)],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      // RFC-035 (Wave 2, FR-6) — the daemon now registers itself in
      // `~/.forgeplan-web/instances.json` on start. Point HOME/USERPROFILE
      // at this test's own scratch dir so the smoke suite never touches
      // the developer's real registry file.
      env: { ...process.env, HOME: scratch, USERPROFILE: scratch },
    },
  );

  try {
    await waitForLine(child, (buf) => buf.includes("onboard-agent live on"));

    // No user_message was ever sent on this connection, so the daemon's
    // per-connection turnActive guard must treat the cancel below as a
    // no-op: no crash, no frame, and the connection/daemon stay healthy
    // afterward (verified via /health once the socket closes).
    await new Promise((resolvePromise, rejectPromise) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const timer = setTimeout(() => {
        ws.terminate();
        rejectPromise(new Error("timed out exercising a no-op cancel"));
      }, 5_000);
      ws.on("message", (raw) => {
        const msg = decodeServerMessage(raw.toString());
        if (msg?.type !== "ready") return;
        ws.send(encode({ type: "cancel" }));
        // Give the daemon a moment to (not) misbehave before closing —
        // any crash would surface as the subsequent /health check failing
        // or this process having already exited.
        setTimeout(() => {
          clearTimeout(timer);
          ws.close();
          resolvePromise();
        }, 300);
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        rejectPromise(err);
      });
    });

    assert(
      child.exitCode === null && !child.killed,
      "daemon process must still be running after a no-op cancel",
    );
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) =>
      r.json(),
    );
    assert(
      health.ok === true,
      "daemon should still answer /health after a no-op cancel",
    );
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function checkResumeQueryParamConnectionStaysHealthy() {
  log(
    "daemon process: RFC-034 Phase 4c — a ?resume=<id> connection (target " +
      "obviously nonexistent) still handshakes and leaves the daemon healthy",
  );

  const scratch = mkdtempSync(join(tmpdir(), "fpw-agent-smoke-resume-"));
  const port = 17900 + Math.floor(Math.random() * 200);

  const child = spawn(
    process.execPath,
    [AGENT_BIN, "--cwd", scratch, "--port", String(port)],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      // RFC-035 (Wave 2, FR-6) — the daemon now registers itself in
      // `~/.forgeplan-web/instances.json` on start. Point HOME/USERPROFILE
      // at this test's own scratch dir so the smoke suite never touches
      // the developer's real registry file.
      env: { ...process.env, HOME: scratch, USERPROFILE: scratch },
    },
  );

  try {
    await waitForLine(child, (buf) => buf.includes("onboard-agent live on"));

    // A resume target that cannot possibly exist on this fresh --cwd
    // scratch dir. This exercises parseResumeSessionId reading a REAL `ws`
    // upgrade request URL end-to-end, and the query()-with-resume /
    // retry-fresh wiring in bin/agent.mjs, without depending on an actual
    // live-model turn succeeding (see file header — no live turn here).
    const readyFrame = await new Promise((resolvePromise, rejectPromise) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/?resume=smoke-test-nonexistent-session`,
      );
      const timer = setTimeout(() => {
        ws.terminate();
        rejectPromise(
          new Error(
            "timed out waiting for {type:ready} on a ?resume= connection",
          ),
        );
      }, 5_000);
      ws.on("message", (raw) => {
        clearTimeout(timer);
        const msg = decodeServerMessage(raw.toString());
        ws.close();
        resolvePromise(msg);
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        rejectPromise(err);
      });
    });
    assert(
      readyFrame?.type === "ready",
      "a ?resume= connection should still get the synchronous {type:'ready'} frame",
    );

    // Give the daemon a moment to (not) misbehave in the background before
    // checking /health — same pattern as checkCancelIsNoOpWithoutInFlightTurn.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
    assert(
      child.exitCode === null && !child.killed,
      "daemon process must still be running after a ?resume= connection with a bogus id",
    );
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) =>
      r.json(),
    );
    assert(
      health.ok === true,
      "daemon should still answer /health after a ?resume= connection with a bogus id",
    );
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function checkLazyQueryStartOnProbeOnlyConnection() {
  log(
    "daemon process: bugfix (leaked subprocess) — a connection that never " +
      "sends user_message gets ONLY the ready frame, nothing more",
  );

  const scratch = mkdtempSync(join(tmpdir(), "fpw-agent-smoke-lazy-"));
  const port = 18100 + Math.floor(Math.random() * 200);

  const child = spawn(
    process.execPath,
    [AGENT_BIN, "--cwd", scratch, "--port", String(port)],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      // RFC-035 (Wave 2, FR-6) — the daemon now registers itself in
      // `~/.forgeplan-web/instances.json` on start. Point HOME/USERPROFILE
      // at this test's own scratch dir so the smoke suite never touches
      // the developer's real registry file.
      env: { ...process.env, HOME: scratch, USERPROFILE: scratch },
    },
  );

  try {
    await waitForLine(child, (buf) => buf.includes("onboard-agent live on"));

    // Connect, collect every frame that arrives within a window, then
    // close — no user_message is ever sent. Before the lazy-start bugfix
    // the daemon called startQuery() unconditionally on connect, spawning
    // a `claude` subprocess immediately; that subprocess would eventually
    // push a `system`/`init` message through to a `{type:"session"}`
    // frame, or an `{type:"error"}` frame if the spawn itself failed.
    // Receiving ONLY the synchronous `ready` frame in this window, with no
    // session/error frame ever following, is the black-box signal that no
    // query() was ever started for a connection that never sent a
    // user_message (this script deliberately avoids depending on the
    // ability to actually spawn `claude` — see file header — so it cannot
    // assert subprocess absence directly).
    const frames = await new Promise((resolvePromise, rejectPromise) => {
      const seen = [];
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const timer = setTimeout(() => {
        ws.close();
        resolvePromise(seen);
      }, 500);
      ws.on("message", (raw) => {
        const msg = decodeServerMessage(raw.toString());
        if (msg) seen.push(msg.type);
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        rejectPromise(err);
      });
    });
    assert(
      frames.length === 1 && frames[0] === "ready",
      `a probe-only connection (no user_message sent) should receive ONLY ` +
        `{type:"ready"}, got: ${JSON.stringify(frames)}`,
    );

    assert(
      child.exitCode === null && !child.killed,
      "daemon process must still be running after a probe-only connection closes",
    );
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) =>
      r.json(),
    );
    assert(
      health.ok === true,
      "daemon should still answer /health after a probe-only connection closes",
    );
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
    rmSync(scratch, { recursive: true, force: true });
  }
}

function checkRegistryRoundTrip() {
  log(
    "registry: register/heartbeat/deregister round-trips a row; " +
      "readOtherLiveInstances excludes self and defaults kind to 'web'",
  );

  // RFC-035 (Wave 2, FR-6) — registry.mjs resolves its path from
  // os.homedir(), which reads HOME (POSIX) / USERPROFILE (Windows) at call
  // time. Overriding both here, in-process, for the duration of this one
  // synchronous check keeps the smoke suite from ever touching the
  // developer's real ~/.forgeplan-web/instances.json.
  const scratchHome = mkdtempSync(join(tmpdir(), "fpw-agent-smoke-registry-"));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = scratchHome;
  process.env.USERPROFILE = scratchHome;

  try {
    const port = 19999;
    const selfId = registerAgent({
      port,
      cwd: ROOT,
      protocolVersion: PROTOCOL_VERSION,
    });
    assert(
      selfId === makeAgentId(port),
      "registerAgent should return the agent:host:port id shape",
    );

    const registryFile = join(scratchHome, ".forgeplan-web", "instances.json");
    assert(
      existsSync(registryFile),
      "registerAgent should write ~/.forgeplan-web/instances.json",
    );
    const written = JSON.parse(readFileSync(registryFile, "utf8"));
    const row = written.instances.find((r) => r.id === selfId);
    assert(row?.kind === "agent", "registered row should carry kind:'agent'");
    assert(row?.scope === "agent", "registered row should carry scope:'agent'");
    assert(
      row?.pid === process.pid,
      "registered row pid should be this process",
    );
    assert(
      row?.workspaceRoot === ROOT && row?.projectName !== undefined,
      "registered row should carry workspaceRoot/projectName from cwd",
    );

    // Seed a second, independently-alive row (same live pid as this test
    // process, so isAlive() treats it as live) with NO `kind` field — the
    // shape of a pre-RFC-035 web-instance row — to exercise the "default
    // missing kind to 'web'" fallback.
    const otherRow = {
      id: "web:127.0.0.1:5555",
      host: "127.0.0.1",
      port: 5555,
      pid: process.pid,
      scope: "project",
      workspaceRoot: ROOT,
      projectName: "other-project",
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      webVersion: "0.1.0",
      forgeplanCli: null,
    };
    const before = JSON.parse(readFileSync(registryFile, "utf8"));
    const seededInstances = [...before.instances, otherRow];
    // Reuse the same atomic-write shape the module itself uses (tmp+rename)
    // to seed this row without importing bin/lib/registry.mjs.
    const tmp = `${registryFile}.tmp.seed.${Date.now()}`;
    writeFileSync(
      tmp,
      JSON.stringify({ version: 1, instances: seededInstances }, null, 2) +
        "\n",
    );
    renameSync(tmp, registryFile);

    const others = readOtherLiveInstances(selfId);
    assert(
      !others.some((o) => o.port === port),
      "readOtherLiveInstances should exclude the self row",
    );
    const other = others.find((o) => o.port === 5555);
    assert(
      other?.projectName === "other-project" && other?.kind === "web",
      "readOtherLiveInstances should include the other live row, defaulting kind to 'web'",
    );

    heartbeatAgent(selfId);
    const afterHeartbeat = JSON.parse(readFileSync(registryFile, "utf8"));
    const rowAfterHeartbeat = afterHeartbeat.instances.find(
      (r) => r.id === selfId,
    );
    assert(
      rowAfterHeartbeat &&
        Date.parse(rowAfterHeartbeat.heartbeatAt) >=
          Date.parse(row.heartbeatAt),
      "heartbeatAgent should refresh heartbeatAt",
    );

    deregisterAgent(selfId);
    const afterDeregister = JSON.parse(readFileSync(registryFile, "utf8"));
    assert(
      !afterDeregister.instances.some((r) => r.id === selfId),
      "deregisterAgent should remove the row",
    );

    // heartbeatAgent on an id with no live row and no in-memory
    // last-known-row (a fresh module instance would have none; here we
    // just deregistered, which clears the cache too) must not throw.
    let threw = false;
    try {
      heartbeatAgent(selfId);
    } catch {
      threw = true;
    }
    assert(
      !threw,
      "heartbeatAgent on an unknown id after deregister should be a safe no-op",
    );
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    rmSync(scratchHome, { recursive: true, force: true });
  }
}

async function main() {
  checkProtocolRoundTrip();
  checkProfileDeniesWriteEditBash();
  checkResumeSessionIdParsing();
  checkRegistryRoundTrip();
  await checkMessageQueueAndToolRelay();
  await checkMessageQueueClose();
  await checkDaemonProcess();
  await checkCancelIsNoOpWithoutInFlightTurn();
  await checkResumeQueryParamConnectionStaysHealthy();
  await checkLazyQueryStartOnProbeOnlyConnection();

  if (failed) {
    process.stderr.write("[agent-smoke] FAIL — see above\n");
    process.exit(1);
  }
  log("ALL CHECKS PASS (no live-model turn exercised — see file header)");
}

main().catch((err) => {
  process.stderr.write(`[agent-smoke] unhandled: ${err?.stack ?? err}\n`);
  process.exit(1);
});
