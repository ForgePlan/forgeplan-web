---
depth: standard
id: PRD-010
kind: prd
links:
- target: EPIC-005
  relation: refines
status: active
title: Cold tier archive to S3 Glacier
---

# PRD-010: Cold tier archive to S3 Glacier

## Vision

Spans older than tenant-configured threshold (default 30 days) move
automatically to S3 Glacier Instant Retrieval, reducing hot-tier
storage cost by 70%+. Tenants can still query archive data; UI
indicates retrieval latency.

## Problem

Storage cost is the dominant line item for large tenants. Most
queries hit data <30 days old; >90 days is investigation-only.
Hot-tier ClickHouse storage is 7× more expensive than S3 Glacier IR.

## Target Users

| Persona | Pain |
|---------|------|
| Customer Finance | Storage cost surprises |
| SRE | Wants long retention without paying full freight |

## Success Criteria

| ID | Target |
|----|--------|
| SC-1: Storage cost reduction | ≥ 70% |
| SC-2: Hot data query unaffected | p95 unchanged |
| SC-3: Cold data query latency | < 5s p95 |
| SC-4: Tenant adoption (12 months) | ≥ 60% of paid tenants |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | Tenant admin can set archive threshold (7d–365d) |
| FR-002 | Must | System can archive matching spans to S3 Glacier IR |
| FR-003 | Must | Query API can fetch archived data transparently |
| FR-004 | Should | UI shows "fetching archive" indicator > 1s |
| FR-005 | Should | Tenant can choose retrieval tier (Instant / Flexible / Deep) |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Archive operation runs as bounded background job; no impact on ingest p99 |
| NFR-002 | Cold data restoration time: < 4h to hot for full re-warm |
| NFR-003 | Per-tenant cost dashboard reflects archive savings within 24h |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-005 | parent |
| RFC-012 | compaction approach |
| SPEC-017 | lifecycle |
| EVID-016 | trial validation |


