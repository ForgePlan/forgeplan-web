---
depth: tactical
id: EVID-016
kind: evidence
links:
- target: PRD-010
  relation: informs
status: active
title: Cold tier cost reduction trial across 3 tenants
---

# EVID-016: Cold tier cost reduction trial across 3 tenants

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-25 |
| Valid Until | 2026-10-25 |
| Target | PRD-010 (Cold tier archive) |
| Author | storage-platform |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Setup

Migrated spans older than 30 days for 3 staging tenants from hot
ClickHouse (gp3) to S3 Glacier Instant Retrieval, retaining query
ability with 1–4s additional latency.

| Tenant | Hot data (TB) | Cold-eligible (TB) |
|--------|---------------|---------------------|
| stg-acme | 1.2 | 0.7 |
| stg-globex | 4.1 | 2.8 |
| stg-initech | 0.8 | 0.5 |

## Result

| Metric | Before | After | Δ |
|--------|--------|-------|---|
| Storage cost / month (USD) | 1,810 | 380 | −79% |
| Query p95 (recent data) | 310 ms | 310 ms | unchanged |
| Query p95 (cold data > 30d) | 340 ms | 2,800 ms | +725% |
| Tenant-visible: opt-in cold tier | n/a | available | — |

Cold-tier query latency is significantly higher (expected). Tenants
opt in via UI; queries against cold data display a "fetching archive"
indicator after 1s.

## Interpretation

PRD-010 economics validated. Recommend default-on for spans > 90d
(tenant-overridable). The 2.8s tail is acceptable for archive-style
investigation queries; live dashboards should never fetch cold data.

## Congruence Level Justification

CL3: real workload, real S3 Glacier IR, identical query mix.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-010 | informs |
| SPEC-017 | informs (lifecycle) |


