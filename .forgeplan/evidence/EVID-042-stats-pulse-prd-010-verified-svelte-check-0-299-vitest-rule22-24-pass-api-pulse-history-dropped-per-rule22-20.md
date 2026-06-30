---
depth: tactical
id: EVID-042
kind: evidence
links:
- target: PRD-010
  relation: informs
- target: RFC-009
  relation: informs
status: active
title: 'stats-pulse PRD-010 verified: svelte-check 0, 299 vitest, rule22/24 PASS; /api/pulse+history dropped per rule22/20'
---

---

assigned_number: 42
created: 2026-06-30
id: EVID-042
kind: evidence
predicted_number: 42
slug: evid-stats-pulse-prd-010-verified-svelte-check-0-299-vitest-rule22-24-pass-api
status: draft
title: 'stats-pulse PRD-010 verified: svelte-check 0, 299 vitest, rule22/24 PASS; /api/pulse+history dropped per rule22/20'
updated: 2026-06-30

---

# EVID-042: stats-pulse PRD-010 verified + spec reconciled

| Field   | Value                                                               |
| ------- | ------------------------------------------------------------------- |
| Status  | Draft                                                               |
| Created | 2026-06-30                                                          |
| Target  | PRD-010 / RFC-009 — Workspace pulse: stats dashboard + health score |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Measurement

design→build→verify workflow on branch `feat/stats-pulse-prd010` (commit `07e851d`), each check
re-run twice by the build agent and once independently by the verifier, then by the orchestrator:

- `cd template && npm run check` (svelte-check / tsc)
- `cd template && npm test` (vitest)
- rule-22: grep `template/src/routes/api/` for any new route; confirm no `/api/pulse`
- rule-24: the README authoritative `:global()` verification snippet over src/{entities,widgets,pages,routes}
- forgeplan validate PRD-010 / RFC-009 after reconciliation

## Result

- svelte-check: **0 errors / 0 warnings** (1103 files)
- vitest: **299/299** across 28 files (+63 stats-pulse cases: pulse-stats, interpret, health-score, trend, memo)
- rule 22: **PASS** — no `/api/pulse` route; all stats from allow-listed `/api/list`, `/api/score`,
  `/api/health`, `/api/log`, `/api/stale`; one wider-limit log poller (`/api/log?limit=5000`, passes the
  endpoint's `^\d{1,4}$` guard). No allow-list widening.
- rule 24: **PASS** — charts are widget-local SVG on CSS tokens; 6th "Stats" tab reuses Tabs/TabsList;
  no `:global()` into primitives; no hardcoded hex.
- forgeplan validate: PRD-010 PASS (0 err), RFC-009 PASS (0 err) after reconciliation.
- FR coverage: FR-001/002/004/005/006/007/008/009/010/012 (Must/Should) PASS; FR-003 degraded; FR-011 substituted.

## Interpretation

stats-pulse is implemented + verified against PRD-010 — all Must FRs met. Crucially, the spec itself was
reconciled to match reality: PRD-010/RFC-009 originally mandated two surfaces that violate hard constraints,
both correctly OMITTED from the code and now marked superseded in the artifact bodies:

- **`GET /api/pulse` dropped** (rule 22 — not an allow-listed read-only subcommand). Stats computed client-side.
- **server-written `.forgeplan-web/health-history.json` dropped** (rule 20 — init host-isolation). FR-011
  trend reconstructed client-side from `/api/log` replay.
- **FR-003 decay calendar degraded** to a coarse `/api/health` at-risk/stale proxy (`valid_until` is only on
  `/api/get/[id]`, not any allow-listed aggregate). True heat-map = opt-in per-id fan-out (`TODO(fr-003-calendar)`).

These were design-time choices in the spec that the constraint review corrected; re-introducing them would
break rule 22 / rule 20. PRD-010 + RFC-009 each carry an "As-Built Reconciliation" section recording this.

## Congruence Level Justification

<!-- Legend: CL3 same-context (penalty 0.0); CL2 related (0.1); CL1 external (0.4); CL0 opposed (0.9). -->

CL3 — tests/checks run against the actual surface being decided (the built stats-pulse on its branch):
svelte-check + 299 vitest cases (incl. all pure pulse/health-score/interpret/trend libs) + an independent
verifier, all green; plus forgeplan validate on the reconciled artifacts. Same context, test evidence.

## Related Artifacts

| Artifact | Relation |
| -------- | -------- |
| PRD-010  | informs  |
| RFC-009  | informs  |



