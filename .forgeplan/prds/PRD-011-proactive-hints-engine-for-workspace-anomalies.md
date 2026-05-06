---
depth: standard
id: PRD-011
kind: prd
status: draft
title: Proactive hints engine for workspace anomalies
---

# PRD-011: Proactive hints engine for workspace anomalies

## Problem

Forgeplan is rich in signal — `R_eff`, `valid_until` decay, blind-spots,
orphans, stale, unactivated drafts, dependency cycles, velocity drops —
but the user has to **go look** for each. Charts (PRD-010) help, but
even charts are passive: user has to open the Stats tab.

What's missing: a small surface that **proactively says** "here are 3
things you might want to look at right now, ranked by how badly they
need attention", drawn from the workspace state itself.

This is different from notifications (PRD-007) — those fire on
**transitions** (new blind_spot, stale_count up). Hints are about the
**current state**: even if nothing changed since yesterday, the
workspace might have an unread important pattern.

**Impact**: a tech lead opening web each morning currently sees the
graph + a healthbar with raw counts. They have to mentally scan and
prioritize. Hints engine does that for them.

## Target Users

| Persona                    | Description               | Pain                                            |
| -------------------------- | ------------------------- | ----------------------------------------------- |
| Tech lead morning check-in | brief glance at workspace | too many places to look — needs auto-triage     |
| Active developer           | starting work session     | "what should I focus on today?" — no answer     |
| New contributor            | inheriting a workspace    | "where do I start?" — invisible without context |

## Goals

| ID    | Criterion                                                                                                 | Metric                          | Target                  | How to measure |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------- | -------------- |
| SC-1  | Hints panel renders top 3 hints above HealthBar (or as a collapsible banner)                              | DOM `[data-test="hints-panel"]` | element + ≤ 3 children  | Playwright     |
| SC-2  | Each hint has: severity icon, 1-sentence text, suggested action (link or CLI hint), dismiss ×             | DOM check per hint              | all 4 fields present    | Playwright     |
| SC-3  | At least 8 distinct hint rules implemented covering common forgeplan-anomalies                            | code review                     | ≥ 8 rules in the engine | review         |
| SC-4  | Hints ranked by severity × recency: critical and recent show first                                        | ordering test                   | rule applied            | unit test      |
| SC-5  | Dismissed hints persist in localStorage with TTL (24h) so they re-appear if the underlying issue persists | localStorage check              | TTL respected           | unit test      |
| SC-6  | "Snooze 1 day" / "Snooze 1 week" options on each hint                                                     | DOM check                       | options present         | Playwright     |
| SC-7  | Hint engine is pure — fed by metrics, returns ranked list                                                 | function signature              | input/output stable     | unit test      |
| SC-8  | New rule definitions are easy: edit `hint-rules.ts`, no other files                                       | code review                     | single-file ext point   | review         |
| SC-9  | All hint copy is plain language ("5 evidence packs expire in 7 days") — no jargon                         | copy review                     | no raw metric names     | review         |
| SC-10 | svelte-check 0/0; smoke matrix green                                                                      | CI                              | 0/0 + 3-OS pass         | CI             |

## Non-Goals

