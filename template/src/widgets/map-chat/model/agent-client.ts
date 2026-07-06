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

// Mirrors the daemon's lib/protocol.mjs wire schema (RFC-034 Function
// Signatures/Contracts) — one source of truth split across two packages.
type ServerMsg =
  | { type: "ready"; protocolVersion?: number; model?: string }
  | { type: "session"; sessionId: string }
  | { type: "token"; delta: string }
  | { type: "show_on_map"; target: CameraTarget }
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

/** Parses one WS text frame as a `ServerMsg`. Unknown `type`s and
 * malformed JSON both degrade to `null` rather than throwing — a future
 * daemon protocol bump must not crash an older web build. */
function parseServerMsg(raw: unknown): ServerMsg | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isServerMsgShape(parsed)) return null;
    switch (parsed.type) {
      case "ready":
      case "session":
      case "token":
      case "show_on_map":
      case "done":
      case "error":
        return parsed as ServerMsg;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Briefly opens the daemon's WebSocket and resolves once a `ready` frame
 * arrives, the socket errors/closes, or `PROBE_TIMEOUT_MS` elapses —
 * whichever comes first. Always closes the probe socket itself before
 * resolving. Never throws; an environment with no global `WebSocket`
 * (e.g. SSR) resolves `{ up: false }` immediately without attempting a
 * connection.
 */
export function probeDaemon(port: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    if (typeof WebSocket === "undefined") {
      resolve({ up: false });
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(daemonUrl(port));
    } catch {
      resolve({ up: false });
      return;
    }

    let settled = false;
    const finish = (result: ProbeResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("close", onClose);
      try {
        socket.close();
      } catch {
        // Already closed/closing — nothing left to clean up.
      }
      resolve(result);
    };

    const onMessage = (event: MessageEvent): void => {
      const msg = parseServerMsg(event.data);
      if (msg?.type === "ready") finish({ up: true, model: msg.model });
    };
    const onError = (): void => finish({ up: false });
    const onClose = (): void => finish({ up: false });
    const timer = setTimeout(() => finish({ up: false }), PROBE_TIMEOUT_MS);

    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
    socket.addEventListener("close", onClose);
  });
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
