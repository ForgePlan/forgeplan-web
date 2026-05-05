---
depth: standard
id: PRD-012
kind: prd
links:
- target: EPIC-006
  relation: refines
status: active
title: Customer-facing audit log API
---

# PRD-012: Customer-facing audit log API

## Vision

Tenants programmatically retrieve a full audit log of admin actions:
who did what, when, from which IP, with what session token. Compliant
with SOC2 CC7.2 and customer expectations for enterprise tier.

## Problem

EVID-011 (SOC2 readiness audit) flagged CC7.2 (change management)
as a critical gap. Customers also routinely ask "who deleted that
dashboard?" via support tickets — there's no self-serve answer.

## Target Users

| Persona | Pain |
|---------|------|
| Customer compliance | Need exportable audit trail for their auditors |
| Customer admin | "Who changed this?" investigations |

## Success Criteria

| ID | Target |
|----|--------|
| SC-1: Coverage | 100% of admin actions logged |
| SC-2: Query latency | < 2s p95 for last 30d |
| SC-3: Retention | 7 years (compliance) |
| SC-4: Tamper-evident | append-only with cryptographic chain |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | API consumer can list audit entries by time, actor, action |
| FR-002 | Must | API consumer can stream audit entries via webhook subscription |
| FR-003 | Must | Audit entries include actor / action / resource / IP / timestamp |
| FR-004 | Should | UI shows audit log with filtering |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Append-only: no updates, no deletes (compliance) |
| NFR-002 | Tamper-evident: each entry hashes the previous one |
| NFR-003 | Retention: 7 years cold storage |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-006 | parent |
| RFC-014 | retention storage |
| SPEC-012 | entry schema |
| EVID-011 | compliance gap |


