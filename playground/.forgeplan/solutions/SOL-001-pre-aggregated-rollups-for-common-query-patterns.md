---
depth: tactical
id: SOL-001
kind: solution
links:
- target: PROB-001
  relation: refines
status: active
title: Pre-aggregated rollups for common query patterns
---

# SOL-001: Pre-aggregated rollups for common query patterns

## Problem addressed

PROB-001 (query p99 regression) — the planner+storage hot path is
expensive for repeating queries. EVID-006 (A/B test) confirmed
that pre-aggregated rollups for the top-7 query fingerprints reduce
p95 by 68%.

## Approach

Maintain materialised views (ClickHouse `MATERIALIZED VIEW`) for
the top query patterns:

| Pattern | View | Refresh |
|---------|------|---------|
| `rate(span_count{service=$x}[1m])` | `mv_rate_1m_per_service` | continuous |
| `histogram_quantile(0.95, rate(span_duration_bucket[5m]))` | `mv_p95_duration_5m` | continuous |
| `sum by (service) (rate(span_count{status_code="ERROR"}[5m]))` | `mv_error_rate_5m_per_service` | continuous |
| ... 4 more | ... | ... |

Query planner detects matching shape and rewrites against the
materialised view if available. Falls back to raw storage on miss.

## Eligibility

A query is rewrite-eligible if:
- It matches one of the 7 registered patterns (regex on canonical AST)
- Time range aligns to the view's resolution boundary
- Tenant is opted in (default ON for new tenants from 2026-Q3)

Ad-hoc queries outside the pattern set still hit raw storage. No
silent semantic differences.

## Tradeoffs

### Positive
- 68% p95 reduction for top-7 patterns (EVID-006)
- 46% CPU drop on storage tier
- Negligible storage overhead (rollups <2% of raw data)

### Negative
- 7 materialised views to maintain; schema bumps require coordinated
  view migration
- Rollup timestamps snap to minute boundaries → 0.4% accuracy delta
  on tail-end values (within ±5% tolerance)

## Rollout plan

1. Phase 1: deploy to 4 opt-in tenants for 14d
2. Phase 2: GA to all new tenants 2026-Q3
3. Phase 3: opt-out for existing tenants (announce 30d notice)

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-001 | refines |
| EVID-006 | informs (validation) |
| EVID-012 | informs (latency budget) |


