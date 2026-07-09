---
depth: tactical
id: EVID-043
kind: evidence
links:
- target: PRD-011
  relation: informs
- target: RFC-010
  relation: informs
status: active
title: 'hints-engine PRD-011 verified: svelte-check 0, 330 vitest, rule22/24 PASS; hints client-side from allow-listed data'
---

---

assigned_number: 43
created: 2026-06-30
id: EVID-043
kind: evidence
predicted_number: 43
slug: evid-hints-engine-prd-011-verified-svelte-check-0-330-vitest-rule22-24-pass
status: draft
title: 'hints-engine PRD-011 verified: svelte-check 0, 330 vitest, rule22/24 PASS; hints client-side from allow-listed data'
updated: 2026-06-30

---

# EVID-043: hints-engine PRD-011 verified

| Field   | Value                                                              |
| ------- | ------------------------------------------------------------------ |
| Status  | Draft                                                              |
| Created | 2026-06-30                                                         |
| Target  | PRD-011 / RFC-010 — Proactive hints engine for workspace anomalies |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Measurement

design→build via workflow on branch `feat/hints-engine-prd011` (commit `b471f26`). The workflow's
structured-output verify step failed on a schema retry-cap (infrastructure, not a code defect), so the
orchestrator performed the verification directly on the working tree:

- `cd template && npm run check` (svelte-check / tsc)
- `cd template && npm test` (vitest)
- rule-22: `git status template/src/routes/api/` (empty) + confirm no `/api/anomalies` route
- rule-24: the README authoritative `:global()` snippet over `src/widgets/hints`
- spot-check: PRD-011 FRs + `hint-rules.ts` is a real rule engine (not a stub)

## Result

- svelte-check: **0 errors / 0 warnings** (1116 files)
- vitest: **330/330** across 30 files (+31 cases: `hint-rules.test.ts`, `compute-hints.test.ts`)
- rule 22: **PASS** — 0 `/api` files changed; no `/api/anomalies` route; hints computed CLIENT-SIDE from
  allow-listed `/api/health`, `/api/stale`, `/api/blindspots`, `/api/blocked`, `/api/score`, `/api/list`.
  No allow-list widening.
- rule 24: **PASS** — hints render via existing shared/ui primitives; no `:global()` into primitive internals.
- `hint-rules.ts`: real DSL — `HintRule` type + exported tunable thresholds (STALE_SPIKE_DELTA,
  LOW_R_EFF_THRESHOLD, BLIND_SPOT_MIN, ORPHAN_MIN, VELOCITY_DROP_FACTOR; FR-005) + multiple rules
  (stale-spike, low-r-eff-critical, valid-until-imminent, blind-spot-new, …) + ranking in `compute-hints.ts`.

## Interpretation

hints-engine is implemented and verified against PRD-011 — pure rule-DSL + ranking dispatcher, fixture-tested.
Unlike stats-pulse, PRD-011/RFC-010 did NOT mandate a forbidden surface (no `/api/anomalies`), so no spec
reconciliation was needed; the design naturally computed hints from allow-listed read-only data. The only
deviation from a clean workflow run was the verify agent's structured-output failure, which the orchestrator
substituted for by verifying directly (this evidence records that substitute verification).

## Congruence Level Justification

<!-- Legend: CL3 same-context (penalty 0.0); CL2 related (0.1); CL1 external (0.4); CL0 opposed (0.9). -->

CL3 — tests/checks run against the actual surface being decided (the built hints-engine on its branch):
svelte-check + 330 vitest cases (incl. the pure hint-rules + compute-hints libs), all green. Same context,
test evidence.

## Related Artifacts

| Artifact | Relation |
| -------- | -------- |
| PRD-011  | informs  |
| RFC-010  | informs  |



