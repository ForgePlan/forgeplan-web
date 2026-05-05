---
depth: tactical
id: SOL-005
kind: solution
links:
- target: PROB-009
  relation: refines
status: active
title: Cardinality limit enforcement at ingest
---

# SOL-005: Cardinality limit enforcement at ingest

## Problem addressed

PROB-009: a single tenant's bad instrumentation (high-cardinality
attributes) blew out the shared shard's dictionary, degrading 7 other
tenants' query latency.

## Approach

Two layers of defence:

### Layer 1: ingest-time cardinality counter

Per-tenant rolling counter of unique (attribute_key, attribute_value)
combinations seen in the last hour. When the counter approaches the
budget, ingest emits warnings. When it exceeds, ingest rejects new
attribute combinations from that tenant for the rest of the hour.

```rust
struct CardinalityBudget {
  per_tenant_max: usize,
  window: Duration,
  observed: HashMap<TenantId, BTreeSet<(AttrKey, AttrHash)>>,
}
```

### Layer 2: tenant tier auto-promotion

If a tenant has legitimate high-cardinality use (we can tell from
the rate of growth — steady linear growth = real, sudden burst = bug),
the operator promotes them to a dedicated shard automatically.

## Default budgets

| Tier | per-hour cardinality budget |
|------|------------------------------|
| Free | 10,000 unique combos |
| Paid | 100,000 |
| Enterprise | configurable (default 1M) |

## Tradeoffs

### Positive
- Eliminates blast radius for the cardinality explosion class of bug
- Tenants get clear feedback (`HELIOS_CARDINALITY_BUDGET_EXCEEDED` error)

### Negative
- Auto-promotion adds operator complexity
- Some legitimate use cases (e.g., A/B test ID as attribute) may need
  manual tuning

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-009 | refines |


