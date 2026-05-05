---
depth: standard
id: EPIC-001
kind: epic
status: active
title: Helios MVP — Trace ingestion and query
---

# EPIC-001: Helios MVP — Trace ingestion and query

## Vision

A production-grade observability platform for distributed services
whose MVP can ingest 1M+ spans/sec, store them efficiently in a
columnar store, and serve PromQL-style queries with predictable
sub-500ms p95 latency.

## Strategic context

Helios competes with Honeycomb, Lightstep, and Datadog APM. We
differentiate on (a) PromQL-native query surface (b) cost predictability
through retention policies and rollups (c) self-serve enterprise
adoption via SSO + claim-based RBAC.

EPIC-001 is the foundational tier — without ingest and query at the
required scale, nothing else matters. Multi-region (EPIC-002) and
self-serve (EPIC-003) build on this.

## Children PRDs

| PRD | Title | Status |
|-----|-------|--------|
| PRD-001 | Distributed tracing ingestion API | refines |
| PRD-002 | PromQL-compatible query language | refines |
| PRD-003 | Alerting rules engine v2 | refines |
| PRD-004 | Service map auto-discovery | refines |

## Success Criteria (epic-level)

| ID | Criterion | Metric | Target |
|----|-----------|--------|--------|
| EC-1 | Ingest scale | spans/sec sustained | 1M+ across 12-pod fleet |
| EC-2 | Query scale | p95 at 1k QPS | < 500 ms |
| EC-3 | Customer count | tenants on MVP | 25 by 2026-Q4 |
| EC-4 | NPS | feature NPS for "core obs" | ≥ +35 |

## Dependencies

- ClickHouse cluster operational (ADR-001)
- Redpanda pilot complete (RFC-001)
- gRPC service mesh (ADR-002)
- Monorepo build pipeline (ADR-003)

## Progress (high-level)

| Area | Status |
|------|--------|
| Ingestion API + storage | In review (PRD-001 active) |
| Query engine | Active development (PRD-002 active) |
| Alerting v2 | Spec phase (PRD-003 active) |
| Service map | Spec phase (PRD-004 draft) |

## Timeline

| Milestone | Target |
|-----------|--------|
| Ingest MVP | 2026-Q3 |
| Query MVP | 2026-Q3 |
| Alerting v2 | 2026-Q4 |
| Epic complete | 2026-Q4 |

## Related Artifacts

All children PRDs above + their refining RFCs/ADRs/Specs/Evidence.


