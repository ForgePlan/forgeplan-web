import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  send,
  cancelCurrent,
  getMessages,
  getModel,
  getTier,
  isPending,
  checkDaemon,
  resetChat,
} from "./chat-store.svelte";
import {
  currentCameraRequest,
  clearCameraTarget,
} from "@/widgets/composed-map/model/camera-bus.svelte";
import { probeDaemon, connectAgent, type AgentHandlers } from "./agent-client";

// onboard-agent phase 1 (AI-only) — send() answers ONLY through the live
// daemon (Tier 1); there is no client-side fallback answerer any more.
// Module-level state (messages/tier here, the camera request in
// camera-bus) persists across tests in this file — reset both before
// every test, mirroring camera-bus.test.ts's own isolation.
//
// agent-client is mocked file-wide: the offline describe block below never
// calls checkDaemon, so the mock is inert for it; the "tier1" block
// reassigns probeDaemon/connectAgent per test to drive the store's
// live-agent branch deterministically, without a real socket.
vi.mock("./agent-client", () => ({
  probeDaemon: vi.fn(),
  connectAgent: vi.fn(),
}));

beforeEach(() => {
  resetChat();
  clearCameraTarget();
  vi.mocked(probeDaemon).mockReset();
  vi.mocked(connectAgent).mockReset();
});

describe("chat-store — send (offline)", () => {
  it("is a no-op while offline (tier0) — no messages are pushed", () => {
    send("Tell me about CLI Surfaces");
    expect(getMessages()).toEqual([]);
  });

  it("does not move the camera while offline", () => {
    const before = currentCameraRequest().seq;
    send("Tell me about CLI Surfaces");
    expect(currentCameraRequest().seq).toBe(before);
  });

  it("ignores a blank/whitespace-only question while offline too", () => {
    send("   ");
    expect(getMessages()).toEqual([]);
  });
});

describe("chat-store — tier", () => {
  it("defaults to tier0", () => {
    expect(getTier()).toBe("tier0");
  });
});

describe("chat-store — resetChat", () => {
  it("clears the transcript and restores the default tier", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    vi.mocked(connectAgent).mockReturnValue({
      send: vi.fn(),
      cancel: vi.fn(),
      close: vi.fn(),
    });

    send("Tell me about CLI Surfaces");
    expect(getMessages().length).toBeGreaterThan(0);
    resetChat();
    expect(getMessages()).toEqual([]);
    expect(getTier()).toBe("tier0");
  });
});

// onboard-agent phase 1 Test Strategy Hooks — checkDaemon upgrades the tier
// on a successful probe; send() in tier1 streams tokens into the assistant
// message via a mocked agent-client and drives camera-bus via
// onShowOnMap; onError/onClose fall back to tier0 (offline) gracefully.
describe("chat-store — tier1", () => {
  function mockConnection() {
    const conn = { send: vi.fn(), cancel: vi.fn(), close: vi.fn() };
    let handlers: AgentHandlers | undefined;
    vi.mocked(connectAgent).mockImplementation((_port, h) => {
      handlers = h;
      return conn;
    });
    return {
      conn,
      handlers: () => {
        expect(handlers).toBeDefined();
        return handlers!;
      },
    };
  }

  it("upgrades to tier1 and records the model once the daemon probe succeeds", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    expect(getTier()).toBe("tier1");
    expect(getModel()).toBe("claude-mock");
  });

  it("stays on tier0 when the probe reports the daemon down", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({ up: false });
    await checkDaemon(7431);
    expect(getTier()).toBe("tier0");
    expect(getModel()).toBeNull();
  });

  it("pushes a user message and streams tokens into a progressively-updated assistant message", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers } = mockConnection();

    send("Where does artifact recording live?");
    expect(getMessages()).toEqual([
      { role: "user", text: "Where does artifact recording live?" },
      { role: "assistant", text: "" },
    ]);
    expect(isPending()).toBe(true);

    handlers().onToken("Arti");
    handlers().onToken("facts live in .forgeplan/");
    expect(getMessages()[1]).toEqual({
      role: "assistant",
      text: "Artifacts live in .forgeplan/",
    });

    handlers().onDone();
    expect(isPending()).toBe(false);
  });

  it("relays a show_on_map call to camera-bus during a tier1 answer", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers } = mockConnection();

    const before = currentCameraRequest().seq;
    send("Where does artifact recording live?");
    handlers().onShowOnMap({ kind: "zone", id: "z.a" });

    const after = currentCameraRequest();
    expect(after.seq).toBe(before + 1);
    expect(after.target).toEqual({ kind: "zone", id: "z.a" });
  });

  it("ignores a second send while a tier1 answer is still pending", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { conn } = mockConnection();

    send("First question");
    send("Second question");
    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(getMessages()).toHaveLength(2);
  });

  it("falls back to tier0 and surfaces the message on onError", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers } = mockConnection();

    send("Where does artifact recording live?");
    handlers().onError("daemon crashed");

    expect(getTier()).toBe("tier0");
    expect(getModel()).toBeNull();
    expect(isPending()).toBe(false);
    expect(getMessages()[1]).toEqual({
      role: "assistant",
      text: "daemon crashed",
    });
  });

  it("falls back to tier0 and drops the empty placeholder on an unsolicited close", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers } = mockConnection();

    send("Where does artifact recording live?");
    handlers().onClose();

    expect(getTier()).toBe("tier0");
    // No tokens ever arrived — the dangling empty assistant bubble is
    // dropped rather than left in the transcript.
    expect(getMessages()).toEqual([
      { role: "user", text: "Where does artifact recording live?" },
    ]);
  });

  it("keeps a partial answer intact when the connection drops mid-stream", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers } = mockConnection();

    send("Where does artifact recording live?");
    handlers().onToken("Partial answer");
    handlers().onClose();

    expect(getTier()).toBe("tier0");
    expect(getMessages()[1]).toEqual({
      role: "assistant",
      text: "Partial answer",
    });
  });
});

