// Route-local copy of widgets/dependency-graph/lib/reduced-motion.ts's
// `motionDuration` helper. That file is not part of dependency-graph's
// public index.ts barrel, so importing it directly would reach into
// another widget's private lib/ (FSD encapsulation violation) — this route
// owns an identical, tiny copy instead until promotion (see
// widgets/iso-map/index.ts's canonical TODO(iso-promote)) hoists a shared
// version both call sites can use. Safe on server:
// matchMedia is window-only, so it guards.
export function motionDuration(defaultMs: number): number {
  if (typeof window === "undefined") return defaultMs;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : defaultMs;
}
