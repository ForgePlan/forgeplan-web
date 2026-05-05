---
depth: standard
id: PRD-014
kind: prd
links:
- target: EPIC-003
  relation: refines
status: active
title: SDK auto-instrumentation for Node.js
---

# PRD-014: SDK auto-instrumentation for Node.js

## Vision

A Node.js SDK that, when installed and required, auto-instruments
all common libraries (Express, Fastify, Postgres, Redis, gRPC,
HTTP clients) without manual configuration. Customer time-to-first-
span < 2 minutes from `npm install`.

## Problem

Manual OpenTelemetry instrumentation requires customer engineering
time (~4h per service). EVID-018 onboarding telemetry shows 18%
funnel drop at "First span ingested". Lower the barrier; capture
those teams.

## Target Users

| Persona | Pain |
|---------|------|
| App engineer | "I just want spans without learning OTel concepts" |
| Onboarding new tenant | Drop-off at instrumentation step |

## Success Criteria

| ID | Target |
|----|--------|
| SC-1: Time-to-first-span | < 2 min from npm install |
| SC-2: Latency overhead | < 5% at p99 |
| SC-3: Library coverage | top-12 libraries by GitHub usage |
| SC-4: Onboarding funnel improvement | +10pt conversion at instrument step |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | SDK auto-detects supported libraries via require-hooks |
| FR-002 | Must | SDK reads tenant API key from env var; no further config |
| FR-003 | Must | SDK supports manual override via single config function |
| FR-004 | Should | SDK ships bundled OTLP exporter; no separate setup |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Latency overhead < 5% p99 (EVID-017 met) |
| NFR-002 | Memory overhead < 50 MB at typical 100 RPS |
| NFR-003 | Compatibility: Node 18+ (matches npm support) |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-003 | parent (onboarding push) |
| RFC-015 | distribution model |
| SPEC-013 | interface |
| EVID-017 | overhead validation |


