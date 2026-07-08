// RFC-034 (Pillar C, Phase 2) — the versioned WebSocket message schema shared
// by both ends of the onboard-agent bridge: this daemon (agent/bin/agent.mjs)
// and the browser's Tier-1 client (template/src/widgets/map-chat/model/
// agent-client.ts, Phase 3). This is the ONE source of truth for the wire
// shape; bump PROTOCOL_VERSION on any breaking change so the browser can
// detect skew via the `ready` frame and fall back to Tier 0 gracefully.
//
// ClientMsg: { type: "user_message", text, turnId } | { type: "cancel" }
// ServerMsg: { type: "ready", protocolVersion, model, capabilities, otherInstances }
//          | { type: "session", sessionId }
//          | { type: "token", delta, turnId }
//          | { type: "show_on_map", target: { kind, id }, turnId }
//          | { type: "usage", inputTokens, outputTokens, costUsd, turnId }
//          | { type: "done", turnId }
//          | { type: "error", message, fatal, turnId }
//
// RFC-035 (Wave 2, FR-5/FR-6) — `usage` and the `ready` frame's
// `capabilities`/`otherInstances` fields are ADDITIVE (PROTOCOL_VERSION
// bumped 1 -> 2). `capabilities`/`otherInstances` default to `[]` when
// absent so a pre-RFC-035 daemon's `ready` frame still decodes; an
// unrecognised `usage` frame from an older/newer peer already degrades to
// `null` per the general "unknown frame -> drop" contract below.
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
//
// Bugfix #1 (cross-turn frame race, PROTOCOL_VERSION bumped 2 -> 3) — the
// daemon runs ONE persistent Query per connection; a `cancel` interrupts it
// but frames already in flight from the interrupted turn could still land
// after the NEXT `user_message`'s frames start, corrupting the wrong chat
// bubble. Every outgoing per-turn frame (`token`/`usage`/`show_on_map`/
// `done`/`error`) now echoes the `turnId` of the `user_message` that started
// it, so the browser can drop frames whose `turnId` no longer matches the
// turn it is currently rendering. `turnId` is ADDITIVE and OPTIONAL on
// decode — a frame missing it (older daemon, or a `cancel`-triggered
// synthetic `done`) decodes with `turnId: null`, meaning "no correlation
// available"; callers must treat `null` as "cannot verify, accept as-is" for
// backward compatibility rather than dropping it.
//
// Bugfix #6 (error frame fatal/non-fatal discriminant) — `{type:"error"}`
// now carries `fatal: boolean`. `fatal: false` means a single turn failed
// but the connection/session is still usable (the web can show a recoverable
// notice and let the user try again on the SAME connection); `fatal: true`
// means the connection/session itself cannot continue (the web should fall
// back to Tier 0). `decodeServerMessage` defaults `fatal` to `true` when
// absent, so an older daemon's error frame (pre-bugfix-#6, no `fatal` field)
// is conservatively treated as fatal — the same behaviour the web already
// had before this field existed.

