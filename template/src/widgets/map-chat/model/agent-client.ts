// RFC-034 (Pillar C, Phase 3b) — read-only WebSocket client for the
// onboarding daemon (@forgeplan/web-agent). The browser talks to
// ws://127.0.0.1:<port> DIRECTLY — never through /api/* (rule 22: the
// SvelteKit server is a read-only mirror and structurally cannot proxy
// this). Every export here is defensive by contract: a missing daemon, a
// dropped connection, or an unparseable frame degrades to a callback (or
// a resolved `{ up: false }`), never a thrown exception — chat-store's
// Tier 1 must be able to fail silently back to Tier 0.

import type { CameraTarget } from "@/widgets/composed-map/model/camera-bus.svelte";

const PROBE_TIMEOUT_MS = 1500;

/** RFC-035 (Wave 2, FR-6) — one entry in the `ready` frame's
 * instance-discovery snapshot (agent/lib/registry.mjs#readOtherLiveInstances).
 * `kind` stays a plain `string` (not a union) so a future registry row kind
 * decodes without a web-side release — same forward-compat stance as the
 * rest of this file's frame parsing. */
export interface OtherAgentInstance {
  projectName: string;
  port: number;
  kind: string;
}

/** RFC-035 (Wave 2, FR-5) — one turn's token/cost delta, forwarded verbatim
 * from the Agent SDK's own `result.usage` + `result.total_cost_usd` via the
 * daemon's `usage` frame. Callers accumulate across turns themselves. */
export interface UsageDelta {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// Mirrors the daemon's lib/protocol.mjs wire schema (RFC-034 Function
// Signatures/Contracts) — one source of truth split across two packages.
// RFC-035 (Wave 2) added `usage` and the `ready` frame's `capabilities`/
// `otherInstances` fields, additively (PROTOCOL_VERSION 1 -> 2).
//
// Bugfix #1 (cross-turn frame race, PROTOCOL_VERSION 2 -> 3) — every
// per-turn frame (`token`/`show_on_map`/`usage`/`done`/`error`) now echoes
// the `turnId` of the `user_message` that started it; `null` means "no
// correlation available" (older daemon, or a `cancel`-triggered synthetic
// `done`) and callers must accept it as-is per agent/lib/protocol.mjs's
// header. Bugfix #6 — `error` also carries `fatal: boolean`, discriminating
// a recoverable per-turn failure from one that ends the connection/session.
type ServerMsg =
  | {
      type: "ready";
      protocolVersion?: number;
      model?: string;
      capabilities: string[];
      otherInstances: OtherAgentInstance[];
    }
  | { type: "session"; sessionId: string }
  | { type: "token"; delta: string; turnId: string | null }
  | { type: "show_on_map"; target: CameraTarget; turnId: string | null }
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      turnId: string | null;
    }
  | { type: "done"; turnId: string | null }
  | { type: "error"; message: string; fatal: boolean; turnId: string | null };

/** Bugfix #1 — the client always tags its `user_message` with the turnId
 * the caller (chat-store) generated for this turn, so the daemon can echo
 * it back on every frame that turn produces. */
type ClientMsg =
  | { type: "user_message"; text: string; turnId: string }
  | { type: "cancel" };

/** RFC-035 (Wave 2 follow-up) — `/health` now mirrors the same
 * `capabilities`/`otherInstances` the `ready` frame advertises (see
 * agent/bin/agent.mjs's `GET /health` handler), so the Info tab's "Other
 * projects" row (and model) can populate from the probe alone — before any
 * WebSocket connects. Both optional so a pre-follow-up daemon's `/health`
 * (still just `{ ok, protocolVersion, model }`) keeps parsing unchanged. */
export interface ProbeResult {
  up: boolean;
  model?: string;
  capabilities?: string[];
  otherInstances?: OtherAgentInstance[];
}

