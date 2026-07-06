import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { probeDaemon, connectAgent, type AgentHandlers } from "./agent-client";
import type { CameraTarget } from "@/widgets/composed-map/model/camera-bus.svelte";

// RFC-034 Test Strategy Hooks — probe up/down; token stream assembles;
// `show_on_map` frame -> `onShowOnMap`; close -> `onClose`. A hand-rolled
// mock WebSocket stands in for the real thing: it records what was sent
// and lets a test fire `message`/`error`/`close` events on demand.

const OPEN = 1;
const CLOSED = 3;

class MockSocket {
  static CONNECTING = 0;
  static OPEN = OPEN;
  static CLOSING = 2;
  static CLOSED = CLOSED;

  readyState = MockSocket.CONNECTING;
  url: string;
  sent: string[] = [];
  closed = false;
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }

  addEventListener(type: string, cb: (event: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  removeEventListener(type: string, cb: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(cb);
  }

  send(data: string): void {
    if (this.readyState !== OPEN) throw new Error("socket not open");
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = CLOSED;
  }

  /** Test helper: simulate the socket reaching OPEN. */
  open(): void {
    this.readyState = OPEN;
  }

  /** Test helper: fire a listener as the real WebSocket would. */
  emit(type: string, event: unknown = {}): void {
    for (const cb of this.listeners.get(type) ?? []) cb(event);
  }

  emitMessage(payload: unknown): void {
    this.emit("message", { data: JSON.stringify(payload) });
  }
}

let instances: MockSocket[] = [];

function lastSocket(): MockSocket {
  const socket = instances[instances.length - 1];
  expect(socket).toBeDefined();
  return socket!;
}

beforeEach(() => {
  instances = [];
  vi.stubGlobal("WebSocket", MockSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probeDaemon", () => {
  // RFC-034 Phase 4b: probeDaemon fetches GET /health instead of opening a
  // probe WebSocket (a WS connect/error cycle logs a loud "connection
  // refused" to the console on every poll while the daemon is down; a
  // caught fetch rejection is quieter). Mocks `fetch`, not `WebSocket`.
  function jsonResponse(body: unknown, ok = true): Response {
    return {
      ok,
      json: () => Promise.resolve(body),
    } as unknown as Response;
  }

  it("resolves up:true with the model when /health responds ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ ok: true, protocolVersion: 1, model: "claude-x" }),
        ),
    );
    await expect(probeDaemon(7431)).resolves.toEqual({
      up: true,
      model: "claude-x",
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7431/health",
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("resolves up:false on a non-2xx HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));
    await expect(probeDaemon(7431)).resolves.toEqual({ up: false });
  });

  it("resolves up:false when the body's ok field is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: false })),
    );
    await expect(probeDaemon(7431)).resolves.toEqual({ up: false });
  });

  it("resolves up:false on a network error instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("refused")));
    await expect(probeDaemon(7431)).resolves.toEqual({ up: false });
  });

  it("resolves up:false on an unparseable JSON body instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("bad json")),
      } as unknown as Response),
    );
    await expect(probeDaemon(7431)).resolves.toEqual({ up: false });
  });

  it("resolves up:false immediately with no global fetch (SSR)", async () => {
    vi.stubGlobal("fetch", undefined);
    await expect(probeDaemon(7431)).resolves.toEqual({ up: false });
  });
});

function handlers(): AgentHandlers &
  Record<keyof AgentHandlers, ReturnType<typeof vi.fn>> {
  return {
    onToken: vi.fn<(delta: string) => void>(),
    onShowOnMap: vi.fn<(target: CameraTarget) => void>(),
    onDone: vi.fn<() => void>(),
    onError: vi.fn<(message: string) => void>(),
    onClose: vi.fn<() => void>(),
    onSession: vi.fn<(sessionId: string) => void>(),
  };
}

