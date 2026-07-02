/**
 * ICOM layout helper — the one genuinely new algorithm in T2 (RFC-029).
 *
 * Pure, deterministic, side-effect-free. No DOM, no Svelte, no core mutation.
 * Given the already-bounded Idef0Diagram from the headless TADD core (RFC-028 /
 * SPEC-004), produces placed boxes and arrows in px coordinates for the hybrid
 * DOM-boxes + SVG-overlay renderer in Idef0View.svelte.
 *
 * Invariants (L-1…L-4, RFC-029):
 *   L-1: reads only number/key/kind/provenance/rollupCount/side/edge/focus from
 *        core output — never recomputes classification, numbering, or density.
 *   L-2: deterministic — same Idef0Diagram ⇒ identical Idef0Layout.
 *   L-3: never mutates inputs; never pushes geometry back into the core.
 *   L-4: focus role resolved by matching box.key against diagram.focus field,
 *        not by array index.
 */

import { serialiseKey } from "@/shared/lib/idef0";
import type {
  ClassifiedEdge,
  CompositeKey,
  DiagramBox,
  Idef0Diagram,
  IcomSide,
  Provenance,
  TierStackForest,
} from "@/shared/lib/idef0";
import type { ArtifactSummary } from "@/entities/artifact";

export type { IcomSide };

export type DiagramMode = "idef0" | "tier-stack";

/** Which role this placed box plays in the layout. */
export type BoxRole = "focus" | "child" | "band-member" | "rollup";

/** Geometry constants consumed by layoutIdef0Diagram and layoutTierBands. */
export interface BoxGeom {
  /** Box width in px. */
  boxW: number;
  /** Box height in px. */
  boxH: number;
  /** Horizontal gap between adjacent boxes in the child grid. */
  gapX: number;
  /** Vertical gap between box rows. */
  gapY: number;
  /** Outer canvas margin on all sides. */
  margin: number;
  /** Space on each side for ICOM arrows (the "gutter"). */
  gutter: number;
  /** Number of columns in the child grid (idef0 mode). */
  cols: number;
}

const DEFAULT_GEOM: BoxGeom = {
  boxW: 180,
  boxH: 68,
  gapX: 24,
  gapY: 24,
  margin: 32,
  gutter: 80,
  cols: 3,
};

/** Height of a DOM band-header row in px (tier-stack mode). Exported so the
 *  view can position the header above its box row without hard-coding the value.
 */
export const BAND_HEADER_H = 24;

/** Metadata for one tier band in tier-stack mode. Emitted by layoutTierBands;
 *  absent (empty array) in idef0 mode. The view uses this to render full-width
 *  DOM band-header slabs instead of the removed SVG text labels.
 */
export interface BandInfo {
  tierIdx: number;
  kind: string;
  /** Non-rollup box count in this band. */
  count: number;
  /** Top-left y of the first box row in this band (boxes sit at this y).
   *  The header is positioned at y − BAND_HEADER_H − 8 (above the boxes). */
  y: number;
}

/**
 * A placed box: core fields forwarded verbatim plus px geometry and a layout
 * role. `band` is the tier index (parsed from box.number T<n> prefix) in
 * tier-stack mode; undefined in idef0 mode.
 */
export interface PlacedBox {
  key: CompositeKey;
  number: string;
  kind: string;
  provenance: Provenance;
  rollupCount?: number;
  role: BoxRole;
  /** Tier index in tier-stack mode (from T<n> prefix). Absent in idef0 mode. */
  band?: number;
  /** Top-left x in px (same coordinate space as the SVG arrow overlay). */
  x: number;
  /** Top-left y in px. */
  y: number;
  w: number;
  h: number;
}

/**
 * A placed arrow. Geometry is in the same px space as PlacedBox.
 * `headAtBox === true`: arrowhead is at (x2, y2) touching the anchor box edge
 *   (I / C / M arrows enter the box).
 * `headAtBox === false`: arrowhead is at (x2, y2) pointing AWAY from the box
 *   (O arrows leave the box to the right gutter).
 */
