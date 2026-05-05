// FR-004 (PRD-003): single source of truth for the prefers-reduced-motion
// preference. Returns 0 (no animation) when reduce is set, otherwise the
// passed default. Safe on server: matchMedia is window-only, so we guard.
export function motionDuration(defaultMs: number): number {
  if (typeof window === "undefined") return defaultMs;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : defaultMs;
}
