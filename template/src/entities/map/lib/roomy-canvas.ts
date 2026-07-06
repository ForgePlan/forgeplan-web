import type { MapDocument } from "../model/types";

// A macro grid this wide (>=4 columns across zones) is already width-bound —
// scaling its gaps on top pushes total width up further, and fit-to-view
// then shrinks the whole layout back down into a thin, cramped strip (the
// opposite of "roomy"). A narrow grid (few cols) is gap-starved, not
// width-bound, so it is the one that benefits from extra breathing room.
const WIDE_GRID_COLS_THRESHOLD = 4;
const DEFAULT_SCALE = 1.25;

function resolveScale(doc: MapDocument, requestedScale: number): number {
  return doc.canvas.grid.cols >= WIDE_GRID_COLS_THRESHOLD
    ? 1.0
    : requestedScale;
}

// Elegance polish (RFC-030 follow-up) — a pure pre-layout transform that
// widens the macro-grid tracks (canvas.gap.x/y) and the intra-zone card
// spacing (canvas.cell.card_gap) so computeComposedLayout (frozen,
// UNCHANGED) spreads cards apart and edges get room to curve instead of
// crowding, worst on dense layers (e.g. z.decisions: 194 nodes / 208
// edges). Card SIZE (card_w/card_h) is untouched — only the GAPS grow, and
// only on grids narrow enough to be gap-starved rather than width-bound
// (see resolveScale). Deterministic: no node reorder, no node/edge
// mutation, no x/y minted.
export function roomyCanvas(
  doc: MapDocument,
  scale = DEFAULT_SCALE,
): MapDocument {
  const effectiveScale = resolveScale(doc, scale);
  return {
    ...doc,
    canvas: {
      ...doc.canvas,
      gap: {
        x: Math.round(doc.canvas.gap.x * effectiveScale),
        y: Math.round(doc.canvas.gap.y * effectiveScale),
      },
      cell: {
        ...doc.canvas.cell,
        card_gap: Math.round(doc.canvas.cell.card_gap * effectiveScale),
      },
    },
  };
}
