import type { ScoreEntry } from "@/entities/score";
import type { ActivityEntry } from "@/entities/activity";
import { median, weeklyVelocity } from "./pulse-stats";

// PRD-010 / RFC-009 FR-008 / FR-009 — deterministic workspace health score
// 0..100. Pure function of read-only inputs. Median (not mean) for the R_eff
// component so a single high-evidence artifact cannot game the score (R-2).

export interface HealthScoreInput {
  /** /api/score results (scored / evidenced subset only). */
  scores: ScoreEntry[];
  /** count of artifacts whose status is 'active'. */
  activeCount: number;
  /** total artifact count (all kinds, all statuses). */
  totalCount: number;
  /** count of distinct blind-spot artifacts (health.blind_spots). */
  blindSpotCount: number;
  /** /api/log entries (status transitions + creates) for velocity. */
  log: ActivityEntry[];
}

export interface HealthComponent {
  key: string;
  label: string;
  /** Component value in [0,1]. */
  value: number;
  /** Weight in [0,1]; weights sum to 1. */
  weight: number;
}

export interface HealthScore {
  /** Final integer score 0..100. */
  score: number;
  components: HealthComponent[];
}

// Weights (RFC-009 FR-009). Must sum to 1.
export const HEALTH_WEIGHTS = {
  rEffHealth: 0.3,
  activationRatio: 0.2,
  evidenceFreshness: 0.2,
  blindSpotScore: 0.15,
  velocityScore: 0.15,
} as const;

/** Median R_eff of the scored subset, already in [0,1]. */
export function rEffHealthComponent(scores: ScoreEntry[]): number {
  const m = median(scores.map((s) => s.r_eff));
  return clamp01(m);
}

/** active / total. Empty workspace → 0 (no health to speak of). */
export function activationRatioComponent(
  activeCount: number,
  totalCount: number,
): number {
  if (totalCount <= 0) return 0;
  return clamp01(activeCount / totalCount);
}

/**
 * Fraction of artifacts that carry evidence (are scored). Proxy for evidence
 * freshness reachable read-only: an artifact present in /api/score has at
 * least one linked EvidencePack. total 0 → 0.
 */
export function evidenceFreshnessComponent(
  scoredCount: number,
  totalCount: number,
): number {
  if (totalCount <= 0) return 0;
  return clamp01(scoredCount / totalCount);
}

/**
 * 1 − (blind spots / total). All artifacts blind → 0; none blind → 1.
 * total 0 → 1 (nothing can be blind).
 */
export function blindSpotComponent(
  blindSpotCount: number,
  totalCount: number,
): number {
  if (totalCount <= 0) return 1;
  return clamp01(1 - blindSpotCount / totalCount);
}

/**
 * Velocity → [0,1]. Uses the most recent week's net flow, mapped through a
 * saturating ramp: net ≤ 0 → 0, net ≥ SATURATION → 1. Keeps the score
 * sensitive to recent throughput without letting a burst peg it.
 */
export const VELOCITY_SATURATION = 5;

export function velocityComponent(
  log: ActivityEntry[],
  saturation = VELOCITY_SATURATION,
): number {
  const weeks = weeklyVelocity(log);
  const last = weeks[weeks.length - 1];
  if (!last) return 0;
  const recent = last.net;
  if (recent <= 0) return 0;
  return clamp01(recent / saturation);
}

/**
 * Deterministic composite. score = round(100 × Σ value·weight). Identical
 * inputs always yield an identical integer — asserted in the test suite.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScore {
  const scoredCount = input.scores.length;
  const components: HealthComponent[] = [
    {
      key: "rEffHealth",
      label: "R_eff (median)",
      value: rEffHealthComponent(input.scores),
      weight: HEALTH_WEIGHTS.rEffHealth,
    },
    {
      key: "activationRatio",
      label: "Activation ratio",
      value: activationRatioComponent(input.activeCount, input.totalCount),
      weight: HEALTH_WEIGHTS.activationRatio,
    },
    {
      key: "evidenceFreshness",
      label: "Evidence coverage",
      value: evidenceFreshnessComponent(scoredCount, input.totalCount),
      weight: HEALTH_WEIGHTS.evidenceFreshness,
    },
    {
      key: "blindSpotScore",
      label: "Blind-spot freedom",
      value: blindSpotComponent(input.blindSpotCount, input.totalCount),
      weight: HEALTH_WEIGHTS.blindSpotScore,
    },
    {
      key: "velocityScore",
      label: "Recent velocity",
      value: velocityComponent(input.log),
      weight: HEALTH_WEIGHTS.velocityScore,
    },
  ];
  const weighted = components.reduce((s, c) => s + c.value * c.weight, 0);
  return { score: Math.round(100 * weighted), components };
}

export type HealthBand = "good" | "warn" | "bad";

/** RFC-009 thresholds: 80+ good, 60–79 warn, 0–59 bad. */
export function healthBand(score: number): HealthBand {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
