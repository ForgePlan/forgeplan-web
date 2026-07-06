import { describe, expect, it } from "vitest";
import { liftIds, rollupEdges } from "./edge-rollup";
import { deriveSubDocument } from "./derive-subdocument";
import type { MapDocument, MapEdge, MapNode, MapZone } from "../model/types";

// RFC-031 follow-up Test Strategy Hooks — remap, dedupe+count, self-loop
// drop, pass-through, liftIds, 2-altitude compose.

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

function mega(overrides: Partial<MapNode> = {}): MapNode {
  return {
    id: "mega1",
    label: "Collapsed",
    kind: "component",
    zone: "z.a",
    is_mega: true,
    collapsed: true,
    children: [],
    found_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function edge(overrides: Partial<MapEdge> = {}): MapEdge {
  return { from: "n1", to: "n2", relation: "informs", ...overrides };
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
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe("rollupEdges — pass-through", () => {
  it("returns the document unchanged (identity) when no mega is collapsed", () => {
    const doc = baseDoc({
      nodes: [node({ id: "n1" }), node({ id: "n2" })],
      edges: [edge({ from: "n1", to: "n2" })],
    });
    expect(rollupEdges(doc)).toBe(doc);
  });

  it("passes an edge with both endpoints already visible through untouched (same reference)", () => {
    const p = node({ id: "p", zone: "z.b" });
    const q = node({ id: "q", zone: "z.b" });
    const m = mega({ id: "mega1", children: ["c1"] });
    const c1 = node({ id: "c1" });
    const e = edge({ from: "p", to: "q" });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, q, c1, m],
      edges: [e],
    });
    const result = rollupEdges(doc);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toBe(e);
  });
});

