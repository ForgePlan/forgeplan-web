---
depth: standard
id: SPEC-002
kind: spec
links:
- target: PRD-001
  relation: refines
- target: SPEC-009
  relation: supersedes
status: superseded
title: Span schema v1.2
---

# SPEC-002: Span schema v1.2

## Schema (ClickHouse DDL)

```sql
CREATE TABLE spans_v12 ON CLUSTER helios_ch (
  tenant_id        LowCardinality(String),
  service          LowCardinality(String),
  operation        LowCardinality(String),
  kind             Enum8('CLIENT'=1,'SERVER'=2,'PRODUCER'=3,'CONSUMER'=4,'INTERNAL'=5),
  status_code      Enum8('UNSET'=0,'OK'=1,'ERROR'=2),
  status_message   String,
  trace_id         FixedString(16),
  span_id          FixedString(8),
  parent_span_id   FixedString(8),
  start_time       DateTime64(9),
  end_time         DateTime64(9),
  duration_ns      UInt64 MATERIALIZED (toUnixTimestamp64Nano(end_time) - toUnixTimestamp64Nano(start_time)),
  attributes       Map(LowCardinality(String), String),
  events           Nested(timestamp DateTime64(9), name String, attributes Map(LowCardinality(String), String)),
  links            Nested(trace_id FixedString(16), span_id FixedString(8), attributes Map(LowCardinality(String), String)),
  resource         Map(LowCardinality(String), String),
  schema_version   LowCardinality(String) DEFAULT 'v1.2'
)
ENGINE = ReplicatedMergeTree(...)
ORDER BY (tenant_id, service, toStartOfHour(start_time), trace_id)
PARTITION BY toYYYYMMDD(start_time)
TTL start_time + toIntervalDay(retention_days(tenant_id)) DELETE;
```

## Mapping from OTel

| OTel field | Schema column |
|------------|---------------|
| `Span.name` | `operation` |
| `Span.kind` | `kind` |
| `Span.status` | `status_code, status_message` |
| `Span.trace_id` | `trace_id` |
| `Span.span_id` | `span_id` |
| `Span.parent_span_id` | `parent_span_id` |
| `Span.start_time_unix_nano` | `start_time` (ns precision) |
| `Span.end_time_unix_nano` | `end_time` |
| `Span.attributes` | `attributes` (KV) |
| `Span.events` | `events` (nested) |
| `Span.links` | `links` (nested) |
| `Resource.attributes['service.name']` | `service` (extracted) |
| Other `Resource.attributes` | `resource` |

## Validation rules

- `tenant_id`: non-empty, valid ULID format
- `trace_id`: exactly 16 bytes; rejected if zero
- `span_id`: exactly 8 bytes; rejected if zero
- `parent_span_id`: 8 bytes or zero (root spans)
- `start_time` ≤ `end_time` (rejected; warning emitted)
- `attributes` keys: max 100 distinct per tenant per day; cardinality
  limit enforced

## Versioning

- Backwards compatible: v1.2 adds optional fields only
- Breaking changes (v2.x) require dual-write for one quarter
- Schema version in `schema_version` column for compat queries

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-001 | refines |
| SPEC-001 | complements (wire contract) |
| ADR-001 | informs (storage choice) |



