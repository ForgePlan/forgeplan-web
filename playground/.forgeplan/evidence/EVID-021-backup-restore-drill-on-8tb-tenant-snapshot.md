---
depth: tactical
id: EVID-021
kind: evidence
links:
- target: PROB-010
  relation: informs
status: active
title: Backup restore drill on 8TB tenant snapshot
---

# EVID-021: Backup restore drill on 8TB tenant snapshot

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-18 |
| Valid Until | 2026-10-18 |
| Target | PROB-010 (Backup restoration takes 14h) |
| Author | sre-platform |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Drill

Restored production snapshot of largest tenant (`acme-corp`, 8.4 TB)
to a parallel cluster. Goal: validate disaster recovery RTO claim
of 4h for largest tenant.

| Phase | Target | Observed |
|-------|--------|----------|
| Snapshot retrieval from S3 | < 30 min | 22 min |
| Schema reconstruction | < 5 min | 3 min |
| Bulk data load (parallel) | < 3h | 11h 40min |
| Index build / projection rebuild | < 30 min | 1h 20min |
| Validation queries | < 30 min | 18 min |
| **Total** | **4h** | **13h 23min** |

## Root cause

Bulk load is single-threaded into the destination cluster's leader.
Despite reading parallel snapshot chunks, the write path serialises
through one node's WAL. Confirmed via flame graph; 80% of restore
time is the write-side bottleneck.

## Interpretation

DR claim of 4h RTO does not hold for largest tenants. Must either:
- Parallelise bulk load (write to multiple shards concurrently —
  possible but breaks ACID guarantees during restore)
- Reduce reliance on full restores (introduce incremental recovery
  via continuous replication)
- Lower the largest-tenant threshold for the 4h tier

Recommendation: re-rate RTO tier as 4h (≤2 TB), 12h (>2 TB), and
work on incremental recovery RFC for 2026-Q4.

## Congruence Level Justification

CL3: real production snapshot, real target cluster sizing, end-to-end
measured (no simulation).

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-010 | informs (root cause) |


