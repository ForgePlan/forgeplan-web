---
depth: tactical
id: EVID-002
kind: evidence
links:
- target: PROB-001
  relation: informs
status: active
title: 'Load test: 10k concurrent queries on staging'
---

# EVID-002: Load test — 10k concurrent queries on staging

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-18 |
| Valid Until | 2026-07-18 |
| Target | PROB-001 (Query p99 regressed 4x after v0.18 rollout) |
| Author | sre-platform |

## Structured Fields

evidence_type: test
verdict: weakens
congruence_level: 3

## Measurement

k6 cluster (8 nodes, eu-west-1) ramping 0 → 10,000 concurrent users over
5 min, sustained for 20 min. Targets staging `/api/query` with realistic
PromQL mix: 60% range_query (1h), 30% instant, 10% topk(10).

- Build under test: v0.18.2 (post-regression)
- Comparison build: v0.17.9
- Same dataset: 14d retention, 8.4 TB compressed

## Result

| Metric | v0.17.9 | v0.18.2 |
|--------|---------|---------|
| p50 (ms) | 41 | 78 |
| p95 (ms) | 220 | 980 |
| p99 (ms) | 410 | 1,850 |
| Error rate (%) | 0.02 | 1.3 |

p99 4.5× regression confirmed. Error budget (1% monthly) burns in 6h
under sustained 10k QPS. Errors concentrated in `topk` queries with
`group_left` joins.

## Interpretation

Regression is real, reproducible, and traffic-shape-dependent. Topk
joins triggered the slow path introduced when query planner caching
was disabled in v0.18. EVID-012 (latency budget breakdown) confirms
the planner step jumped from 4ms to 380ms in the new build.

## Congruence Level Justification

CL3: load test on production-equivalent staging cluster, same dataset
size, same traffic mix derived from prod sampling. No model
extrapolation; direct measurement.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-001 | informs (root cause) |
| EVID-012 | corroborates |


