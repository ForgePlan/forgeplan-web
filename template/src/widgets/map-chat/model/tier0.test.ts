import { describe, it, expect } from "vitest";
import { answerFromMap } from "./tier0";
import type {
  MapDocument,
  MapNode,
  MapZone,
  MapFlow,
  MapEdge,
} from "@/entities/map";

// RFC-034 Test Strategy Hooks — question -> answer over a fixture doc:
// matches a zone by label; a node by label; a node by provenance path;
// a flow by name; returns a target; never throws; model-free; never
// fabricates a description_ru that isn't present on the entity.

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

function node(overrides: Partial<MapNode> = {}): MapNode {
  return {
    id: "n1",
    label: "Node 1",
    kind: "component",
    zone: "z.a",
    found_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseDoc(overrides: Partial<MapDocument> = {}): MapDocument {
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
      grid: { cols: 2, rows: 1 },
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
    zones: [zone()],
    nodes: [node()],
    edges: [],
    ...overrides,
  };
}

const zones: MapZone[] = [
  zone({
    id: "z.cli",
    label: "CLI Surfaces",
    description_ru: "Публичные точки входа.",
  }),
  zone({ id: "z.web", label: "Web Widgets" }), // no description_ru — honesty case
];

const nodes: MapNode[] = [
  node({
    id: "n.bin",
    label: "forgeplan-web.mjs",
    zone: "z.cli",
    description_ru: "Точка входа CLI.",
    provenance: {
      source: "file",
      ref: "bin/forgeplan-web.mjs",
      confidence: 0.9,
    },
  }),
  node({ id: "n.init", label: "init command", zone: "z.cli" }),
  node({
    id: "n.core",
    label: "Core Bootstrap",
    zone: "z.web",
    provenance: { source: "file", ref: "bin/lib/core.mjs", confidence: 0.8 },
  }), // no description_ru, no edges — honesty + empty-connections case
];

const edges: MapEdge[] = [{ from: "n.bin", to: "n.init", relation: "calls" }];

const flows: MapFlow[] = [
  {
    id: "f.onboard",
    name: "Onboarding Flow",
    node_ids: ["n.bin", "n.init"],
    steps: ["Step one", "Step two"],
  },
];

function fixtureDoc(): MapDocument {
  return baseDoc({ zones, nodes, edges, flows });
}

describe("answerFromMap — zone match", () => {
  it("matches a zone by label, carries description_ru verbatim, returns a zone target", () => {
    const result = answerFromMap(fixtureDoc(), "Tell me about CLI Surfaces");
    expect(result.target).toEqual({ kind: "zone", id: "z.cli" });
    expect(result.text).toContain("CLI Surfaces");
    expect(result.text).toContain("Публичные точки входа.");
  });

  it("includes a what's-inside member summary for the matched zone", () => {
    const result = answerFromMap(fixtureDoc(), "Tell me about CLI Surfaces");
    expect(result.text).toContain("What's inside");
    expect(result.text).toContain("forgeplan-web.mjs");
    expect(result.text).toContain("init command");
  });

  it("never fabricates a description_ru sentence when the zone has none", () => {
    const result = answerFromMap(fixtureDoc(), "What is Web Widgets?");
    expect(result.target).toEqual({ kind: "zone", id: "z.web" });
    expect(result.text).toContain("Web Widgets");
    expect(result.text).not.toContain("Публичные");
  });
});

describe("answerFromMap — node match", () => {
  it("matches a node by label, carries its description_ru, and lists out-connections", () => {
    const result = answerFromMap(
      fixtureDoc(),
      "What does forgeplan-web.mjs do?",
    );
    expect(result.target).toEqual({ kind: "node", id: "n.bin" });
    expect(result.text).toContain("forgeplan-web.mjs");
    expect(result.text).toContain("Точка входа CLI.");
    expect(result.text).toContain("Connects to: init command");
  });

  it("matches a node by its provenance path when the label alone isn't asked for", () => {
    const result = answerFromMap(
      fixtureDoc(),
      "what happens in bin/lib/core.mjs",
    );
    expect(result.target).toEqual({ kind: "node", id: "n.core" });
    expect(result.text).toContain("Core Bootstrap");
  });

  it("never fabricates description or connections for a node that has neither", () => {
    const result = answerFromMap(
      fixtureDoc(),
      "what happens in bin/lib/core.mjs",
    );
    expect(result.text).not.toContain("Connects to");
    expect(result.text).not.toContain("Connected from");
  });
});

describe("answerFromMap — flow match", () => {
  it("matches a flow by name, returns a flow target, and numbers its steps", () => {
    const result = answerFromMap(
      fixtureDoc(),
      "Walk me through the Onboarding Flow",
    );
    expect(result.target).toEqual({ kind: "flow", id: "f.onboard" });
    expect(result.text).toContain("Onboarding Flow");
    expect(result.text).toContain("1. Step one");
    expect(result.text).toContain("2. Step two");
  });
});

describe("answerFromMap — no match", () => {
  it("falls back to a sample of zone labels and leaves target undefined", () => {
    const result = answerFromMap(fixtureDoc(), "asdkjqwlekj nonsense zzz");
    expect(result.target).toBeUndefined();
    expect(result.text).toContain("CLI Surfaces");
  });

  it("returns an honest empty-map fallback when the document has no zones", () => {
    const result = answerFromMap(baseDoc({ zones: [], nodes: [] }), "hello");
    expect(result.target).toBeUndefined();
    expect(result.text).toBe("I don't have a loaded map to answer from yet.");
  });
});

describe("answerFromMap — never throws", () => {
  it("handles an empty question without throwing", () => {
    expect(() => answerFromMap(fixtureDoc(), "")).not.toThrow();
    expect(answerFromMap(fixtureDoc(), "").target).toBeUndefined();
  });

  it("handles a whitespace-only question without throwing", () => {
    expect(() => answerFromMap(fixtureDoc(), "   ")).not.toThrow();
  });

  it("handles a degenerate document (no zones/nodes/flows) without throwing", () => {
    const empty = baseDoc({ zones: [], nodes: [], edges: [], flows: [] });
    expect(() => answerFromMap(empty, "anything")).not.toThrow();
  });

  it("is deterministic — the same (doc, question) always yields the same answer", () => {
    const a = answerFromMap(fixtureDoc(), "Tell me about CLI Surfaces");
    const b = answerFromMap(fixtureDoc(), "Tell me about CLI Surfaces");
    expect(a).toEqual(b);
  });
});
