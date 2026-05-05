---
depth: standard
id: RFC-003
kind: rfc
links:
- target: PRD-004
  relation: refines
status: active
title: Tail-based sampling architecture
---

# RFC-003: Tail-based sampling architecture

## Summary

Implement tail-based sampling at the ingest tier: complete traces
are buffered for a tunable window (default 30s), then sampled based
on tenant-defined rules (errors always kept, slow traces 100%, normal
traffic at 1–5%).

## Motivation

Head-based sampling (current) drops 95% of traces at SDK level →
loses long-tail latency outliers and errors that occur in unsampled
parents. Tail sampling keeps the interesting traces while controlling
storage cost.

## Goals

- Sampling decisions made on complete trace shape, not first span
- Tenants can author sampling rules (error always, slow > Xms, etc.)
- No per-span CPU overhead > 10% of ingest pipeline

## Options

| Option | Pros | Cons |
|--------|------|------|
| Head sampling (status quo) | Simple, low CPU | Misses tail |
| Tail sampling at ingest (chosen) | Captures interesting traces | Memory cost; 30s buffer |
| Tail sampling at SDK | Lowest cost | Requires complete trace at one client; impossible cross-process |
| Hybrid (head + tail) | Best of both | Implementation complexity |

## Implementation Phases

| Phase | Scope |
|-------|-------|
| 1 | Buffer architecture: bounded, partitioned by trace_id |
| 2 | Rule engine: error/duration/attribute matchers |
| 3 | Tenant API: rule authoring + dry-run |
| 4 | Rollout per-tenant behind flag |

## Risks

- R-1: 30s buffer at 1M spans/sec = significant memory. Mitigation:
  per-tenant memory budgets; spillover to local SSD.
- R-2: Late spans (>30s) silently dropped. Mitigation: emit metric;
  document; allow extending window per tenant.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-004 | refines |


