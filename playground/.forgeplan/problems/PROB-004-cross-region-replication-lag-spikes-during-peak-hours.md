---
depth: tactical
id: PROB-004
kind: problem
links:
- target: EPIC-002
  relation: informs
status: active
title: Cross-region replication lag spikes during peak hours
---

# PROB-004: Cross-region replication lag spikes during peak hours

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-04-08 |
| Severity | Medium |
| Owner | sre-platform |

## Symptom

Span replication from us-east-1 (primary) to eu-west-1 (DR) lags by
8–14 minutes during peak hours (14:00–18:00 UTC), well beyond the 60s
SLO. Off-peak: lag is consistently <10s.

## Investigation

Replication path:
```
ClickHouse us-east-1
   ↓ ReplicatedMergeTree async replication
   ↓ over cross-region link (~80 ms RTT)
ClickHouse eu-west-1
```

During peak:
- us-east-1 ingest rate: ~600k spans/sec
- Replication queue depth grows from <1k to 90k entries
- Network throughput on cross-region link: 6 Gbps (saturated)

Cross-region link bandwidth is the bottleneck. We provisioned 5 Gbps
sustained / 10 Gbps burst; sustained traffic actually wants ~7 Gbps.

## Impact

- DR readiness: if us-east-1 fails during peak, eu-west-1 is up to
  14 min behind = potential data loss window for that bracket
- Read-your-writes for cross-region readers: stale up to 14 min

## Mitigations under consideration

- Bump cross-region link to 10 Gbps sustained (cost: ~$8k/month)
- Compress replication payload (current: uncompressed ZSTD-decoded
  before replication; could replicate compressed)
- Tier 2 tenants only: skip cross-region; local DR via snapshots
- Adopt asynchronous-by-design (eventual) replication semantics and
  document the 14-min window as expected

## Decision pending

Linked to EPIC-002 (multi-region deployment & data residency).

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-002 | informs |