describe("rollupEdges — remap onto the covering mega", () => {
  it("remaps a hidden endpoint to its covering mega, carrying the relation verbatim", () => {
    const p = node({ id: "p", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const m = mega({ id: "mega1", children: ["c1"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, m],
      edges: [edge({ from: "p", to: "c1", relation: "informs" })],
    });
    const result = rollupEdges(doc);
    expect(result.edges).toEqual([
      { from: "p", to: "mega1", relation: "informs" },
    ]);
  });

  it("resolves a multiply-nested hidden id to the outermost visible mega", () => {
    const p = node({ id: "p", zone: "z.b" });
    const g1 = node({ id: "g1" });
    const inner = mega({ id: "inner", children: ["g1"] });
    const outer = mega({ id: "outer", children: ["inner"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, g1, inner, outer],
      edges: [edge({ from: "p", to: "g1" })],
    });
    const result = rollupEdges(doc);
    expect(result.edges).toEqual([
      { from: "p", to: "outer", relation: "informs" },
    ]);
  });
});

describe("rollupEdges — dedupe + count", () => {
  it("merges multiple raw edges landing on the same (from,to) pair, carrying rollup_count", () => {
    const p = node({ id: "p", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const c3 = node({ id: "c3" });
    const m = mega({ id: "mega1", children: ["c1", "c2", "c3"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, c2, c3, m],
      edges: [
        edge({ from: "p", to: "c1" }),
        edge({ from: "p", to: "c2" }),
        edge({ from: "p", to: "c3" }),
      ],
    });
    const result = rollupEdges(doc);
    expect(result.edges).toEqual([
      { from: "p", to: "mega1", relation: "informs", rollup_count: 3 },
    ]);
  });

  it("picks the alphabetically-first relation deterministically when merged edges disagree", () => {
    const p = node({ id: "p", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const m = mega({ id: "mega1", children: ["c1", "c2"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, c2, m],
      edges: [
        edge({ from: "p", to: "c1", relation: "supports" }),
        edge({ from: "p", to: "c2", relation: "informs" }),
      ],
    });
    const result = rollupEdges(doc);
    expect(result.edges).toEqual([
      { from: "p", to: "mega1", relation: "informs", rollup_count: 2 },
    ]);
  });

  it("is order-independent: shuffled input edges produce the identical aggregated result", () => {
    const p = node({ id: "p", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const m = mega({ id: "mega1", children: ["c1", "c2"] });
    const forward = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, c2, m],
      edges: [edge({ from: "p", to: "c1" }), edge({ from: "p", to: "c2" })],
    });
    const reversed = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, c2, m],
      edges: [edge({ from: "p", to: "c2" }), edge({ from: "p", to: "c1" })],
    });
    expect(rollupEdges(forward)).toEqual(rollupEdges(reversed));
  });
});

describe("rollupEdges — self-loop drop", () => {
  it("drops an edge whose endpoints resolve onto the SAME mega after remap", () => {
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const p = node({ id: "p", zone: "z.b" });
    const m = mega({ id: "mega1", children: ["c1", "c2"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [c1, c2, p, m],
      edges: [edge({ from: "c1", to: "c2" }), edge({ from: "p", to: "c1" })],
    });
    const result = rollupEdges(doc);
    expect(result.edges).toEqual([
      { from: "p", to: "mega1", relation: "informs" },
    ]);
  });
});

describe("rollupEdges — self-loop drop with no other remap (no early-return regression)", () => {
  it("drops a same-mega self-loop even when every other edge is already visible-to-visible (touched.length === 0)", () => {
    const p = node({ id: "p", zone: "z.b" });
    const q = node({ id: "q", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const m = mega({ id: "mega1", children: ["c1", "c2"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, q, c1, c2, m],
      edges: [edge({ from: "p", to: "q" }), edge({ from: "c1", to: "c2" })],
    });
    const result = rollupEdges(doc);
    expect(result.edges).toEqual([{ from: "p", to: "q", relation: "informs" }]);
    expect(result).not.toBe(doc);
  });
});

describe("rollupEdges — determinism / no fabrication", () => {
  it("is deterministic across repeated calls on the same input", () => {
    const p = node({ id: "p", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const m = mega({ id: "mega1", children: ["c1"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, m],
      edges: [edge({ from: "p", to: "c1" })],
    });
    expect(rollupEdges(doc)).toEqual(rollupEdges(doc));
  });

  it("never introduces x/y and never mints an id absent from the input document", () => {
    const p = node({ id: "p", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const m = mega({ id: "mega1", children: ["c1"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, m],
      edges: [edge({ from: "p", to: "c1" })],
    });
    const knownIds = new Set(doc.nodes.map((n) => n.id));
    const result = rollupEdges(doc);
    for (const e of result.edges) {
      expect("x" in e).toBe(false);
      expect("y" in e).toBe(false);
      expect(knownIds.has(e.from)).toBe(true);
      expect(knownIds.has(e.to)).toBe(true);
    }
  });

  it("does not mutate the input document's edges array", () => {
    const p = node({ id: "p", zone: "z.b" });
    const c1 = node({ id: "c1" });
    const m = mega({ id: "mega1", children: ["c1"] });
    const originalEdges = [edge({ from: "p", to: "c1" })];
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [p, c1, m],
      edges: originalEdges,
    });
    rollupEdges(doc);
    expect(doc.edges).toBe(originalEdges);
    expect(doc.edges).toEqual([edge({ from: "p", to: "c1" })]);
  });
});

describe("liftIds", () => {
  it("maps a visible id to itself", () => {
    const doc = baseDoc({ nodes: [node({ id: "n1" })] });
    expect(liftIds(doc, ["n1"])).toEqual(new Set(["n1"]));
  });

  it("lifts a hidden id to its direct covering mega", () => {
    const c1 = node({ id: "c1" });
    const m = mega({ id: "mega1", children: ["c1"] });
    const doc = baseDoc({ nodes: [c1, m] });
    expect(liftIds(doc, ["c1"])).toEqual(new Set(["mega1"]));
  });

  it("lifts a doubly-nested hidden id to the outermost visible mega", () => {
    const g1 = node({ id: "g1" });
    const inner = mega({ id: "inner", children: ["g1"] });
    const outer = mega({ id: "outer", children: ["inner"] });
    const doc = baseDoc({ nodes: [g1, inner, outer] });
    expect(liftIds(doc, ["g1"])).toEqual(new Set(["outer"]));
  });

  it("de-duplicates when multiple ids lift to the same covering mega", () => {
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const m = mega({ id: "mega1", children: ["c1", "c2"] });
    const doc = baseDoc({ nodes: [c1, c2, m] });
    expect(liftIds(doc, ["c1", "c2"])).toEqual(new Set(["mega1"]));
  });
});

describe("rollupEdges + liftIds — compose with drill-down (2-altitude fixture)", () => {
  // RFC-031's deriveSubDocument dissolves ONLY the descended-into mega
  // (`collapsed` flips false); a nested mega among its revealed children
  // stays a collapsed card at the new altitude. Both rollupEdges and
  // liftIds re-derive their hidden->covering map fresh from whatever doc
  // they're handed, so the SAME functions must re-resolve g1's covering
  // mega from "outer" (root altitude) to "inner" (post-descend altitude)
  // with zero special-casing — "this comes for free" per the RFC.
  function build(): MapDocument {
    const c1 = node({ id: "c1", found_at: "2026-01-01T00:00:01.000Z" });
    const g1 = node({ id: "g1", found_at: "2026-01-01T00:00:02.000Z" });
    const g2 = node({ id: "g2", found_at: "2026-01-01T00:00:03.000Z" });
    const inner = mega({
      id: "inner",
      children: ["g1", "g2"],
      found_at: "2026-01-01T00:00:04.000Z",
    });
    const outer = mega({
      id: "outer",
      children: ["c1", "inner"],
      found_at: "2026-01-01T00:00:05.000Z",
    });
    return baseDoc({
      zones: [zone({ id: "z.a", cols: 2 })],
      nodes: [c1, g1, g2, inner, outer],
      edges: [edge({ from: "c1", to: "inner", relation: "informs" })],
    });
  }

  it("at root altitude, g1/g2 lift to the outermost visible mega (outer)", () => {
    const root = build();
    expect(liftIds(root, ["g1"])).toEqual(new Set(["outer"]));
    expect(liftIds(root, ["g2"])).toEqual(new Set(["outer"]));
  });

  it("post-descend (into outer), g1/g2 lift to the now-visible nested mega (inner)", () => {
    const root = build();
    const level1 = deriveSubDocument(root, "outer");
    expect(liftIds(level1, ["g1"])).toEqual(new Set(["inner"]));
    expect(liftIds(level1, ["g2"])).toEqual(new Set(["inner"]));
  });

  it("rollupEdges on the post-descend document preserves the intra-altitude pass-through edge", () => {
    const root = build();
    const level1 = deriveSubDocument(root, "outer");
    // c1 <-> inner both survive deriveSubDocument's revealedIds filter (they
    // are outer's direct children); inner is still visible (as a collapsed
    // card) at this altitude, so this edge needs no remap at all.
    expect(level1.edges).toEqual([
      { from: "c1", to: "inner", relation: "informs" },
    ]);
    const rolled = rollupEdges(level1);
    expect(rolled.edges).toEqual(level1.edges);
  });
});