export interface PlacedArrow {
  edge: ClassifiedEdge;
  side: IcomSide;
  /** Slot index within arrows on the same side of the same anchor box. */
  slot: number;
  /** The on-page box this arrow attaches to (may be a child, not the focus). */
  anchorKey: CompositeKey;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** True for I/C/M (head at box edge); false for O (head in gutter). */
  headAtBox: boolean;
}

/** The complete placed layout returned to the view. */
export interface Idef0Layout {
  boxes: PlacedBox[];
  arrows: PlacedArrow[];
  /** Band metadata for tier-stack mode. Empty array in idef0 mode. */
  bands: BandInfo[];
  /** Total canvas width in px (for the SVG viewBox / container sizing). */
  width: number;
  /** Total canvas height in px. */
  height: number;
  mode: DiagramMode;
}

// ─── internal helpers ───────────────────────────────────────────────────────

function mergeGeom(partial?: Partial<BoxGeom>): BoxGeom {
  return { ...DEFAULT_GEOM, ...partial };
}

/**
 * Parse the T<n> tier index from a box number string.
 * "T2.3" → 2, "T2.+" → 2, "A1.2" → -1 (not a tier-stack number).
 */
function parseTierIndex(number: string): number {
  const m = /^T(\d+)\./.exec(number);
  return m ? parseInt(m[1] ?? "0", 10) : -1;
}

/**
 * Resolve the anchor endpoint key for an arrow.
 * RFC-029: I/C/M ENTER the target (edge.to); O LEAVES the source (edge.from).
 */
function anchorEndpoint(edge: ClassifiedEdge, side: IcomSide): CompositeKey {
  // Output arrows leave the source box; all others enter the target.
  return side === "right" ? edge.from : edge.to;
}

/**
 * Build geometry for one placed arrow on a known anchor box.
 * Spacing distributes multiple arrows on the same side of the same box into
 * evenly-spaced parallel lines.
 */
function buildArrow(
  edge: ClassifiedEdge,
  side: IcomSide,
  slot: number,
  anchorKey: CompositeKey,
  anchorBox: PlacedBox,
  gutter: number,
): PlacedArrow {
  const SLOT_SPACING = 14;
  const { x, y, w, h } = anchorBox;

  let x1: number, y1: number, x2: number, y2: number, headAtBox: boolean;

  if (side === "left") {
    // Input: enters from the left gutter → box left edge.
    const ay = y + h * 0.3 + slot * SLOT_SPACING;
    x1 = x - gutter;
    y1 = ay;
    x2 = x;
    y2 = ay;
    headAtBox = true;
  } else if (side === "top") {
    // Control: enters from above → box top edge.
    const ax = x + w * 0.3 + slot * SLOT_SPACING;
    x1 = ax;
    y1 = y - gutter;
    x2 = ax;
    y2 = y;
    headAtBox = true;
  } else if (side === "right") {
    // Output: leaves box right edge → right gutter.
    const ay = y + h * 0.3 + slot * SLOT_SPACING;
    x1 = x + w;
    y1 = ay;
    x2 = x + w + gutter;
    y2 = ay;
    headAtBox = false;
  } else {
    // Mechanism: enters from below gutter → box bottom edge.
    const ax = x + w * 0.3 + slot * SLOT_SPACING;
    x1 = ax;
    y1 = y + h + gutter;
    x2 = ax;
    y2 = y + h;
    headAtBox = true;
  }

  return { edge, side, slot, anchorKey, x1, y1, x2, y2, headAtBox };
}

// ─── public layout functions ────────────────────────────────────────────────

/**
 * Layout an idef0-mode diagram: focus/context box at top + child grid + arrows
 * on ICOM sides anchored to their own incident on-page box (RFC-029 E-1).
 *
 * The diagram is already bounded by the core (focus + ≤5 children + rollup =
 * ≤7 boxes); this function computes no classification/numbering/density (L-1).
 */
