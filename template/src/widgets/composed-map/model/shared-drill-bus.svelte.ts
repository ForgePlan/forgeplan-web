// Shared FOCUS CHAIN between the 2D ComposedMapView and the 3D IsoMinimap
// corner (widgets/iso-map/model/iso-view-state.svelte.ts). Holds ONLY the
// ordered list of drilled zone/node ids — the same shape
// drill-state.ts#focusChain returns (root excluded, deepest entry last).
// Each view keeps its OWN LevelFrame[] levelStack locally for view-specific
// concerns that must never be shared (2D: pan/zoom transform + kFit; 3D:
// depthWindow + enter/exit animation tweens) and reconciles that local
// state against this chain via a pair of $effects living in each view's own
// component (an $effect needs a component owner, so the reconciliation
// itself is NOT implemented here — see ComposedMapView.svelte's and
// IsoMinimap.svelte's own OUTBOUND/INBOUND effect pair). Mirrors
// camera-bus.svelte.ts's shape: no class, one module-level $state singleton
// per page.
//
// Plain data only — this file MUST NOT import three/@threlte (or anything
// that does), so importing it from the 2D/SSR path never pulls the 3D
// dependency graph in.

import { untrack } from "svelte";

let chain = $state<string[]>([]);

/** Reactive read — call from inside an $effect/$derived to track changes. */
export function sharedFocusChain(): string[] {
  return chain;
}

export function chainsEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Content-guarded write: a no-op (no new array, no reactive notification)
// when `next` already matches the current chain. This is load-bearing for
// the outbound/inbound effect pair in each consuming view — without it, a
// view that just applied an externally-driven chain would immediately
// "confirm" it right back into a NEW object, re-triggering the other
// view's inbound effect for no reason. The internal comparison read is
// wrapped in `untrack` so that calling this from inside a REACTIVE
// $effect (as both consuming views do) never makes that effect an
// accidental subscriber of this module's own state — only the writes a
// caller performs on ITS OWN local state should decide when it re-runs.
export function setSharedFocusChain(next: readonly string[]): void {
  const current = untrack(() => chain);
  if (chainsEqual(current, next)) return;
  chain = [...next];
}
