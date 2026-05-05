---
depth: standard
id: ADR-006
kind: adr
links:
- target: PRD-002
  relation: informs
status: active
title: Reject GraphQL for the public query API
---

# ADR-006: Reject GraphQL for the public query API

## Context

PRD-002 (PromQL-compatible query language) defines the public Helios
query interface. During RFC review, two senior engineers proposed
GraphQL Federation as the public API surface, citing flexible query
shapes and strong client codegen. Internal prototypes built (one for
spans, one for alerts).

## Decision

**Selected: NO. The public query API is a PromQL-style DSL over HTTP
(`POST /api/query`) with JSON responses. Internal mesh remains gRPC
(ADR-002). GraphQL is rejected for the public surface specifically.**

**Why selected**: the cost of a GraphQL gateway in the hot query path
exceeded the value at our usage shape. Customers ask for "PromQL plus
a few extras" — not a graph-shaped query API. The two prototypes
showed 3.4× higher p95 latency with no measurable productivity gain
for enterprise customers (whose engineers already know PromQL).

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| GraphQL Federation (Apollo) | **Rejected** | latency overhead; mismatched shape |
| GraphQL (single schema) | Rejected | same overhead, less flexibility |
| PromQL-compatible DSL | **Chosen** | matches user mental model; hot-path simple |
| OpenAPI / REST | Rejected | doesn't compose; client must paginate manually |

## Consequences

### Positive

- Hot path stays simple — one JSON parse, one planner entry point.
- PromQL community libraries work out-of-the-box.
- Migration path from Prometheus straightforward.

### Negative (trade-offs)

- Less flexible client-side composition (one query → one shape).
  Acceptable: clients are typically dashboards, not exploratory tools.
- Some internal teams wanted GraphQL for tooling purposes. They got
  a separate, internal-only GraphQL endpoint outside the hot path.

### Risks

- If we ever expose entity-graph data (services, dependencies, owners),
  we may want GraphQL for that surface specifically. Decision is
  scoped to *query* API (numeric/time-series), not entity graph.

## Invariants

- The public query API does not accept GraphQL.
- Internal-only GraphQL surfaces (admin tools) are gated behind SSO
  and rate-limited; never on the hot path.
- ADR-006 does not preclude future entity-graph APIs choosing GraphQL.

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-002 | PRD | informs |
| ADR-002 | ADR | complements (gRPC for internal mesh) |


