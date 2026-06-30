---
depth: standard
id: PRD-010
kind: prd
links:
- target: PRD-011
  relation: informs
status: active
title: 'Workspace pulse: stats dashboard + health score + trends'
---

# PRD-010: Workspace pulse — stats dashboard + health score + trends

## Problem

`@forgeplan/web` shows topology (graph) and per-artifact details (panel),
but has zero **aggregate signal**: no chart of R_eff distribution, no
calendar of upcoming `valid_until` decay, no sense of project velocity,
no single number for "is this workspace healthy right now".

A user looking at 289 artifacts can't tell:

- "Is the average evidence-quality going up or down across the project?"
- "How many decisions will go stale in the next 30 days?"
- "Are we activating decisions faster than we deprecate them, or stalling?"
- "If I had to give one number for project health right now, what would it be?"

CLI gives some of this via `forgeplan health` and `forgeplan score`, but

- numbers without context (no "is 0.71 R_eff good or bad for this workspace")
- no time-series (no answer to "is it trending?")
- no glanceable summary

**Critical UX constraint**: charts MUST include plain-language
interpretation. A bare number (`0.71`) is gibberish to a stakeholder
not steeped in forgeplan-methodology. Every chart needs an inline
caption that says "this means X / look at Y / ↑ healthy / ↓ concerning".

## Target Users

| Persona         | Description         | Pain                                          |
| --------------- | ------------------- | --------------------------------------------- |
| Tech lead       | weekly health check | needs glanceable signals across the workspace |
| Stakeholder     | quarterly review    | needs interpretable numbers, not raw metrics  |
| New team member | onboarding          | needs a "where is this project at?" summary   |

## Goals

| ID    | Criterion                                                                                                                                                          | Metric                                                                | Target                     | How to measure |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------- | -------------- |
| SC-1  | Stats panel renders 4 charts: R_eff histogram, decay calendar, weekly velocity, status-transitions Sankey                                                          | DOM evaluate `[data-test="stats-{r_eff,decay,velocity,transitions}"]` | 4 elements present         | Playwright     |
| SC-2  | Each chart has a tooltip on hover that explains in plain language what the chart shows AND a static caption underneath                                             | DOM `[data-test="chart-tooltip"]` + `[data-test="chart-caption"]`     | both present per chart     | Playwright     |
| SC-3  | Each chart auto-interprets state via a 🟢/🟡/🔴 badge with 1-line explanation ("Bimodal distribution — healthy. Most decisions well-evidenced, 3 in active work.") | DOM evaluate `[data-test="chart-status"]`                             | badge + text per chart     | Playwright     |
| SC-4  | Health score (0..100) appears above HealthBar                                                                                                                      | DOM `[data-test="health-score"]`                                      | element with numeric text  | Playwright     |
| SC-5  | Health score has a hover tooltip listing components ("R_eff avg: 0.71, activated: 78%, evidence-fresh: 64%, blind-spots: 2")                                       | DOM `[data-test="health-score-breakdown"]`                            | breakdown visible on hover | Playwright     |
| SC-6  | Health score trend chart (last 30 days) appears next to the score                                                                                                  | DOM `[data-test="health-trend"]`                                      | inline sparkline           | Playwright     |
| SC-7  | Stats panel reachable as 6th tab in InsightsRail OR a dedicated route `/stats`                                                                                     | DOM                                                                   | tab/route present          | Playwright     |
| SC-8  | All charts respect `prefers-reduced-motion` (no animation on entry)                                                                                                | media query                                                           | transition: none           | manual         |
| SC-9  | All charts have keyboard-accessible interactions (Tab → focus on each interactive element; Enter → drill-down to filtered list)                                    | keyboard nav                                                          | works                      | manual         |
| SC-10 | svelte-check 0/0; smoke matrix green                                                                                                                               | CI                                                                    | 0/0 + 3-OS pass            | CI             |

## Non-Goals

- Don't build a full BI dashboard — 4 focused charts, not 20.
- Don't allow custom user-defined charts ("dashboard builder") — pre-baked.
- Don't write a new charting framework — reuse d3-shape / d3-scale already in deps (or add d3-array if needed).
- Don't compute trends from a database — derive from `forgeplan journal --json` (already an event log).
- Don't replicate `forgeplan health` CLI output verbatim — add visual layer on top.

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                                                                                      | Acceptance                  |
| ------ | ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| FR-001 | Core          | Must     | User can open a Stats panel via 6th tab in InsightsRail                                                                          | Tab + panel render          |
| FR-002 | Core          | Must     | R_eff histogram: x-axis = R_eff buckets [0..1] in 0.1 steps, y-axis = artifact count                                             | bars rendered + axis labels |
| FR-003 | Core          | Must     | Decay calendar: 12-month heat-map showing count of artifacts whose `valid_until` falls in each week                              | tiles coloured by count     |
| FR-004 | Core          | Must     | Weekly velocity line chart: 12-week window of (activations + deprecations - drafts_added) per week                               | line + grid                 |
| FR-005 | Core          | Must     | Status transitions Sankey: flows from `draft / active / superseded / deprecated / stale` over the last 90 days                   | Sankey rendered             |
| FR-006 | Core          | **Must** | **Each chart has 1-2 sentence tooltip on hover explaining the chart + a static caption explaining what readers should look for** | DOM check + content review  |
| FR-007 | Core          | **Must** | **Each chart has 🟢/🟡/🔴 status badge + plain-language interpretation of the current pattern**                                  | DOM check                   |
| FR-008 | Core          | Must     | Health score (0..100) displayed above HealthBar                                                                                  | numeric + scale visible     |
| FR-009 | Core          | Must     | Health score formula documented in RFC-009; deterministic                                                                        | unit tests                  |
| FR-010 | Core          | Should   | Health score breakdown tooltip lists components and individual values                                                            | hover shows breakdown       |
| FR-011 | Core          | Should   | Health score 30-day trend sparkline next to the number                                                                           | sparkline rendered          |
| FR-012 | UX            | Should   | Click on any chart drills down to filtered artifact list (e.g. click on "expires this week" tile → InsightsRail filtered list)   | navigation works            |
| FR-013 | UX            | Could    | "Snapshot" button copies a markdown summary of current pulse for Slack / PR                                                      | clipboard write             |
| FR-014 | A11y          | Must     | Charts are keyboard-navigable + have aria-label describing the data                                                              | screen reader test          |
| FR-015 | Documentation | Should   | CHANGELOG describes FR-001..FR-014                                                                                               | grep                        |

