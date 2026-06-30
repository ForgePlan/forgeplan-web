import type {
  ArtifactSummary,
  ArtifactStatus,
  ArtifactKind,
} from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";
import type { HealthResponse } from "@/entities/health";
import type { ScoreEntry } from "@/entities/score";
import type { WeekVelocity } from "@/widgets/stats-pulse/lib/pulse-stats";

// PRD-011 / RFC-010 — pure rule-DSL types for the proactive hints engine.
// All inputs are derived CLIENT-SIDE from allow-listed read-only pollers
// (health, list, score, blocked, log). No /api/anomalies, no new endpoint,
// no allow-list widening (rule 22).

export type HintSeverity = "critical" | "warning" | "tip";

/**
 * Snapshot consumed by every rule's `match` / `copy`. Rules never fetch —
 * they read only this immutable input (RFC-010 invariant).
 *
 * Deviations from the RFC's HintInput (documented in plan blockers):
 *  - `statusById` / `kindById` / `titleById`: id→field maps derived from
 *    /api/list, needed for cross-referencing scores (which carry no status)
 *    and for plain-language copy. RFC omitted these.
 *  - `cycles`: directly from /api/blocked.cycles — the CLI already computes
 *    cycle detection, so the rule consumes it instead of re-deriving from
 *    edges client-side.
 *  - `velocityWeekly`: full WeekVelocity[] (from weeklyVelocity()) instead
 *    of the RFC's single number, so velocity-drop can compare last vs prev
 *    week deterministically.
 *  - `prevStaleCount`: last-seen stale count persisted in localStorage
 *    (mirrors notify.svelte's snapshot pattern). stale-spike needs a prior
 *    value to compute a delta; no aggregate payload carries one.
 */
export interface HintInput {
  artifacts: ArtifactSummary[];
  statusById: Map<string, ArtifactStatus>;
  kindById: Map<string, ArtifactKind>;
  titleById: Map<string, string>;
  edges: GraphEdge[];
  health: HealthResponse;
  scores: ScoreEntry[];
  cycles: string[][];
  velocityWeekly: WeekVelocity[];
  prevStaleCount: number;
  now: Date;
}

export interface HintMatch {
  /** Overrides the rule's defaultSeverity when present. */
  severity?: HintSeverity;
  affectedIds: string[];
  data?: Record<string, string | number>;
}

export interface HintAction {
  label: string;
  href?: string;
  cliHint?: string;
}

export interface Hint {
  /** Stable per-rule id (`stale-spike`, `low-r-eff-critical`, …). */
  id: string;
  severity: HintSeverity;
  /** One sentence, plain language, resolved via hint-copy.ts. */
  text: string;
  action?: HintAction;
  affectedIds?: string[];
  /**
   * Stable rank index from the rule's position in HINT_RULES. Used as the
   * deterministic secondary tiebreak in rankHints (NFR-003). REPLACES the
   * RFC's `computedAt` recency tiebreak, which is Date.now-based and
   * therefore non-deterministic across renders (plan blocker B4).
   */
  priority: number;
}

export interface HintRule {
  /** Stable id — never renamed; deprecation requires a new id (invariant). */
  id: string;
  defaultSeverity: HintSeverity;
  match: (input: HintInput) => HintMatch | null;
  copy: (input: HintInput, match: HintMatch) => string;
}
