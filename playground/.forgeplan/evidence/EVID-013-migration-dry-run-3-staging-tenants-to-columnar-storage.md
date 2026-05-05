---
depth: tactical
id: EVID-013
kind: evidence
links:
- target: ADR-001
  relation: informs
status: active
title: 'Migration dry-run: 3 staging tenants to columnar storage'
---

# EVID-013: Migration dry-run — 3 staging tenants to columnar storage

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-08 |
| Valid Until | 2026-10-08 |
| Target | ADR-001 (ClickHouse decision), RFC-004 (columnar layout) |
| Author | storage-platform |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Tenants migrated (staging)

| Tenant | Hot data (TB) | Span/sec peak | Schema variants |
|--------|---------------|---------------|-----------------|
| stg-acme | 1.2 | 18,000 | 14 |
| stg-globex | 4.1 | 62,000 | 31 |
| stg-initech | 0.8 | 9,400 | 8 |

## Procedure

1. Snapshot source TimescaleDB to S3 (parquet)
2. Bulk-load into ClickHouse staging cluster via `INSERT FROM s3()`
3. Run shadow queries (mirror prod for 48h)
4. Compare result hashes for 1,200 deterministic queries
5. Cutover traffic; revert plan tested

## Result

| Metric | Goal | Observed |
|--------|------|----------|
| Migration time / TB | ≤45 min | 32 min mean |
| Result hash match (deterministic queries) | 100% | 99.92% |
| Query p95 post-cutover | ≤500 ms | 310 ms |
| Storage delta (compression) | ≥2× better | 2.7× |
| Rollback drill | <10 min | 6 min 40s |

99.92% (not 100%) match traced to 0.08% queries with non-deterministic
ordering on tied sort keys. Fix: stable sort tie-breaker on span ID.

## Interpretation

Procedure validated end-to-end. Rollback drill within target.
Recommendation: schedule production migration in batches of 10 tenants,
2-week interval between waves. Stop migration if any wave shows >0.1%
hash mismatch.

## Congruence Level Justification

CL3: real anonymised production data shape, target cluster topology
matches prod, queries used in comparison are sampled from real prod
traffic.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-001 | informs (migration feasibility) |
| RFC-004 | informs (layout validated in practice) |


