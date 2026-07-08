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
//
// Naming note (EVID-100 Finding #7): RFC-036 documents this bus's contract
// as `focusChain` (the reactive chain) + `focusTo(chain)` (reconcile to an
// explicit chain). `focusTo` below is exactly what this module's setter
// does ("reconcile to an explicit chain... used when one surface must
// jump the other to an arbitrary focus", per the RFC) — renamed to match.
// The getter keeps its `sharedFocusChain` name rather than the RFC's bare
// `focusChain`: `widgets/composed-map/model/drill-state.ts` already
// exports an UNRELATED `focusChain(levelStack)` (a per-view LOCAL chain
// derivation) that both ComposedMapView.svelte and iso-view-state.svelte.ts
// import alongside this module — a bare `focusChain` here would collide
// with that import at every call site. `sharedFocusChain` disambiguates
// the two "focus chain" concepts by name, same as the file's own header
// paragraph above already does in prose. The RFC ALSO documents per-action
// `descend`/`ascend` and depth/visibility (`setDepth`/`toggleVisible`) as
// bus methods — those are NOT implemented here: depth-window and
// visibility are intentionally LOCAL-only state inside
// `iso-view-state.svelte.ts` (never shared), and each view's own
// descend/ascend mutates its OWN local levelStack, then mirrors the
// resulting full chain out via `focusTo` — a broadcast, not a per-action
// shared mutator. RFC-036's Function Signatures section still needs a
// follow-up edit to reflect this; that is Profile A/B territory (ADR/RFC
// ownership), not this coder change.

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
export function focusTo(next: readonly string[]): void {
  const current = untrack(() => chain);
  if (chainsEqual(current, next)) return;
  chain = [...next];
}
