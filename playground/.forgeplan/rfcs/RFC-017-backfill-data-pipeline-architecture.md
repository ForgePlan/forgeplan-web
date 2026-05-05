---
depth: standard
id: RFC-017
kind: rfc
links:
- target: PRD-013
  relation: refines
status: active
title: Backfill data pipeline architecture
---

# RFC-017: Backfill data pipeline architecture

## Summary

Build a generalised backfill pipeline for: (a) DSAR exports
(PRD-013), (b) tenant data migrations (org→sub-account split for
PRD-016), (c) historical re-aggregation for new metrics. Built on
Temporal (ADR-009).

## Motivation

We currently have 4 ad-hoc backfill scripts (DSAR, tenant move, alert
rule re-eval, span re-aggregation). Each is single-use, brittle, and
hand-monitored. A generalised pipeline cuts maintenance and unlocks
new use cases.

## Architecture

```
[ Temporal workflow ]
  ↓
  Activity 1: enumerate work items (filter)
  Activity 2: per-item fetch (batched)
  Activity 3: per-item transform
  Activity 4: per-item write
  Activity 5: idempotency record
  ↓
[ Output sink ]
```

## Goals

- All backfills go through this pipeline (no new ad-hoc scripts)
- Resumable / restartable from checkpoint
- Per-tenant rate limiting to avoid hot-path impact
- Observable: each step emits its own spans

## Risks

- Pipeline adds abstraction layer; simple backfills may feel heavy
- Temporal workflow deterministic-replay constraint catches some
  developers who slip in `Date.now()` or `Math.random()` outside
  Activity boundaries

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-013 | refines |
| ADR-009 | informs |
| SPEC-016 | concrete spec |


