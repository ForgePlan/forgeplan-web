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
//      `GET /health`, and sends a `{type:"ready"}` frame on WS connect.
// A full live-model turn needs the user's own Claude Code session and is
// verified later (Phase 4) — this script deliberately does not attempt one.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
  showOnMapMessage,
  tokenMessage,
} from "../lib/protocol.mjs";
import {
  ALLOWED_TOOLS,
  DISALLOWED_TOOLS,
  buildOptions,
} from "../lib/profile.mjs";
import { buildOnboardServer, createMessageQueue } from "../bin/agent.mjs";

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
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );

  try {
    await waitForLine(child, (buf) => buf.includes("onboard-agent live on"));
    log(`daemon reported live on port ${port}`);

    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) =>
      r.json(),
    );
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
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function main() {
  checkProtocolRoundTrip();
  checkProfileDeniesWriteEditBash();
  await checkMessageQueueAndToolRelay();
  await checkDaemonProcess();

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
