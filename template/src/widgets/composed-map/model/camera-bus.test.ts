import { describe, it, expect, beforeEach } from "vitest";
import {
  showOnMap,
  currentCameraRequest,
  clearCameraTarget,
  type CameraTarget,
} from "./camera-bus.svelte";

// Module-level $state persists across tests in this file (same singleton
// the real view consumes) — reset it before every test so cases don't leak
// into each other, mirroring the isolation node-tabs.test.ts gets for free
// from per-test-unique ids (a single current-target store has no such luxury).
beforeEach(() => {
  clearCameraTarget();
});

describe("camera-bus", () => {
  it("starts with no target", () => {
    expect(currentCameraRequest().target).toBeNull();
  });

  it("round-trips a target through showOnMap / currentCameraRequest", () => {
    const target: CameraTarget = { kind: "zone", id: "zone-a" };
    showOnMap(target);
    expect(currentCameraRequest().target).toEqual(target);
  });

  it("increments seq on every showOnMap call", () => {
    const before = currentCameraRequest().seq;
    showOnMap({ kind: "node", id: "node-a" });
    const afterFirst = currentCameraRequest().seq;
    expect(afterFirst).toBe(before + 1);
    showOnMap({ kind: "node", id: "node-a" });
    const afterSecond = currentCameraRequest().seq;
    expect(afterSecond).toBe(afterFirst + 1);
  });

  it("increments seq even when the SAME target is requested twice", () => {
    const target: CameraTarget = { kind: "flow", id: "flow-a" };
    showOnMap(target);
    const firstSeq = currentCameraRequest().seq;
    showOnMap(target);
    const secondSeq = currentCameraRequest().seq;
    expect(secondSeq).toBe(firstSeq + 1);
    expect(currentCameraRequest().target).toEqual(target);
  });

  it("clearCameraTarget resets the target to null", () => {
    showOnMap({ kind: "zone", id: "zone-b" });
    expect(currentCameraRequest().target).not.toBeNull();
    clearCameraTarget();
    expect(currentCameraRequest().target).toBeNull();
  });

  it("clearCameraTarget does not bump seq", () => {
    showOnMap({ kind: "zone", id: "zone-c" });
    const seqAfterShow = currentCameraRequest().seq;
    clearCameraTarget();
    expect(currentCameraRequest().seq).toBe(seqAfterShow);
  });
});
