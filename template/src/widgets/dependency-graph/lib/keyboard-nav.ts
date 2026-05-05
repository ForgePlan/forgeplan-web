/**
 * Direction-based focus navigation for graph views.
 *
 * Given the currently focused node and a desired direction (one of the
 * four arrow keys), pick the next node whose centre lies inside the
 * angular cone of that direction (±60° around the cardinal axis) and
 * minimises a cost = distance · (1 + 2·angularDeviation/π).
 *
 * If no candidate falls inside the cone, fall back to the nearest
 * node by Euclidean distance — so the user always moves.
 */

export type Direction = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export interface FocusNode {
  id: string;
  /** Centre coordinates in the same coordinate space (logical or screen). */
  x: number;
  y: number;
}

const HALF_CONE = Math.PI / 3; // 60° each side → 120° cone total

const directionVector = (dir: Direction): { dx: number; dy: number } => {
  switch (dir) {
    case "ArrowLeft":
      return { dx: -1, dy: 0 };
    case "ArrowRight":
      return { dx: 1, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -1 };
    case "ArrowDown":
      return { dx: 0, dy: 1 };
  }
};

export function pickNextNode(
  current: FocusNode,
  candidates: FocusNode[],
  dir: Direction,
): FocusNode | null {
  if (candidates.length === 0) return null;
  const others = candidates.filter((n) => n.id !== current.id);
  if (others.length === 0) return null;

  const target = directionVector(dir);
  let best: { node: FocusNode; cost: number } | null = null;
  let nearest: { node: FocusNode; dist: number } | null = null;

  for (const n of others) {
    const dx = n.x - current.x;
    const dy = n.y - current.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;

    if (!nearest || dist < nearest.dist) nearest = { node: n, dist };

    const cosAngle = (dx * target.dx + dy * target.dy) / dist;
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    if (angle > HALF_CONE) continue;

    const cost = dist * (1 + (2 * angle) / Math.PI);
    if (!best || cost < best.cost) best = { node: n, cost };
  }

  return best?.node ?? nearest?.node ?? null;
}
