import { describe, expect, it } from "vitest";
import { buildLevelDocuments, isRootZoneDescend } from "./level-documents";
import type { MapDocument, MapNode, MapZone } from "@/entities/map";

// PRD-038 FR-002 (E3 seam) Test Strategy Hooks — the seam prefers a cached,
// valid emitted layer over the client-derived deriveSubDocument fold for
// the FIRST descent only; deeper levels and a missing/invalid cache entry
// both fall back to the RFC-031 derived behaviour unchanged.

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
    zones: [zone()],
    nodes: [node()],
    edges: [],
    ...overrides,
  };
}

describe("isRootZoneDescend", () => {
  const root = baseDoc({ zones: [zone({ id: "z.decisions" })] });

  it("is true only for a root-level descent into one of the root doc's own zones", () => {
    expect(isRootZoneDescend(root, 1, "z.decisions")).toBe(true);
  });

  it("is false once already below the root level (levelStack.length > 1)", () => {
    expect(isRootZoneDescend(root, 2, "z.decisions")).toBe(false);
  });

  it("is false for an id that is not a root-level zone (e.g. a mega-node)", () => {
    expect(isRootZoneDescend(root, 1, "mega1")).toBe(false);
  });
});

describe("buildLevelDocuments", () => {
  it("returns [rootDoc] unchanged (same reference) at level 0 (empty focus chain)", () => {
    const root = baseDoc();
    const docs = buildLevelDocuments(root, [], new Map());
    expect(docs).toEqual([root]);
    expect(docs[0]).toBe(root);
  });

  it("falls back to the client-derived fold when the zone is not in the layer cache", () => {
    const root = baseDoc({
      zones: [zone({ id: "z.a", layers: undefined })],
      nodes: [node({ id: "n1", zone: "z.a" })],
    });
    const docs = buildLevelDocuments(root, ["z.a"], new Map());
    expect(docs).toHaveLength(2);
    // Derived fold never emits the root's own zone id back verbatim — it
    // synthesizes a "sub:<focusId>:<layer>" zone, proving this path did NOT
    // just echo the emitted-layer branch.
    expect(docs[1]!.zones[0]!.id).toBe("sub:z.a:all");
  });

  it("falls back to the client-derived fold when the cache holds null (fetched, absent/invalid)", () => {
    const root = baseDoc({
      zones: [zone({ id: "z.a" })],
      nodes: [node({ id: "n1", zone: "z.a" })],
    });
    const cache = new Map<string, MapDocument | null>([["z.a", null]]);
    const docs = buildLevelDocuments(root, ["z.a"], cache);
    expect(docs[1]!.zones[0]!.id).toBe("sub:z.a:all");
  });

  it("prefers the cached emitted layer over the derived fold for the FIRST descent", () => {
    const root = baseDoc({ zones: [zone({ id: "z.decisions" })] });
    const emittedLayer = baseDoc({
      zones: [zone({ id: "z.decisions.sub-1", label: "Emitted sub-zone" })],
      flows: [
        {
          id: "flow.emitted",
          name: "Emitted-only flow",
          node_ids: [],
        },
      ],
    });
    const cache = new Map<string, MapDocument | null>([
      ["z.decisions", emittedLayer],
    ]);
    const docs = buildLevelDocuments(root, ["z.decisions"], cache);
    expect(docs).toHaveLength(2);
    expect(docs[1]).toBe(emittedLayer);
    expect(docs[1]!.flows?.[0]?.id).toBe("flow.emitted");
  });

  it("only prefers the emitted layer for the FIRST descent — deeper levels stay derived", () => {
    const emittedLayer = baseDoc({
      zones: [zone({ id: "z.sub", layers: undefined })],
      nodes: [node({ id: "n2", zone: "z.sub" })],
    });
    const root = baseDoc({ zones: [zone({ id: "z.decisions" })] });
    const cache = new Map<string, MapDocument | null>([
      ["z.decisions", emittedLayer],
      // Even if a cache entry existed for the second-level focus id, only
      // index 0 of the focus chain ever consults the cache
      // (TODO(e3-nested-layers) in level-documents.ts).
      ["z.sub", baseDoc({ zones: [zone({ id: "should-never-be-used" })] })],
    ]);
    const docs = buildLevelDocuments(root, ["z.decisions", "z.sub"], cache);
    expect(docs).toHaveLength(3);
    expect(docs[1]).toBe(emittedLayer);
    // Level 2 is derived from the emitted layer (docs[1]), not the cache.
    expect(docs[2]!.zones[0]!.id).toBe("sub:z.sub:all");
  });
});
