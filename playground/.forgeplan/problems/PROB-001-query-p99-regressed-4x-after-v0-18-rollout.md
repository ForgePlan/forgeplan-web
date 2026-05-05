---
depth: tactical
id: PROB-001
kind: problem
status: deprecated
title: Query p99 regressed 4x after v0.18 rollout
---

# PROB-001: Query p99 regressed 4x after v0.18 rollout

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-04-15 |
| Severity | High |
| Affected | All tenants on v0.18.0 — v0.18.2 |
| Owner | query-engine-eng |

## Symptom

Query API p99 latency rose from ~410 ms (v0.17.9) to ~1,850 ms
(v0.18.2) within 24h of rollout. Top complaint via support tickets:
"dashboards are timing out". Error rate climbed from 0.02% to 1.3%
on `/api/query`.

## Reproduction

- Deploy v0.18.2 to staging
- Run k6 load test (10k concurrent, mixed PromQL workload)
- Measure p50/p95/p99 over 20 min sustained

EVID-002 captures this reproduction with full breakdown.

## Investigation

Latency budget breakdown (EVID-012) traced ~97% of the regression to
the planner step:

- v0.17.9 planner p95: 4 ms
- v0.18.2 planner p95: 380 ms

Root cause: in v0.18.0, the team **disabled the query plan cache** to
fix a correctness bug (CACHE-714: cached plans returned stale results
after schema bumps). The fix was correct, but the workload then hit
the cold-plan path 100% of the time.

## Impact

- Customer-visible: 18 enterprise tenants reported timeouts in
  ticketed support during the 17-day window
- SLO: monthly error budget for query API consumed in 6h on day 1
- Trust: 1 prospect deal slipped from Q2 to Q3 ("we'll wait for the
  fix")

## Affected Files

- `crates/query/src/planner/cache.rs` (cache disabled here)
- `crates/query/src/planner/mod.rs`

## Mitigations applied

- Hotfix v0.18.3 (deployed 2026-04-19): re-enabled cache with a
  schema-version-aware key (no longer staleness-prone)
- p99 returned to ~440 ms within 30 min of rollout

## Long-term fix

RFC-006 formalises a two-level cache (L1 in-process AST cache, L2
Redis-backed plan cache) with explicit invalidation on schema bump.
SOL-004 adds a result cache layer above the planner.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-002 | informs (load test) |
| EVID-004 | informs (incident postmortem) |
| EVID-012 | informs (latency breakdown) |
| SOL-001 | refines (rollups mitigation) |
| SOL-004 | refines (result cache) |



