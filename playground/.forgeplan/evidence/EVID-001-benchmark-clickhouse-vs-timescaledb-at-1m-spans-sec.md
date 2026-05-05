---
depth: tactical
id: EVID-001
kind: evidence
links:
- target: ADR-001
  relation: informs
- target: EVID-014
  relation: supersedes
status: superseded
title: 'Benchmark: ClickHouse vs TimescaleDB at 1M spans/sec'
---

# EVID-001: Benchmark — ClickHouse vs TimescaleDB at 1M spans/sec

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-12 |
| Valid Until | 2026-10-12 |
| Target | ADR-001 (Choose ClickHouse over TimescaleDB for span storage) |
| Author | observability-eng |

## Structured Fields

evidence_type: benchmark
verdict: supports
congruence_level: 3

## Measurement

Synthetic load generator (Vegeta + custom span emitter) at 1,000,000 spans/sec
sustained over 30 min, measured against single-region staging clusters.

- ClickHouse 24.3, 6× r6i.4xlarge (16 vCPU / 128 GB), MergeTree on gp3 (1 TB)
- TimescaleDB 2.14 (PG16), 6× r6i.4xlarge identical, native compression on
- Workload: 70% append, 25% range scans (1h windows), 5% group-by
- Measured: ingest p99 latency, query p95 latency on 100M-row range, storage
  amplification ratio after 4h retention

## Result

| Metric | ClickHouse | TimescaleDB |
|--------|------------|-------------|
| Ingest p99 (ms) | 18 | 64 |
| Query p95 (s)   | 0.42 | 2.7 |
| Compression ratio | 11.3× | 4.1× |
| CPU at peak (%) | 58 | 91 |

ClickHouse showed 6.4× lower query p95 and 2.7× better compression at
identical hardware. TimescaleDB CPU saturated at peak; ClickHouse had
headroom (~40%).

## Interpretation

Span workload is dominated by columnar range scans + heavy compression
opportunity (high cardinality string fields, low cardinality enums). This
matches ClickHouse's design centre. TimescaleDB's row-store with hypertable
compression is competitive on smaller fleets but degrades non-linearly past
~500k spans/sec.

## Congruence Level Justification

CL3: same workload shape, same hardware class, same staging environment as
production target. No extrapolation across span schemas, no synthetic-only
metrics — measurements taken on real OTLP traffic mix.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-001 | informs (chosen option) |
| RFC-004 | informs (columnar layout RFC referenced this benchmark) |



