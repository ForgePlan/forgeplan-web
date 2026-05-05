---
depth: standard
id: PRD-013
kind: prd
links:
- target: EPIC-006
  relation: refines
status: active
title: Per-tenant data export for DSAR compliance
---

# PRD-013: Per-tenant data export for DSAR compliance

## Vision

Tenants export ALL data Helios holds about a specific user identity
(via attribute filter or explicit user_id) in a machine-readable
format suitable for handoff to data subjects. Time-bounded, signed,
fulfils GDPR Article 15 + CCPA right-to-know.

## Problem

EVID-011 (SOC2 readiness) flagged P3.1 (DSAR workflow) as critical.
Currently, fulfilling a Data Subject Access Request requires
engineering involvement (~4h SRE + legal review). Manual process
cannot scale; legal sees this as a top compliance risk.

## Target Users

| Persona | Pain |
|---------|------|
| Customer privacy lead | Manually fulfilling DSARs |
| Legal | Lack of standard DSAR workflow |

## Success Criteria

| ID | Target |
|----|--------|
| SC-1: Self-serve | tenant fulfils DSAR without Helios eng involvement |
| SC-2: Latency | export ready within 48h of request (legal SLA = 30 days) |
| SC-3: Coverage | 100% of stored personal-data fields included |
| SC-4: Format | JSON Lines, signed manifest, downloadable URL with 7-day TTL |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | Tenant admin can submit DSAR by user_id or attribute match |
| FR-002 | Must | System packages all personal data, signs manifest, returns URL |
| FR-003 | Must | DSAR action is itself audit-logged (PRD-012) |
| FR-004 | Should | Tenant can preview row count before triggering full export |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-006 | parent |
| RFC-017 | backfill pipeline (DSAR uses) |
| EVID-011 | compliance gap |


