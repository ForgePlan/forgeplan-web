---
depth: standard
id: PRD-001
kind: prd
links:
- target: EPIC-001
  relation: refines
status: active
title: Distributed tracing ingestion API
---

# PRD-001: Distributed tracing ingestion API

## Executive Summary

### Vision

Helios accepts spans from any OpenTelemetry-compatible source at
1M+ spans/sec sustained, with ingest p99 < 50ms and zero data loss
under planned-failure scenarios.

### Problem

SREs and platform teams instrument their services with OpenTelemetry
SDKs but lack a backend that survives traffic bursts (3–5× normal),
provides predictable cost at high cardinality, and offers a query
language they already know. Existing tools either drop bursts silently
or surprise teams with bills.

**Impact**: 40% of SRE interviews (EVID-005 sample) report at least
one "lost the trace we needed during the incident" event in the past
quarter.

### Target Users

| Persona | Description | Key pain |
|---------|-------------|----------|
| Backend SRE | Operates production microservices, on-call | Trace search slow; ingest drops during bursts |
| Platform engineer | Owns observability infra | Cost spikes from cardinality explosions |
| Application engineer | Instruments their service | OTel SDK config; sample-rate tuning |

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe |
|----|-----------|--------|---------|--------|-----------|
| SC-1 | Ingest throughput | spans/sec/pod | 50k | 100k | 2026-Q3 |
| SC-2 | Ingest p99 | latency at 100k sps | 18 ms | < 50 ms | 2026-Q3 |
| SC-3 | Zero data loss | bursts ≤ 3× sustained | 88% | 100% | 2026-Q3 |
| SC-4 | Tenant onboarding | time-to-first-span | 22 min | < 5 min | 2026-Q4 |

## Product Scope

### MVP (in-scope)

- OTLP/gRPC and OTLP/HTTP ingest endpoints
- Per-tenant authentication via signed JWT
- Backpressure with bounded buffers (avoid PROB-002 regressions)
- Schema validation with friendly error messages
- Prometheus-compatible `/metrics` endpoint for collector self-obs

### Out of scope (this PRD)

- Tail-based sampling (RFC-003 will cover)
- Custom processors / pipelines (planned 2026-Q4)
- Browser RUM ingestion (separate PRD)

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Tenant can submit OTLP/gRPC batches up to 4 MB | Onboarding |
| FR-002 | Core | Must | API returns 429 with Retry-After when backpressure fires | Burst |
| FR-003 | Auth | Must | Tenant can authenticate via signed JWT; invalid tokens rejected with structured error | Onboarding |
| FR-004 | UX | Should | API returns schema-violation hints with field path | Onboarding |
| FR-005 | Integration | Should | API exposes its own observability via OTel | All |

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Ingest p99 latency | < 50 ms | At 100k spans/sec/pod | APM (RED) |
| NFR-002 | Availability | Monthly uptime | ≥ 99.95% | Per region | SLO dashboards |
| NFR-003 | Security | All ingestion authenticated | 100% | Production | Audit logs |
| NFR-004 | Scalability | Horizontal | linear to 5M spans/sec | 50 pod fleet | Load test |

## Risks & Mitigations

| ID | Risk | P | Impact | Mitigation |
|----|------|---|--------|------------|
| R-1 | Burst > 5× sustains > 10 min | Med | High | bounded buffer + tenant-level shedding |
| R-2 | High-cardinality customer breaks storage | Low | Critical | per-tenant cardinality limits, alerting |
| R-3 | Schema drift between collector versions | Med | Medium | strict validation, `_unknown_field` capture |

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| EPIC-001 | Parent | active |
| RFC-001 | Architecture proposal (Kafka→Redpanda) | active |
| RFC-002 | OTel canonical wire | active |
| SPEC-001 | OTLP endpoint contract | active |
| SPEC-002 | Span schema v1.2 | active |
| EVID-002 | Load-test evidence | active |


