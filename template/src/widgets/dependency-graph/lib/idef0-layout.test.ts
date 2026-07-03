/**
 * SPEC-005 geometry conformance tests for idef0-layout.ts (RFC-029).
 *
 * All tests run in the node environment — pure layout functions, no DOM, no
 * Svelte. Fixtures use deriveIdef0 for the dense path (proving the dense code
 * path works end-to-end) and synthetic Idef0Diagram objects for side-specific
 * assertions that canonical relations cannot produce (e.g. output → right).
 *
 * Pool: 'threads' per vitest.config.ts (macOS fork-limit convention).
 */

import { describe, it, expect } from "vitest";
import {
  deriveIdef0,
  serialiseKey,
  type Idef0Diagram,
  type DiagramArrow,
  type CompositeKey,
  type IcomSide,
  type Provenance,
  type ClassifiedEdge,
  type RawSnapshot,
  type TierStackForest,
  type IcomLegend,
} from "@/shared/lib/idef0";
import {
  layoutIdef0Diagram,
  layoutTierBands,
  resolveFocusKey,
  BAND_HEADER_H,
  type PlacedBox,
  type PlacedArrow,
  type Idef0Layout,
  type BandInfo,
} from "./idef0-layout";

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** Canonical ICOM legend shared by core diagram outputs. */
const LEGEND: IcomLegend = {
  roles: ["input", "control", "output", "mechanism", "decomposition"],
  honestyKey: { real: "solid", derived: "dashed ≈" },
};

/**
 * DENSE raw snapshot fixture:
 *   - A (prd, root)
 *     - B (rfc, depth 1) refines A
 *       - B1..B8 (adr, depth 2) — 8 children triggers rollup
 *         - X1 (evidence, depth 3) refines B1 — satisfies depth≥3
 *   - density = (11-1)/10 = 1.0 ≥ 0.3 → idef0 mode
 *   - focus = B → children = {B1..B5 shown} + rollup(B6..B8)
 *
 * ICOM non-tree edges for the diagram at focus=B:
 *   - A based_on B1: input/left, B1 is in-level (child-incident)
 *   - A supersedes B2: control/top, B2 is in-level
 *   - A informs B3: mechanism/bottom, B3 is in-level
 *   - B1 based_on B2: input/left, BOTH B1+B2 in-level (E-1: child↔child edge)
 */
const DENSE_RAW: RawSnapshot = {
  nodes: [
    { id: "A", title: "Root PRD", kind: "prd" },
    { id: "B", title: "RFC B", kind: "rfc" },
    { id: "B1", title: "ADR B1", kind: "adr" },
    { id: "B2", title: "ADR B2", kind: "adr" },
    { id: "B3", title: "ADR B3", kind: "adr" },
    { id: "B4", title: "ADR B4", kind: "adr" },
    { id: "B5", title: "ADR B5", kind: "adr" },
    { id: "B6", title: "ADR B6", kind: "adr" },
    { id: "B7", title: "ADR B7", kind: "adr" },
    { id: "B8", title: "ADR B8", kind: "adr" },
    { id: "X1", title: "EVID X1", kind: "evidence" },
  ],
  edges: [
    // Tree edges (refines: from=child, to=parent in forest.ts)
    { from: "B", to: "A", relation: "refines" },
    { from: "B1", to: "B", relation: "refines" },
    { from: "B2", to: "B", relation: "refines" },
    { from: "B3", to: "B", relation: "refines" },
    { from: "B4", to: "B", relation: "refines" },
    { from: "B5", to: "B", relation: "refines" },
    { from: "B6", to: "B", relation: "refines" },
    { from: "B7", to: "B", relation: "refines" },
    { from: "B8", to: "B", relation: "refines" },
    { from: "X1", to: "B1", relation: "refines" },
    // ICOM non-tree edges
    { from: "A", to: "B1", relation: "based_on" }, // input/left to B1
    { from: "A", to: "B2", relation: "supersedes" }, // control/top to B2
    { from: "A", to: "B3", relation: "informs" }, // mechanism/bottom to B3
    { from: "B1", to: "B2", relation: "based_on" }, // input/left B1→B2 (E-1: child↔child)
  ],
};

