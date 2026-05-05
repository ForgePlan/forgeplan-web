---
depth: tactical
id: EVID-003
kind: evidence
links:
- target: PROB-002
  relation: informs
status: active
title: 'Memory profile: collector at 50k spans/sec'
---

# EVID-003: Memory profile — collector at 50k spans/sec

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-03-22 |
| Valid Until | 2026-09-22 |
| Target | PROB-002 (Memory leak in collector under burst load) |
| Author | platform-eng |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Measurement

pprof heap snapshots taken at t=0, t=15min, t=1h, t=4h on a single
collector pod (4 vCPU / 8 GB) under sustained 50k spans/sec. Spans
emitted by traffic-replay tool from anonymised prod capture.

- Build: collector v0.18.2 (Rust, tokio runtime)
- Allocator: jemalloc 5.3
- Rate: 50,000 spans/sec, mean span size 1.4 KB
- Burst pattern: 30s peaks at 80k, 90s troughs at 30k

## Result

| Snapshot | RSS (MB) | Heap live (MB) | Goroutines/Tasks |
|----------|----------|----------------|------------------|
| t=0 | 312 | 198 | 1,240 |
| t=15min | 487 | 311 | 1,260 |
| t=1h | 891 | 612 | 1,510 |
| t=4h | 2,140 | 1,620 | 4,890 |

Linear growth ~410 MB/h, no plateau within 4h. Top retainer: unbounded
`Vec<SpanBatch>` inside batch flusher when downstream Kafka write
backpressure activates.

## Interpretation

Confirms PROB-002. Root cause: batch flusher accumulates retries
without bound on Kafka 5xx; should bound the in-flight queue and shed
load. SOL-002 (bounded-buffer backpressure) directly addresses this.

## Congruence Level Justification

CL3: profile on the actual production binary (no debug build), real
Kafka backend, replay of production traffic shape. The exact failure
path is reproduced.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-002 | informs (root cause confirmed) |
| SOL-002 | informs (motivates the fix) |


