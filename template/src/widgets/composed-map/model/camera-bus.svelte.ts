// RFC-034 (Pillar C) — the ONE seam a chat (Tier 0 or Tier 1) uses to drive
// ComposedMapView's existing camera (RFC-033 Invariant 2: fitToRect stays
// the only camera-move primitive; this module never touches the DOM or the
// zoom behaviour itself). Mirrors node-tabs.svelte.ts's plain module-level
// $state store shape — no class, no context, one shared instance per page.

export type CameraTarget = {
  kind: "zone" | "node" | "flow";
  id: string;
};

export interface CameraRequest {
  target: CameraTarget | null;
  /**
   * Monotonically increasing per `showOnMap` call. The view keys its
   * consuming $effect on this counter rather than on `target` identity, so
   * asking to look at the SAME zone/node/flow twice in a row still re-fires
   * the camera move (e.g. re-asking "where is X" recentres the view instead
   * of being a silent no-op because the target object looks unchanged).
   */
  seq: number;
}

let request = $state<CameraRequest>({ target: null, seq: 0 });

/** Chat writes: request the view's camera move to the given target. */
export function showOnMap(target: CameraTarget): void {
  request = { target, seq: request.seq + 1 };
}

/** View reads: the current camera request (target + seq to key off of). */
export function currentCameraRequest(): CameraRequest {
  return request;
}

/** Clears the current target without bumping `seq` (no new camera move). */
export function clearCameraTarget(): void {
  request = { target: null, seq: request.seq };
}
