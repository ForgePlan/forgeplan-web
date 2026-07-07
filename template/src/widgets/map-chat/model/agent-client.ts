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
type ServerMsg =
  | {
      type: "ready";
      protocolVersion?: number;
      model?: string;
      capabilities: string[];
      otherInstances: OtherAgentInstance[];
    }
  | { type: "session"; sessionId: string }
  | { type: "token"; delta: string }
  | { type: "show_on_map"; target: CameraTarget }
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }
  | { type: "done" }
  | { type: "error"; message: string };

type ClientMsg = { type: "user_message"; text: string } | { type: "cancel" };

export interface ProbeResult {
  up: boolean;
  model?: string;
}

export interface AgentHandlers {
  onToken(delta: string): void;
  onShowOnMap(target: CameraTarget): void;
  onDone(): void;
  onError(message: string): void;
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
  onUsage?(usage: UsageDelta): void;
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
  send(text: string): void;
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

/** Parses one WS text frame as a `ServerMsg`. Unknown `type`s and
 * malformed JSON both degrade to `null` rather than throwing — a future
 * daemon protocol bump must not crash an older web build. */
function parseServerMsg(raw: unknown): ServerMsg | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isServerMsgShape(parsed)) return null;
    const p = parsed as Record<string, unknown>;
    switch (parsed.type) {
      case "ready":
        return normalizeReady(p);
      case "session":
      case "token":
      case "show_on_map":
      case "done":
      case "error":
        return parsed as ServerMsg;
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
      const json = (await res.json()) as { ok?: unknown; model?: unknown };
      return {
        up: json.ok === true,
        model: typeof json.model === "string" ? json.model : undefined,
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
        handlers.onToken(msg.delta);
        return;
      case "show_on_map":
        handlers.onShowOnMap(msg.target);
        return;
      case "usage":
        handlers.onUsage?.({
          inputTokens: msg.inputTokens,
          outputTokens: msg.outputTokens,
          costUsd: msg.costUsd,
        });
        return;
      case "done":
        handlers.onDone();
        return;
      case "error":
        handlers.onError(msg.message);
        return;
    }
  });
  socket.addEventListener("error", () => {
    if (!closedByCaller) {
      handlers.onError("Connection to the live agent failed.");
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
    send(text: string): void {
      dispatch({ type: "user_message", text });
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