describe("connectAgent", () => {
  it("assembles a token stream by forwarding each delta in order", () => {
    const h = handlers();
    connectAgent(7431, h);
    const socket = lastSocket();
    socket.emitMessage({ type: "token", delta: "Hel" });
    socket.emitMessage({ type: "token", delta: "lo" });
    expect(h.onToken.mock.calls).toEqual([["Hel"], ["lo"]]);
  });

  it("routes a show_on_map frame to onShowOnMap", () => {
    const h = handlers();
    connectAgent(7431, h);
    const socket = lastSocket();
    const target = { kind: "zone" as const, id: "z.a" };
    socket.emitMessage({ type: "show_on_map", target });
    expect(h.onShowOnMap).toHaveBeenCalledWith(target);
  });

  it("routes a done frame to onDone", () => {
    const h = handlers();
    connectAgent(7431, h);
    lastSocket().emitMessage({ type: "done" });
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it("routes an error frame to onError with the message", () => {
    const h = handlers();
    connectAgent(7431, h);
    lastSocket().emitMessage({ type: "error", message: "boom" });
    expect(h.onError).toHaveBeenCalledWith("boom");
  });

  it("routes an unsolicited close to onClose", () => {
    const h = handlers();
    connectAgent(7431, h);
    lastSocket().emit("close");
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose again when the caller itself closes the connection", () => {
    const h = handlers();
    const conn = connectAgent(7431, h);
    const socket = lastSocket();
    conn.close();
    // The real WebSocket fires its own close event once the underlying
    // socket actually terminates -- simulate that arriving after close().
    socket.emit("close");
    expect(h.onClose).not.toHaveBeenCalled();
  });

  it("sends a user_message frame only once the socket is open", () => {
    const h = handlers();
    const conn = connectAgent(7431, h);
    const socket = lastSocket();
    conn.send("hello");
    expect(socket.sent).toEqual([]);
    socket.open();
    conn.send("hello again");
    expect(socket.sent).toEqual([
      JSON.stringify({ type: "user_message", text: "hello again" }),
    ]);
  });

  it("buffers sends issued before the socket opens and flushes them, in order, once open fires", () => {
    const h = handlers();
    const conn = connectAgent(7431, h);
    const socket = lastSocket();
    // Simulates chat-store's Tier-1 send: connectAgent() + conn.send()
    // called synchronously, before the socket has left CONNECTING.
    conn.send("first");
    conn.send("second");
    expect(socket.sent).toEqual([]);
    socket.open();
    socket.emit("open");
    expect(socket.sent).toEqual([
      JSON.stringify({ type: "user_message", text: "first" }),
      JSON.stringify({ type: "user_message", text: "second" }),
    ]);
  });

  it("still delivers a send issued after the socket is already open immediately", () => {
    const h = handlers();
    const conn = connectAgent(7431, h);
    const socket = lastSocket();
    socket.open();
    socket.emit("open");
    conn.send("hello");
    expect(socket.sent).toEqual([
      JSON.stringify({ type: "user_message", text: "hello" }),
    ]);
  });

  it("sends a cancel frame", () => {
    const h = handlers();
    const conn = connectAgent(7431, h);
    const socket = lastSocket();
    socket.open();
    conn.cancel();
    expect(socket.sent).toEqual([JSON.stringify({ type: "cancel" })]);
  });

  it("ignores malformed frames instead of throwing", () => {
    const h = handlers();
    connectAgent(7431, h);
    const socket = lastSocket();
    expect(() => socket.emit("message", { data: "{not json" })).not.toThrow();
    expect(h.onToken).not.toHaveBeenCalled();
  });

  it("degrades to a no-op connection plus an async onClose with no global WebSocket", async () => {
    vi.stubGlobal("WebSocket", undefined);
    const h = handlers();
    const conn = connectAgent(7431, h);
    expect(() => conn.send("x")).not.toThrow();
    expect(() => conn.cancel()).not.toThrow();
    expect(() => conn.close()).not.toThrow();
    // The degraded connection reports via a queued microtask, not a timer
    // -- flush microtasks directly rather than reaching for a real-timer
    // poll (vi.waitFor) while fake timers are active in this suite.
    await Promise.resolve();
    await Promise.resolve();
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });
});
