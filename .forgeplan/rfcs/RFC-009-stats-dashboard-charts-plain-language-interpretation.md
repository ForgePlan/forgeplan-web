---
depth: standard
id: RFC-009
kind: rfc
links:
- target: PRD-010
  relation: refines
status: draft
title: Stats dashboard charts + plain-language interpretation
---

# RFC-009: Stats dashboard charts + interpretation

## Summary

PRD-010 wants a workspace-pulse dashboard with 4 charts + a single
health score (0..100) + 30-day sparkline trend. **Critical UX
constraint**: every chart shows the user not just the numbers but
**what the numbers mean** — tooltip on hover + static caption + status
badge with 1-line interpretation. This RFC pins:

1. **The 4 charts** — exact data shape, axis math, colour mapping.
2. **Interpretation rules** — heuristics that decide 🟢/🟡/🔴 + the
   1-line copy per chart.
3. **Health score formula** — composition + gaming-resistance.
4. **Server endpoint contract** — `/api/pulse`.

## Motivation

Without this RFC, the chart-interpretation rules become ad-hoc and
inconsistent. A user reading "0.71" gets nothing. A user reading
"R_eff distribution is bimodal — most decisions well-evidenced, 3 in
active work" understands.

Pinning here makes the implementation mechanical and the copy
audit-replicable.

## The 4 charts

### 1. R_eff histogram

- **Axes**: x = R_eff buckets [0..1] in 0.1 steps (10 bars); y = artifact count.
- **Colour**: bar colour ∝ bucket position. Buckets [0..0.4]: `var(--bad)`. [0.4..0.7]: `var(--warn)`. [0.7..1]: `var(--good)`.
- **Caption** (static, below chart): "Each bar = number of artifacts with R_eff in this range. Far-left = weak evidence; far-right = solid."
- **Interpretation rules** (heuristic):
  - 🟢 healthy: median ≥ 0.7 AND right tail (≥ 0.7) > 60% of total. Copy: "Bimodal distribution — most decisions well-evidenced, X in active work."
  - 🟡 watching: median 0.4..0.7 OR right tail 30..60%. Copy: "Mixed quality. X artifacts need more evidence."
  - 🔴 concerning: median < 0.4 OR > 30% in [0..0.4]. Copy: "X% of decisions sit on weak evidence — risk debt accumulating."

### 2. Decay calendar (heat-map)

- **Axes**: x = next 12 months in week-tiles; y = single row.
- **Colour**: tile shade ∝ count of artifacts whose `valid_until` falls in that week. Lerp from `var(--bg-2)` (0) to `var(--bad)` (10+).
- **Caption**: "Each tile = a week. Darker = more evidence packs expire that week. Watch for clusters — they signal future maintenance bursts."
- **Interpretation rules**:
  - 🟢: no week has > 5 expiries.
  - 🟡: at least one week with 5..10 expiries.
  - 🔴: any week with > 10 expiries OR > 20 expiries in next 30 days. Copy: "X items expire in N days — schedule a refresh sprint."

### 3. Weekly velocity (line chart)

- **Axes**: x = last 12 weeks; y = (activations + deprecations) - drafts_added per week. Net effect: positive = decisions reaching ground; negative = piling drafts.
- **Colour**: stroke `var(--accent)`. Zero-line in `var(--line-2)`.
- **Caption**: "Bars above zero = the project is decisively settling. Below zero = drafts piling up faster than activations."
- **Interpretation rules**:
  - 🟢: avg of last 4 weeks > 0 AND not falling > 50% from prior 4 weeks.
  - 🟡: avg ≥ 0 but trend declining > 30%.
  - 🔴: avg < 0 across last 4 weeks. Copy: "Drafts piling up. Either pause new ones or schedule activation push."

### 4. Status transitions Sankey

- **Nodes** (left col): `draft / active / superseded / deprecated / stale` populated 90 days ago.
- **Nodes** (right col): same labels at "now".
- **Flows**: count of artifacts that transitioned from left-bucket to right-bucket.
- **Colour**: kind colour for each flow.
- **Caption**: "Where artifacts ended up vs. where they started 90 days ago. Look for stuck draft → draft (red flag) and active → superseded (rapid evolution)."
- **Interpretation rules**:
  - 🟢: > 60% of `draft` from 90d ago is now `active` or `superseded`.
  - 🟡: 30..60%.
  - 🔴: < 30%. Copy: "Drafts not converting to decisions — review what's blocking."

## Health score formula

`HEALTH_SCORE = round(100 × weighted_avg(components, weights))`

Components (each 0..1, higher = better):

| Component              | Formula                                            | Weight |
| ---------------------- | -------------------------------------------------- | ------ |
| **R_eff health**       | median R_eff across activated artifacts            | 0.30   |
| **Activation ratio**   | activated_count / total_count                      | 0.20   |
| **Evidence freshness** | 1 - (median_evidence_age_days / 90) clamped [0..1] | 0.20   |
| **Blind-spot score**   | 1 - (blind_spot_count / total_count)               | 0.15   |
| **Velocity score**     | clamp(0, avg_4w_velocity / 5, 1)                   | 0.15   |

