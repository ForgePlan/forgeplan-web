---
depth: standard
id: SPEC-008
kind: spec
links:
- target: RFC-004
  relation: refines
status: deprecated
title: Storage compaction job spec
---

# SPEC-008: Storage compaction job spec

## Purpose

ClickHouse MergeTree merges parts in the background. The default
scheduler is workload-agnostic; at our ingest rate, default merging
saturates I/O during peak hours and creates long-tail query latency.

This spec defines a per-tenant compaction job that schedules merges
during low-traffic windows and bounds I/O throughput.

## Inputs

- Tenant ID
- Per-tenant traffic profile (computed weekly): top-2 low-activity
  hours per UTC day
- Per-tenant storage shape: parts count, total size, max-merge-size

## Schedule

```yaml
job:
  cron: "*/15 * * * *"   # check every 15 min
  selectors:
    - tenant_id
  body:
    - if: low_activity_window AND parts_count > 200
      action: optimize_partition
      throughput_limit_mb_per_s: 80
    - if: parts_count > 600
      action: optimize_partition
      throughput_limit_mb_per_s: 40   # urgent; throttled but unconditional
```

## Actions

### `optimize_partition`

```sql
OPTIMIZE TABLE spans_v12
  PARTITION '{partition}'
  ON CLUSTER helios_ch
  FINAL
SETTINGS
  max_bytes_to_merge_at_max_space_in_pool = {throughput_limit_mb_per_s} * 1048576;
```

Run with `SETTINGS replication_alter_partitions_sync = 2` so the job
waits for replicas.

## Telemetry

- `helios.compaction.parts_merged` counter (by tenant)
- `helios.compaction.duration_seconds` histogram
- `helios.compaction.bytes_merged` counter
- `helios.compaction.skip_reason` counter — reasons: `not_low_activity`,
  `cluster_loadshed`, `tenant_disabled`

## Failure handling

- Job leases a per-tenant lock (Redis TTL 1h); concurrent runs
  prevented
- On failure, exponential backoff (5min, 15min, 60min); 3 successive
  failures page on-call
- Cluster-level loadshed signal pauses all compaction jobs immediately

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-004 | refines (storage layout) |
| ADR-001 | informs (ClickHouse choice) |