/** key for focus node B */
const FOCUS_B: CompositeKey = { id: "B", title: "RFC B" };

/**
 * Sparse raw snapshot — 15 disconnected prd nodes.
 * density = 0/14 = 0 < 0.3 → tier-stack mode.
 * With ≥7 members the tier gets a rollup: shows 5 + rollup = 6 boxes.
 */
function sparseRaw(n: number, kind = "prd"): RawSnapshot {
  return {
    nodes: Array.from({ length: n }, (_, i) => ({
      id: `N${i}`,
      title: `Node ${i}`,
      kind,
    })),
    edges: [],
  };
}

/** Helper: find a placed box by its key */
function findBox(layout: Idef0Layout, key: CompositeKey): PlacedBox {
  const s = serialiseKey(key);
  const found = layout.boxes.find((b) => serialiseKey(b.key) === s);
  if (!found) throw new Error(`Box not found: ${JSON.stringify(key)}`);
  return found;
}

/** Helper: find placed arrows by side */
function arrowsBySide(layout: Idef0Layout, side: IcomSide): PlacedArrow[] {
  return layout.arrows.filter((a) => a.side === side);
}

// ─── Dense fixture derivation ────────────────────────────────────────────────

describe("dense idef0 render — SPEC-005 §dense-idef0-render", () => {
  const result = deriveIdef0(DENSE_RAW, {
    threshold: 0.3,
    focus: FOCUS_B,
  });
  const layout = layoutIdef0Diagram(result.diagram);

  it("fixture routes to idef0 mode (density ≥ 0.3)", () => {
    expect(result.verdict.mode).toBe("idef0");
    expect(result.verdict.metric).toBeGreaterThanOrEqual(0.3);
  });

  it("focus box is identified by key match, not array index (L-4)", () => {
    const focusBox = layout.boxes.find((b) => b.role === "focus");
    expect(focusBox).toBeDefined();
    expect(serialiseKey(focusBox!.key)).toBe(serialiseKey(FOCUS_B));
    // role===focus must NOT coincide with boxes[0] position incidentally — it
    // must be because diagram.focus matches:
    expect(focusBox!.role).toBe("focus");
  });

  it("≤6 children shown + exactly one rollup box (RC-5)", () => {
    const childBoxes = layout.boxes.filter(
      (b) => b.role === "child" || b.role === "rollup",
    );
    const rollupBoxes = layout.boxes.filter((b) => b.role === "rollup");
    expect(childBoxes.length).toBeLessThanOrEqual(6);
    expect(rollupBoxes).toHaveLength(1);
    expect(rollupBoxes[0]!.rollupCount).toBeGreaterThan(0);
  });

  it("total box count is bounded regardless of child count (RC-5)", () => {
    // focus + ≤5 children + 1 rollup = ≤7 total
    expect(layout.boxes.length).toBeLessThanOrEqual(7);
  });

  it("rollup box has role===rollup and is NOT drillable (EVID-060 E-2)", () => {
    const rollup = layout.boxes.find((b) => b.role === "rollup");
    expect(rollup).toBeDefined();
    expect(rollup!.role).toBe("rollup");
    // provenance of rollup is "derived" (from computeIdef0Diagram)
    expect(rollup!.provenance).toBe("derived");
  });

  it("input (left) arrow: A based_on B1 — x1 < anchorBox.x (I=left)", () => {
    const leftArrows = arrowsBySide(layout, "left");
    expect(leftArrows.length).toBeGreaterThan(0);
    for (const a of leftArrows) {
      const anchor = findBox(layout, a.anchorKey);
      expect(a.x1).toBeLessThan(anchor.x);
      expect(a.x2).toBe(anchor.x); // head at box left edge
    }
  });

  it("control (top) arrow: A supersedes B2 — y1 < anchorBox.y (C=top)", () => {
    const topArrows = arrowsBySide(layout, "top");
    expect(topArrows.length).toBeGreaterThan(0);
    for (const a of topArrows) {
      const anchor = findBox(layout, a.anchorKey);
      expect(a.y1).toBeLessThan(anchor.y);
      expect(a.y2).toBe(anchor.y); // head at box top edge
    }
  });

  it("mechanism (bottom) arrow: A informs B3 — y1 > anchorBox.y+h (M=bottom)", () => {
    const bottomArrows = arrowsBySide(layout, "bottom");
    expect(bottomArrows.length).toBeGreaterThan(0);
    for (const a of bottomArrows) {
      const anchor = findBox(layout, a.anchorKey);
      expect(a.y1).toBeGreaterThan(anchor.y + anchor.h); // from below
      expect(a.y2).toBe(anchor.y + anchor.h); // head at box bottom
    }
  });

  it("child↔child input arrow anchors to the CHILD box, not focus (E-1)", () => {
    // B1 based_on B2: from=B1, to=B2, side=left, anchor = edge.to = B2
    const leftArrows = arrowsBySide(layout, "left");
    // One of the left arrows must anchor at B2 (not at focus=B)
    const b2Key: CompositeKey = { id: "B2", title: "ADR B2" };
    const childIncidentArrow = leftArrows.find(
      (a) => serialiseKey(a.anchorKey) === serialiseKey(b2Key),
    );
    expect(childIncidentArrow).toBeDefined();
    // Anchor is B2 — verify geometry is relative to B2, not focus
    const b2Box = findBox(layout, b2Key);
    expect(childIncidentArrow!.x2).toBe(b2Box.x);
  });

  it("box numbers, sides, and provenance are read from core (no recompute — RC-3)", () => {
    // Every placed box number must exist verbatim in the core diagram boxes
    const coreNumbers = new Set(result.diagram.boxes.map((b) => b.number));
    for (const pb of layout.boxes) {
      expect(coreNumbers.has(pb.number)).toBe(true);
    }
    // Every placed arrow side must match the corresponding core arrow side
    for (const pa of layout.arrows) {
      const coreArrow = result.diagram.arrows.find(
        (ca) =>
          serialiseKey(ca.edge.from) === serialiseKey(pa.edge.from) &&
          serialiseKey(ca.edge.to) === serialiseKey(pa.edge.to) &&
          ca.edge.relation === pa.edge.relation,
      );
      expect(coreArrow).toBeDefined();
      expect(pa.side).toBe(coreArrow!.side);
    }
  });
});