export const PROTOCOL_VERSION = 3;

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
    // Bugfix #1 — turnId is additive/optional on decode: a sender on an
    // older protocol (or one that simply omits it) still gets a usable
    // ClientMsg, with turnId: null meaning "no correlation supplied".
    const turnId = typeof parsed.turnId === "string" ? parsed.turnId : null;
    return { type: "user_message", text: parsed.text, turnId };
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
    case "ready": {
      if (
        typeof parsed.protocolVersion !== "number" ||
        typeof parsed.model !== "string"
      ) {
        return null;
      }
      // RFC-035 (Wave 2, FR-5/FR-6) — additive fields. Absent (a pre-Wave-2
      // daemon) defaults to an empty list so the frame still decodes;
      // present-but-malformed entries are dropped rather than failing the
      // whole frame.
      const capabilities = Array.isArray(parsed.capabilities)
        ? parsed.capabilities.filter((c) => typeof c === "string")
        : [];
      const otherInstances = Array.isArray(parsed.otherInstances)
        ? parsed.otherInstances.filter(
            (i) =>
              i &&
              typeof i === "object" &&
              typeof i.projectName === "string" &&
              typeof i.port === "number" &&
              typeof i.kind === "string",
          )
        : [];
      return {
        type: "ready",
        protocolVersion: parsed.protocolVersion,
        model: parsed.model,
        capabilities,
        otherInstances,
      };
    }
    case "session":
      if (typeof parsed.sessionId !== "string") return null;
      return { type: "session", sessionId: parsed.sessionId };
    case "token": {
      if (typeof parsed.delta !== "string") return null;
      const turnId = typeof parsed.turnId === "string" ? parsed.turnId : null;
      return { type: "token", delta: parsed.delta, turnId };
    }
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
      const turnId = typeof parsed.turnId === "string" ? parsed.turnId : null;
      return {
        type: "show_on_map",
        target: { kind: target.kind, id: target.id },
        turnId,
      };
    }
    case "usage": {
      if (
        typeof parsed.inputTokens !== "number" ||
        typeof parsed.outputTokens !== "number" ||
        typeof parsed.costUsd !== "number"
      ) {
        return null;
      }
      const turnId = typeof parsed.turnId === "string" ? parsed.turnId : null;
      return {
        type: "usage",
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        costUsd: parsed.costUsd,
        turnId,
      };
    }
    case "done": {
      const turnId = typeof parsed.turnId === "string" ? parsed.turnId : null;
      return { type: "done", turnId };
    }
    case "error": {
      if (typeof parsed.message !== "string") return null;
      const turnId = typeof parsed.turnId === "string" ? parsed.turnId : null;
      // Bugfix #6 — `fatal` defaults to `true` when absent: an older
      // daemon's error frame (pre-bugfix-#6) predates the discriminant, and
      // treating it as fatal preserves the exact behaviour the web already
      // had before this field existed (full tier0 fallback on any error).
      const fatal = typeof parsed.fatal === "boolean" ? parsed.fatal : true;
      return { type: "error", message: parsed.message, fatal, turnId };
    }
    default:
      return null;
  }
}

/**
 * RFC-035 (Wave 2, FR-5/FR-6) — `capabilities` advertises which additive
 * frame types this daemon build actually emits (e.g. `["usage",
 * "instances"]`) so an older web client feature-detects rather than
 * assuming; `otherInstances` is the FR-6 instance-discovery snapshot taken
 * at connect time (`{ projectName, port, kind }[]`, see agent/lib/registry.mjs
 * #readOtherLiveInstances). Both default to `[]` — a caller that has
 * nothing to report (or predates this RFC) can omit the second argument.
 */
export function readyMessage(
  model,
  { capabilities = [], otherInstances = [] } = {},
) {
  return {
    type: "ready",
    protocolVersion: PROTOCOL_VERSION,
    model,
    capabilities,
    otherInstances,
  };
}

/** RFC-034 Phase 4c — the SDK's own session id for this connection's
 * query(), captured from the `system`/`init` message. Sent once, as soon
 * as it is known (not on the synchronous `ready` frame — see file header). */
export function sessionMessage(sessionId) {
  return { type: "session", sessionId };
}

/** Bugfix #1 — `turnId` echoes the `user_message.turnId` that started the
 * turn this token belongs to; `null`/omitted when the caller has no turn
 * context (kept optional so existing single-arg call sites still work). */
export function tokenMessage(delta, turnId = null) {
  return { type: "token", delta, turnId };
}

export function showOnMapMessage(target, turnId = null) {
  return { type: "show_on_map", target, turnId };
}

/** RFC-035 (Wave 2, FR-5) — forwards the Agent SDK's own `result.usage`
 * (input_tokens/output_tokens) + `result.total_cost_usd` for one completed
 * turn. Sent right before `done` on every `result` message that carries
 * `usage` (see agent/bin/agent.mjs); the web client accumulates these
 * per-session and cumulatively. Bugfix #1 — `turnId` echoes the turn this
 * usage figure belongs to. */
export function usageMessage(
  { inputTokens, outputTokens, costUsd },
  turnId = null,
) {
  return { type: "usage", inputTokens, outputTokens, costUsd, turnId };
}

export function doneMessage(turnId = null) {
  return { type: "done", turnId };
}

/** Bugfix #6 — `fatal` discriminates a recoverable per-turn failure
 * (`fatal: false`, connection/session still usable) from one that ends the
 * connection/session (`fatal: true`, the web should fall back to Tier 0).
 * Bugfix #1 — `turnId` echoes the turn this error belongs to, `null` for a
 * connection-level error with no specific turn in flight. */
export function errorMessage(message, { fatal = true, turnId = null } = {}) {
  return { type: "error", message, fatal, turnId };
}
