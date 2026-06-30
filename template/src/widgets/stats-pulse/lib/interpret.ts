import type { HistogramBucket, WeekVelocity, DecayProxy } from "./pulse-stats";
import type { HealthScore } from "./health-score";
import { healthBand } from "./health-score";

// PRD-010 / RFC-009 FR-007 — plain-language interpretation of each chart.
// Pure heuristics → { tone, icon, copy }. Icon is a SHAPE+glyph so the badge
// never relies on colour alone (NFR-005 colourblind safety).

export type Tone = "good" | "warn" | "bad";

export interface Interpretation {
  tone: Tone;
  /** Shape glyph — distinguishable without colour. */
  icon: string;
  /** One short, plain-language sentence. */
  copy: string;
}

const ICON: Record<Tone, string> = {
  good: "●", // filled circle
  warn: "◐", // half circle
  bad: "○", // hollow circle
};

function withIcon(tone: Tone, copy: string): Interpretation {
  return { tone, icon: ICON[tone], copy };
}

/**
 * R_eff histogram → reads the share of evidenced artifacts at or above the
 * 0.7 "strong" line.
 */
export function interpretHistogram(buckets: HistogramBucket[]): Interpretation {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0)
    return withIcon("warn", "No evidenced artifacts to score yet.");
  const strong = buckets
    .filter((b) => b.lo >= 0.7)
    .reduce((s, b) => s + b.count, 0);
  const weak = buckets
    .filter((b) => b.hi <= 0.4)
    .reduce((s, b) => s + b.count, 0);
  const strongPct = Math.round((strong / total) * 100);
  if (weak / total > 0.3)
    return withIcon(
      "bad",
      `${Math.round((weak / total) * 100)}% of evidenced artifacts sit below R_eff 0.4 — weak proof.`,
    );
  if (strongPct >= 60)
    return withIcon(
      "good",
      `${strongPct}% of evidenced artifacts have strong evidence (R_eff ≥ 0.7).`,
    );
  return withIcon(
    "warn",
    `Only ${strongPct}% of evidenced artifacts reach strong evidence (R_eff ≥ 0.7).`,
  );
}

/** Decay proxy → counts of decaying artifacts. */
export function interpretDecay(decay: DecayProxy): Interpretation {
  if (decay.total === 0)
    return withIcon("good", "Nothing is stale or at risk of decay.");
  if (decay.atRisk > 0 || decay.stale > 0)
    return withIcon(
      "bad",
      `${decay.atRisk + decay.stale} artifact(s) stale or at risk; ${decay.staleDrafts} stale draft(s).`,
    );
  return withIcon(
    "warn",
    `${decay.staleDrafts} draft(s) sitting untouched — review or close them.`,
  );
}

/** Weekly velocity → trend of recent net flow. */
export function interpretVelocity(weeks: WeekVelocity[]): Interpretation {
  const last = weeks[weeks.length - 1];
  if (!last) return withIcon("warn", "No activity recorded yet.");
  const recent = last.net;
  if (recent > 0)
    return withIcon(
      "good",
      `Net +${recent} artifact(s) progressed this week — workspace is advancing.`,
    );
  if (recent === 0)
    return withIcon("warn", "Flat week — as much new backlog as progress.");
  return withIcon(
    "bad",
    `Net ${recent} this week — backlog grew faster than it cleared.`,
  );
}

/** Status transitions → presence of forward flow. */
export function interpretTransitions(
  transitions: { from: string; to: string; count: number }[],
): Interpretation {
  if (transitions.length === 0)
    return withIcon("warn", "No status changes in the last 90 days.");
  const activations = transitions
    .filter((t) => t.to === "active")
    .reduce((s, t) => s + t.count, 0);
  const regressions = transitions
    .filter(
      (t) => t.to === "deprecated" || t.to === "superseded" || t.to === "stale",
    )
    .reduce((s, t) => s + t.count, 0);
  if (activations === 0 && regressions > 0)
    return withIcon(
      "bad",
      `${regressions} artifact(s) retired and none activated — the graph is shrinking.`,
    );
  if (activations >= regressions)
    return withIcon(
      "good",
      `${activations} activation(s) vs ${regressions} retirement(s) — healthy forward flow.`,
    );
  return withIcon(
    "warn",
    `${regressions} retirement(s) outpaced ${activations} activation(s).`,
  );
}

/** Overall health score → band-based summary. */
export function interpretHealthScore(health: HealthScore): Interpretation {
  const band = healthBand(health.score);
  if (band === "good")
    return withIcon(
      "good",
      `Workspace health is strong (${health.score}/100).`,
    );
  if (band === "warn")
    return withIcon(
      "warn",
      `Workspace health is fair (${health.score}/100) — room to tighten evidence and flow.`,
    );
  return withIcon(
    "bad",
    `Workspace health is weak (${health.score}/100) — proof, activation, or blind spots need attention.`,
  );
}