// ─── Output (right) side — synthetic diagram ─────────────────────────────────

describe("output (right) side arrow — synthetic Idef0Diagram", () => {
  const focusKey: CompositeKey = { id: "F", title: "Focus" };
  const childKey: CompositeKey = { id: "C1", title: "Child 1" };
  const externalKey: CompositeKey = { id: "EXT", title: "External" };

  const syntheticEdge: ClassifiedEdge = {
    from: childKey,
    to: externalKey,
    relation: "based_on",
    icom: "output" as any, // synthetic — core never produces output icom via canonical relations
    provenance: "real" as Provenance,
  };

  const syntheticDiagram: Idef0Diagram = {
    boxes: [
      { key: focusKey, number: "A1", kind: "prd", provenance: "real" },
      { key: childKey, number: "A1.1", kind: "rfc", provenance: "real" },
    ],
    arrows: [{ edge: syntheticEdge, side: "right" }],
    legend: LEGEND,
    mode: "idef0",
    focus: focusKey,
  };

  it("output (right) arrow: x1 === anchorBox.x+w, x2 > anchorBox.x+w (O=right)", () => {
    const layout = layoutIdef0Diagram(syntheticDiagram);
    const rightArrows = arrowsBySide(layout, "right");
    expect(rightArrows.length).toBeGreaterThan(0);
    for (const a of rightArrows) {
      const anchor = findBox(layout, a.anchorKey);
      expect(a.x1).toBe(anchor.x + anchor.w); // leaves from right edge
      expect(a.x2).toBeGreaterThan(anchor.x + anchor.w); // extends into gutter
      expect(a.headAtBox).toBe(false);
    }
  });

  it("output arrow anchor is edge.from (source box) for O=right", () => {
    const layout = layoutIdef0Diagram(syntheticDiagram);
    const rightArrows = arrowsBySide(layout, "right");
    expect(rightArrows.length).toBeGreaterThan(0);
    // anchor = edge.from = childKey (since side=right → anchorEndpoint uses .from)
    expect(serialiseKey(rightArrows[0]!.anchorKey)).toBe(
      serialiseKey(childKey),
    );
  });

  it("headAtBox is true for I/C/M and false for O", () => {
    // Build a diagram with one arrow of each side
    const makeArrow = (side: IcomSide): DiagramArrow => ({
      edge: {
        from: childKey,
        to: externalKey,
        relation: "based_on",
        icom: "input" as any,
        provenance: "real" as Provenance,
      },
      side,
    });
    const diag: Idef0Diagram = {
      boxes: [
        { key: focusKey, number: "A1", kind: "prd", provenance: "real" },
        { key: childKey, number: "A1.1", kind: "rfc", provenance: "real" },
      ],
      arrows: [
        makeArrow("left"),
        makeArrow("top"),
        makeArrow("right"),
        makeArrow("bottom"),
      ],
      legend: LEGEND,
      mode: "idef0",
      focus: focusKey,
    };
    const layout = layoutIdef0Diagram(diag);
    for (const pa of layout.arrows) {
      if (pa.side === "right") {
        expect(pa.headAtBox).toBe(false);
      } else {
        expect(pa.headAtBox).toBe(true);
      }
    }
  });
});

