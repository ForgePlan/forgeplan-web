---
depth: standard
id: PRD-009
kind: prd
links:
- target: EPIC-004
  relation: refines
status: active
title: Anomaly detection rules engine
---

# PRD-009: Anomaly detection rules engine

## Vision

Helios automatically surfaces anomalies in span/metric data without
requiring SREs to author each rule manually. F1 ≥ 0.75 on internal
labelled benchmark; false-alert rate ≤ 6 per day per 100 services.

## Problem

Customers must hand-author every alert rule. Many anomalies (sudden
RPS drops, latency spikes, error rate creep) follow predictable
shapes that statistical detectors can find automatically. SREs are
under-resourced to maintain hand-tuned rules at the rate services
multiply.

## Target Users

| Persona | Pain |
|---------|------|
| SRE | Manually writing rules; missing anomalies |
| Platform engineer | Wants "auto-on" anomaly detection by default |

## Success Criteria

| ID | Criterion | Target |
|----|-----------|--------|
| SC-1 | F1 on labelled set | ≥ 0.75 |
| SC-2 | False alerts/day per 100 services | ≤ 6 |
| SC-3 | Time-to-first-anomaly | < 24h after enabling |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | Tenant can opt-in per-service auto-detection |
| FR-002 | Must | Anomaly fire produces an Alert (existing pipeline reused) |
| FR-003 | Must | User can author per-service detector overrides via DSL |
| FR-004 | Should | User can mark a detected anomaly as "expected" → detector learns |
| FR-005 | Could | User can review detector decisions over past 7d |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Detector evaluation p95 < 10s/service/cycle |
| NFR-002 | Cycle cadence: 60s |
| NFR-003 | Privacy: detector cannot see attribute values, only aggregates |

## Risks

| Risk | Mitigation |
|------|------------|
| False alerts at scale → trust erosion | Per-service ramp; require 7-day "shadow mode" before fire |
| Statistical approach insufficient | RFC-011 evaluated alternatives |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-004 | parent |
| RFC-011 | architecture |
| SPEC-010 | DSL |
| EVID-015 | informs (F1 measurement) |


