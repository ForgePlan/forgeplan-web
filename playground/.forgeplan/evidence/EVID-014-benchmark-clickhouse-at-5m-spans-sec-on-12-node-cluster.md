---
depth: tactical
id: EVID-014
kind: evidence
status: active
title: 'Benchmark: ClickHouse at 5M spans/sec on 12-node cluster'
---

# EVID-014: Benchmark — ClickHouse at 5M spans/sec on 12-node cluster

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-28 |
| Valid Until | 2026-10-28 |
| Target | ADR-001 (re-confirm at higher scale) |
| Author | observability-eng |

## Structured Fields

evidence_type: benchmark
verdict: supports
congruence_level: 3

## Why this benchmark exists

EVID-001 confirmed ClickHouse choice at 1M spans/sec. By 2026-Q1 our
peak production load reached 4.2M spans/sec, putting EVID-001 outside
its measured envelope. This benchmark re-confirms the decision at the
new operating point and supersedes EVID-001 as the authoritative
performance reference.

## Setup

- 12× r6i.4xlarge (16 vCPU / 128 GB), MergeTree on gp3 (2 TB each)
- Workload: same shape as EVID-001 (70% append, 25% range scans, 5% group-by)
- Sustained 5,000,000 spans/sec for 60 minutes

## Result

| Metric | EVID-001 (1M sps) | EVID-014 (5M sps) | Δ |
|--------|-------------------|-------------------|---|
| Ingest p99 (ms) | 18 | 27 | +50% |
| Query p95 (s) | 0.42 | 0.51 | +21% |
| CPU at peak (%) | 58 | 74 | +28% |
| Storage amplification | 11.3× | 10.9× | −4% |

Linear scaling holds. CPU headroom narrows but stays positive (26%
remaining at peak). Compression ratio essentially unchanged.

## Interpretation

ADR-001 holds at 5× current scale. EVID-001 is superseded as the
authoritative reference; the system is now characterised at 5M sps
and the cost model in EVID-008 should be re-rated for that envelope.

## Congruence Level Justification

CL3: same workload mix, same hardware class, longer run, larger
cluster.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-001 | supersedes |
| ADR-001 | informs (re-confirms) |


