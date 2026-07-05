import { describe, expect, it } from "vitest";
import {
  COOLDOWN_MS,
  R_ASCEND,
  R_DESCEND,
  clampBelowDescend,
  climbTo,
  focusChain,
  popLevel,
  pushLevel,
  rootFrame,
  type LevelFrame,
} from "./drill-state";

// RFC-031 Phase 2 Test Strategy Hooks — the stateful cross-once + cooldown
// wheel routing lives in ComposedMapView.svelte's handleWheel (Wave 2, out
// of this wave's scope); these are the pure primitives it is built on.

describe("threshold constants", () => {
  it("locks the calibration-pending values from the RFC", () => {
    expect(R_DESCEND).toBe(2.5);
    expect(R_ASCEND).toBe(0.55);
    expect(COOLDOWN_MS).toBe(350);
  });

  it("keeps the neutral band non-empty and below the descend threshold", () => {
    expect(R_ASCEND).toBeLessThan(R_DESCEND);
  });
});

describe("rootFrame", () => {
  it("has no focusId, a ratio of 1 (k === kFit), and no pan offset", () => {
    const frame = rootFrame(1.5);
    expect(frame.focusId).toBeNull();
    expect(frame.kFit).toBe(1.5);
    expect(frame.transform).toEqual({ x: 0, y: 0, k: 1.5 });
  });
});

describe("pushLevel", () => {
  it("saves the top frame's transform and pushes a child placeholder at ratio 1", () => {
    const stack = [rootFrame(1)];
    const saved = { x: 12, y: 34, k: 1.8 };
    const next = pushLevel(stack, "z.decisions", saved);
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({ ...rootFrame(1), transform: saved });
    const child = next[1]!;
    expect(child.focusId).toBe("z.decisions");
    // reset-to-fit lands at ratio 1.0 — mid-band, cannot immediately re-fire
    expect(child.transform.k / child.kFit).toBe(1);
  });

  it("does not mutate the input stack", () => {
    const stack = [rootFrame(1)];
    const before = JSON.parse(JSON.stringify(stack)) as LevelFrame[];
    pushLevel(stack, "z.decisions", { x: 0, y: 0, k: 1 });
    expect(stack).toEqual(before);
  });

  it("returns a shallow copy for an empty stack rather than throwing", () => {
    expect(pushLevel([], "z.a", { x: 0, y: 0, k: 1 })).toEqual([]);
  });

  it("supports pushing a second level on top of the first", () => {
    let stack = [rootFrame(1)];
    stack = pushLevel(stack, "z.decisions", { x: 0, y: 0, k: 2.6 });
    stack = pushLevel(stack, "mega-1", { x: 5, y: 5, k: 2.7 });
    expect(focusChain(stack)).toEqual(["z.decisions", "mega-1"]);
    expect(stack[1]!.transform).toEqual({ x: 5, y: 5, k: 2.7 });
  });
});

describe("popLevel", () => {
  it("removes exactly the top frame", () => {
    let stack = [rootFrame(1)];
    stack = pushLevel(stack, "z.a", { x: 0, y: 0, k: 1 });
    stack = pushLevel(stack, "mega-1", { x: 0, y: 0, k: 1 });
    const popped = popLevel(stack);
    expect(focusChain(popped)).toEqual(["z.a"]);
  });

  it("is a no-op at the root (never pops below level 0)", () => {
    const stack = [rootFrame(1)];
    expect(popLevel(stack)).toEqual(stack);
  });
});

describe("climbTo", () => {
  it("truncates the stack to the given index (crumb click)", () => {
    let stack = [rootFrame(1)];
    stack = pushLevel(stack, "z.a", { x: 0, y: 0, k: 1 });
    stack = pushLevel(stack, "mega-1", { x: 0, y: 0, k: 1 });
    stack = pushLevel(stack, "mega-2", { x: 0, y: 0, k: 1 });
    expect(focusChain(climbTo(stack, 1))).toEqual(["z.a"]);
    expect(focusChain(climbTo(stack, 0))).toEqual([]);
  });

  it("returns an unchanged copy for an out-of-range index", () => {
    const stack = [rootFrame(1)];
    expect(climbTo(stack, -1)).toEqual(stack);
    expect(climbTo(stack, 5)).toEqual(stack);
  });
});

describe("focusChain", () => {
  it("is empty at level 0 (root only)", () => {
    expect(focusChain([rootFrame(1)])).toEqual([]);
  });

  it("maps every non-root frame to its focusId, in order", () => {
    let stack = [rootFrame(1)];
    stack = pushLevel(stack, "a", { x: 0, y: 0, k: 1 });
    stack = pushLevel(stack, "b", { x: 0, y: 0, k: 1 });
    expect(focusChain(stack)).toEqual(["a", "b"]);
  });
});

describe("clampBelowDescend", () => {
  it("leaves a transform already below the descend threshold untouched", () => {
    const t = { x: 3, y: 4, k: 1 };
    const clamped = clampBelowDescend(t, 1);
    expect(clamped).toEqual(t);
  });

  it("caps a transform at/above the descend ratio to strictly below R_DESCEND", () => {
    const kFit = 2;
    const t = { x: 3, y: 4, k: kFit * R_DESCEND * 4 };
    const clamped = clampBelowDescend(t, kFit);
    expect(clamped.k / kFit).toBeLessThan(R_DESCEND);
    expect(clamped.x).toBe(t.x);
    expect(clamped.y).toBe(t.y);
  });

  it("caps a transform sitting exactly at the descend ratio", () => {
    const kFit = 1;
    const t = { x: 0, y: 0, k: kFit * R_DESCEND };
    const clamped = clampBelowDescend(t, kFit);
    expect(clamped.k / kFit).toBeLessThan(R_DESCEND);
  });
});