export interface AgentHandlers {
  /** Bugfix #1 — `turnId` echoes the `user_message.turnId` that started the
   * turn this frame belongs to; `null` when the daemon supplied none
   * (older build, or a cancel-triggered synthetic frame). The caller
   * (chat-store) is responsible for dropping frames whose `turnId` no
   * longer matches the turn it is currently rendering — this client
   * forwards every frame uninterpreted. */
  onToken(delta: string, turnId: string | null): void;
  onShowOnMap(target: CameraTarget, turnId: string | null): void;
  onDone(turnId: string | null): void;
  /** Bugfix #6 — `fatal` discriminates a recoverable per-turn failure
   * (connection/session still usable) from one that ends the connection/
   * session (the caller should fall back to Tier 0). */
  onError(message: string, fatal: boolean, turnId: string | null): void;
  onClose(): void;
  /** RFC-034 Phase 4c (live-continue) — fires once the daemon captures the
   * Agent SDK's own session id for this connection (from its `system`/
   * `init` message). Optional so existing callers/mocks built before this
   * phase keep compiling unchanged. */
  onSession?(sessionId: string): void;
  /** RFC-035 (Wave 2, FR-5) — fires on each daemon `usage` frame (one per
   * completed turn) with that turn's own delta; the caller accumulates
   * across turns (chat-store keeps session + cumulative totals). Optional
   * so pre-Wave-2 callers/mocks keep compiling unchanged. */
  onUsage?(usage: UsageDelta, turnId: string | null): void;
  /** RFC-035 (Wave 2, FR-6) — fires once per connection with the `ready`
   * frame's additive fields: which optional frame types this daemon build
   * emits, and the instance-discovery snapshot taken at connect time.
   * Optional, same reasoning as onUsage/onSession. */
  onReadyMeta?(meta: {
    capabilities: string[];
    otherInstances: OtherAgentInstance[];
  }): void;
}

export interface ConnectOptions {
  /** RFC-034 Phase 4c (live-continue) — when set, asks the daemon to
   * `resume` this Agent SDK session id instead of starting a fresh one.
   * Threaded onto the WS URL as `?resume=<id>` (read at connect time by
   * agent/bin/agent.mjs) rather than a WS frame — see lib/protocol.mjs's
   * header for why. */
  resumeSessionId?: string;
}

export interface AgentConnection {
  /** Bugfix #1 — `turnId` is threaded onto the outgoing `user_message` so
   * every frame the daemon emits for this turn echoes it back, letting the
   * caller correlate/drop stale-turn frames. */
  send(text: string, turnId: string): void;
  cancel(): void;
  close(): void;
}

function daemonUrl(port: number, resumeSessionId?: string): string {
  const base = `ws://127.0.0.1:${port}`;
  return resumeSessionId
    ? `${base}/?resume=${encodeURIComponent(resumeSessionId)}`
    : base;
}

