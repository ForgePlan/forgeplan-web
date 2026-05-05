---
depth: standard
id: PRD-002
kind: prd
links:
- target: EPIC-001
  relation: refines
status: active
title: PromQL-compatible query language
---

# PRD-002: PromQL-compatible query language

## Executive Summary

### Vision

Helios exposes a query language that Prometheus users adopt without
training: any valid PromQL query against an equivalent metric set
returns equivalent results, plus extensions specific to span data
(e.g., `span_duration_seconds`).

### Problem

Customers migrate from Prometheus + Tempo + Loki and have institutional
knowledge in PromQL. Forcing a new DSL adds 2–6 weeks of ramp-up. Two
enterprise prospects in 2025-Q4 specifically blocked on "we lose all
our dashboards if you have your own language".

**Impact**: 3 of 5 lost deals in 2025-Q4 cited query-language migration.

### Target Users

| Persona | Description | Key pain |
|---------|-------------|----------|
| SRE | Builds dashboards, alert rules | Existing PromQL doesn't translate |
| Data engineer | Writes ad-hoc queries | New DSL slows exploration |

## Success Criteria

| ID | Criterion | Metric | Target | Timeframe |
|----|-----------|--------|--------|-----------|
| SC-1 | PromQL compat | conformance suite pass rate | ≥ 98% | 2026-Q3 |
| SC-2 | Query p95 latency | at 1k QPS | < 500 ms | 2026-Q3 |
| SC-3 | Customer dashboards | imported without changes | ≥ 80% | 2026-Q4 |

## Functional Requirements

| ID | Category | Priority | Requirement |
|----|----------|----------|-------------|
| FR-001 | Compat | Must | API consumer can submit PromQL `query` and `query_range` requests with PromQL semantics |
| FR-002 | Compat | Must | API consumer can use `rate`, `increase`, `histogram_quantile`, `topk`, `label_replace` |
| FR-003 | Extension | Should | API consumer can query span-specific aggregations via extension functions (`span_p99`, `service_dependency`) |
| FR-004 | Performance | Should | Result cache returns cached responses for repeat queries within 60s |

## Non-Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-001 | Performance | Query p95 | < 500 ms at 1k QPS |
| NFR-002 | Performance | Cache hit ratio | ≥ 60% on top-200 fingerprints |
| NFR-003 | Compat | Conformance | ≥ 98% pass on Prometheus PromQL suite |
| NFR-004 | Multi-tenancy | Isolation | No cross-tenant data leakage in cached responses |

## Risks & Mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| R-1 | PromQL spec ambiguity → consumer-visible drift | Maintain conformance suite + golden test fixtures |
| R-2 | Query plan caching staleness on schema changes | Plan cache key includes schema version |
| R-3 | Extension functions become incompatible with future PromQL evolution | Namespaced under `helios_*` prefix |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-001 | parent |
| RFC-006 | Query planner caching strategy |
| ADR-006 | Reject GraphQL (rationale) |
| SPEC-003 | API request/response shapes |
| EVID-002 | Load test |
| EVID-012 | Latency budget breakdown |
| SOL-004 | Result cache (planned) |


