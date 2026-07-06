import { describe, expect, it } from "vitest";
import { computeComposedLayout, curve } from "./composed-layout";
import type { MapDocument, MapNode, MapZone } from "../model/types";

// SPEC-006 AC-2 — computeComposedLayout is pure: deterministic, pinned-cols
// (column count from zone.cols, never derived from node count), append-stable
// (earlier positions survive a later-found_at node being added, whether or
// not the append crosses into a new row), and bounded/finite output.

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
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe("computeComposedLayout — SPEC-006 AC-2", () => {
  it("is deterministic: the same document twice produces deep-equal output", () => {
    const doc = baseDoc({
      nodes: [
        node({ id: "n1", found_at: "2026-01-01T00:00:00.000Z" }),
        node({ id: "n2", found_at: "2026-01-02T00:00:00.000Z" }),
        node({ id: "n3", found_at: "2026-01-03T00:00:00.000Z" }),
      ],
    });
    const a = computeComposedLayout(doc);
    const b = computeComposedLayout(doc);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
    expect([...a.nodePositions.entries()]).toEqual([
      ...b.nodePositions.entries(),
    ]);
    expect([...a.zoneRects.entries()]).toEqual([...b.zoneRects.entries()]);
    expect(a.edgePaths).toEqual(b.edgePaths);
    expect(a.connectorPaths).toEqual(b.connectorPaths);
  });

  it("pins column count from zone.cols, never derives it from node count", () => {
    // zone.cols=3 with only 2 nodes: a node-count-derived layout would pick
    // 2 cols (or 1), not 3 — assert both nodes land in row 0 (cols 0 and 1),
    // proving the sub-grid width came from the pinned cols=3, not ceil(n/1).
    const doc = baseDoc({
      zones: [zone({ cols: 3 })],
      nodes: [
        node({ id: "n1", found_at: "2026-01-01T00:00:00.000Z" }),
        node({ id: "n2", found_at: "2026-01-02T00:00:00.000Z" }),
      ],
    });
    const layout = computeComposedLayout(doc);
    const p1 = layout.nodePositions.get("n1")!;
    const p2 = layout.nodePositions.get("n2")!;
    expect(p1.y).toBe(p2.y); // same row — 3 pinned cols fit both side by side
    expect(p2.x).toBeGreaterThan(p1.x);
  });

  it("append-stability: adding a later node without crossing a row boundary leaves earlier positions byte-identical", () => {
    const before = baseDoc({
      zones: [zone({ cols: 2 })],
      nodes: [node({ id: "n1", found_at: "2026-01-01T00:00:00.000Z" })],
    });
    const after = baseDoc({
      zones: [zone({ cols: 2 })],
      nodes: [
        node({ id: "n1", found_at: "2026-01-01T00:00:00.000Z" }),
        node({ id: "n2", found_at: "2026-01-02T00:00:00.000Z" }), // appended later, same row (cols=2)
      ],
    });
    const layoutBefore = computeComposedLayout(before);
    const layoutAfter = computeComposedLayout(after);
    expect(layoutAfter.nodePositions.get("n1")).toEqual(
      layoutBefore.nodePositions.get("n1"),
    );
  });

  it("append-stability: an append that wraps into a new row still leaves every earlier position byte-identical", () => {
    const before = baseDoc({
      zones: [zone({ cols: 2 })],
      nodes: [
        node({ id: "n1", found_at: "2026-01-01T00:00:00.000Z" }),
        node({ id: "n2", found_at: "2026-01-02T00:00:00.000Z" }),
      ],
    });
    const after = baseDoc({
      zones: [zone({ cols: 2 })],
      nodes: [
        node({ id: "n1", found_at: "2026-01-01T00:00:00.000Z" }),
        node({ id: "n2", found_at: "2026-01-02T00:00:00.000Z" }),
        node({ id: "n3", found_at: "2026-01-03T00:00:00.000Z" }), // wraps to row 1
      ],
    });
    const layoutBefore = computeComposedLayout(before);
    const layoutAfter = computeComposedLayout(after);
    expect(layoutAfter.nodePositions.get("n1")).toEqual(
      layoutBefore.nodePositions.get("n1"),
    );
    expect(layoutAfter.nodePositions.get("n2")).toEqual(
      layoutBefore.nodePositions.get("n2"),
    );
    const p3 = layoutAfter.nodePositions.get("n3")!;
    const p1 = layoutAfter.nodePositions.get("n1")!;
    expect(p3.y).toBeGreaterThan(p1.y); // downstream translation, not overlap
  });

  it("produces bounded, finite output for a multi-zone, multi-edge document", () => {
    const doc = baseDoc({
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
      zones: [zone({ id: "z.a", cols: 2 }), zone({ id: "z.b", cols: 1 })],
      composition: {
        template: "generic",
        arrangement: "stack-ttb",
        entry_zone: "z.a",
        placements: [
          { zone: "z.a", cell: { row: 0, col: 0 } },
          { zone: "z.b", cell: { row: 0, col: 1 } },
        ],
        zone_connectors: [{ from: "z.a", to: "z.b", label: "flows to" }],
      },
      nodes: [
        node({ id: "n1", zone: "z.a", found_at: "2026-01-01T00:00:00.000Z" }),
        node({ id: "n2", zone: "z.b", found_at: "2026-01-02T00:00:00.000Z" }),
      ],
      edges: [{ from: "n1", to: "n2", relation: "informs" }],
    });
    const layout = computeComposedLayout(doc);
    expect(Number.isFinite(layout.width)).toBe(true);
    expect(Number.isFinite(layout.height)).toBe(true);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    for (const pos of layout.nodePositions.values()) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
    expect(layout.edgePaths).toHaveLength(1);
    expect(layout.connectorPaths).toHaveLength(1);
    expect(layout.edgePaths[0]?.d).toMatch(/^M /);
    expect(layout.connectorPaths[0]?.d).toMatch(/^M /);
  });

  it("skips edges/connectors whose endpoints have no resolved position, without throwing", () => {
    const doc = baseDoc({
      nodes: [node({ id: "n1", found_at: "2026-01-01T00:00:00.000Z" })],
      edges: [{ from: "n1", to: "does-not-exist", relation: "informs" }],
    });
    expect(() => computeComposedLayout(doc)).not.toThrow();
    const layout = computeComposedLayout(doc);
    expect(layout.edgePaths).toHaveLength(0);
  });

  it("a collapsed mega-node stands in for its children: children get no position (not double-drawn)", () => {
    // The emitter puts BOTH the mega and its children in nodes[] (validate.ts
    // Rule 11 requires the children present). Rendering both would draw the
    // "N collapsed nodes" card next to all N children. The collapsed
    // children must have no layout position so ComposedMapView skips them.
    const doc = baseDoc({
      nodes: [
        node({ id: "c1", found_at: "2026-01-01T00:00:01.000Z" }),
        node({ id: "c2", found_at: "2026-01-01T00:00:02.000Z" }),
        node({
          id: "mega",
          label: "2 collapsed nodes",
          is_mega: true,
          collapsed: true,
          children: ["c1", "c2"],
          found_at: "2026-01-01T00:00:03.000Z",
        }),
      ],
      edges: [{ from: "c1", to: "c2", relation: "informs" }],
    });
    const layout = computeComposedLayout(doc);
    // the mega renders; its children do not
    expect(layout.nodePositions.has("mega")).toBe(true);
    expect(layout.nodePositions.has("c1")).toBe(false);
    expect(layout.nodePositions.has("c2")).toBe(false);
    // an edge between two hidden children drops (no dangling path)
    expect(layout.edgePaths).toHaveLength(0);
  });

  it("a non-collapsed mega-node keeps its children visible", () => {
    const doc = baseDoc({
      nodes: [
        node({ id: "c1", found_at: "2026-01-01T00:00:01.000Z" }),
        node({
          id: "mega",
          is_mega: true,
          collapsed: false,
          children: ["c1"],
          found_at: "2026-01-01T00:00:02.000Z",
        }),
      ],
    });
    const layout = computeComposedLayout(doc);
    expect(layout.nodePositions.has("c1")).toBe(true);
    expect(layout.nodePositions.has("mega")).toBe(true);
  });
});

describe("curve()", () => {
  it("produces a well-formed SVG cubic-bezier path string", () => {
    const a = { x: 0, y: 0, w: 190, h: 60, cx: 95, cy: 30 };
    const b = { x: 300, y: 200, w: 190, h: 60, cx: 395, cy: 230 };
    const result = curve(a, b, 0);
    expect(result.d).toMatch(/^M -?[\d.]+ -?[\d.]+ C /);
    expect(Number.isFinite(result.mid.x)).toBe(true);
    expect(Number.isFinite(result.mid.y)).toBe(true);
  });
});
