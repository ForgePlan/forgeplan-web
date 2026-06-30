import type { HintRule } from "./types";
import { renderCopy } from "./hint-copy";

// PRD-011 / RFC-010 FR-004/FR-005 — the rule registry. Adding a 9th rule is a
// single append to HINT_RULES; each rule has a stable id, a pure `match`, and a
// `copy` that resolves through hint-copy.ts (NFR-005).
//
// Thresholds are exported consts (FR-005 / SC-8 single-file tunable). FR-010
// (per-rule threshold via forgeplan-web.json) is a documented blocker (B3):
// that file is server-only and not reachable from any allow-listed client
// endpoint, so config-driven thresholds are deferred. These consts are the
// tunable surface until a config-exposing surface exists.

export const STALE_SPIKE_DELTA = 3;
export const LOW_R_EFF_THRESHOLD = 0.3;
export const BLIND_SPOT_MIN = 2;
export const ORPHAN_MIN = 1;
/** velocity-drop fires when lastWeek.net < prevWeek.net × this factor. */
export const VELOCITY_DROP_FACTOR = 0.4;

// 1. stale-spike — health.stale_count jumped by >= STALE_SPIKE_DELTA vs the
// last-seen count persisted in localStorage (plan blocker: no aggregate
// endpoint carries a prior count, so we persist one ourselves).
const staleSpike: HintRule = {
  id: "stale-spike",
  defaultSeverity: "warning",
  match: (input) => {
    const delta = input.health.stale_count - input.prevStaleCount;
    if (delta < STALE_SPIKE_DELTA) return null;
    const drafts = input.health.stale_drafts ?? [];
    const affectedIds = drafts.map((d) => d.id).filter(Boolean);
    return { affectedIds, data: { n: input.health.stale_count } };
  },
  copy: (input, match) =>
    renderCopy("stale-spike", {
      n: input.health.stale_count,
      topId: match.affectedIds[0] ?? "an artifact",
    }),
};

// 2. low-r-eff-critical — an active artifact scores below threshold. score has
// no status, so cross-reference statusById (derived from /api/list).
const lowReffCritical: HintRule = {
  id: "low-r-eff-critical",
  defaultSeverity: "critical",
  match: (input) => {
    const affectedIds: string[] = [];
    for (const s of input.scores) {
      if (typeof s.r_eff !== "number" || Number.isNaN(s.r_eff)) continue;
      if (s.r_eff >= LOW_R_EFF_THRESHOLD) continue;
      if (input.statusById.get(s.id) !== "active") continue;
      affectedIds.push(s.id);
    }
    if (affectedIds.length === 0) return null;
    affectedIds.sort();
    return { affectedIds };
  },
  copy: (_input, match) =>
    renderCopy("low-r-eff-critical", {
      topId: match.affectedIds[0] ?? "An active artifact",
    }),
};

// 3. valid-until-imminent — DEGRADED (plan blocker B1). Per-artifact
// valid_until is not in any aggregate read-only payload; fall back to
// health.at_risk count for a coarse "at risk of decaying" signal.
const validUntilImminent: HintRule = {
  id: "valid-until-imminent",
  defaultSeverity: "warning",
  match: (input) => {
    const atRisk = input.health.at_risk ?? [];
    if (atRisk.length === 0) return null;
    const affectedIds = atRisk.map((a) => a.id).filter(Boolean);
    return { affectedIds, data: { n: atRisk.length } };
  },
  copy: (input, _match) =>
    renderCopy("valid-until-imminent", {
      n: (input.health.at_risk ?? []).length,
    }),
};

// 4. blind-spot-new — health reports >= BLIND_SPOT_MIN blind spots (active
// artifacts with no supporting evidence).
const blindSpotNew: HintRule = {
  id: "blind-spot-new",
  defaultSeverity: "warning",
  match: (input) => {
    const spots = input.health.blind_spots;
    if (spots.length < BLIND_SPOT_MIN) return null;
    const affectedIds = spots.map((s) => s.id).filter(Boolean);
    return { affectedIds, data: { n: spots.length } };
  },
  copy: (input, _match) =>
    renderCopy("blind-spot-new", { n: input.health.blind_spots.length }),
};

