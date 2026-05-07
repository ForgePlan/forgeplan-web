import { describe, it, expect } from "vitest";
import {
  assignSankeyColumns,
  buildSankeyPayload,
  adaptiveCanvasHeight,
  dropCollidingLabels,
  MIN_CANVAS_HEIGHT_PX,
  MIN_NODE_HEIGHT_PX,
  LABEL_LINE_HEIGHT_PX,
} from "./sankey-layout";
import type { ArtifactSummary } from "@/entities/artifact";

const mk = (id: string, kind: string): ArtifactSummary =>
  ({ id, kind, title: "", status: "active" }) as ArtifactSummary;

describe("assignSankeyColumns — column = compact tier of kind", () => {
  it("orders prd / rfc / evidence as 0 / 1 / 2", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "rfc"), mk("C", "evidence")],
      [],
    );
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(1);
    expect(cols["C"]).toBe(2);
  });

  it("missing tiers collapse: prd + evidence → 0 / 1 (no gap)", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "evidence"), mk("C", "evidence")],
      [],
    );
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(1);
    expect(cols["C"]).toBe(1);
  });

  it("kinds that share a tier share a column (two PRDs both 0)", () => {
    const cols = assignSankeyColumns([mk("P1", "prd"), mk("P2", "prd")], []);
    expect(cols["P1"]).toBe(0);
    expect(cols["P2"]).toBe(0);
  });
});

describe("buildSankeyPayload — direction normalised abstract → concrete", () => {
  it("evidence informs PRD: link goes from PRD column → evidence column", () => {
    const { links } = buildSankeyPayload(
      [mk("PRD-1", "prd"), mk("EVID-1", "evidence")],
      [{ from: "EVID-1", to: "PRD-1", relation: "informs" }],
    );
    expect(links).toHaveLength(1);
    // 'informs' → target (PRD-1) is the parent; layout flows from
    // PRD-1 (column 0) to EVID-1 (column 1).
    expect(links[0]?.source).toBe("PRD-1");
    expect(links[0]?.target).toBe("EVID-1");
  });

  it("rfc refines PRD: link from PRD → RFC (PRD parent, RFC child)", () => {
    const { links } = buildSankeyPayload(
      [mk("PRD-1", "prd"), mk("RFC-1", "rfc")],
      [{ from: "RFC-1", to: "PRD-1", relation: "refines" }],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.source).toBe("PRD-1");
    expect(links[0]?.target).toBe("RFC-1");
  });

  it("contains: source remains parent (PRD contains spec → PRD → spec)", () => {
    const { links } = buildSankeyPayload(
      [mk("PRD-1", "prd"), mk("SPEC-1", "spec")],
      [{ from: "PRD-1", to: "SPEC-1", relation: "contains" }],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.source).toBe("PRD-1");
    expect(links[0]?.target).toBe("SPEC-1");
  });

  it("intra-tier edges (same column) are dropped", () => {
    const { links } = buildSankeyPayload(
      [mk("ADR-1", "adr"), mk("ADR-2", "adr")],
      [{ from: "ADR-2", to: "ADR-1", relation: "supersedes" }],
    );
    expect(links).toHaveLength(0);
  });

  it("nodes carry their compact-tier column + kind", () => {
    const { nodes } = buildSankeyPayload(
      [mk("A", "prd"), mk("B", "rfc"), mk("C", "evidence")],
      [],
    );
    expect(nodes.find((n) => n.id === "A")?.column).toBe(0);
    expect(nodes.find((n) => n.id === "B")?.column).toBe(1);
    expect(nodes.find((n) => n.id === "C")?.column).toBe(2);
    expect(nodes.find((n) => n.id === "A")?.kind).toBe("prd");
  });
});

