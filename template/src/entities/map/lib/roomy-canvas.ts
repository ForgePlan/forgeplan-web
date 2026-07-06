import type { MapDocument } from "../model/types";

// Elegance polish (RFC-030 follow-up) — a pure pre-layout transform that
// widens the macro-grid tracks (canvas.gap.x/y) and the intra-zone card
// spacing (canvas.cell.card_gap) so computeComposedLayout (frozen,
// UNCHANGED) spreads cards apart and edges get room to curve instead of
// crowding, worst on dense layers (e.g. z.decisions: 194 nodes / 208
// edges). Card SIZE (card_w/card_h) is untouched — only the GAPS grow.
// Deterministic: no node reorder, no node/edge mutation, no x/y minted.
export function roomyCanvas(doc: MapDocument, scale = 1.6): MapDocument {
  return {
    ...doc,
    canvas: {
      ...doc.canvas,
      gap: {
        x: Math.round(doc.canvas.gap.x * scale),
        y: Math.round(doc.canvas.gap.y * scale),
      },
      cell: {
        ...doc.canvas.cell,
        card_gap: Math.round(doc.canvas.cell.card_gap * scale),
      },
    },
  };
}