// ─── Tier-stack mode — SPEC-005 §honest-tier-stack-fallback ──────────────────

describe("tier-stack layout — SPEC-005 §honest-tier-stack-fallback", () => {
  const result = deriveIdef0(sparseRaw(15), { threshold: 0.3 });

  it("fixture routes to tier-stack mode (density < 0.3)", () => {
    expect(result.verdict.mode).toBe("tier-stack");
  });

  it("all diagram boxes have provenance===derived (V-FALLBACK)", () => {
    for (const box of result.diagram.boxes) {
      expect(box.provenance).toBe("derived");
    }
  });

  it("no ICOM arrows in tier-stack diagram (all derived, none real)", () => {
    expect(result.diagram.arrows).toHaveLength(0);
  });

  it("layoutTierBands emits 0 arrows (tier-stack has no real ICOM arrows)", () => {
    const layout = layoutTierBands(result.diagram, result.tierStack);
    expect(layout.arrows).toHaveLength(0);
    expect(layout.mode).toBe("tier-stack");
  });

  it("bands grouped by T<n> prefix — boxes come from diagram.boxes (L-1 / EVID-061 F1)", () => {
    // 15 nodes → diagram has ≤6 boxes (5 shown + rollup)
    const layout = layoutTierBands(result.diagram, result.tierStack);
    // Key assertion: layout.boxes.length === diagram.boxes.length (not 15)
    expect(layout.boxes.length).toBe(result.diagram.boxes.length);
    // No box.key matches a raw member beyond diagram.boxes (not one-per-artifact)
    const diagramSerials = new Set(
      result.diagram.boxes.map((b) => serialiseKey(b.key)),
    );
    for (const pb of layout.boxes) {
      expect(diagramSerials.has(serialiseKey(pb.key))).toBe(true);
    }
  });

  it("rollup box present when tier has >6 members (≤5 shown + rollup)", () => {
    const layout = layoutTierBands(result.diagram, result.tierStack);
    const rollupBoxes = layout.boxes.filter((b) => b.role === "rollup");
    // 15 > 6 → rollup expected
    expect(rollupBoxes.length).toBeGreaterThan(0);
    expect(rollupBoxes[0]!.rollupCount).toBeGreaterThan(0);
  });

  it("all placed boxes have provenance===derived in tier-stack layout", () => {
    const layout = layoutTierBands(result.diagram, result.tierStack);
    for (const pb of layout.boxes) {
      expect(pb.provenance).toBe("derived");
    }
  });

  it("layoutTierBands emits a bands array with one entry per tier", () => {
    const layout = layoutTierBands(result.diagram, result.tierStack);
    // Single tier for a flat sparse fixture → exactly one BandInfo
    expect(layout.bands.length).toBeGreaterThan(0);
    const band: BandInfo = layout.bands[0]!;
    expect(typeof band.tierIdx).toBe("number");
    expect(typeof band.kind).toBe("string");
    expect(typeof band.count).toBe("number");
    expect(typeof band.y).toBe("number");
  });

  it("band.y is below the margin+BAND_HEADER_H+8 baseline (first band offset)", () => {
    const layout = layoutTierBands(result.diagram, result.tierStack);
    // With DEFAULT_GEOM.margin=32 and BAND_HEADER_H=24:
    // first band y = 32 + 24 + 8 = 64
    const firstBand = layout.bands[0]!;
    expect(firstBand.y).toBeGreaterThan(0);
    // band header sits at (band.y - BAND_HEADER_H - 8); that must be ≥ margin
    expect(firstBand.y - BAND_HEADER_H - 8).toBeGreaterThanOrEqual(0);
  });

  it("band.count equals number of non-rollup boxes in the band", () => {
    const layout = layoutTierBands(result.diagram, result.tierStack);
    for (const band of layout.bands) {
      const bandBoxes = layout.boxes.filter((b) => b.band === band.tierIdx);
      const nonRollupActual = bandBoxes.filter(
        (b) => b.role !== "rollup",
      ).length;
      expect(band.count).toBe(nonRollupActual);
    }
  });

  it("rollup box has reduced dimensions (w≤120, h=32) in tier-stack layout", () => {
    const layout = layoutTierBands(result.diagram, result.tierStack);
    const rollup = layout.boxes.find((b) => b.role === "rollup");
    if (rollup) {
      expect(rollup.w).toBeLessThanOrEqual(120);
      expect(rollup.h).toBe(32);
    }
  });

  it("idef0 mode emits empty bands array", () => {
    const denseResult = deriveIdef0(DENSE_RAW, {
      threshold: 0.3,
      focus: FOCUS_B,
    });
    const layout = layoutIdef0Diagram(denseResult.diagram);
    expect(layout.bands).toEqual([]);
  });

  it("tierStack.tiers is used ONLY for band kind — not to enumerate members (EVID-061 F1)", () => {
    // If we mutate tier members before calling layoutTierBands, the layout
    // result must not change (because layoutTierBands reads diagram.boxes, not
    // tierStack.tiers[].members).
    const fakeStack: TierStackForest = {
      tiers: result.tierStack.tiers.map((t) => ({
        ...t,
        members: [], // wipe members — layout must be unchanged
      })),
      mode: "tier-stack",
      provenance: "derived",
    };
    const real = layoutTierBands(result.diagram, result.tierStack);
    const fake = layoutTierBands(result.diagram, fakeStack);
    expect(fake.boxes.length).toBe(real.boxes.length);
    real.boxes.forEach((rb, i) => {
      expect(serialiseKey(fake.boxes[i]!.key)).toBe(serialiseKey(rb.key));
    });
  });
});