## Non-Functional Requirements

| ID      | Category      | Requirement                                                                                      | Metric                 | Method |
| ------- | ------------- | ------------------------------------------------------------------------------------------------ | ---------------------- | ------ |
| NFR-001 | Performance   | All 4 charts render in < 250ms on N=300                                                          | Performance API timing | manual |
| NFR-002 | Bundle        | New deps + chart code ≤ 40 KB gzip on top of current bundle                                      | dist diff              | shell  |
| NFR-003 | Server        | Single endpoint `/api/pulse?since=DATE` returns aggregated data; ≤ 200ms server time             | manual timing          | manual |
| NFR-004 | A11y          | All chart text contrast ≥ 4.5:1 (WCAG AA)                                                        | computed style review  | manual |
| NFR-005 | Accessibility | Color-blind users (red-green) get a second cue on the status badge (icon shape, not just colour) | DOM review             | manual |

## Affected Files

- `template/src/widgets/stats-pulse/ui/StatsPanel.svelte` (new)
- `template/src/widgets/stats-pulse/ui/{ReffHistogram,DecayCalendar,WeeklyVelocity,StatusTransitions}.svelte` (new — 4 chart components)
- `template/src/widgets/stats-pulse/ui/HealthScore.svelte` (new — score + sparkline + breakdown)
- `template/src/widgets/stats-pulse/lib/pulse-stats.ts` (new — pure computation)
- `template/src/widgets/stats-pulse/lib/pulse-stats.test.ts` (new — unit tests)
- `template/src/widgets/stats-pulse/lib/health-score.ts` (new — composition formula)
- `template/src/widgets/stats-pulse/lib/health-score.test.ts` (new)
- `template/src/widgets/stats-pulse/lib/interpret.ts` (new — heuristic 🟢/🟡/🔴 interpreters per chart)
- `template/src/routes/api/pulse/+server.ts` (new — server aggregation endpoint)
- `template/src/widgets/insights-rail/ui/InsightsRail.svelte` (modified — 6th tab "Stats")
- `template/src/widgets/health-bar/ui/HealthBar.svelte` (modified — embed HealthScore)
- `template/src/shared/server/forgeplan.ts` (modified — extend READ_ONLY_SUBCOMMANDS allow-list with `journal` if not already)
- `CHANGELOG.md`

## Related Artifacts

| Artifact | Relation                                                         | Status   |
| -------- | ---------------------------------------------------------------- | -------- |
| RFC-009  | Architecture — chart selection, formulas, interpretation rules   | planned  |
| EVID-018 | Acceptance pack                                                  | planned  |
| PRD-011  | Sibling F23 (Proactive hints engine — feeds off similar metrics) | parallel |
| PRD-008  | Time-travel — same `journal` data source                         | parallel |

## Risks & Mitigations

| ID  | Risk                                                                                              | Prob   | Impact | Mitigation                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| R-1 | Chart interpretation copy is wrong / misleading                                                   | High   | High   | RFC-009 pins exact rules per chart; add unit tests asserting copy for known fixtures; prepare review checklist        |
| R-2 | Health score formula too simple (gameable) — e.g. one big high-R_eff artifact masks ten low-R_eff | Medium | Medium | Use median-based components, not mean. Document gaming-resistance in RFC-009                                          |
| R-3 | Charts cluttered on small viewports                                                               | Medium | Medium | Stack charts vertically below 800px viewport; respect `prefers-reduced-motion` for transitions                        |
| R-4 | Interpretation thresholds too strict / too lax for different project sizes                        | Medium | Low    | Make thresholds configurable via `forgeplan-web.json` if user wants override. Default tuned for 50-500 artifact range |
| R-5 | Chart rendering causes a 10s poll cascade refresh                                                 | Low    | Medium | Memoize via content-signature like F4 audit cleanup did for filters                                                   |





## As-Built Reconciliation (2026-06-30)

Implemented client-side only (PR → develop). Items below were SUPERSEDED — they violate
@forgeplan/web hard constraints and are NOT in the shipped code:

- **GET `/api/pulse` (NFR-003 / Affected Files): dropped** — not an allow-listed read-only
  forgeplan subcommand (rule 22). Stats are aggregated CLIENT-SIDE in `widgets/stats-pulse`
  from already-polled `/api/list`, `/api/score`, `/api/health`, `/api/log`, `/api/stale`.
- **server-written `.forgeplan-web/health-history.json`: dropped** — violates init
  host-isolation (rule 20). FR-011's 30-day trend is reconstructed client-side by replaying
  the `/api/log` event stream (approximate; "no data yet" under 7 days coverage).
- **FR-003 decay calendar: degraded** to a coarse at-risk/stale proxy from `/api/health` —
  `valid_until` is only on `/api/get/[id]`, not any allow-listed aggregate. True 12-month
  heat-map needs opt-in per-id fan-out (`TODO(fr-003-calendar)`).

Evidence: EVID-042. Original spec text retained above as design-time intent.


