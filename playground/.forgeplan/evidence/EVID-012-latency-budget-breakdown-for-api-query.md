---
depth: tactical
id: EVID-012
kind: evidence
links:
- target: SOL-004
  relation: informs
status: active
title: Latency budget breakdown for /api/query
---

# EVID-012: Latency budget breakdown for /api/query

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-19 |
| Valid Until | 2026-07-19 |
| Target | SOL-004 (Query result cache), PRD-002 |
| Author | query-engine-eng |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Method

Distributed tracing instrumentation on `/api/query` request path.
1,000 production traces sampled uniformly across a 24h window
(2026-04-15). Decomposed by phase using OTel `code.function` spans.

## Latency decomposition (p95, ms)

| Phase | v0.17.9 | v0.18.2 |
|-------|---------|---------|
| TLS termination | 8 | 8 |
| Auth + RBAC | 14 | 14 |
| Query parse + AST | 6 | 7 |
| Planner (ordering, pushdown) | 4 | 380 |
| Storage roundtrip | 178 | 192 |
| Result serialization | 22 | 24 |
| Other | 9 | 11 |
| **Total p95** | **241** | **636** |

Planner step alone accounts for **97% of the regression**. EVID-002
load test confirms this dominates wall-clock. Planner cache was
disabled in v0.18.0 to address a correctness bug; replan from scratch
is the new hot path.

## Result cache opportunity (SOL-004)

Top-200 query fingerprints account for 71% of QPS; among those, 89%
are deterministic over 60s windows. A content-hashed result cache
with 60s TTL could absorb ~60% of QPS from the planner+storage tier.

## Interpretation

SOL-004 has high upside (eliminates ~60% of expensive replans). Cache
key must include tenant + RBAC fingerprint to avoid cross-tenant
leakage. Negative cache for empty results is also valuable to absorb
404 storms.

## Congruence Level Justification

CL3: production traces, real tenant traffic, exact target endpoint.
Decomposition uses code-level instrumentation, not extrapolation.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| SOL-004 | informs (motivates design) |
| PROB-001 | informs (latency root cause) |
| EVID-002 | corroborates |


