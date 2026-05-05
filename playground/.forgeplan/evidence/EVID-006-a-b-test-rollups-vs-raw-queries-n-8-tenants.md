---
depth: tactical
id: EVID-006
kind: evidence
links:
- target: SOL-001
  relation: informs
status: active
title: 'A/B test: rollups vs raw queries (n=8 tenants)'
---

# EVID-006: A/B test — rollups vs raw queries (n=8 tenants)

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-22 |
| Valid Until | 2026-10-22 |
| Target | SOL-001 (Pre-aggregated rollups) |
| Author | query-engine-eng |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Setup

8 staging tenants split 4:4 into control (raw queries) and treatment
(rollup-served when applicable). 14-day window, 2026-04-08 → 2026-04-21.
Tenants matched on traffic shape (RPS p50 within 10%) and dataset
size (within 25%).

## Hypothesis

Pre-aggregated 1-min rollups for top-7 most-frequent query patterns
will reduce query p95 by ≥40% with <5% accuracy delta on returned
values.

## Result

| Metric | Control | Treatment | Δ |
|--------|---------|-----------|---|
| Query p50 (ms) | 78 | 21 | −73% |
| Query p95 (ms) | 980 | 310 | −68% |
| Query p99 (ms) | 1,850 | 720 | −61% |
| CPU on storage tier (%) | 71 | 38 | −46% |
| Accuracy delta (%) | n/a | 0.4 | within tolerance |

p95 improvement (−68%) exceeded target (−40%). Accuracy delta
(0.4%) well within ±5% tolerance — discrepancy is due to rollup
timestamps snapping to minute boundaries.

## Interpretation

SOL-001 validated for top-7 patterns. Recommend GA with the
restriction that ad-hoc queries outside the pattern set still hit
raw storage; rollup eligibility decided by query planner based on
pattern fingerprint.

## Congruence Level Justification

CL3: real tenants, real workload, real storage tier. Test ran on
prod-equivalent dataset; treatment tenants opted in with consent.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| SOL-001 | informs (validated approach) |
| PROB-001 | informs (mitigation path) |


