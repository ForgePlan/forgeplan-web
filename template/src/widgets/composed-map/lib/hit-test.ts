import type { Point, Rect } from "@/entities/map/lib/composed-layout";
import type { MapZone } from "@/entities/map/model/types";

// RFC-031 Phase 2 — pure cursor/wheel hit-testing in the transformed
// (post-pan/zoom) coordinate space. Used identically by click-descend and
// wheel-descend (Q3).

export interface Transform {
  x: number;
  y: number;
  k: number;
}

// TODO(viewbox): assumes `.map-canvas` has no `viewBox` (1 SVG user unit ==
// 1 CSS px, true of the current markup) — if a viewBox is ever added, this
// must also divide by the viewBox scale factor.
export function toLayoutPoint(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
  t: Transform,
): Point {
  const localX = clientX - svgRect.left;
  const localY = clientY - svgRect.top;
  return { x: (localX - t.x) / t.k, y: (localY - t.y) / t.k };
}

export function hitTestZone(
  p: Point,
  zones: readonly MapZone[],
  zoneRects: ReadonlyMap<string, Rect>,
): string | null {
  for (const zone of zones) {
    const rect = zoneRects.get(zone.id);
    if (!rect) continue;
    if (
      p.x >= rect.x &&
      p.x <= rect.x + rect.w &&
      p.y >= rect.y &&
      p.y <= rect.y + rect.h
    ) {
      return zone.id;
    }
  }
  return null;
}
