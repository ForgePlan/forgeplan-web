---
depth: tactical
id: EVID-008
kind: evidence
links:
- target: RFC-001
  relation: informs
status: active
title: 'Cost model: Kafka vs Redpanda at 100MB/s sustained'
---

# EVID-008: Cost model — Kafka vs Redpanda at 100MB/s sustained

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-03-28 |
| Valid Until | 2026-09-28 |
| Target | RFC-001 (Switch ingest pipeline from Kafka to Redpanda) |
| Author | platform-eng |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 2

## Workload assumed

Continuous 100 MB/s sustained ingress (≈ peak 2026-Q1 traffic), 7-day
retention, 3× replication. Two-AZ deployment in eu-west-1.

## Method

Built TCO models for both stacks using:
- Cluster sizing from each vendor's official sizing tools
- Compute pricing: AWS on-demand (no Savings Plan), eu-west-1
- Storage pricing: gp3 baseline + provisioned IOPS for Kafka,
  Redpanda's "tiered storage" with S3 Standard for cold tier
- Operational cost: assumed 0.25 FTE Kafka SRE vs 0.1 FTE Redpanda
  (vendor claim; we discounted 50% for first 12 months)

## Result

Annualised cost (USD), 12-month horizon:

| Component | Kafka (Strimzi) | Redpanda |
|-----------|-----------------|----------|
| Compute | 184,000 | 102,000 |
| Storage | 71,000 | 48,000 |
| Network (cross-AZ) | 39,000 | 21,000 |
| Operational FTE | 62,500 | 31,250 |
| **Total** | **356,500** | **202,250** |

Redpanda comes in 43% cheaper TCO. Storage savings driven by
write-amplification difference (Kafka segment files vs Redpanda's
single-write log). Operational savings discounted heavily; even at
parity, Redpanda wins on infra by ~30%.

## Interpretation

Cost model supports RFC-001 economically. Decision should also weight
operational risk (smaller Redpanda community, fewer engineers with
production experience). Recommendation: pilot on non-critical tenant
class for 90 days before full migration.

## Congruence Level Justification

CL2: cost model uses vendor sizing tools, not measured traffic on
actual Redpanda cluster. Operational FTE estimate is forecast, not
observed. Treat as directional; pilot will provide CL3.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-001 | informs (economic case) |


