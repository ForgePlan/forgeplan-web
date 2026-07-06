import { describe, it, expect, beforeEach } from "vitest";
import { send, getMessages, getTier, resetChat } from "./chat-store.svelte";
import {
  currentCameraRequest,
  clearCameraTarget,
} from "@/widgets/composed-map/model/camera-bus.svelte";
import type { MapDocument, MapZone } from "@/entities/map";

// RFC-034 Test Strategy Hooks — send() pushes user+assistant messages, and
// drives camera-bus.showOnMap exactly when the tier0 answer carries a
// target. Module-level state (messages/tier here, the camera request in
// camera-bus) persists across tests in this file — reset both before every
// test, mirroring camera-bus.test.ts's own isolation.
beforeEach(() => {
  resetChat();
  clearCameraTarget();
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
