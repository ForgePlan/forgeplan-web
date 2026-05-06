import type { DropEdge } from "../model/types";

export type DragPayload =
  | { type: "add"; view: string }
  | { type: "swap"; leafId: string };

const MIME = "application/x-forgeplan-mosaic";

// Module-level singleton: dataTransfer.getData() returns "" during dragover
// for security reasons (only readable on drop). We mirror the payload here
// so dragover can know what's being dragged and paint the right overlay.
// Cleared on dragend / drop.
let activeDrag: DragPayload | null = null;

export function beginDrag(p: DragPayload): void {
  activeDrag = p;
}

export function endDrag(): void {
  activeDrag = null;
}

export function getActiveDrag(): DragPayload | null {
  return activeDrag;
}

export function setDragPayload(dt: DataTransfer, p: DragPayload): void {
  // Stash on DataTransfer so cross-window / cross-frame drops still work,
  // and stash in module state for same-window dragover (where getData is
  // not allowed by the spec).
  beginDrag(p);
  try {
    dt.setData(MIME, JSON.stringify(p));
  } catch {
    // Some browsers/test environments block setData on certain MIME types.
  }
  // text/plain fallback so the drag actually starts in browsers that
  // require some non-empty data on the drag.
  try {
    dt.setData("text/plain", p.type === "add" ? p.view : p.leafId);
  } catch {
    // FIXME(drag-fallback): if this also throws, drag may not initialise.
  }
  dt.effectAllowed = "move";
}

export function getDragPayload(dt: DataTransfer): DragPayload | null {
  const fromModule = getActiveDrag();
  if (fromModule) return fromModule;
  const raw = dt.getData(MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (parsed.type === "add" && typeof parsed.view === "string") return parsed;
    if (parsed.type === "swap" && typeof parsed.leafId === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function hasDragPayload(dt: DataTransfer): boolean {
  if (getActiveDrag()) return true;
  return dt.types.includes(MIME);
}

const EDGE_THRESHOLD = 0.25;

export function quadrant(rect: DOMRect, x: number, y: number): DropEdge {
  const relX = (x - rect.left) / rect.width;
  const relY = (y - rect.top) / rect.height;

  if (
    relX > EDGE_THRESHOLD &&
    relX < 1 - EDGE_THRESHOLD &&
    relY > EDGE_THRESHOLD &&
    relY < 1 - EDGE_THRESHOLD
  ) {
    return "center";
  }

  const dLeft = relX;
  const dRight = 1 - relX;
  const dTop = relY;
  const dBottom = 1 - relY;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return "left";
  if (min === dRight) return "right";
  if (min === dTop) return "top";
  return "bottom";
}

export function highlightStyle(edge: DropEdge): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  switch (edge) {
    case "left":
      return { left: "0%", top: "0%", width: "50%", height: "100%" };
    case "right":
      return { left: "50%", top: "0%", width: "50%", height: "100%" };
    case "top":
      return { left: "0%", top: "0%", width: "100%", height: "50%" };
    case "bottom":
      return { left: "0%", top: "50%", width: "100%", height: "50%" };
    case "center":
      return { left: "10%", top: "10%", width: "80%", height: "80%" };
  }
}
