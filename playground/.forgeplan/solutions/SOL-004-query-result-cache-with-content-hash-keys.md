---
depth: tactical
id: SOL-004
kind: solution
links:
- target: PROB-001
  relation: refines
status: active
title: Query result cache with content-hash keys
---

# SOL-004: Query result cache with content-hash keys

## Problem addressed

PROB-001 (query p99 regression). EVID-012 showed that 71% of QPS
hits the same 200 query fingerprints, of which 89% are deterministic
within 60-second windows.

## Approach

Add a result cache layer between the query planner and the storage
tier. Cache key includes:

```
hash(canonical_AST + tenant_id + rbac_fingerprint + schema_version + time_window_bucket(60s))
```

`time_window_bucket(60s)`: `floor(now / 60s) * 60s`. Two queries
issued within the same 60s bucket with otherwise identical hash
share a cached result.

## Storage

- Backend: Redis cluster (per region)
- Eviction: LRU + TTL (60s by default)
- Capacity: 10 GB per region (≈ 5M cached results at typical size)

## Negative cache

Empty results are also cached (60s TTL). This absorbs "404 storms"
observed when a popular dashboard queries a service that hasn't
emitted spans in the past hour.

## Cross-tenant isolation

The `rbac_fingerprint` component of the key includes:
- `tenant_id`
- A hash of the user's effective row-level filters
- Token expiry boundary (so post-revocation queries miss cache)

Distinct tenants and distinct RBAC profiles never share a cached
result. Verified via property test.

## Tradeoffs

### Positive
- Absorbs ~60% of QPS from the planner+storage tier (EVID-012 model)
- Lowers query p95 by an additional ~40% on top of SOL-001
- 60s freshness boundary acceptable for dashboards (vs sub-second
  for live alerting, which bypasses this cache)

### Negative
- 60s freshness window — explicit constraint; live monitoring uses
  no-cache header
- Cache key complexity → bugs are hard to diagnose; comprehensive
  property tests required

## Rollout

- Phase 1: shadow-mode (compute key + check cache, but always serve
  fresh result; measure hit rate)
- Phase 2: enable for read-only dashboard queries
- Phase 3: GA for all queries except those with `Cache-Control: no-cache`

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-001 | refines |
| PRD-002 | refines |
| EVID-012 | informs |