// 5. orphan-detected — health.orphans (artifacts with no links). Served by
// health.orphans rather than recomputing adjacency from edges.
const orphanDetected: HintRule = {
  id: "orphan-detected",
  defaultSeverity: "tip",
  match: (input) => {
    const orphans = input.health.orphans;
    if (orphans.length < ORPHAN_MIN) return null;
    return { affectedIds: [...orphans], data: { n: orphans.length } };
  },
  copy: (input, _match) =>
    renderCopy("orphan-detected", { n: input.health.orphans.length }),
};

// 6. draft-too-old — DEGRADED (plan blocker B2). Per-artifact created_at is
// not in /api/list. Fall back to health.stale_drafts[] (carries id +
// age_hours), which already encodes aged drafts. Semantics shift from
// "draft > 30d" to "draft flagged stale by health" — documented divergence.
const draftTooOld: HintRule = {
  id: "draft-too-old",
  defaultSeverity: "tip",
  match: (input) => {
    const drafts = input.health.stale_drafts ?? [];
    if (drafts.length === 0) return null;
    const affectedIds = drafts.map((d) => d.id).filter(Boolean);
    if (affectedIds.length === 0) return null;
    affectedIds.sort();
    return { affectedIds, data: { n: affectedIds.length } };
  },
  copy: (_input, match) =>
    renderCopy("draft-too-old", {
      topId: match.affectedIds[0] ?? "A draft",
    }),
};

// 7. velocity-drop — last full week's net flow collapsed vs the prior week.
// Guard prevWeek.net > 0 so we never divide against a flat/negative baseline.
const velocityDrop: HintRule = {
  id: "velocity-drop",
  defaultSeverity: "warning",
  match: (input) => {
    const weeks = input.velocityWeekly;
    if (weeks.length < 2) return null;
    const prev = weeks[weeks.length - 2];
    const last = weeks[weeks.length - 1];
    if (!prev || !last) return null;
    if (prev.net <= 0) return null;
    if (last.net >= prev.net * VELOCITY_DROP_FACTOR) return null;
    const pct = Math.round((1 - last.net / prev.net) * 100);
    return { affectedIds: [], data: { pct } };
  },
  copy: (input, _match) => {
    const weeks = input.velocityWeekly;
    const prev = weeks[weeks.length - 2];
    const last = weeks[weeks.length - 1];
    const pct =
      prev && last && prev.net > 0
        ? Math.round((1 - last.net / prev.net) * 100)
        : 0;
    return renderCopy("velocity-drop", { pct });
  },
};

// 8. cycle-detected — a dependency cycle reported by /api/blocked.cycles. The
// CLI already detects cycles; the rule consumes them directly.
const cycleDetected: HintRule = {
  id: "cycle-detected",
  defaultSeverity: "critical",
  match: (input) => {
    if (input.cycles.length === 0) return null;
    const first = input.cycles[0] ?? [];
    if (first.length === 0) return null;
    return { affectedIds: [...first] };
  },
  copy: (input, _match) => {
    const first = input.cycles[0] ?? [];
    const chain = [...first, first[0] ?? ""].filter(Boolean).join(" → ");
    return renderCopy("cycle-detected", { chain });
  },
};

/**
 * The rule registry, in priority order (index = `Hint.priority`, the
 * deterministic secondary tiebreak in rankHints). Append-only: a new rule
 * goes at the end; reordering changes tiebreak behaviour.
 */
export const HINT_RULES: readonly HintRule[] = [
  staleSpike,
  lowReffCritical,
  validUntilImminent,
  blindSpotNew,
  orphanDetected,
  draftTooOld,
  velocityDrop,
  cycleDetected,
];