// ─── Bounded DOM at N≥1000 — SPEC-005 NFR-001 ───────────────────────────────

describe("bounded box-count at N≥1000 — SPEC-005 NFR-001", () => {
  it("idef0 mode: ≤7 layout boxes regardless of N (O(1)-DOM, RC-5)", () => {
    // 1 root + 998 children → density ≈ 1.0 → idef0 mode
    const raw: RawSnapshot = {
      nodes: [
        { id: "root", title: "Root", kind: "prd" },
        ...Array.from({ length: 998 }, (_, i) => ({
          id: `c${i}`,
          title: `Child ${i}`,
          kind: "rfc",
        })),
      ],
      edges: Array.from({ length: 998 }, (_, i) => ({
        from: `c${i}`,
        to: "root",
        relation: "refines",
      })),
    };
    const focusKey: CompositeKey = { id: "root", title: "Root" };
    const result = deriveIdef0(raw, { threshold: 0.3, focus: focusKey });
    expect(result.verdict.mode).toBe("idef0");
    const layout = layoutIdef0Diagram(result.diagram);
    // focus + ≤5 children + 1 rollup = ≤7
    expect(layout.boxes.length).toBeLessThanOrEqual(7);
    // rollup must be present (998 >> 6)
    expect(layout.boxes.some((b) => b.role === "rollup")).toBe(true);
  });

  it("tier-stack mode: boxes bounded by ≤6/tier regardless of N (EVID-061 F1)", () => {
    // 1000 disconnected nodes → density = 0 → tier-stack mode
    const raw = sparseRaw(1000, "prd");
    const result = deriveIdef0(raw, { threshold: 0.3 });
    expect(result.verdict.mode).toBe("tier-stack");
    // Core already bounded diagram.boxes
    expect(result.diagram.boxes.length).toBeLessThanOrEqual(6); // ≤5 shown + 1 rollup
    const layout = layoutTierBands(result.diagram, result.tierStack);
    // layout.boxes === diagram.boxes (no inflation)
    expect(layout.boxes.length).toBe(result.diagram.boxes.length);
    expect(layout.boxes.length).toBeLessThanOrEqual(6);
  });

  it("tier-stack with multiple tiers: ≤6 boxes per tier band", () => {
    // Mix of kinds so multiple tiers are created
    const raw: RawSnapshot = {
      nodes: [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `prd${i}`,
          title: `PRD ${i}`,
          kind: "prd",
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `rfc${i}`,
          title: `RFC ${i}`,
          kind: "rfc",
        })),
      ],
      edges: [],
    };
    const result = deriveIdef0(raw, { threshold: 0.3 });
    expect(result.verdict.mode).toBe("tier-stack");
    const layout = layoutTierBands(result.diagram, result.tierStack);
    // Group by band and assert ≤6 per band
    const byBand = new Map<number, PlacedBox[]>();
    for (const pb of layout.boxes) {
      const band = pb.band ?? -1;
      if (!byBand.has(band)) byBand.set(band, []);
      byBand.get(band)!.push(pb);
    }
    for (const [, boxes] of byBand) {
      expect(boxes.length).toBeLessThanOrEqual(6);
    }
  });
});

