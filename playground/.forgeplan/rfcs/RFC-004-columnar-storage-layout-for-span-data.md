---
depth: standard
id: RFC-004
kind: rfc
links:
- target: PRD-001
  relation: refines
status: active
title: Columnar storage layout for span data
---

# RFC-004: Columnar storage layout for span data

## Summary

Span data is stored in a columnar layout optimised for: time-range
scans, group-by service+operation, and aggregate functions on
duration. Layout is implemented on ClickHouse MergeTree (ADR-001).

## Motivation

Span workload is overwhelmingly columnar: filter by time + service,
group by operation, aggregate p95. Row-store engines (TimescaleDB,
PG) saturate CPU on serialization for these patterns. Columnar
projection eliminates that overhead.

## Goals

- 10× compression vs row-store on representative workload
- p95 query latency < 500ms on 100M-row range scans
- Schema supports OTel span model 1:1 (no lossy translation)

## Layout

```
ORDER BY (tenant_id, service, toStartOfHour(start_time), trace_id)
PARTITION BY toYYYYMMDD(start_time)
TTL start_time + INTERVAL 90 DAY DELETE
```

- Columns: tenant_id, service, operation, kind, status_code,
  duration_ns, start_time, end_time, trace_id, span_id, parent_span_id,
  attributes (LowCardinality<String> map), events, links
- Compression: ZSTD level 3 default; LZ4 for tenant_id (low cardinality)
- LowCardinality dictionary on service, operation, kind

## Options

| Option | Verdict |
|--------|---------|
| Row-store (TimescaleDB) | Rejected — CPU saturated |
| Columnar (ClickHouse) | **Chosen** |
| Custom Parquet + DuckDB | Rejected — no clustered query layer |

## Implementation Phases

| Phase | Scope |
|-------|-------|
| 1 | Schema + benchmark | EVID-001 |
| 2 | Migration tooling | EVID-013 |
| 3 | Production cutover | per ADR-001 rollback plan |

## Risks

- R-1: Schema evolution painful on 100M+ row tables. Mitigation:
  add columns Nullable, never remove; cleanup via TTL + DROP COLUMN
  in maintenance windows.
- R-2: Query patterns outside ORDER BY are slow. Mitigation:
  per-tenant materialised projections for common dashboards.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-001 | refines |
| ADR-001 | based_on relationship reverse: ADR is based_on this |
| EVID-001 | informs |
| EVID-013 | informs |