**Gaming resistance**: median (not mean) ensures one big-R_eff artifact doesn't mask ten low-R_eff ones. Components covering different dimensions — can't game by tweaking one.

**Sparkline** (30-day trend): server caches daily snapshots of HEALTH_SCORE in `.forgeplan-web/health-history.json` (single line append per day). Sparkline = those 30 daily points. If history < 30 days → fewer points; "no data yet" hint.

**Threshold copy** for the score itself:

- 80..100: "🟢 Healthy"
- 60..79: "🟡 Watching"
- 0..59: "🔴 Concerning"

## Server endpoint contract

`GET /api/pulse?since=ISO`:

Returns:

```json
{
  "now": "2026-05-06T14:00:00Z",
  "since": "2026-02-05T14:00:00Z",
  "r_eff_histogram": [{ "bucket": 0.0, "count": 3 }, ...],
  "decay_calendar": [{ "week": "2026-W19", "count": 2 }, ...],
  "velocity_weekly": [{ "week": "2026-W14", "net": 3 }, ...],
  "status_transitions": [{ "from": "draft", "to": "active", "count": 8 }, ...],
  "health_score": {
    "score": 72,
    "components": { "r_eff_health": 0.71, "activation_ratio": 0.78, ... },
    "trend": [70, 71, 71, ..., 72]
  }
}
```

Pure read: invokes `forgeplan list --json`, `forgeplan score <id> --json` (already in allow-list), `forgeplan journal --json` (added in F18). Single endpoint, ≤ 200ms server time. Cache on `(workspace_mtime)` for 30s.

## Implementation Phases

1. **F22-T1** — `lib/pulse-stats.ts` + tests (pure aggregation from list+journal).
2. **F22-T2** — `lib/interpret.ts` + tests (heuristic rules per chart).
3. **F22-T3** — `lib/health-score.ts` + tests (formula + gaming-resistance assertions).
4. **F22-T4** — server endpoint `/api/pulse/+server.ts` + cache.
5. **F22-T5** — 4 chart components (`ReffHistogram`, `DecayCalendar`, `WeeklyVelocity`, `StatusTransitions`).
6. **F22-T6** — `HealthScore.svelte` (number + sparkline + breakdown tooltip).
7. **F22-T7** — `StatsPanel.svelte` wrapper + 6th tab in InsightsRail; embed HealthScore in HealthBar.
8. **F22-T8** — CHANGELOG, smoke + tests, commit, push, PR.

## Proposed Direction

Adopt the 4-chart + 1-score approach. Each chart **must ship with** its
tooltip + caption + interpretation badge — those are non-negotiable per
PRD-010 FR-006/FR-007. PR `feature/f22-workspace-pulse → develop`.

## Options Considered

| Option                              | Description                            | Verdict                                                                 |
| ----------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| **A. 4 hand-baked charts**          | Custom SVG per chart, no chart library | **Chosen** — full control of caption/interpretation copy, zero new deps |
| B. ECharts / Recharts               | Off-the-shelf chart library            | Rejected — adds 100+ KB bundle, bloated for 4 specific charts           |
| C. Render charts server-side as SVG | Lighter client                         | Rejected — animation/interaction would still need client logic          |
| **D. Median-based health score**    | Resistant to single-artifact gaming    | **Chosen**                                                              |
| E. Mean-based health score          | Simpler                                | Rejected — single big-R_eff artifact dominates                          |

## Invariants

- Every chart includes: hover tooltip (1-2 sentences) + static caption + status badge with 1-line copy.
- Server endpoint is read-only (rule 22). Allow-list extension is `journal` only (already added in F18).
- Health score formula is deterministic — same inputs → same score.
- Health history append-only (`.forgeplan-web/health-history.json`); never overwritten or compacted client-side.
- Sparkline gracefully shows "no data yet" when < 7 days of history.

## Rollback Plan

1. Revert each F22-T\* commit independently.
2. Drop server endpoint route + lib files.
3. Remove 6th tab from InsightsRail.
4. Health-history file in `.forgeplan-web/` survives but unused.

## Risks

- R-1: Interpretation copy turns out wrong on certain workspaces. Mitigate via fixture-based unit tests + 1-week dogfood window before announce.
- R-2: SVG charts re-render on each 10s poll cascade. Mitigate via content-signature memoization (same lib pattern as F4 cluster.svelte.ts).
- R-3: Health score changes too quickly day-to-day, distracts users. Mitigate by smoothing — sparkline shows 7-day moving average not raw daily.
- R-4: Health-history file grows unbounded. Mitigate by appending lines; rotate after 365 days (~ 365 lines × 80 bytes ≈ 30 KB max).