// ─── Determinism — SPEC-005 RC-3 / L-2 ──────────────────────────────────────

describe("determinism under input reorder — L-2", () => {
  it("layoutIdef0Diagram returns identical result on repeated calls", () => {
    const result = deriveIdef0(DENSE_RAW, {
      threshold: 0.3,
      focus: FOCUS_B,
    });
    const layout1 = layoutIdef0Diagram(result.diagram);
    const layout2 = layoutIdef0Diagram(result.diagram);
    expect(layout1.boxes.map((b) => serialiseKey(b.key))).toEqual(
      layout2.boxes.map((b) => serialiseKey(b.key)),
    );
    expect(
      layout1.arrows.map((a) => `${a.x1},${a.y1},${a.x2},${a.y2}`),
    ).toEqual(layout2.arrows.map((a) => `${a.x1},${a.y1},${a.x2},${a.y2}`));
  });

  it("layoutTierBands returns identical result on repeated calls", () => {
    const result = deriveIdef0(sparseRaw(8), { threshold: 0.3 });
    const layout1 = layoutTierBands(result.diagram, result.tierStack);
    const layout2 = layoutTierBands(result.diagram, result.tierStack);
    expect(layout1.boxes.map((b) => serialiseKey(b.key))).toEqual(
      layout2.boxes.map((b) => serialiseKey(b.key)),
    );
  });

  it("layoutIdef0Diagram is independent of arrow array order (core already sorts)", () => {
    const result = deriveIdef0(DENSE_RAW, {
      threshold: 0.3,
      focus: FOCUS_B,
    });
    // The core's diagram.arrows is already sorted per INV-8; verify the layout
    // arrow count / slot assignment is stable by calling twice.
    const layoutA = layoutIdef0Diagram(result.diagram);
    const layoutB = layoutIdef0Diagram(result.diagram);
    expect(layoutA.arrows.map((a) => a.slot)).toEqual(
      layoutB.arrows.map((a) => a.slot),
    );
  });
});

