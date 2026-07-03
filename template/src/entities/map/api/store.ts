import { createPoller } from "@/shared/api";
import type { MapResponse } from "../model/types";

// RFC-030 SD-1 — widget-owned, ref-counted poller: N mounted map panes
// (dashboard + mosaic) share one poll loop; the last release stops it.
export const mapPoller = createPoller<MapResponse["data"]>("/api/map");

let refCount = 0;

export function acquireMapPolling(): () => void {
  refCount += 1;
  if (refCount === 1) mapPoller.start();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) mapPoller.stop();
  };
}