describe("adaptiveCanvasHeight — VIEW_H grows with column density", () => {
  it("empty set returns the minimum floor", () => {
    expect(adaptiveCanvasHeight([])).toBe(MIN_CANVAS_HEIGHT_PX);
  });

  it("sparse columns (≤12 nodes) stay at the 760 floor", () => {
    const nodes = Array.from({ length: 12 }, () => ({ column: 0 }));
    expect(adaptiveCanvasHeight(nodes)).toBe(MIN_CANVAS_HEIGHT_PX);
  });

  it("dense columns (≥26 nodes) grow past the floor to keep bars chunky", () => {
    const nodes = Array.from({ length: 26 }, () => ({ column: 0 }));
    const got = adaptiveCanvasHeight(nodes);
    expect(got).toBeGreaterThan(MIN_CANVAS_HEIGHT_PX);
    // 26 * 32 + 25 * 26 + 2 * 32 = 1546
    expect(got).toBe(26 * MIN_NODE_HEIGHT_PX + 25 * 26 + 2 * 32);
  });

  it("uses the densest column, not total node count", () => {
    const nodes = [
      ...Array.from({ length: 100 }, () => ({ column: 0 })),
      ...Array.from({ length: 20 }, () => ({ column: 1 })),
    ];
    expect(adaptiveCanvasHeight(nodes)).toBe(100 * MIN_NODE_HEIGHT_PX + 99 * 26 + 2 * 32);
  });
});

describe("dropCollidingLabels — keeps non-overlapping labels", () => {
  it("returns empty set when labels are spaced apart", () => {
    const nodes = [
      { id: "A", column: 0, y0: 0, y1: 10 },
      { id: "B", column: 0, y0: 30, y1: 40 },
      { id: "C", column: 0, y0: 60, y1: 70 },
    ];
    expect(dropCollidingLabels(nodes).size).toBe(0);
  });

  it("drops every other label in a dense column", () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({
      id: `N${i}`,
      column: 0,
      y0: i * 12,
      y1: i * 12 + 4,
    }));
    const dropped = dropCollidingLabels(nodes);
    expect(dropped.size).toBe(5);
    expect(dropped.has("N0")).toBe(false);
    expect(dropped.has("N1")).toBe(true);
    expect(dropped.has("N2")).toBe(false);
    expect(dropped.has("N3")).toBe(true);
  });

  it("first label always survives — kept count is bounded by floor(span / lineHeight) + 1", () => {
    const nodes = Array.from({ length: 8 }, (_, i) => ({
      id: `N${i}`,
      column: 0,
      y0: i * 4,
      y1: i * 4 + 2,
    }));
    const dropped = dropCollidingLabels(nodes);
    expect(dropped.has("N0")).toBe(false);
    expect(nodes.length - dropped.size).toBeLessThan(nodes.length);
    expect(dropped.size).toBeGreaterThanOrEqual(4);
  });

  it("treats columns independently", () => {
    const nodes = [
      { id: "A0", column: 0, y0: 0, y1: 4 },
      { id: "A1", column: 0, y0: 5, y1: 9 },
      { id: "B0", column: 1, y0: 0, y1: 4 },
      { id: "B1", column: 1, y0: 100, y1: 104 },
    ];
    const dropped = dropCollidingLabels(nodes);
    expect(dropped.has("A1")).toBe(true);
    expect(dropped.has("B0")).toBe(false);
    expect(dropped.has("B1")).toBe(false);
  });

  it("respects custom line height", () => {
    const nodes = [
      { id: "A", column: 0, y0: 0, y1: 10 },
      { id: "B", column: 0, y0: 20, y1: 30 },
    ];
    expect(dropCollidingLabels(nodes, 50).has("B")).toBe(true);
    expect(dropCollidingLabels(nodes, 5).has("B")).toBe(false);
  });

  it("uses default line height of 22px", () => {
    expect(LABEL_LINE_HEIGHT_PX).toBe(22);
    const nodes = [
      { id: "A", column: 0, y0: 0, y1: 4 },
      { id: "B", column: 0, y0: 6, y1: 10 },
    ];
    expect(dropCollidingLabels(nodes).has("B")).toBe(true);
  });
});
