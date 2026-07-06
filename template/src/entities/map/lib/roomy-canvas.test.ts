import { describe, expect, it } from "vitest";
import { roomyCanvas } from "./roomy-canvas";
import type { MapDocument, MapNode, MapZone } from "../model/types";

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

describe("roomyCanvas — scales gaps only", () => {
  it("scales canvas.gap.x/y and canvas.cell.card_gap by the given scale, rounded to int", () => {
    const doc = baseDoc();
    const result = roomyCanvas(doc, 1.6);
    expect(result.canvas.gap).toEqual({ x: 141, y: 112 }); // round(88*1.6)=141, round(70*1.6)=112
    expect(result.canvas.cell.card_gap).toBe(58); // round(36*1.6)=57.6 -> 58
  });

  it("defaults to scale 1.25 when no scale argument is given", () => {
    const doc = baseDoc();
    const withDefault = roomyCanvas(doc);
    const withExplicit = roomyCanvas(doc, 1.25);
    expect(withDefault.canvas.gap).toEqual(withExplicit.canvas.gap);
    expect(withDefault.canvas.cell.card_gap).toBe(
      withExplicit.canvas.cell.card_gap,
    );
  });

  it("leaves card_w/card_h untouched — only gaps grow, not card size", () => {
    const doc = baseDoc();
    const result = roomyCanvas(doc, 2);
    expect(result.canvas.cell.card_w).toBe(doc.canvas.cell.card_w);
    expect(result.canvas.cell.card_h).toBe(doc.canvas.cell.card_h);
  });

  it("leaves zpad untouched", () => {
    const doc = baseDoc();
    const result = roomyCanvas(doc, 2);
    expect(result.canvas.cell.zpad).toEqual(doc.canvas.cell.zpad);
  });

  it("leaves canvas.grid and canvas.margin untouched", () => {
    const doc = baseDoc();
    const result = roomyCanvas(doc, 2);
    expect(result.canvas.grid).toEqual(doc.canvas.grid);
    expect(result.canvas.margin).toBe(doc.canvas.margin);
  });
});

describe("roomyCanvas — adaptive wide-grid rule", () => {
  it("leaves gaps unscaled when canvas.grid.cols >= 4 (already width-bound)", () => {
    const doc = baseDoc({
      canvas: { ...baseDoc().canvas, grid: { cols: 4, rows: 1 } },
    });
    const result = roomyCanvas(doc);
    expect(result.canvas.gap).toEqual(doc.canvas.gap);
    expect(result.canvas.cell.card_gap).toBe(doc.canvas.cell.card_gap);
  });

  it("leaves gaps unscaled for grids wider than the threshold", () => {
    const doc = baseDoc({
      canvas: { ...baseDoc().canvas, grid: { cols: 8, rows: 1 } },
    });
    const result = roomyCanvas(doc, 1.6);
    expect(result.canvas.gap).toEqual(doc.canvas.gap);
    expect(result.canvas.cell.card_gap).toBe(doc.canvas.cell.card_gap);
  });

  it("scales gaps normally for a narrow grid (cols < 4, gap-starved)", () => {
    const doc = baseDoc({
      canvas: { ...baseDoc().canvas, grid: { cols: 2, rows: 1 } },
    });
    const result = roomyCanvas(doc);
    expect(result.canvas.gap).toEqual({ x: 110, y: 88 }); // round(88*1.25)=110, round(70*1.25)=87.5->88
    expect(result.canvas.cell.card_gap).toBe(45); // round(36*1.25)=45
  });
});

describe("roomyCanvas — node/edge set untouched", () => {
  it("does not reorder, add, or remove nodes", () => {
    const n1 = node({ id: "n1" });
    const n2 = node({ id: "n2" });
    const doc = baseDoc({ nodes: [n1, n2] });
    const result = roomyCanvas(doc, 1.6);
    expect(result.nodes).toBe(doc.nodes);
    expect(result.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it("never mints x/y on any node", () => {
    const n1 = node({ id: "n1" });
    const doc = baseDoc({ nodes: [n1] });
    const result = roomyCanvas(doc, 1.6);
    for (const n of result.nodes) {
      expect("x" in n).toBe(false);
      expect("y" in n).toBe(false);
    }
  });

  it("leaves edges, zones, composition, and meta as the same references", () => {
    const doc = baseDoc();
    const result = roomyCanvas(doc, 1.6);
    expect(result.edges).toBe(doc.edges);
    expect(result.zones).toBe(doc.zones);
    expect(result.composition).toBe(doc.composition);
    expect(result.meta).toBe(doc.meta);
  });
});

describe("roomyCanvas — purity", () => {
  it("does not mutate the input document", () => {
    const doc = baseDoc();
    const before = JSON.parse(JSON.stringify(doc)) as MapDocument;
    roomyCanvas(doc, 1.6);
    expect(doc).toEqual(before);
  });

  it("is deterministic across repeated calls on the same input", () => {
    const doc = baseDoc();
    expect(roomyCanvas(doc, 1.6)).toEqual(roomyCanvas(doc, 1.6));
  });

  it("returns a new document reference (copy), not the same object", () => {
    const doc = baseDoc();
    const result = roomyCanvas(doc, 1.6);
    expect(result).not.toBe(doc);
    expect(result.canvas).not.toBe(doc.canvas);
    expect(result.canvas.cell).not.toBe(doc.canvas.cell);
  });
});
