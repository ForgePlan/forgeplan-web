---
depth: standard
id: RFC-001
kind: rfc
links:
- target: PRD-001
  relation: refines
status: active
title: Switch ingest pipeline from Kafka to Redpanda
---

# RFC-001: Switch ingest pipeline from Kafka to Redpanda

## Summary

Replace Apache Kafka (Strimzi-managed on K8s) with Redpanda as the
durable buffer between collectors and storage tier. Migration path
is per-tenant, behind a feature flag, with 90-day pilot before
full cutover.

## Motivation

- TCO: 43% lower 12-month cost on representative workload (EVID-008)
- Operational simplicity: no Zookeeper, single binary, fewer moving
  parts. SRE on-call cited Kafka as top noise source in Q4.
- Latency: Redpanda's thread-per-core architecture gives lower end-to-end
  ingest latency at our message size distribution (mean 1.4 KB).

## Goals

- Migration is reversible at any tenant boundary
- No customer-visible regression in ingest latency or durability
- Decommission Kafka cluster within 6 months of pilot start

## Non-goals

- Replacing Kafka in non-ingest use cases (audit log streaming
  remains on Kafka — separate decision)
- Adopting Redpanda's tiered storage immediately (pilot with hot
  tier only; tiered storage is a follow-up)

## Options

| Option | Pros | Cons |
|--------|------|------|
| Status quo (Kafka) | Known, mature, team experience | Cost, ops toil |
| Redpanda (chosen) | Cost, perf, simplicity | Smaller community |
| NATS JetStream | Lightweight | Different consistency model; rewrites needed |
| Apache Pulsar | Strong tiered storage | Operational complexity even higher than Kafka |

## Implementation Phases

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| 0 | Cost model + sizing | EVID-008 published |
| 1 | Bench cluster + traffic mirror | 7 days of mirrored traffic w/o consumer divergence |
| 2 | Pilot tenant (stg-acme) | 14 days; SLOs intact |
| 3 | Tier 2 tenants (5 tenants) | 30 days; ingest p99 within ±5% of Kafka |
| 4 | Full cutover | 100% tenants; Kafka cluster scaled down |
| 5 | Decommission Kafka | Cluster destroyed; team retraining done |

## Risks

- R-1: Producer client compat. Mitigation: Redpanda is wire-compatible
  with Kafka protocol; we test against existing producers in CI.
- R-2: Consumer group rebalances behave differently under partition
  scaling. Mitigation: extend chaos drill catalogue.
- R-3: Smaller community → fewer Q&A resources. Mitigation: paid
  Redpanda support contract during phases 2–4.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-001 | refines |
| EVID-008 | informs (cost) |