export function layoutIdef0Diagram(
  diagram: Idef0Diagram,
  geom?: Partial<BoxGeom>,
): Idef0Layout {
  const g = mergeGeom(geom);
  const { boxW, boxH, gapX, gapY, margin, gutter, cols } = g;

  // ── identify focus vs child/rollup boxes (L-4: match key, not array index) ──
  const focusSerial =
    diagram.focus !== null ? serialiseKey(diagram.focus) : null;

  const focusBoxIn = diagram.boxes.find(
    (b) => focusSerial !== null && serialiseKey(b.key) === focusSerial,
  );
  const childBoxesIn: DiagramBox[] = diagram.boxes.filter(
    (b) => !(focusSerial !== null && serialiseKey(b.key) === focusSerial),
  );

  // ── content area origin (left + top margins account for arrow gutters) ──
  const contentLeft = margin + gutter;
  const contentTop = margin + gutter;

  // ── child grid dimensions ──
  const numChildren = childBoxesIn.length;
  const numRows = numChildren > 0 ? Math.ceil(numChildren / cols) : 0;
  const childAreaW = cols * boxW + Math.max(0, cols - 1) * gapX;
  const childAreaH = numRows * boxH + Math.max(0, numRows - 1) * gapY;

  // ── context strip height (space between focus box and children) ──
  const contextStripH = focusBoxIn ? boxH + gapY * 2 : 0;

  const boxes: PlacedBox[] = [];

  // ── place focus/context box centred above child area ──
  if (focusBoxIn) {
    const focusX = contentLeft + (childAreaW - boxW) / 2;
    const focusY = contentTop;
    boxes.push({
      key: focusBoxIn.key,
      number: focusBoxIn.number,
      kind: focusBoxIn.kind,
      provenance: focusBoxIn.provenance,
      rollupCount: focusBoxIn.rollupCount,
      role: "focus",
      x: focusX,
      y: focusY,
      w: boxW,
      h: boxH,
    });
  }

  // ── place child / rollup boxes in the grid ──
  childBoxesIn.forEach((cb, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = contentLeft + col * (boxW + gapX);
    const y = contentTop + contextStripH + row * (boxH + gapY);
    const isRollup = cb.rollupCount !== undefined;
    boxes.push({
      key: cb.key,
      number: cb.number,
      kind: cb.kind,
      provenance: cb.provenance,
      rollupCount: cb.rollupCount,
      role: isRollup ? "rollup" : "child",
      x,
      y,
      w: isRollup ? Math.min(boxW, 120) : boxW,
      h: isRollup ? 32 : boxH,
    });
  });

  // ── build key → box lookup ──
  const boxBySerial = new Map<string, PlacedBox>();
  for (const pb of boxes) boxBySerial.set(serialiseKey(pb.key), pb);

  // off-page fallback anchor: the focus box, or the first child if no focus
  const fallbackAnchor: PlacedBox | undefined =
    focusSerial !== null ? boxBySerial.get(focusSerial) : boxes[0];

  // ── place arrows, grouped by (side, anchorKey) for slot assignment ──
  const slotCounter = new Map<string, number>();
  const arrows: PlacedArrow[] = [];

  for (const da of diagram.arrows) {
    const { edge, side } = da;
    const endpointKey = anchorEndpoint(edge, side);
    const anchorBox =
      boxBySerial.get(serialiseKey(endpointKey)) ?? fallbackAnchor;
    if (!anchorBox) continue;

    const groupKey = `${side}:${serialiseKey(anchorBox.key)}`;
    const slot = slotCounter.get(groupKey) ?? 0;
    slotCounter.set(groupKey, slot + 1);

    arrows.push(buildArrow(edge, side, slot, anchorBox.key, anchorBox, gutter));
  }

  // ── canvas dimensions ──
  const width = contentLeft + childAreaW + gutter + margin;
  const height = contentTop + contextStripH + childAreaH + gutter + margin;

  return { boxes, arrows, bands: [], width, height, mode: "idef0" };
}

/**
 * Layout tier-stack bands from the core's already-bounded diagram.boxes.
 * Bands are formed by grouping boxes on the T<n> prefix of box.number;
 * tierStack.tiers is consulted ONLY for band labels/kind — NEVER to enumerate
 * members (that would re-introduce one-box-per-artifact and blow the DOM at
 * N≥1000, the L-1 / EVID-061 F1 invariant).
 */
