---
depth: standard
id: RFC-008
kind: rfc
links:
- target: PRD-005
  relation: refines
status: active
title: Multi-tenant blast radius isolation
---

# RFC-008: Multi-tenant blast radius isolation

## Summary

Tenants are isolated such that one tenant's traffic spike, schema
explosion, or storage outage cannot affect another tenant's SLOs.
Isolation is enforced at: ingest (per-tenant rate limits), storage
(per-tenant table partitions, separate compaction queues), query
(per-tenant resource pool with admission control).

## Motivation

EVID-007 chaos drill exposed write-path failover taking 12 min
(SLO: 5 min). Investigation traced root cause to a single shared
ingest coordinator across all tenants. One bad tenant can choke the
whole region.

## Goals

- One tenant's burst (≤ 10× sustained) cannot increase another's
  ingest p99 by more than 10%
- A tenant's storage failure (e.g., bad schema) is isolated to that
  tenant's table partition
- Query resource exhaustion at one tenant does not affect another's
  query latency

## Mechanisms

### Ingest

- Token bucket per tenant; bucket size = 2× sustained
- Burst overflow → 429 with Retry-After
- Per-tenant ingest queue with dedicated worker pool (bounded)

### Storage

- Per-tenant table or partition (depending on tenant tier)
- Compaction queues partitioned per tenant; budget per shard
- Cardinality limit per tenant (configurable, default 10k unique
  attribute combinations per signal)

### Query

- Resource pool per tenant tier (CPU, memory, query slots)
- Admission control: queue if pool full, reject after timeout
- Slow query → terminate at tenant timeout, not global

## Risks

- R-1: Per-tenant overhead at small scale. Mitigation: shared
  partitions for free-tier tenants under 10 GB.
- R-2: Operator complexity. Mitigation: ADR-007 operator owns
  per-tenant resource provisioning.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-005 | refines |
| ADR-007 | informs |
| EVID-007 | informs |


