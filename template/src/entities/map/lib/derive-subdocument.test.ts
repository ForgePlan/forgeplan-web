import { describe, expect, it } from "vitest";
import {
  collectDirectChildren,
  deriveSubDocument,
  groupIntoSubZones,
  isDrillable,
  resolveDrillTarget,
  synthesizeComposition,
} from "./derive-subdocument";
import { computeComposedLayout } from "./composed-layout";
import type { MapDocument, MapFlow, MapNode, MapZone } from "../model/types";

// RFC-031 Phase 1 Test Strategy Hooks — determinism, no-x/y, no-minted-ids,
// pinned-cols, recursive append-stability, leaf-honesty, fabrication-audit.

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

describe("resolveDrillTarget", () => {
  it("resolves a zone id to a zone target", () => {
    const doc = baseDoc();
    expect(resolveDrillTarget(doc, "z.a")).toEqual({
      kind: "zone",
      zone: zone(),
    });
  });

  it("resolves a mega node id to a mega target", () => {
    const m = mega({ id: "mega1" });
    const doc = baseDoc({ nodes: [m] });
    expect(resolveDrillTarget(doc, "mega1")).toEqual({ kind: "mega", node: m });
  });

  it("returns null for an unknown focus id", () => {
    expect(resolveDrillTarget(baseDoc(), "does-not-exist")).toBeNull();
  });

  it("returns null for a regular (non-mega) node id", () => {
    const doc = baseDoc({ nodes: [node({ id: "n1" })] });
    expect(resolveDrillTarget(doc, "n1")).toBeNull();
  });
});

