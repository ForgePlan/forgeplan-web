---
depth: standard
id: EPIC-002
kind: epic
status: active
title: Multi-region deployment and data residency
---

# EPIC-002: Multi-region deployment and data residency

## Vision

Helios runs in 3 regions (us-east-1, eu-west-1, ap-southeast-1) with
data residency guaranteed per tenant: a tenant's spans never leave
their assigned region except for explicit cross-region replication
(opt-in DR).

## Strategic context

Enterprise prospects in EU and APAC require data residency for GDPR
and APPI compliance. Single-region (us-east-1) is a hard blocker for
~30% of enterprise pipeline.

## Children PRDs

| PRD | Title |
|-----|-------|
| PRD-005 | Per-tenant retention policies |
| PRD-006 | OAuth2 + SSO integration |

## Success Criteria

| ID | Criterion | Target |
|----|-----------|--------|
| EC-1 | Regions live | 3 regions (US, EU, APAC) by 2026-Q4 |
| EC-2 | Data residency | tenant data crosses regions only with explicit consent |
| EC-3 | Cross-AZ failover | reads ≤ 2min, writes ≤ 5min |
| EC-4 | Compliance | SOC2 Type II + GDPR DPA package |

## Known issues / blockers

- EVID-007 (chaos drill): write failover currently 12 min, breaches
  SLO. Must close before EU launch.
- PROB-004 (cross-region replication lag): 8–14 min during peak;
  affects DR posture.
- EVID-011 (SOC2 readiness): C1.1 + P3.1 critical gaps.

## Dependencies

- ADR-007 (Tenant Operator) — required for per-region tenant lifecycle
- RFC-008 (multi-tenant isolation) — required for shared-region tenants

## Timeline

| Milestone | Target |
|-----------|--------|
| eu-west-1 live | 2026-Q3 |
| ap-southeast-1 live | 2026-Q4 |
| Full residency story | 2026-Q4 |
| SOC2 Type II | 2027-Q1 |

## Related Artifacts

All children PRDs + relevant evidence + RFC-008 + ADR-007.


