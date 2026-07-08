import { describe, it, expect, vi } from "vitest";
import { tick } from "svelte";
import type { MapDocument } from "@/entities/map";
import { chainsEqual } from "@/widgets/composed-map/model/shared-drill-bus.svelte";

// RFC-036 Test Strategy Hooks / EVID-100 Finding #1 — the mid-animation
// convergence fix: a focus-chain update that arrives while iso-view-state's
// own enter/exit tween is in flight is recorded (`pendingExternal`) and
// re-applied by the module's `$effect.root` watcher once the animation
// settles, so the 3D view always converges to the LATEST shared chain.
//
// This lives in a `.render.test.ts` file (the "dom" vitest project:
// happy-dom + `resolve.conditions: ["browser"]`), not a plain `.test.ts`
// ("unit" project: node), because the retry mechanism is driven entirely by
// a Svelte `$effect` — and `$effect` compiles to a no-op under "unit"'s
// node/SSR transform (effects are a client-only lifecycle concept; verified
// empirically with a minimal $effect.root repro that never ran its effect
// body, not even once, at module-init time, under "unit"). Only the "dom"
// project's browser-conditioned, client-generated build actually runs
// `$effect` bodies, so this is the one place the fix can be exercised for
// real rather than asserted against a mechanism that never fires.
vi.mock("@/widgets/iso-map/lib/motion", () => ({
  motionDuration: () => 0,
}));

// iso-view-state.svelte.ts imports `validateMapDocument` (a runtime value)
// from the `@/entities/map` barrel, which also re-exports
// `mapPoller`/`acquireMapPolling` (entities/map/api/store.ts ->
// shared/api/poller.svelte.ts). `validateMapDocument` is never actually
// invoked by the code paths these tests exercise (the test focus ids never
// match `isRootZoneDescend`, so the per-zone-layer fetch that would call it
// never fires) — stubbing the barrel keeps this test focused on the
// animation/effect seam without depending on the poller's own behaviour.
vi.mock("@/entities/map", () => ({
  validateMapDocument: vi.fn(),
}));

const {
  currentFocusChain,
  currentLevelStack,
  currentAnimationKind,
  applyExternalFocusChain,
  ascend,
} = await import("./iso-view-state.svelte");

// A minimal, valid MapDocument (same shape as
// composed-map/model/level-documents.test.ts#baseDoc). Only used as the
// `rootDoc` argument to `applyExternalFocusChain` — its zones deliberately
// do NOT contain the test's focus ids ("ext-a" / "ext-b"), so
// `isRootZoneDescend` is always false and no per-zone layer `fetch()` is
// ever kicked off.
const rootDoc: MapDocument = {
  schema: "forgeplan.map/v1",
  meta: {
    map_id: "test",
    status: "confirmed",
    project_type: "generic",
    composition_id: "c1",
    source_fingerprint: "fp",
    version: 1,
  },
  canvas: {
    grid: { cols: 1, rows: 1 },
    gap: { x: 88, y: 70 },
    margin: 40,
    cell: {
      card_w: 190,
      card_h: 60,
      card_gap: 36,
      zpad: { top: 50, side: 24, bottom: 24 },
    },
  },
  composition: {
    template: "generic",
    arrangement: "stack-ttb",
    entry_zone: "z.a",
    placements: [{ zone: "z.a", cell: { row: 0, col: 0 } }],
    zone_connectors: [],
  },
  zones: [
    {
      id: "z.a",
      label: "Zone A",
      kind: "surface",
      accent: "--map-accent-cyan",
      treatment: "neutral-dashed",
      rule_edge: "off",
      layout_rule: "grid",
      cols: 2,
    },
  ],
  nodes: [
    {
      id: "n1",
      label: "Node 1",
      kind: "component",
      zone: "z.a",
      found_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  edges: [],
};

describe("iso-view-state — mid-animation convergence (RFC-036 Test Strategy Hooks / EVID-100 Finding #1)", () => {
  // These tests share the iso-view-state module singleton (no reset hook is
  // exported) and build on each other's ending state in declaration order —
  // root -> mid-flight -> converged — mirroring
  // composed-map/model/drill-state.test.ts's incremental-stack pattern.

  it("ascend() is a no-op at the root level (nothing to ascend from)", () => {
    expect(currentFocusChain()).toEqual([]);
    const stackBefore = currentLevelStack();
    ascend();
    expect(currentLevelStack()).toBe(stackBefore);
    expect(currentFocusChain()).toEqual([]);
  });

  it("records the pending target while an animation is in flight, then converges to the LATEST chain once it settles (no permanent drift)", async () => {
    // First external update starts an enter animation for "ext-a"; its own
    // synchronous prelude (levelStack push + animationKind = "enter") runs
    // before the function's first `await`, so it is observable immediately.
    const first = applyExternalFocusChain(rootDoc, ["ext-a"]);
    expect(currentAnimationKind()).toBe("enter");
    expect(currentFocusChain()).toEqual(["ext-a"]);

    // A second, deeper update arrives while the first is still animating —
    // the 3D can't apply it immediately, so it must be RECORDED (not
    // dropped, not applied out of order): the chain must NOT yet show
    // "ext-b".
    const second = applyExternalFocusChain(rootDoc, ["ext-a", "ext-b"]);
    expect(currentFocusChain()).toEqual(["ext-a"]);

    await Promise.all([first, second]);

    // Let the module's own `$effect.root` watcher (which re-applies the
    // pending target once `animationKind` settles back to null) run to
    // completion. Polled via `tick()` — a microtask + reactivity flush, not
    // a real timer/animation frame — so this stays deterministic and fast.
    for (let i = 0; i < 20; i++) {
      if (
        currentAnimationKind() === null &&
        chainsEqual(currentFocusChain(), ["ext-a", "ext-b"])
      ) {
        break;
      }
      await tick();
    }

    expect(currentAnimationKind()).toBeNull();
    expect(currentFocusChain()).toEqual(["ext-a", "ext-b"]);
  });

  it("is idempotent once converged — reconciling to the already-current chain triggers no animation and no state churn", async () => {
    expect(currentFocusChain()).toEqual(["ext-a", "ext-b"]);
    const stackBefore = currentLevelStack();
    await applyExternalFocusChain(rootDoc, ["ext-a", "ext-b"]);
    expect(currentAnimationKind()).toBeNull();
    expect(currentLevelStack()).toBe(stackBefore);
  });
});
