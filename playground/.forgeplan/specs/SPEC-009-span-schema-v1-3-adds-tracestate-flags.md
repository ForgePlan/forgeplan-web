---
depth: standard
id: SPEC-009
kind: spec
status: active
title: Span schema v1.3 (adds tracestate + flags)
---

# SPEC-009: Span schema v1.3 (adds tracestate + flags)

## Summary

Schema v1.3 supersedes v1.2 (SPEC-002). New columns:

- `trace_state` (LowCardinality(String)) — W3C Trace Context tracestate
- `trace_flags` (UInt8) — sampled, debug bits per W3C spec
- `span_links_count` (UInt32, materialised) — for projection optimisation

## Migration from v1.2

- Backwards compatible: new columns nullable with default
- Dual-write phase: ingest writes both v1.2 and v1.3 for one quarter
- Cutover: 2026-Q4
- Decommission v1.2: 2027-Q1

## DDL diff

```sql
ALTER TABLE spans_v12 RENAME TO spans_v13;
ALTER TABLE spans_v13
  ADD COLUMN trace_state LowCardinality(String) DEFAULT '',
  ADD COLUMN trace_flags UInt8 DEFAULT 0,
  ADD COLUMN span_links_count UInt32 MATERIALIZED length(links.trace_id);
```

## Why supersede SPEC-002

- W3C Trace Context tracestate adoption became mandatory in OTel SDK
  v1.30 (2026-Q1). Spans without tracestate lose vendor-specific
  trace propagation context.
- Several customers requested debug-flag visibility for selective
  capture in production.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| SPEC-002 | supersedes |
| ADR-001 | informs |


