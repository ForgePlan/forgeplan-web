---
depth: standard
id: ADR-005
kind: adr
links:
- target: PRD-007
  relation: informs
status: active
title: Pin Postgres 16 for control plane metadata
---

# ADR-005: Pin Postgres 16 for control plane metadata

## Context

Control plane (tenant catalog, RBAC, billing meters, alert rules)
is small (≤ 100 GB across 8 tenants), highly relational, and demands
strong consistency. Helios already runs Postgres for several services;
choice is about pinning a major version and treating the upgrade
cadence as a deliberate decision rather than drifting.

## Decision

**Selected: Postgres 16.x (any minor) for control-plane metadata across
all services. RDS-managed in production, plain Postgres in dev.**

**Why selected**: the cadence of upgrade churn (PG14 → 15 → 16 within
24 months across 7 services) was burning 1 SRE-day per service per
upgrade. A pinned major + planned cadence converts this to a single
quarterly project.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| Postgres latest (rolling) | Rejected | uncoordinated upgrades; ext breakage |
| Postgres 16 (pinned) | **Chosen** | LTS-ish horizon, jsonb/CTE good enough |
| MySQL 8 | Rejected | no operational expertise; lose CTE quality |
| CockroachDB | Rejected | over-engineered for our consistency needs |
| Aurora Postgres | Rejected | vendor lock-in cost vs operational savings |

## Consequences

### Positive

- One known-good extension matrix; ext upgrades scheduled together.
- Explicit upgrade cadence (PG17 evaluation: 2026-Q4, target migration
  2027-Q1).
- Minor version drift stays bounded — no dev/prod skew incidents
  since pin.

### Negative (trade-offs)

- We forgo PG17 features (logical-replication conflict detection,
  per-table query plans) until 2027-Q1.
- Some teams have wanted incremental sort optimisations only available
  in PG17; backlog item.

### Risks

- Major version EOL: PG16 final minor in late 2028; plenty of runway.
- Extension drift if a dev installs PG17 locally and uses ext only on
  PG17. Mitigated by docker-compose-based local dev pinning.

## Invariants

- All services target a single major (currently 16)
- Dev, staging, prod minor versions stay within 2 minor releases
- Extension list is governed by a single `pg-extensions.yaml` file

## Valid Until

`valid_until: 2027-01-31` (revisit at PG17 evaluation gate)

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-007 | PRD | informs (billing meter storage) |


