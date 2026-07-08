// Pure geometry for IsoLeaderLine: clamps a point onto the nearest edge of
// a DOMRect, so the leader line's card-side endpoint always lands ON the
// card's border rather than floating inside it. No Svelte, no DOM globals
// beyond the DOMRect/Point shapes themselves (same "pure helper" pattern
// as iso-projection.ts/iso-materials.ts).
export interface Point {
  x: number;
  y: number;
}

export function nearestRectEdgePoint(
  rect: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
  x: number,
  y: number,
): Point {
  const clampedX = Math.min(Math.max(x, rect.left), rect.right);
  const clampedY = Math.min(Math.max(y, rect.top), rect.bottom);
  const insideX = x > rect.left && x < rect.right;
  const insideY = y > rect.top && y < rect.bottom;

  // (x,y) strictly inside the rect (the anchor sits behind its own card,
  // e.g. a degenerate/very small viewport) — push out to the CLOSER edge
  // instead of leaving the endpoint floating inside the card.
  if (insideX && insideY) {
    const candidates: Array<{ dist: number; point: Point }> = [
      { dist: x - rect.left, point: { x: rect.left, y } },
      { dist: rect.right - x, point: { x: rect.right, y } },
      { dist: y - rect.top, point: { x, y: rect.top } },
      { dist: rect.bottom - y, point: { x, y: rect.bottom } },
    ];
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0]!.point;
  }

  return { x: clampedX, y: clampedY };
}