// Phase 4a — cancel/stop: cancelCurrent() lets the user stop a streaming
// Tier-1 answer mid-flight. It must relay the cancel to the daemon (via
// AgentConnection#cancel), clear pending immediately (no waiting on any
// daemon response), keep whatever partial text already streamed in, and
// leave the connection/tier untouched so the next question reuses the
// same live session.
describe("chat-store — cancelCurrent", () => {
  function mockConnection() {
    const conn = { send: vi.fn(), cancel: vi.fn(), close: vi.fn() };
    let handlers: AgentHandlers | undefined;
    vi.mocked(connectAgent).mockImplementation((_port, h) => {
      handlers = h;
      return conn;
    });
    return {
      conn,
      handlers: () => {
        expect(handlers).toBeDefined();
        return handlers!;
      },
    };
  }

  it("is a no-op when nothing is pending — never throws with no active connection", () => {
    expect(() => cancelCurrent()).not.toThrow();
    expect(getMessages()).toEqual([]);
    expect(isPending()).toBe(false);
  });

  it("calls connection.cancel() and clears pending so Send re-enables", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { conn } = mockConnection();

    send("Where does artifact recording live?");
    expect(isPending()).toBe(true);

    cancelCurrent();

    expect(conn.cancel).toHaveBeenCalledTimes(1);
    expect(isPending()).toBe(false);
  });

  it("keeps the partial assistant text and appends a stopped marker", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers } = mockConnection();

    send("Where does artifact recording live?");
    handlers().onToken("Partial answer");
    cancelCurrent();

    expect(getMessages()[1]).toEqual({
      role: "assistant",
      text: "Partial answer\n\n_(stopped)_",
    });
  });

  it("marks a still-empty assistant bubble as stopped rather than dropping it", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    mockConnection();

    send("Where does artifact recording live?");
    cancelCurrent();

    expect(getMessages()[1]).toEqual({
      role: "assistant",
      text: "_(stopped)_",
    });
  });

  it("does not close the connection or revert to tier0 — the session stays open for the next question", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { conn } = mockConnection();

    send("Where does artifact recording live?");
    cancelCurrent();

    expect(conn.close).not.toHaveBeenCalled();
    expect(getTier()).toBe("tier1");
  });

  it("allows sending a new question immediately after cancelling", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { conn } = mockConnection();

    send("First question");
    cancelCurrent();
    send("Second question");

    expect(conn.send).toHaveBeenCalledTimes(2);
    expect(isPending()).toBe(true);
  });

  it("is a no-op if called a second time once already cancelled", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { conn } = mockConnection();

    send("Where does artifact recording live?");
    cancelCurrent();
    cancelCurrent();

    expect(conn.cancel).toHaveBeenCalledTimes(1);
  });
});
