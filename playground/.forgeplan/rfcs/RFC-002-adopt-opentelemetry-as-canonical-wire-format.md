---
depth: standard
id: RFC-002
kind: rfc
links:
- target: PRD-001
  relation: refines
status: active
title: Adopt OpenTelemetry as canonical wire format
---

# RFC-002: Adopt OpenTelemetry as canonical wire format

## Summary

OpenTelemetry Protocol (OTLP) becomes the single accepted ingestion
wire format. Legacy Jaeger and Zipkin endpoints continue to work via
in-process translators for one major version (deprecated 2026-Q4,
removed 2027-Q1).

## Motivation

The market has consolidated. 87% of new tenants in 2026-Q1 send OTLP
natively. Maintaining 3 ingestion paths costs ~0.5 engineer FTE in
edge cases and translation bugs. Simplification is overdue.

## Goals

- One canonical schema (OTLP); one wire path
- Legacy formats translated at edge with explicit deprecation timeline
- Consumer-facing SDKs no longer needed — OTel SDKs are the path

## Options

| Option | Verdict |
|--------|---------|
| Keep Jaeger / Zipkin / OTLP all first-class | Rejected — ongoing cost |
| OTLP canonical, others translated | **Chosen** |
| OTLP only, hard cut | Rejected — breaks customers immediately |

## Implementation Phases

| Phase | Scope | Exit |
|-------|-------|------|
| 1 | OTLP/gRPC ingestion stable | conformance suite passes |
| 2 | Jaeger → OTLP translator at edge | byte-equivalent telemetry confirmed |
| 3 | Zipkin → OTLP translator | same |
| 4 | Customer comms: deprecation announced | 12-month timeline communicated |
| 5 | Legacy endpoints removed | 0 traffic on legacy paths for 30d |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-001 | refines |
| ADR-002 | informs (gRPC choice aligned) |


