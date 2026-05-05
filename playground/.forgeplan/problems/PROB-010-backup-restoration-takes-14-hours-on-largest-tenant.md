---
depth: tactical
id: PROB-010
kind: problem
status: draft
title: Backup restoration takes 14 hours on largest tenant
---

# PROB-010: Backup restoration takes 14h on largest tenant

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-04-18 |
| Severity | High (DR posture) |
| Owner | sre-platform |

## Symptom

DR drill (EVID-021) showed full restore of largest tenant (8.4 TB)
takes 13h 23min — far exceeding the 4h RTO claim documented to
enterprise customers. Two prospects flagged this as a concern after
asking for our DR runbook.

## Root cause

Bulk-load into ClickHouse serialises through the leader's WAL.
Despite reading parallel chunks from S3, the write path is
single-threaded. Confirmed via flame graph in EVID-021.

## Impact

- DR commitment broken for tenants > ~2 TB
- Business: blocks deals with prospects requiring "documented 4h RTO"
- Compliance: SOC2 BCP/DR criteria affected (EVID-011 references this)

## Mitigations under consideration

1. Re-tier RTO claim by tenant size (4h ≤ 2 TB; 12h > 2 TB)
2. Parallelise restore via temporary write-side sharding (breaks
   ACID; only viable if accepted as one-shot)
3. Continuous incremental backup (separate from snapshot) to avoid
   need for full-restore
4. Standby cluster always pre-warmed; "restore" becomes a DNS flip

## Decision pending

Tracked separately; needs PRD before commitment to enterprise
customers.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-021 | informs |
| EVID-011 | informs (compliance) |

