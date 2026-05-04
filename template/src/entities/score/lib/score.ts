import type { ReffTone } from '../model/types';

/** Map an R_eff score to a tone bucket for progress bars. */
export function reffTone(reff: number | undefined): ReffTone {
  if (reff === undefined || Number.isNaN(reff)) return 'bad';
  if (reff >= 0.6) return 'good';
  if (reff >= 0.3) return 'warn';
  return 'bad';
}

/** Node radius for force-directed layouts (kept for back-compat). */
export function reffRadius(reff: number | undefined): number {
  if (reff === undefined || Number.isNaN(reff)) return 8;
  const clamped = Math.max(0, Math.min(1, reff));
  return 7 + clamped * 11;
}

// TODO(palette-audit): verify color parity with view files in PR.
// Resolves to theme CSS variables to match ForceView/TreeView/RadialView
// inline usage; 'warn' maps to --accent (not --warn) per current convention.
/** CSS color token for an R_eff progress-bar segment. Centralizes the
 *  warn/bad/good palette previously inlined across graph view components. */
export function reffBarColor(reff: number | undefined): string {
  const t = reffTone(reff);
  if (t === 'good') return 'var(--good)';
  if (t === 'warn') return 'var(--accent)';
  return 'var(--bad)';
}
