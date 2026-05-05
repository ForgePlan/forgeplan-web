---
depth: standard
id: PRD-015
kind: prd
links:
- target: EPIC-005
  relation: refines
status: active
title: Tenant cost allocation reports
---

# PRD-015: Tenant cost allocation reports

## Vision

Tenants see exactly how their bill breaks down by service / namespace /
team / cost-tag. Reports are downloadable, schedulable, and integrate
with their existing FinOps tooling.

## Problem

Today's billing dashboard shows the bill as a single number per
tenant. Customers with internal cost-allocation needs (most enterprise)
cannot tell which team consumed what. They build private accounting
on top of usage exports — error-prone, frustrating.

## Target Users

| Persona | Pain |
|---------|------|
| Customer FinOps | Manual chargeback work |
| Tenant admin | "Which team is causing the spike?" |

## Success Criteria

| ID | Target |
|----|--------|
| SC-1: Coverage | breakdown by service, namespace, configurable tag |
| SC-2: Accuracy | within 0.5% of total invoice |
| SC-3: Refresh | daily at 02:00 UTC |
| SC-4: Customer adoption | 40% of paid tenants in 6 months |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | Tenant admin can configure cost-allocation tag (default: `service`) |
| FR-002 | Must | UI shows breakdown for current and prior billing period |
| FR-003 | Must | API can export breakdown as CSV / JSON |
| FR-004 | Should | Tenant can schedule report email weekly/monthly |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-005 | parent |
| SPEC-011 | API contract |
| ADR-005 | Postgres for billing |