export function layoutTierBands(
  diagram: Idef0Diagram,
  tierStack: TierStackForest,
  geom?: Partial<BoxGeom>,
): Idef0Layout {
  const g = mergeGeom(geom);
  const { boxW, boxH, gapX, gapY, margin } = g;
  const BAND_GAP = 40; // was 28: accommodates 24px header + 8px gap below
  const LABEL_INDENT = 0; // was 72: SVG text labels removed, boxes use full width

  // ── tier label/kind from tierStack.tiers (the ONLY use of tierStack) ──
  const tierMeta = new Map<number, { kind: string }>();
  for (const t of tierStack.tiers) {
    tierMeta.set(t.tier, { kind: t.kind });
  }

  // ── group diagram.boxes by T<n> prefix (L-1: no tierStack member iteration) ──
  const bandMap = new Map<number, DiagramBox[]>();
  for (const box of diagram.boxes) {
    const tier = parseTierIndex(box.number);
    if (!bandMap.has(tier)) bandMap.set(tier, []);
    bandMap.get(tier)!.push(box);
  }

  // ── sort bands by tier index (altitude order) ──
  const bandEntries = [...bandMap.entries()].sort(([a], [b]) => a - b);

  const boxes: PlacedBox[] = [];
  const bands: BandInfo[] = [];
  // First band's header sits at y=margin; boxes sit BAND_HEADER_H+8px below it.
  let cy = margin + BAND_HEADER_H + 8;

  for (const [tierIdx, bandBoxes] of bandEntries) {
    const bandKind = tierMeta.get(tierIdx)?.kind ?? bandBoxes[0]?.kind ?? "";
    const bxOrigin = margin + LABEL_INDENT; // LABEL_INDENT=0 → just margin

    // Capture box-row y before placing, for the band header positioning in the view.
    const bandY = cy;
    const nonRollupCount = bandBoxes.filter(
      (b) => b.rollupCount === undefined,
    ).length;

    bands.push({ tierIdx, kind: bandKind, count: nonRollupCount, y: bandY });

    bandBoxes.forEach((bb, i) => {
      const isRollup = bb.rollupCount !== undefined;
      const x = bxOrigin + i * (boxW + gapX);
      boxes.push({
        key: bb.key,
        number: bb.number,
        kind: bandKind,
        provenance: bb.provenance,
        rollupCount: bb.rollupCount,
        role: isRollup ? "rollup" : "band-member",
        band: tierIdx,
        x,
        y: cy,
        w: isRollup ? Math.min(boxW, 120) : boxW,
        h: isRollup ? 32 : boxH,
      });
    });

    cy += boxH + gapY + BAND_GAP;
  }

  // ── canvas dimensions ──
  const maxRight =
    boxes.length > 0
      ? Math.max(...boxes.map((b) => b.x + b.w))
      : margin + LABEL_INDENT + boxW;

  return {
    boxes,
    arrows: [], // tier-stack carries no real ICOM arrows (all derived, none included)
    bands,
    width: maxRight + margin,
    height: cy + margin,
    mode: "tier-stack",
  };
}

/**
 * Resolve a bare host `selectedId` string → the core's CompositeKey for focus
 * seeding (RFC-029 F3). Pure — no DOM, no Svelte.
 *
 *   0 matches        → null (the core then defaults to the top ≤6 roots).
 *   1 match          → that node's {id, title}.
 *   >1 (V-COLLISION) → canonically-first key (lowest serialiseKey), so focus
 *                      seeding stays deterministic under id-collision (the
 *                      PROB-060 case), matching the core's own tie-break.
 */
export function resolveFocusKey(
  selectedId: string | null,
  nodes: ArtifactSummary[],
): CompositeKey | null {
  if (!selectedId) return null;
  const matches = nodes.filter((n) => n.id === selectedId);
  const sorted = [...matches].sort((a, b) => {
    const sa = serialiseKey({ id: a.id, title: a.title });
    const sb = serialiseKey({ id: b.id, title: b.title });
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  const first = sorted[0];
  return first ? { id: first.id, title: first.title } : null;
}