describe("isDrillable — Q5 leaf rule", () => {
  it("is false for an unknown focus id", () => {
    expect(isDrillable(baseDoc(), "ghost")).toBe(false);
  });

  it("is false for a childless mega (honest leaf)", () => {
    const doc = baseDoc({ nodes: [mega({ id: "mega1", children: [] })] });
    expect(isDrillable(doc, "mega1")).toBe(false);
  });

  it("is true for a mega with children", () => {
    const doc = baseDoc({
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    expect(isDrillable(doc, "mega1")).toBe(true);
  });

  it("is false for an already-flat zone (no collapsed mega, no layers)", () => {
    const doc = baseDoc({ nodes: [node({ id: "n1" }), node({ id: "n2" })] });
    expect(isDrillable(doc, "z.a")).toBe(false);
  });

  it("is true for a zone holding a collapsed mega", () => {
    const doc = baseDoc({
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    expect(isDrillable(doc, "z.a")).toBe(true);
  });

  it("is true for a zone whose layers[] would split its contents into >1 sub-zone", () => {
    const doc = baseDoc({
      zones: [zone({ layers: ["l1", "l2"] })],
      nodes: [node({ id: "n1", layer: "l1" }), node({ id: "n2", layer: "l2" })],
    });
    expect(isDrillable(doc, "z.a")).toBe(true);
  });

  it("is false for a zone whose layers[] would still resolve to a single sub-zone", () => {
    const doc = baseDoc({
      zones: [zone({ layers: ["l1"] })],
      nodes: [node({ id: "n1", layer: "l1" }), node({ id: "n2", layer: "l1" })],
    });
    expect(isDrillable(doc, "z.a")).toBe(false);
  });
});

describe("collectDirectChildren", () => {
  it("mega target: maps children ids to node objects, skipping missing ids and de-duplicating", () => {
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const m = mega({ id: "mega1", children: ["c1", "ghost", "c2", "c1"] });
    const doc = baseDoc({ nodes: [c1, c2, m] });
    const result = collectDirectChildren(doc, { kind: "mega", node: m });
    expect(result.map((n) => n.id)).toEqual(["c1", "c2"]);
  });

  it("zone target: unions non-mega nodes with expanded collapsed-mega children, ignoring other zones", () => {
    const c1 = node({ id: "c1", zone: "z.a" });
    const other = node({ id: "other", zone: "z.b" });
    const gc1 = node({ id: "gc1", zone: "z.a" });
    const m = mega({ id: "mega1", zone: "z.a", children: ["gc1"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [c1, other, gc1, m],
    });
    const result = collectDirectChildren(doc, {
      kind: "zone",
      zone: zone({ id: "z.a" }),
    });
    expect(result.map((n) => n.id).sort()).toEqual(["c1", "gc1"]);
  });

  it("drops an uncollapsed, non-nested mega's own card but keeps its children", () => {
    const child = node({ id: "child", zone: "z.a" });
    const m = mega({
      id: "mega1",
      zone: "z.a",
      collapsed: false,
      children: ["child"],
    });
    const doc = baseDoc({ nodes: [child, m] });
    const result = collectDirectChildren(doc, { kind: "zone", zone: zone() });
    expect(result.map((n) => n.id)).toEqual(["child"]);
  });

  it("a nested collapsed mega (listed as another mega's child) stays an unexpanded card", () => {
    const c1 = node({ id: "c1", zone: "z.a" });
    const inner = mega({ id: "inner", zone: "z.a", children: ["g1", "g2"] });
    const g1 = node({ id: "g1", zone: "z.a" });
    const g2 = node({ id: "g2", zone: "z.a" });
    const outer = mega({ id: "outer", zone: "z.a", children: ["c1", "inner"] });
    const doc = baseDoc({ nodes: [c1, inner, g1, g2, outer] });
    const result = collectDirectChildren(doc, { kind: "zone", zone: zone() });
    expect(result.map((n) => n.id).sort()).toEqual(["c1", "inner"]);
  });
});

describe("groupIntoSubZones — Q4", () => {
  it("produces a single 'all' sub-zone when the parent zone has no layers", () => {
    const parent = zone({ id: "z.decisions", cols: 4 });
    const children = [node({ id: "n1" }), node({ id: "n2" })];
    const groups = groupIntoSubZones(
      baseDoc(),
      parent,
      children,
      "z.decisions",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.zone.id).toBe("sub:z.decisions:all");
    expect(groups[0]!.zone.cols).toBe(4);
    expect(groups[0]!.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it("groups by layer in parent layers[] order, with a trailing ungrouped bucket only when non-empty", () => {
    const parent = zone({ id: "z.a", cols: 3, layers: ["l1", "l2"] });
    const children = [
      node({ id: "a1", layer: "l1" }),
      node({ id: "b1", layer: "l2" }),
      node({ id: "u1" }),
    ];
    const groups = groupIntoSubZones(baseDoc(), parent, children, "z.a");
    expect(groups.map((g) => g.zone.id)).toEqual([
      "sub:z.a:l1",
      "sub:z.a:l2",
      "sub:z.a:ungrouped",
    ]);
    expect(groups[0]!.nodes.map((n) => n.id)).toEqual(["a1"]);
    expect(groups[1]!.nodes.map((n) => n.id)).toEqual(["b1"]);
    expect(groups[2]!.nodes.map((n) => n.id)).toEqual(["u1"]);
    for (const g of groups) expect(g.zone.cols).toBe(3);
  });

  it("omits the trailing ungrouped bucket when every child matches a named layer", () => {
    const parent = zone({ id: "z.a", layers: ["l1"] });
    const children = [node({ id: "a1", layer: "l1" })];
    const groups = groupIntoSubZones(baseDoc(), parent, children, "z.a");
    expect(groups.map((g) => g.zone.id)).toEqual(["sub:z.a:l1"]);
  });

  it("pins cols from the parent zone regardless of child count (170-node case)", () => {
    const parent = zone({ id: "z.decisions", cols: 4 });
    const children = Array.from({ length: 170 }, (_, i) =>
      node({
        id: `n${i}`,
        found_at: `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
      }),
    );
    const groups = groupIntoSubZones(
      baseDoc(),
      parent,
      children,
      "z.decisions",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.zone.cols).toBe(4);
    expect(groups[0]!.nodes).toHaveLength(170);
  });
});

describe("synthesizeComposition", () => {
  it("stacks one sub-zone per row at col 0, entry_zone = first, no connectors", () => {
    const groups = [
      { zone: zone({ id: "sub:z.a:l1" }), nodes: [] },
      { zone: zone({ id: "sub:z.a:l2" }), nodes: [] },
    ];
    const comp = synthesizeComposition(groups);
    expect(comp.arrangement).toBe("stack-ttb");
    expect(comp.entry_zone).toBe("sub:z.a:l1");
    expect(comp.placements).toEqual([
      { zone: "sub:z.a:l1", cell: { row: 0, col: 0 } },
      { zone: "sub:z.a:l2", cell: { row: 1, col: 0 } },
    ]);
    expect(comp.zone_connectors).toEqual([]);
  });
});

describe("deriveSubDocument — RFC-031 recursive core", () => {
  it("returns the document unchanged (identity) for an unknown focus id", () => {
    const doc = baseDoc({ nodes: [node({ id: "n1" })] });
    expect(deriveSubDocument(doc, "ghost")).toBe(doc);
  });

  it("returns the document unchanged (identity) for a non-drillable (leaf) focus id", () => {
    const doc = baseDoc({ nodes: [mega({ id: "mega1", children: [] })] });
    expect(deriveSubDocument(doc, "mega1")).toBe(doc);
  });

  it("is deterministic: the same (doc, focusId) twice produces a structurally identical document", () => {
    const doc = baseDoc({
      nodes: [
        node({ id: "c1", found_at: "2026-01-01T00:00:01.000Z" }),
        mega({
          id: "mega1",
          children: ["c1"],
          found_at: "2026-01-01T00:00:02.000Z",
        }),
      ],
    });
    const a = deriveSubDocument(doc, "z.a");
    const b = deriveSubDocument(doc, "z.a");
    expect(a).toEqual(b);
  });

  it("mints no node id: every node id in the derived doc already existed in the input", () => {
    const doc = baseDoc({
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    const derived = deriveSubDocument(doc, "z.a");
    const inputIds = new Set(doc.nodes.map((n) => n.id));
    for (const n of derived.nodes) expect(inputIds.has(n.id)).toBe(true);
  });

  it("carries node id and found_at verbatim on the revealed subset", () => {
    const c1 = node({ id: "c1", found_at: "2026-03-01T00:00:00.000Z" });
    const doc = baseDoc({
      nodes: [c1, mega({ id: "mega1", children: ["c1"] })],
    });
    const derived = deriveSubDocument(doc, "z.a");
    const revealed = derived.nodes.find((n) => n.id === "c1")!;
    expect(revealed.found_at).toBe(c1.found_at);
  });

  it("never introduces x/y on any node, at any altitude", () => {
    const doc = baseDoc({
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    const derived = deriveSubDocument(doc, "z.a");
    for (const n of derived.nodes) {
      expect("x" in n).toBe(false);
      expect("y" in n).toBe(false);
    }
  });

  it("pins the sub-zone cols to the parent zone's cols", () => {
    const doc = baseDoc({
      zones: [zone({ cols: 5 })],
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    const derived = deriveSubDocument(doc, "z.a");
    for (const z of derived.zones) expect(z.cols).toBe(5);
  });

  it("sets canvas.grid to {cols:1, rows:<subZoneCount>} and carries cell/gap/margin verbatim", () => {
    const doc = baseDoc({
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    const derived = deriveSubDocument(doc, "z.a");
    expect(derived.canvas.grid).toEqual({
      cols: 1,
      rows: derived.zones.length,
    });
    expect(derived.canvas.cell).toEqual(doc.canvas.cell);
    expect(derived.canvas.gap).toEqual(doc.canvas.gap);
    expect(derived.canvas.margin).toBe(doc.canvas.margin);
  });

  it("filters edges to intra-altitude endpoints and drops a flow that loses its revealed subset (#21)", () => {
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const outside = node({ id: "outside", zone: "z.b" });
    const m = mega({ id: "mega1", children: ["c1", "c2"] });
    const doc = baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [c1, c2, outside, m],
      edges: [
        { from: "c1", to: "c2", relation: "informs" },
        { from: "c1", to: "outside", relation: "informs" },
      ],
      // "outside" never joins the revealed subset for focus "z.a", so this
      // flow keeps < 2 revealed node_ids and is dropped (see the dedicated
      // "carries flows forward" describe block below for the survive case).
      flows: [{ id: "f1", name: "Flow", node_ids: ["c1", "outside"] }],
    });
    const derived = deriveSubDocument(doc, "z.a");
    expect(derived.edges).toEqual([
      { from: "c1", to: "c2", relation: "informs" },
    ]);
    expect(derived.flows).toBeUndefined();
  });

  it("fabrication-audit: sub-zone ids follow sub:<focusId>:<layer> and every node id traces to root", () => {
    const doc = baseDoc({
      zones: [zone({ layers: ["l1", "l2"] })],
      nodes: [
        node({ id: "n1", layer: "l1" }),
        node({ id: "n2", layer: "l2" }),
        mega({ id: "mega1", children: [] }),
      ],
    });
    const derived = deriveSubDocument(doc, "z.a");
    const rootIds = new Set(doc.nodes.map((n) => n.id));
    for (const z of derived.zones) expect(z.id).toMatch(/^sub:z\.a:/);
    for (const n of derived.nodes) expect(rootIds.has(n.id)).toBe(true);
  });

  it("AC-1 path: expands a single ~170-child collapsed mega in its own zone", () => {
    const children = Array.from({ length: 170 }, (_, i) =>
      node({
        id: `d${i}`,
        zone: "z.decisions",
        found_at: `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
      }),
    );
    const megaNode = mega({
      id: "mega-decisions",
      zone: "z.decisions",
      children: children.map((n) => n.id),
      found_at: "2026-01-01T03:00:00.000Z",
    });
    const doc = baseDoc({
      zones: [zone({ id: "z.decisions", cols: 4 })],
      nodes: [...children, megaNode],
    });
    expect(isDrillable(doc, "z.decisions")).toBe(true);
    const derived = deriveSubDocument(doc, "z.decisions");
    expect(derived.zones).toHaveLength(1);
    expect(derived.zones[0]!.cols).toBe(4);
    const revealed = derived.nodes.filter(
      (n) => n.zone === derived.zones[0]!.id,
    );
    expect(revealed).toHaveLength(170);
    expect(() => computeComposedLayout(derived)).not.toThrow();
    const layout = computeComposedLayout(derived);
    expect(layout.nodePositions.size).toBe(170);
  });

  it("recursive append-stability across 2 altitudes of a 2-level descent", () => {
    const c1 = node({
      id: "c1",
      zone: "z.a",
      found_at: "2026-01-01T00:00:01.000Z",
    });
    const c2 = node({
      id: "c2",
      zone: "z.a",
      found_at: "2026-01-01T00:00:02.000Z",
    });
    const inner = mega({
      id: "inner",
      zone: "z.a",
      children: ["g1", "g2"],
      found_at: "2026-01-01T00:00:03.000Z",
    });
    const g1 = node({
      id: "g1",
      zone: "z.a",
      found_at: "2026-01-01T00:00:04.000Z",
    });
    const g2 = node({
      id: "g2",
      zone: "z.a",
      found_at: "2026-01-01T00:00:05.000Z",
    });
    const outer = mega({
      id: "outer",
      zone: "z.a",
      children: ["c1", "c2", "inner"],
      found_at: "2026-01-01T00:00:06.000Z",
    });

    function build(extraRootNode?: MapNode): MapDocument {
      const nodes = [c1, c2, inner, g1, g2, outer];
      return baseDoc({
        zones: [zone({ id: "z.a", cols: 2 })],
        nodes: extraRootNode ? [...nodes, extraRootNode] : nodes,
      });
    }

    const before = build();
    const level1Before = deriveSubDocument(before, "z.a");
    const level2Before = deriveSubDocument(level1Before, "inner");
    expect(isDrillable(level1Before, "inner")).toBe(true);
    const layout1Before = computeComposedLayout(level1Before);
    const layout2Before = computeComposedLayout(level2Before);

    const c0Later = node({
      id: "c0later",
      zone: "z.a",
      found_at: "2026-01-01T00:00:07.000Z",
    });
    const after = build(c0Later);
    const level1After = deriveSubDocument(after, "z.a");
    const level2After = deriveSubDocument(level1After, "inner");
    const layout1After = computeComposedLayout(level1After);
    const layout2After = computeComposedLayout(level2After);

    for (const id of ["c1", "c2", "inner"]) {
      expect(layout1After.nodePositions.get(id)).toEqual(
        layout1Before.nodePositions.get(id),
      );
    }
    for (const id of ["g1", "g2"]) {
      expect(layout2After.nodePositions.get(id)).toEqual(
        layout2Before.nodePositions.get(id),
      );
    }
  });

  it("level-0 identity: an empty focus-chain fold leaves the root document untouched", () => {
    const root = baseDoc({
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    const emptyChain: string[] = [];
    const activeDoc = emptyChain.reduce(
      (d: MapDocument, fid: string) => deriveSubDocument(d, fid),
      root,
    );
    expect(activeDoc).toBe(root);
  });
});

describe("deriveSubDocument — #21 carries parent flows filtered to the revealed subset", () => {
  // Focus "z.a" reveals {c1, c2, c3} (expanded from mega1's children);
  // "outside" (zone z.b) never joins the revealed subset.
  function docWithFlows(flows: MapFlow[]): MapDocument {
    const c1 = node({ id: "c1" });
    const c2 = node({ id: "c2" });
    const c3 = node({ id: "c3" });
    const outside = node({ id: "outside", zone: "z.b" });
    const m = mega({ id: "mega1", children: ["c1", "c2", "c3"] });
    return baseDoc({
      zones: [zone({ id: "z.a" }), zone({ id: "z.b" })],
      nodes: [c1, c2, c3, outside, m],
      flows,
    });
  }

  it("survives verbatim when ALL node_ids are in the revealed subset", () => {
    const flow: MapFlow = {
      id: "f1",
      name: "Full Flow",
      node_ids: ["c1", "c2", "c3"],
      edge_ids: ["e1", "e2"],
      steps: ["step one", "step two", "step three"],
    };
    const doc = docWithFlows([flow]);
    const derived = deriveSubDocument(doc, "z.a");
    expect(derived.flows).toEqual([flow]);
  });

  it("trims node_ids and drops steps/edge_ids when only SOME (>=2) node_ids are revealed", () => {
    const flow: MapFlow = {
      id: "f1",
      name: "Partial Flow",
      node_ids: ["c1", "c2", "outside"],
      edge_ids: ["e1", "e2"],
      steps: ["step one", "step two", "step three"],
    };
    const doc = docWithFlows([flow]);
    const derived = deriveSubDocument(doc, "z.a");
    expect(derived.flows).toHaveLength(1);
    const carried = derived.flows![0]!;
    expect(carried.node_ids).toEqual(["c1", "c2"]);
    expect(carried.steps).toBeUndefined();
    expect(carried.edge_ids).toBeUndefined();
  });

  it("drops a flow with fewer than 2 revealed node_ids", () => {
    const flow: MapFlow = {
      id: "f1",
      name: "Barely There Flow",
      node_ids: ["c1", "outside"],
    };
    const doc = docWithFlows([flow]);
    const derived = deriveSubDocument(doc, "z.a");
    expect(derived.flows).toBeUndefined();
  });

  it("yields flows === undefined (not []) when no flow survives", () => {
    const flows: MapFlow[] = [
      { id: "f1", name: "Dropped One", node_ids: ["outside"] },
      { id: "f2", name: "Dropped Two", node_ids: ["c1", "outside"] },
    ];
    const doc = docWithFlows(flows);
    const derived = deriveSubDocument(doc, "z.a");
    expect(derived.flows).toBeUndefined();
  });

  it("non-regression: derived flows stay undefined when the parent doc has no flows", () => {
    const doc = baseDoc({
      nodes: [node({ id: "c1" }), mega({ id: "mega1", children: ["c1"] })],
    });
    expect(doc.flows).toBeUndefined();
    const derived = deriveSubDocument(doc, "z.a");
    expect(derived.flows).toBeUndefined();
  });
});
