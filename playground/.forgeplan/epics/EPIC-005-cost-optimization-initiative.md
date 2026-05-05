---
depth: standard
id: EPIC-005
kind: epic
status: active
title: Cost optimization initiative
---

# EPIC-005: Cost optimization initiative

## Vision

Reduce per-tenant cost-of-goods-sold (COGS) by 35% in 12 months,
preserving customer-facing SLOs, by combining cold-tier archival,
continuous profiling, and per-tenant cost reporting that incentivises
customers to also self-tune.

## Strategic context

COGS is the dominant input to gross margin. Cloud hyperscalers compress
margins; we must compress costs faster than price drops. Customer
demand for transparent billing further pushes cost reporting into
EPIC-005 scope.

## Children PRDs

| PRD | Title |
|-----|-------|
| PRD-010 | Cold tier archive to S3 Glacier |
| PRD-015 | Tenant cost allocation reports |

## Driver decisions

- ADR-008 (Pyroscope) directly attributable to this Epic — measured
  TLS overhead led to TLS-reuse work that cut collector CPU 18%.

## Success Criteria

| ID | Target |
|----|--------|
| EC-1: COGS reduction | ≥ 35% within 12 months |
| EC-2: Customer adoption of cold-tier | ≥ 60% of paid tenants |
| EC-3: Customer NPS unchanged or positive | NPS Δ ≥ 0 |

## Risks

- Aggressive cost reduction without telemetry → silent SLO degradation.
  Mitigation: every cost-cut decision must reference the SLO it touches
  and have a rollback plan.

## Timeline

| Milestone | Target |
|-----------|--------|
| Cold tier ship | 2026-Q4 |
| Cost reports ship | 2026-Q4 |
| 35% COGS reduction | 2027-Q3 |

## Related Artifacts

All children PRDs + ADR-008 + EVID-016 + EVID-025.


