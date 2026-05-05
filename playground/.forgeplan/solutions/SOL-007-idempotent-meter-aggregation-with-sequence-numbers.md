---
depth: tactical
id: SOL-007
kind: solution
links:
- target: PROB-013
  relation: refines
status: active
title: Idempotent meter aggregation with sequence numbers
---

# SOL-007: Idempotent meter aggregation with sequence numbers

## Problem addressed

PROB-013 (INC-217): meter aggregator double-counted usage when
cross-region replication catch-up ran on a different code version
than initial aggregation.

## Approach

Each ingest event carries a monotonic per-tenant sequence number.
Aggregation deduplicates by sequence number; second application with
same sequence is a no-op.

### Schema

```sql
ALTER TABLE meter_event ADD COLUMN sequence_number BIGINT NOT NULL;
CREATE UNIQUE INDEX idx_meter_seq ON meter_event (tenant_id, sequence_number);
```

### Aggregation logic

```sql
INSERT INTO meter_minute_rollup (tenant_id, minute, total_spans, total_bytes)
SELECT tenant_id, minute, sum(span_count), sum(byte_count)
FROM meter_event
WHERE tenant_id = $tenant
  AND minute = $minute
ON CONFLICT (tenant_id, minute) DO UPDATE SET
  total_spans = excluded.total_spans,
  total_bytes = excluded.total_bytes;
```

(The unique constraint on `(tenant_id, sequence_number)` ensures
that re-inserting the same event is a constraint violation; the
sum is then computed from the deduplicated set.)

## Sequence assignment

Sequence numbers are issued per-tenant by the ingest gateway using
a Postgres sequence. Single-region issue; cross-region replication
preserves the order.

## SLO

Daily total = sum(minute rollups) within 0.5%. Page on breach.

## Tradeoffs

### Positive
- Eliminates the entire double-counting class
- Idempotent replay: catch-up jobs are safe by construction

### Negative
- Sequence assignment is a single-region bottleneck (~50k seq/sec
  per Postgres node — well within budget)
- Schema migration touches 4 hot tables; needs careful rollout

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-013 | refines |
| EVID-024 | informs |