function isServerMsgShape(value: unknown): value is { type: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** RFC-035 (Wave 2, FR-6) — narrows one `otherInstances` array entry; a
 * malformed entry is dropped rather than failing the whole `ready` frame
 * (mirrors agent/lib/protocol.mjs#decodeServerMessage's own leniency). */
function isOtherAgentInstance(value: unknown): value is OtherAgentInstance {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.projectName === "string" &&
    typeof v.port === "number" &&
    typeof v.kind === "string"
  );
}

/** RFC-035 (Wave 2, FR-6) — normalizes a `ready` frame's additive fields.
 * Absent (a pre-Wave-2 daemon) defaults to `[]` so the frame still decodes;
 * present-but-malformed entries are dropped rather than failing the whole
 * frame — same contract as agent/lib/protocol.mjs's own `decodeServerMessage`. */
function normalizeReady(parsed: Record<string, unknown>): ServerMsg {
  const capabilities = Array.isArray(parsed.capabilities)
    ? parsed.capabilities.filter((c): c is string => typeof c === "string")
    : [];
  const otherInstances = Array.isArray(parsed.otherInstances)
    ? parsed.otherInstances.filter(isOtherAgentInstance)
    : [];
  return {
    type: "ready",
    protocolVersion:
      typeof parsed.protocolVersion === "number"
        ? parsed.protocolVersion
        : undefined,
    model: typeof parsed.model === "string" ? parsed.model : undefined,
    capabilities,
    otherInstances,
  };
}

/** Bugfix #1 — extracts a frame's `turnId`, defaulting to `null` when
 * absent/malformed (older daemon, or a cancel-triggered synthetic frame) —
 * mirrors agent/lib/protocol.mjs#decodeServerMessage's own leniency. */
function turnIdOf(p: Record<string, unknown>): string | null {
  return typeof p.turnId === "string" ? p.turnId : null;
}

/** Parses one WS text frame as a `ServerMsg`. Unknown `type`s and
 * malformed JSON both degrade to `null` rather than throwing — a future
 * daemon protocol bump must not crash an older web build. */
function parseServerMsg(raw: unknown): ServerMsg | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isServerMsgShape(parsed)) return null;
    const p = parsed as Record<string, unknown>;
    const turnId = turnIdOf(p);
    switch (parsed.type) {
      case "ready":
        return normalizeReady(p);
      case "session":
        return parsed as ServerMsg;
      case "token":
        return { ...(parsed as { type: "token"; delta: string }), turnId };
      case "show_on_map":
        return {
          ...(parsed as { type: "show_on_map"; target: CameraTarget }),
          turnId,
        };
      case "done":
        return { type: "done", turnId };
      case "error":
        // Bugfix #6 — `fatal` defaults to `true` when absent: an older
        // daemon's error frame predates the discriminant, and treating it
        // as fatal preserves the exact behaviour the web already had
        // before this field existed (full tier0 fallback on any error).
        // `message` is read off `p` (already `Record<string, unknown>`)
        // rather than cast through `parsed` — `{ type: string }` and
        // `{ message: string }` share no property, so TS correctly flags
        // that cast as an unsound conversion (neither type overlaps the
        // other); validating the field's runtime type instead avoids the
        // cast entirely.
        return {
          type: "error",
          message: typeof p.message === "string" ? p.message : "",
          fatal: typeof p.fatal === "boolean" ? p.fatal : true,
          turnId,
        };
      case "usage":
        if (
          typeof p.inputTokens !== "number" ||
          typeof p.outputTokens !== "number" ||
          typeof p.costUsd !== "number"
        ) {
          return null;
        }
        return {
          type: "usage",
          inputTokens: p.inputTokens,
          outputTokens: p.outputTokens,
          costUsd: p.costUsd,
          turnId,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Probes the daemon's `GET /health` endpoint with a short-timeout `fetch`.
 * A plain fetch has no socket lifecycle to manage, so it is safe to poll on
 * `chat-store`'s `PROBE_INTERVAL_MS` interval (unlike opening a fresh
 * WebSocket per tick, which used to spawn a `claude` subprocess on the
 * daemon for every probe — see agent/bin/agent.mjs's file header for the
 * daemon-side rationale for exposing both `/health` and the per-connection
 * `{type:"ready"}` frame). Resolves `{ up: false }` on ANY failure — a
 * missing global `fetch`/`AbortController` (e.g. SSR), a network-level
 * rejection, a non-2xx response, or unparsable JSON — never throws.
 */
export function probeDaemon(port: number): Promise<ProbeResult> {
  if (typeof fetch === "undefined" || typeof AbortController === "undefined") {
    return Promise.resolve({ up: false });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  return fetch(`http://127.0.0.1:${port}/health`, {
    signal: controller.signal,
    headers: { accept: "application/json" },
  })
    .then(async (res) => {
      if (!res.ok) return { up: false };
      const json = (await res.json()) as {
        ok?: unknown;
        model?: unknown;
        capabilities?: unknown;
        otherInstances?: unknown;
      };
      // RFC-035 (Wave 2 follow-up) — same leniency as normalizeReady: a
      // malformed/absent field never fails the whole probe, it just drops
      // to an empty list so the Info tab shows "just this one" instead of
      // throwing.
      const capabilities = Array.isArray(json.capabilities)
        ? json.capabilities.filter((c): c is string => typeof c === "string")
        : [];
      const otherInstances = Array.isArray(json.otherInstances)
        ? json.otherInstances.filter(isOtherAgentInstance)
        : [];
      return {
        up: json.ok === true,
        model: typeof json.model === "string" ? json.model : undefined,
        capabilities,
        otherInstances,
      };
    })
    .catch((): ProbeResult => ({ up: false }))
    .finally(() => clearTimeout(timer));
}

/**
 * Opens a persistent WebSocket session to the daemon and routes every
 * frame to `handlers`. Returns immediately without waiting for `ready` —
 * a daemon that never answers surfaces through `onError`/`onClose`, the
 * same path a daemon that answers and later drops takes. Any `send`/
 * `cancel` issued before the socket reaches `OPEN` is buffered and
 * flushed, in order, once the `open` event fires, so a caller that calls
 * `send` synchronously right after `connectAgent` returns never loses the
 * frame. Never throws; a missing global `WebSocket` degrades to a no-op
 * connection plus an async `onClose` so the caller's fallback path runs
 * uniformly either way.
 */
export function connectAgent(
  port: number,
  handlers: AgentHandlers,
  options?: ConnectOptions,
): AgentConnection {
  const noop = (): void => {};

  if (typeof WebSocket === "undefined") {
    queueMicrotask(() => handlers.onClose());
    return { send: noop, cancel: noop, close: noop };
  }

  let socket: WebSocket;
  try {
    socket = new WebSocket(daemonUrl(port, options?.resumeSessionId));
  } catch {
    queueMicrotask(() => handlers.onClose());
    return { send: noop, cancel: noop, close: noop };
  }

  let closedByCaller = false;
  const pending: ClientMsg[] = [];
  const dispatch = (payload: ClientMsg): void => {
    if (socket.readyState !== WebSocket.OPEN) {
      pending.push(payload);
      return;
    }
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      // Dropped between the readyState check and send — the close/error
      // event already in flight will notify the caller.
    }
  };

  socket.addEventListener("message", (event: MessageEvent) => {
    const msg = parseServerMsg(event.data);
    if (!msg) return;
    switch (msg.type) {
      case "ready":
        handlers.onReadyMeta?.({
          capabilities: msg.capabilities,
          otherInstances: msg.otherInstances,
        });
        return;
      case "session":
        handlers.onSession?.(msg.sessionId);
        return;
      case "token":
        handlers.onToken(msg.delta, msg.turnId);
        return;
      case "show_on_map":
        handlers.onShowOnMap(msg.target, msg.turnId);
        return;
      case "usage":
        handlers.onUsage?.(
          {
            inputTokens: msg.inputTokens,
            outputTokens: msg.outputTokens,
            costUsd: msg.costUsd,
          },
          msg.turnId,
        );
        return;
      case "done":
        handlers.onDone(msg.turnId);
        return;
      case "error":
        handlers.onError(msg.message, msg.fatal, msg.turnId);
        return;
    }
  });
  socket.addEventListener("error", () => {
    if (!closedByCaller) {
      // Connection-level failure, not a per-turn daemon frame — always
      // fatal (the socket itself is gone) and has no turn to correlate.
      handlers.onError("Connection to the live agent failed.", true, null);
    }
  });
  socket.addEventListener("close", () => {
    if (!closedByCaller) handlers.onClose();
  });
  socket.addEventListener("open", () => {
    if (closedByCaller) return;
    const queued = pending.splice(0, pending.length);
    for (const payload of queued) {
      try {
        socket.send(JSON.stringify(payload));
      } catch {
        // Dropped mid-flush — the close/error event already in flight
        // will notify the caller.
      }
    }
  });

  return {
    send(text: string, turnId: string): void {
      dispatch({ type: "user_message", text, turnId });
    },
    cancel(): void {
      dispatch({ type: "cancel" });
    },
    close(): void {
      closedByCaller = true;
      try {
        socket.close();
      } catch {
        // Already closed/closing.
      }
    },
  };
}
