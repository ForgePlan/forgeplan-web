import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  send,
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
import type { MapDocument, MapZone } from "@/entities/map";
import { probeDaemon, connectAgent, type AgentHandlers } from "./agent-client";

// RFC-034 Test Strategy Hooks — send() pushes user+assistant messages, and
// drives camera-bus.showOnMap exactly when the tier0 answer carries a
// target. Module-level state (messages/tier here, the camera request in
// camera-bus) persists across tests in this file — reset both before every
// test, mirroring camera-bus.test.ts's own isolation.
//
// agent-client is mocked file-wide: the Tier-0-only describe blocks below
// never call checkDaemon/send-in-tier1, so the mock is inert for them; the
// "tier1" block reassigns probeDaemon/connectAgent per test to drive the
// store's live-agent branch deterministically, without a real socket.
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

function zone(overrides: Partial<MapZone> = {}): MapZone {
  return {
    id: "z.a",
    label: "Zone A",
    kind: "surface",
    accent: "--map-accent-cyan",
    treatment: "neutral-dashed",
    rule_edge: "off",
    layout_rule: "grid",
    cols: 2,
    ...overrides,
  };
}

function fixtureDoc(): MapDocument {
  return {
    schema: "forgeplan.map/v1",
    meta: {
      map_id: "test",
      status: "confirmed",
      project_type: "generic",
      composition_id: "c1",
      source_fingerprint: "fp",
      version: 1,
    },
    canvas: {
      grid: { cols: 1, rows: 1 },
      gap: { x: 88, y: 70 },
      margin: 40,
      cell: {
        card_w: 190,
        card_h: 60,
        card_gap: 36,
        zpad: { top: 50, side: 24, bottom: 24 },
      },
    },
    composition: {
      template: "generic",
      arrangement: "stack-ttb",
      entry_zone: "z.a",
      placements: [{ zone: "z.a", cell: { row: 0, col: 0 } }],
      zone_connectors: [],
    },
    zones: [zone({ id: "z.a", label: "CLI Surfaces" })],
    nodes: [],
    edges: [],
  };
}

describe("chat-store — send", () => {
  it("pushes a user message followed by a grounded assistant message", () => {
    send(fixtureDoc(), "Tell me about CLI Surfaces");
    const messages = getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: "user",
      text: "Tell me about CLI Surfaces",
    });
    expect(messages[1]!.role).toBe("assistant");
    expect(messages[1]!.text).toContain("CLI Surfaces");
  });

  it("drives the camera via camera-bus when the tier0 answer has a target", () => {
    const before = currentCameraRequest().seq;
    send(fixtureDoc(), "Tell me about CLI Surfaces");
    const after = currentCameraRequest();
    expect(after.seq).toBe(before + 1);
    expect(after.target).toEqual({ kind: "zone", id: "z.a" });
  });

  it("does not move the camera when the tier0 answer has no target (fallback)", () => {
    const before = currentCameraRequest().seq;
    send(fixtureDoc(), "asdkjqwlekj nonsense zzz");
    expect(getMessages()).toHaveLength(2);
    expect(currentCameraRequest().seq).toBe(before);
  });

  it("ignores a blank/whitespace-only question — no messages pushed", () => {
    send(fixtureDoc(), "   ");
    expect(getMessages()).toHaveLength(0);
  });

  it("accumulates messages across multiple sends", () => {
    send(fixtureDoc(), "Tell me about CLI Surfaces");
    send(fixtureDoc(), "asdkjqwlekj nonsense zzz");
    expect(getMessages()).toHaveLength(4);
  });
});

describe("chat-store — tier", () => {
  it("defaults to tier0", () => {
    expect(getTier()).toBe("tier0");
  });
});

describe("chat-store — resetChat", () => {
  it("clears the transcript and restores the default tier", () => {
    send(fixtureDoc(), "Tell me about CLI Surfaces");
    expect(getMessages().length).toBeGreaterThan(0);
    resetChat();
    expect(getMessages()).toEqual([]);
    expect(getTier()).toBe("tier0");
  });
});

// RFC-034 Phase 3b Test Strategy Hooks — checkDaemon upgrades the tier on a
// successful probe; send() in tier1 streams tokens into the assistant
// message via a mocked agent-client and drives camera-bus the same way
// tier0 does; onError/onClose fall back to tier0 gracefully.
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

  it("streams tokens into a progressively-updated assistant message", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers } = mockConnection();

    send(fixtureDoc(), "Where does artifact recording live?");
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
    send(fixtureDoc(), "Where does artifact recording live?");
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

    send(fixtureDoc(), "First question");
    send(fixtureDoc(), "Second question");
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

    send(fixtureDoc(), "Where does artifact recording live?");
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

    send(fixtureDoc(), "Where does artifact recording live?");
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

    send(fixtureDoc(), "Where does artifact recording live?");
    handlers().onToken("Partial answer");
    handlers().onClose();

    expect(getTier()).toBe("tier0");
    expect(getMessages()[1]).toEqual({
      role: "assistant",
      text: "Partial answer",
    });
  });
});