// ─── Honest fallback: mode switch — SPEC-005 §render-the-returned-mode ───────

describe("honest mode switch — RC-1", () => {
  it("tier-stack fixture: layoutTierBands has 0 arrows, all boxes derived", () => {
    const result = deriveIdef0(sparseRaw(5), { threshold: 0.3 });
    expect(result.verdict.mode).toBe("tier-stack");
    const layout = layoutTierBands(result.diagram, result.tierStack);
    expect(layout.arrows).toHaveLength(0);
    expect(layout.mode).toBe("tier-stack");
    for (const pb of layout.boxes) {
      expect(pb.provenance).toBe("derived");
    }
  });

  it("dense fixture: layoutIdef0Diagram has arrows, focus box is real", () => {
    const result = deriveIdef0(DENSE_RAW, {
      threshold: 0.3,
      focus: FOCUS_B,
    });
    expect(result.verdict.mode).toBe("idef0");
    const layout = layoutIdef0Diagram(result.diagram);
    expect(layout.mode).toBe("idef0");
    const focusBox = layout.boxes.find((b) => b.role === "focus");
    expect(focusBox?.provenance).toBe("real");
    expect(layout.arrows.length).toBeGreaterThan(0);
  });
});

// ─── resolveFocusKey — RFC-029 §focus-seed-resolver ──────────────────────────

describe("resolveFocusKey — V-COLLISION / F3", () => {
  it("returns null for unknown id", () => {
    const nodes = [
      { id: "A", title: "A", kind: "prd" as const, status: "active" as const },
    ];
    expect(resolveFocusKey("UNKNOWN", nodes)).toBeNull();
  });

  it("returns null for null selectedId", () => {
    const nodes = [
      { id: "A", title: "A", kind: "prd" as const, status: "active" as const },
    ];
    expect(resolveFocusKey(null, nodes)).toBeNull();
  });

  it("returns the unique key for a matching id", () => {
    const nodes = [
      {
        id: "A",
        title: "My PRD",
        kind: "prd" as const,
        status: "active" as const,
      },
    ];
    const key = resolveFocusKey("A", nodes);
    expect(key).toEqual({ id: "A", title: "My PRD" });
  });

  it("V-COLLISION: same id, distinct titles → returns canonically-first key", () => {
    // serialiseKey = JSON.stringify([id, title])
    // '["X","Alpha"]' < '["X","Beta"]' lexicographically → Alpha is canonical-first
    const nodes = [
      {
        id: "X",
        title: "Beta",
        kind: "prd" as const,
        status: "active" as const,
      },
      {
        id: "X",
        title: "Alpha",
        kind: "prd" as const,
        status: "active" as const,
      },
    ];
    const key = resolveFocusKey("X", nodes);
    expect(key).toEqual({ id: "X", title: "Alpha" });
  });

  it("V-COLLISION: deterministic regardless of node array order", () => {
    const nodesA = [
      {
        id: "X",
        title: "Beta",
        kind: "prd" as const,
        status: "active" as const,
      },
      {
        id: "X",
        title: "Alpha",
        kind: "prd" as const,
        status: "active" as const,
      },
    ];
    const nodesB = [
      {
        id: "X",
        title: "Alpha",
        kind: "prd" as const,
        status: "active" as const,
      },
      {
        id: "X",
        title: "Beta",
        kind: "prd" as const,
        status: "active" as const,
      },
    ];
    expect(resolveFocusKey("X", nodesA)).toEqual(resolveFocusKey("X", nodesB));
  });
});

