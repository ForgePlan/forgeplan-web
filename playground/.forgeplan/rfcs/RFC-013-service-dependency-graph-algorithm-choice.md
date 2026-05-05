---
depth: standard
id: RFC-013
kind: rfc
links:
- target: PRD-011
  relation: refines
status: active
title: Service dependency graph algorithm choice
---

# RFC-013: Service dependency graph algorithm choice

## Summary

For PRD-011 (real-time service dependency analytics), choose the
graph derivation algorithm. Decision: streaming aggregation per-edge
with 60s windows; full graph reconstruction by union of edges.

## Options

| Option | Pros | Cons |
|--------|------|------|
| Batch reconstruction every 60s | Simple | High CPU on each cycle |
| Streaming aggregation (chosen) | Incremental | More complex state |
| GraphX-style algorithms | Powerful | Overkill at our edge count |

## Decision

**Streaming aggregation.** Each ingested span emits an event to a
per-(caller, callee) counter; 60s tumbling window flushes into the
graph store. Graph store is a simple adjacency list keyed by tenant.

## Implementation

```
[ span ingest ] → [ window aggregator ]
                    ↓ every 60s
                  [ graph store (Redis hash) ]
                    ↓ poll
                  [ UI ]
```

## Performance

- Per-edge state: ~32 bytes
- Typical tenant: 200 services, ~3000 edges → 96 KB
- 1k tenants: ~96 MB total Redis memory; cheap

## Risks

- Tail of edges with very low RPS may flicker in/out of view; UI
  applies hysteresis (3-window minimum)
- Cardinality explosion if user's services have high-cardinality
  identity (e.g. per-instance hostname). Mitigation: cardinality
  cap per tenant

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-011 | refines |