- Don't replace InsightsRail tabs — hints sit ABOVE the rail as a separate banner.
- Don't notify (browser notification) — those are F12; hints are passive in-page only.
- Don't auto-mutate the workspace ("auto-fix this" buttons) — every action is a CLI hint or a link.
- Don't make hints AI-generated — heuristic rules first; AI hint-generation is a separate future feature.

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                                                                                                                 | Acceptance           |
| ------ | ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- |
| FR-001 | Core          | Must     | Hints panel appears above HealthBar; collapsible (collapsed state persisted)                                                                                | DOM check            |
| FR-002 | Core          | Must     | Top 3 hints by severity × recency shown by default                                                                                                          | unit test on ranking |
| FR-003 | Core          | Must     | Each hint has: severity icon (⚠/💡/📈), 1-sentence text, action (link / CLI cmd), dismiss ×                                                                | DOM check            |
| FR-004 | Core          | Must     | At least 8 hint rules: stale-spike, low-r_eff-critical, valid-until-imminent, blind-spot-new, orphan-detected, draft-too-old, velocity-drop, cycle-detected | code review          |
| FR-005 | Core          | Must     | Rules live in single `hint-rules.ts` with consistent shape                                                                                                  | code review          |
| FR-006 | Core          | Must     | Pure function `computeHints(state) → Hint[]` ranked, dedupe-aware                                                                                           | unit test            |
| FR-007 | UX            | Should   | "Snooze 1d" / "Snooze 1w" / "Dismiss" options per hint                                                                                                      | DOM                  |
| FR-008 | UX            | Should   | Snoozed hints persist in localStorage, auto-resurface after TTL                                                                                             | localStorage check   |
| FR-009 | UX            | Should   | "Hide all hints" master toggle in HealthBar                                                                                                                 | toggle present       |
| FR-010 | UX            | Could    | Per-rule severity threshold configurable via `forgeplan-web.json`                                                                                           | config read          | config-driven |
| FR-011 | A11y          | Must     | aria-live "polite" mirror of new hints for screen readers                                                                                                   | DOM check            |
| FR-012 | Documentation | Should   | CHANGELOG + small docs page describing all rules                                                                                                            | grep + docs review   |

## Non-Functional Requirements

| ID      | Category           | Requirement                                             | Metric      | Method    |
| ------- | ------------------ | ------------------------------------------------------- | ----------- | --------- |
| NFR-001 | Performance        | `computeHints` runs ≤ 30ms on N=300                     | timing test | unit test |
| NFR-002 | Bundle             | Engine + UI ≤ 12 KB gzip                                | dist diff   | shell     |
| NFR-003 | Determinism        | Same workspace state → same hints in same order         | unit test   | vitest    |
| NFR-004 | A11y               | aria-live polite + dismiss button keyboard accessible   | manual      | manual    |
| NFR-005 | Localization-ready | All copy strings centralized in one map for future i18n | code review | review    |

## Affected Files

- `template/src/widgets/hints/lib/hint-rules.ts` (new — 8+ rule definitions)
- `template/src/widgets/hints/lib/hint-rules.test.ts` (new)
- `template/src/widgets/hints/lib/compute-hints.ts` (new — runner + ranker)
- `template/src/widgets/hints/lib/compute-hints.test.ts` (new)
- `template/src/widgets/hints/ui/HintsPanel.svelte` (new)
- `template/src/widgets/hints/ui/HintCard.svelte` (new — single hint render)
- `template/src/pages/home/ui/HomePage.svelte` (modified — embed HintsPanel above HealthBar)
- `template/src/pages/home/lib/settings.ts` (modified — add `hintsHidden`, `hintsSnoozed: Record<string, number>`)
- `CHANGELOG.md`

## Related Artifacts

| Artifact | Relation                                                              | Status           |
| -------- | --------------------------------------------------------------------- | ---------------- |
| RFC-010  | Architecture — rule DSL + ranking + snooze                            | planned          |
| EVID-019 | Acceptance pack                                                       | planned          |
| PRD-007  | Sibling — F12 push notifications (transition events vs current state) | already shipped  |
| PRD-010  | F22 stats dashboard — same metrics surface                            | parallel feature |

## Risks & Mitigations

| ID  | Risk                                                                                    | Prob   | Impact | Mitigation                                                                                  |
| --- | --------------------------------------------------------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------- |
| R-1 | Hint fatigue — too many hints, user starts dismissing en masse                          | High   | High   | Cap at 3 visible by default; "Hide all hints" toggle; tune thresholds with dogfood feedback |
| R-2 | Hint copy comes off as condescending / annoying                                         | Medium | Medium | Copy review checklist: factual, neutral tone, no exclamation marks, no "Hey!"               |
| R-3 | Hints tied to internal jargon (R_eff, blind_spot) confuse non-author users              | High   | Medium | NFR-005 + copy review: "5 weak-evidence decisions" not "5 R_eff < 0.3"                      |
| R-4 | Per-rule false positives (e.g. "draft-too-old" misfires for legit long-running designs) | Medium | Medium | Make threshold per-rule configurable (FR-010); document defaults                            |
| R-5 | Rules order/priority becomes a maintenance burden                                       | Low    | Low    | Single file `hint-rules.ts`; tests assert order stability for fixture inputs                |