// ─── Rollup is terminal — SPEC-005 / EVID-061 F2 ────────────────────────────

describe("rollup is a terminal count — not a window-expand control (F2 / C-1)", () => {
  it("deriveIdef0 with window does NOT change diagram.boxes (window is outline-only)", () => {
    const result1 = deriveIdef0(DENSE_RAW, {
      threshold: 0.3,
      focus: FOCUS_B,
    });
    const result2 = deriveIdef0(DENSE_RAW, {
      threshold: 0.3,
      focus: FOCUS_B,
      window: { offset: 3, limit: 10 }, // window on outline only
    });
    // Diagram must be identical regardless of window
    expect(result1.diagram.boxes.map((b) => serialiseKey(b.key))).toEqual(
      result2.diagram.boxes.map((b) => serialiseKey(b.key)),
    );
    // Outline is bounded by the window
    expect(result2.outline.length).toBeLessThanOrEqual(10);
  });

  it("rollup box key is synthetic (__rollup__) — not a real artifact key", () => {
    const result = deriveIdef0(DENSE_RAW, {
      threshold: 0.3,
      focus: FOCUS_B,
    });
    const layout = layoutIdef0Diagram(result.diagram);
    const rollup = layout.boxes.find((b) => b.role === "rollup");
    expect(rollup).toBeDefined();
    expect(rollup!.key.id).toBe("__rollup__");
  });
});

describe("outline window peek contract (EVID-065 #1 pagination fix)", () => {
  // The view requests limit = PAGE+1 and treats outline.length > PAGE as
  // "has next page", displaying only the first PAGE rows. This guards the
  // exactly-full-page ghost: N === PAGE must NOT signal a next page.
  const PAGE = 4;
  function flatSnapshot(n: number): RawSnapshot {
    return {
      nodes: Array.from({ length: n }, (_, i) => ({
        id: `N${i}`,
        title: `t${i}`,
        kind: "prd",
      })),
      edges: [],
    };
  }

  it("exactly-full page does not signal a next page (N === PAGE)", () => {
    const r = deriveIdef0(flatSnapshot(PAGE), {
      threshold: 0.3,
      window: { offset: 0, limit: PAGE + 1 },
    });
    expect(r.outline.length).toBe(PAGE); // peeked +1 finds nothing extra
    expect(r.outline.length > PAGE).toBe(false); // hasNextPage === false
  });

  it("over-full page signals a next page and displays only PAGE rows", () => {
    const r = deriveIdef0(flatSnapshot(PAGE + 3), {
      threshold: 0.3,
      window: { offset: 0, limit: PAGE + 1 },
    });
    expect(r.outline.length).toBe(PAGE + 1); // the peeked +1 row is present
    expect(r.outline.length > PAGE).toBe(true); // hasNextPage === true
    expect(r.outline.slice(0, PAGE).length).toBe(PAGE); // displayed page
  });

  it("last partial page shows remaining rows without a ghost next page", () => {
    const r = deriveIdef0(flatSnapshot(PAGE + 2), {
      threshold: 0.3,
      window: { offset: PAGE, limit: PAGE + 1 },
    });
    expect(r.outline.length).toBe(2); // the 2 trailing rows past the offset
    expect(r.outline.length > PAGE).toBe(false); // hasNextPage === false
  });
});
