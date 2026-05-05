---
depth: standard
id: PRD-016
kind: prd
links:
- target: EPIC-006
  relation: refines
status: draft
title: Multi-account organization hierarchy
---

# PRD-016: Multi-account organization hierarchy

## Vision

A "company" can have an organization with N sub-accounts (one per
team or division). RBAC scoped to sub-account; data isolation by
default; rollup billing optional. Migration path from current
single-tenant model is smooth.

## Problem

EVID-019 (8 enterprise admin interviews) found 100% of large customers
want sub-accounts. The current "one tenant per company" model forces
data co-mingling that customers explicitly bought us to avoid.

## Target Users

| Persona | Pain |
|---------|------|
| Enterprise admin | Cannot give different teams different scopes |
| SRE in big org | Sees other teams' alert noise |

## Success Criteria

| ID | Target |
|----|--------|
| SC-1: Hierarchy depth | ≥ 3 levels (org → division → team) |
| SC-2: RBAC | claim-based mapping to sub-account |
| SC-3: Migration | existing tenants migrate to org/sub model without data loss |
| SC-4: Rollup billing | optional, per-org configurable |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | Org admin can create sub-accounts under their org |
| FR-002 | Must | RBAC scoped to sub-account; claim mapping configurable |
| FR-003 | Must | Data isolated by default; cross-account read is opt-in per sub-account |
| FR-004 | Must | Migration tool moves existing tenants into org with org-only sub-account |
| FR-005 | Should | Org-level billing rollup with per-sub-account drill-down |

## Risks

| Risk | Mitigation |
|------|------------|
| Migration data loss | Migration tool runs as 2-phase commit; reversible |
| Performance at scale | EVID-020 tested 1k orgs × 50 sub-accounts; plan revisions identified |
| Pricing model confusion | Marketing must explain rollup vs per-sub billing pre-launch |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-006 | parent |
| SPEC-014 | data model |
| SPEC-015 | rate limits per sub-account |
| EVID-019 | customer interviews |
| EVID-020 | scale test |

