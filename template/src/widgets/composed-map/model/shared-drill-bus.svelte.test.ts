import { describe, it, expect, beforeEach } from "vitest";
import {
  sharedFocusChain,
  focusTo,
  chainsEqual,
} from "./shared-drill-bus.svelte";

// RFC-036 Test Strategy Hooks / EVID-100 Finding #2 — the shared-drill-bus
// reducer had zero tests. This file covers the bus itself: (1) reducer
// idempotence and (2) the bidirectional 2D<->3D sync contract + the
// content-guard that prevents an infinite re-fire loop.
//
// The THIRD hook — mid-animation convergence (EVID-100 Finding #1) — lives
// in the 3D consumer, `widgets/iso-map/model/iso-view-state.svelte.ts`, and
// depends on that module's own `$effect.root` watcher actually firing.
// `$effect` is compiled to a no-op under this project's "unit" (node/SSR)
// vitest project — Svelte only runs effects in client-generated code, which
// requires the "dom" project's `happy-dom` environment + `browser` resolve
// condition (verified empirically: a minimal $effect.root repro in "unit"
// never ran its effect body, not even once, at module-init time). That test
// lives in the co-located `iso-view-state.render.test.ts` instead, so it
// exercises the real mechanism rather than a fake standing in for it.

describe("chainsEqual", () => {
  it("is true for two empty chains", () => {
    expect(chainsEqual([], [])).toBe(true);
  });

  it("is true for equal-content chains regardless of array identity", () => {
    expect(chainsEqual(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("is false for different lengths", () => {
    expect(chainsEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("is false for the same length but different content", () => {
    expect(chainsEqual(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("shared-drill-bus", () => {
  // Module-level $state persists across tests in this file (the same
  // singleton both real views consume) — reset it before every test via
  // the bus's own public API, mirroring camera-bus.test.ts's
  // `clearCameraTarget()` pattern.
  beforeEach(() => {
    focusTo([]);
  });

  it("starts with an empty chain", () => {
    expect(sharedFocusChain()).toEqual([]);
  });

  describe("reducer idempotence", () => {
    it("descending into the same zone twice does not duplicate the chain", () => {
      focusTo(["z.a"]);
      focusTo(["z.a"]);
      expect(sharedFocusChain()).toEqual(["z.a"]);
    });

    it("re-applying the identical multi-level chain is a no-op (same array reference, no churn)", () => {
      focusTo(["z.a", "z.b"]);
      const applied = sharedFocusChain();
      // A structurally-identical but NOT reference-identical array — proves
      // the guard compares content, not the input array's identity.
      focusTo([...applied]);
      expect(sharedFocusChain()).toBe(applied);
    });

    it("writes a NEW array only when the chain genuinely changes", () => {
      focusTo(["z.a"]);
      const before = sharedFocusChain();
      focusTo(["z.a", "z.b"]);
      expect(sharedFocusChain()).not.toBe(before);
      expect(sharedFocusChain()).toEqual(["z.a", "z.b"]);
    });

    it("ascend past root (focusTo([]) on an already-empty chain) is a no-op", () => {
      expect(sharedFocusChain()).toEqual([]);
      const before = sharedFocusChain();
      focusTo([]);
      expect(sharedFocusChain()).toBe(before);
    });
  });

  describe("bidirectional-sync contract", () => {
    it("a 2D-origin write is visible to the 3D reader", () => {
      focusTo(["z.a"]); // simulates ComposedMapView's outbound effect
      expect(sharedFocusChain()).toEqual(["z.a"]); // iso-view-state's inbound effect would read this
    });

    it("a 3D-origin write is visible to the 2D reader (and vice versa)", () => {
      focusTo(["z.a"]);
      focusTo(["z.a", "mega-1"]); // simulates the 3D surface descending further
      expect(sharedFocusChain()).toEqual(["z.a", "mega-1"]); // 2D reads it back
    });

    it("single source of truth — every reader observes the identical array reference", () => {
      focusTo(["z.a"]);
      const readByComposedMapView = sharedFocusChain();
      const readByIsoViewState = sharedFocusChain();
      expect(readByComposedMapView).toBe(readByIsoViewState);
    });

    it("echoing the just-applied chain back (content-guarded write) does not re-fire an update — breaks the 2D<->3D loop", () => {
      focusTo(["z.a", "z.b"]);
      const applied = sharedFocusChain();
      // The scenario the file's own header comment describes: a view that
      // just applied an externally-driven chain "confirms" it right back
      // into the bus. Without the content guard this would assign a NEW
      // array and re-trigger the other view's inbound effect for no reason.
      focusTo([...applied]);
      expect(sharedFocusChain()).toBe(applied);
    });
  });
});
