---
depth: standard
id: RFC-006
kind: rfc
links:
- target: PRD-002
  relation: refines
status: active
title: Query planner caching strategy
---

# RFC-006: Query planner caching strategy

## Summary

The query planner caches plans at two levels: (a) AST → logical plan
(content-hashed, in-process LRU, 10k entries), (b) logical plan →
physical plan (per-cluster Redis, content+schema-hashed, 60s TTL).

## Motivation

EVID-012 showed planner cost jumped from 4ms to 380ms in v0.18 after
plan cache was disabled (correctness fix). Top-200 query fingerprints
account for 71% of QPS — caching the plan is high leverage.

## Goals

- Eliminate 60% of planner work on hot queries
- Cache key includes schema + tenant + RBAC fingerprint to prevent
  cross-tenant leakage or stale-schema hits
- Invalidation on tenant schema change ≤ 30s

## Cache levels

### L1: AST → logical plan (in-process)

- Key: SHA256(canonical_AST_serialization)
- Value: logical plan struct
- Capacity: 10,000 per worker
- Eviction: LRU
- Cost: ~150 KB / 1k entries
- Hit ratio target: 70% on hot path

### L2: logical plan → physical plan (Redis)

- Key: SHA256(logical_plan + tenant_id + rbac_fp + schema_version)
- Value: physical plan + cardinality estimates
- TTL: 60s
- Capacity: 1M entries cluster-wide
- Cross-region: not replicated; each region has its own L2

## Risks

- R-1: Stale schema → wrong plan. Mitigation: schema_version in key;
  schema bump increments version atomically.
- R-2: Memory regression. Mitigation: per-pod budget, spill to L2 on
  pressure.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-002 | refines |
| EVID-012 | informs |
| SOL-004 | complements (result cache, separate concern) |


