---
depth: tactical
id: EVID-041
kind: evidence
links:
- target: PRD-009
  relation: informs
- target: RFC-008
  relation: informs
status: active
title: 'risk-overlay PRD-009 verified: svelte-check 0, 236 vitest, rule22/24 PASS'
---

---

assigned_number: 41
created: 2026-06-30
id: EVID-041
kind: evidence
predicted_number: 41
slug: evid-risk-overlay-prd-009-verified-svelte-check-0-236-vitest-rule22-24-pass
status: draft
title: 'risk-overlay PRD-009 verified: svelte-check 0, 236 vitest, rule22/24 PASS'
updated: 2026-06-30

---

# EVID-041: risk-overlay PRD-009 verified

| Field   | Value                                                        |
| ------- | ------------------------------------------------------------ |
| Status  | Draft                                                        |
| Created | 2026-06-30                                                   |
| Target  | PRD-009 / RFC-008 — Risk overlay for workspace decay surface |

<!-- REQUIRED for R_eff scoring. Legal values documented in templates/evidence/README.md. -->

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Measurement

Design→build→verify workflow on branch `feat/risk-overlay-prd009` (commit `cd13dd1`),
then re-run by the orchestrator on the same tree:

- `cd template && npm run check` (svelte-check / tsc)
- `cd template && npm test` (vitest)
- rule-22 check: `git status template/src/routes/api/` (must be empty)
- rule-24 check: the README verification grep for `:global()` reaching primitive internals
- independent verify agent re-read PRD-009 FRs + changed files and re-ran the suite

## Result

- svelte-check: **0 errors / 0 warnings / 0 files_with_problems** (1086 files)
- vitest: **236/236 passed** across 23 files (+11 new `risk-score.test.ts` cases)
- rule 22: **0 `/api` files changed** — risk computed client-side from already-fetched
  `/api/score` + `/api/graph`; no `/api/decay`, no allow-list widening
- rule 24: **PASS** — on/off control uses the shared `Toggle` primitive (grew a
  `dataAction` prop, no `:global()` override)
- FR coverage (PRD-009): FR-001..FR-005 (Must) **PASS**; FR-006/008/010 (Should) PASS;
  FR-009 (Could) PASS; **FR-007 (Should) PARTIAL** (see Interpretation)

## Interpretation

risk-overlay is implemented and verified against PRD-009 — all Must FRs met. The feature
is dormant-safe (toggle defaults off, persisted via settings.ts) and read-only (rule 22).

Documented deviations (justified, recorded for review on the PR):

- **FR-007 degraded** — per-EVID `congruence_level` / `evidence_type` are not exposed by any
  allow-listed JSON (they live only in EVID body markdown). The SC-6 DOM contract (`.weakest`
  on the lowest-R_eff informing EVID) is satisfied via `/api/score`; CL/type render as "—".
  Widening the allow-list was deliberately avoided. An opt-in lazy enrichment (parse EVID
  bodies via `get`) is a possible follow-up; the proper fix is upstream (expose CL/type in
  `get`/`score --json`).
- **Matrix/Sankey/Sunburst excluded** — they have no per-node concept; glow applies to the 4
  box-views only, so SC-9 ("no glow on Sankey/Sunburst") holds unconditionally.
- **drop-shadow not box-shadow** — box-shadow does not clip to shape inside SVG (RFC's own
  rejected option C); implemented the RFC CSS `filter: drop-shadow(...)`.
- **graph-level glow radius reflects R_eff only** (not decay) — `valid_until` is only on
  ArtifactDetail (`get`), not the bulk list; the full composite (R_eff × decay) is shown in
  the ArtifactPanel risk-anatomy section, which has `valid_until`.

## Congruence Level Justification

<!-- Legend: CL3 same-context (penalty 0.0); CL2 related (0.1); CL1 external (0.4); CL0 opposed (0.9). -->

CL3 — the tests/checks run against the actual surface being decided (the built risk-overlay
on its branch): svelte-check + 236 vitest cases (incl. the pure `risk-score` lib) + an
independent verifier, all green. Same context, measurement/test evidence.

## Related Artifacts

| Artifact | Relation |
| -------- | -------- |
| PRD-009  | informs  |
| RFC-008  | informs  |



