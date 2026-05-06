export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MiniRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeBBox(
  positions: Array<{ x: number; y: number }>,
  padding = 50,
): BBox {
  if (positions.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

export function bboxScale(bbox: BBox, miniW: number, miniH: number): number {
  const dx = bbox.maxX - bbox.minX || 1;
  const dy = bbox.maxY - bbox.minY || 1;
  return Math.min(miniW / dx, miniH / dy);
}

export function canvasToMini(
  p: { x: number; y: number },
  bbox: BBox,
  scale: number,
  miniW: number,
  miniH: number,
): { x: number; y: number } {
  const dx = bbox.maxX - bbox.minX;
  const dy = bbox.maxY - bbox.minY;
  const offsetX = (miniW - dx * scale) / 2;
  const offsetY = (miniH - dy * scale) / 2;
  return {
    x: offsetX + (p.x - bbox.minX) * scale,
    y: offsetY + (p.y - bbox.minY) * scale,
  };
}

export function miniToCanvas(
  p: { x: number; y: number },
  bbox: BBox,
  scale: number,
  miniW: number,
  miniH: number,
): { x: number; y: number } {
  const dx = bbox.maxX - bbox.minX;
  const dy = bbox.maxY - bbox.minY;
  const offsetX = (miniW - dx * scale) / 2;
  const offsetY = (miniH - dy * scale) / 2;
  return {
    x: bbox.minX + (p.x - offsetX) / scale,
    y: bbox.minY + (p.y - offsetY) / scale,
  };
}

export function viewportRectInMini(
  transform: { x: number; y: number; k: number },
  viewport: { w: number; h: number },
  bbox: BBox,
  scale: number,
  miniW: number,
  miniH: number,
): MiniRect {
  const canvasMinX = -transform.x / transform.k;
  const canvasMinY = -transform.y / transform.k;
  const canvasMaxX = (viewport.w - transform.x) / transform.k;
  const canvasMaxY = (viewport.h - transform.y) / transform.k;
  const tl = canvasToMini(
    { x: canvasMinX, y: canvasMinY },
    bbox,
    scale,
    miniW,
    miniH,
  );
  const br = canvasToMini(
    { x: canvasMaxX, y: canvasMaxY },
    bbox,
    scale,
    miniW,
    miniH,
  );
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}
