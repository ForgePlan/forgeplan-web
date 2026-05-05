---
depth: tactical
id: PROB-009
kind: problem
status: deprecated
title: Cardinality explosion in user-defined attributes
---

# PROB-009: Cardinality explosion in user-defined attributes

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-03-08 |
| Severity | High (multi-tenant impact) |
| Owner | storage-platform |

## Symptom

A single tenant's bad instrumentation (attaching `user_id` as a span
attribute) caused a cardinality explosion: 14M unique attribute keys
within 4 hours. ClickHouse projection materialisation slowed; query
p99 across all tenants on the shared cluster regressed 40%.

## Investigation

Tenant `tnt_widgetco` deployed a v0.x service with:
```python
span.set_attribute("user_id", request.user.id)  # 14M unique users
span.set_attribute("session_id", request.session_id)  # similar
```

These attributes, on a shared shard with 7 other tenants, blew out
the LowCardinality dictionary. Every other tenant on the shard was
collateral damage.

## Mitigations applied

- Manual intervention: tenant disabled, schema rebuilt over 6 hours
- One tenant lost 4 hours of data during emergency rebuild
- All other tenants on shard saw degraded query latency for 6 hours

## Long-term fix

SOL-005 (cardinality limit enforcement at ingest) — reject ingest
batches whose attribute cardinality exceeds per-tenant budget;
auto-tier the offending tenant to a dedicated shard if it's a
legitimate high-cardinality use case.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| SOL-005 | refines |
| RFC-008 | informs (multi-tenant isolation) |



