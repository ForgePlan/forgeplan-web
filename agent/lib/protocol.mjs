// RFC-034 (Pillar C, Phase 2) — the versioned WebSocket message schema shared
// by both ends of the onboard-agent bridge: this daemon (agent/bin/agent.mjs)
// and the browser's Tier-1 client (template/src/widgets/map-chat/model/
// agent-client.ts, Phase 3). This is the ONE source of truth for the wire
// shape; bump PROTOCOL_VERSION on any breaking change so the browser can
// detect skew via the `ready` frame and fall back to Tier 0 gracefully.
//
// ClientMsg: { type: "user_message", text } | { type: "cancel" }
// ServerMsg: { type: "ready", protocolVersion, model }
//          | { type: "session", sessionId }
//          | { type: "token", delta }
//          | { type: "show_on_map", target: { kind, id } }
//          | { type: "done" }
//          | { type: "error", message }
//
// RFC-034 (Pillar C, Phase 4c) — live-continue: `{type:"session"}` is a
// server-only frame the daemon sends once it captures the Agent SDK's own
// `session_id` (from the `system`/`init` message that starts every query()
// stream — see agent/bin/agent.mjs). It is NOT sent on the initial `ready`
// frame because `ready` fires synchronously on connect, before the SDK
// session has been negotiated. The browser persists this id per chat
// session (chat-store.svelte.ts) so a later visit can ask the daemon to
// RESUME it. Resume is NOT a ClientMsg frame: the client requests it at
// CONNECT time via a `?resume=<sessionId>` query param on the WebSocket
// URL (parsed from the upgrade request in agent/bin/agent.mjs), which
// avoids any first-frame ordering race between a hypothetical `{type:
// "resume"}` frame and the daemon's synchronous `query()` bootstrap.

export const PROTOCOL_VERSION = 1;

export const CAMERA_TARGET_KINDS = ["zone", "node", "flow"];

export function encode(message) {
  return JSON.stringify(message);
}

/**
 * Decodes a raw client-sent string into a ClientMsg. Returns `null` on any
 * malformed JSON or unrecognised shape — callers MUST silently ignore a
 * `null` result (protocol contract: unknown/malformed frames are dropped,
 * never crash the connection).
 */
export function decodeClientMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  if (parsed.type === "user_message") {
    if (typeof parsed.text !== "string") return null;
    return { type: "user_message", text: parsed.text };
  }
  if (parsed.type === "cancel") {
    return { type: "cancel" };
  }
  return null;
}

/**
 * Decodes a raw server-sent string into a ServerMsg. Exposed for the
 * browser client and for this package's own smoke test — the daemon itself
 * only ever encodes (never decodes) ServerMsg frames.
 */
export function decodeServerMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  switch (parsed.type) {
    case "ready":
      if (
        typeof parsed.protocolVersion !== "number" ||
        typeof parsed.model !== "string"
      ) {
        return null;
      }
      return {
        type: "ready",
        protocolVersion: parsed.protocolVersion,
        model: parsed.model,
      };
    case "session":
      if (typeof parsed.sessionId !== "string") return null;
      return { type: "session", sessionId: parsed.sessionId };
    case "token":
      if (typeof parsed.delta !== "string") return null;
      return { type: "token", delta: parsed.delta };
    case "show_on_map": {
      const target = parsed.target;
      if (
        !target ||
        typeof target !== "object" ||
        !CAMERA_TARGET_KINDS.includes(target.kind) ||
        typeof target.id !== "string"
      ) {
        return null;
      }
      return {
        type: "show_on_map",
        target: { kind: target.kind, id: target.id },
      };
    }
    case "done":
      return { type: "done" };
    case "error":
      if (typeof parsed.message !== "string") return null;
      return { type: "error", message: parsed.message };
    default:
      return null;
  }
}

export function readyMessage(model) {
  return { type: "ready", protocolVersion: PROTOCOL_VERSION, model };
}

/** RFC-034 Phase 4c — the SDK's own session id for this connection's
 * query(), captured from the `system`/`init` message. Sent once, as soon
 * as it is known (not on the synchronous `ready` frame — see file header). */
export function sessionMessage(sessionId) {
  return { type: "session", sessionId };
}

export function tokenMessage(delta) {
  return { type: "token", delta };
}

export function showOnMapMessage(target) {
  return { type: "show_on_map", target };
}

export function doneMessage() {
  return { type: "done" };
}

export function errorMessage(message) {
  return { type: "error", message };
}
