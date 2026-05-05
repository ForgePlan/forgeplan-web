---
depth: tactical
id: PROB-002
kind: problem
status: deprecated
title: Memory leak in collector under burst load
---

# PROB-002: Memory leak in collector under burst load

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-03-25 |
| Severity | High |
| Owner | platform-eng |

## Symptom

Collector pods OOMKilled within 4–6h of sustained burst traffic
(80k spans/sec peaks). RSS grows linearly without plateau. EVID-003
profile shows 410 MB/h growth at 50k spans/sec.

## Reproduction

- Deploy collector v0.18.x to staging
- Replay anonymised prod traffic at 50k spans/sec mean, with 30s
  bursts to 80k every 90s
- Observe RSS / heap growth via pprof every 15 min for 4h

## Investigation

Heap dominators at t=4h (from pprof):

```
1.4 GB  Vec<SpanBatch> in batch_flusher::pending_retries
0.2 GB  Tokio task buffers
0.1 GB  jemalloc fragmentation
```

The unbounded `Vec<SpanBatch>` accumulates batches whose Kafka write
returned 5xx. Default policy: retry indefinitely. Under sustained
backpressure from Kafka (e.g., during a cluster rebalance), the
queue grows without limit.

## Impact

- INC-204 (EVID-004): SEV-2 production incident, 46 min duration
- SLO: ingest lag SLO (3 min) breached for 23 min
- Cost: 12 → 24 collector pods scaled during recovery (2× cost burst)

## Mitigations applied

- Hotfix: 8 GB memory limit per pod (deployed 2026-03-30)
  forces faster OOMKill and shorter cascade chains
- Increased Kafka cluster headroom from 30% to 50%

## Long-term fix

SOL-002 (bounded-buffer backpressure): impose a hard cap on
in-flight batch retries (4× sustained throughput); on overflow,
return 429 to upstream collectors and shed load.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-003 | informs (heap profile) |
| EVID-004 | informs (incident postmortem) |
| SOL-002 | refines (fix) |



