---
depth: standard
id: EPIC-004
kind: epic
status: active
title: AI-powered anomaly detection
---

# EPIC-004: AI-powered anomaly detection

## Vision

Helios automatically surfaces anomalous behavior (RPS drops, latency
spikes, error rate creep) without requiring SREs to author rules
for every signal. v1 ships with statistical detection; ML-based
detection deferred to 2027.

## Strategic context

Anomaly detection is a competitive differentiator: Datadog APM Watchdog,
Honeycomb BubbleUp, Lightstep Anomaly. Without auto-detection, Helios
relies on customer-authored rules, missing entire classes of slow drift.

## Children PRDs

| PRD | Title |
|-----|-------|
| PRD-009 | Anomaly detection rules engine |
| PRD-011 | Real-time service dependency analytics |

## Success Criteria

| ID | Target |
|----|--------|
| EC-1: F1 on labelled set | ≥ 0.75 |
| EC-2: False alerts/day per 100 services | ≤ 6 |
| EC-3: Tenant adoption | ≥ 30% of paid tenants in 12 months |
| EC-4: NPS for anomaly feature | ≥ +20 in launch quarter |

## Dependencies

- PRD-003 (alerting v2) for delivery pipeline
- SOL-003 (alert grouping) absorbs anomaly noise

## Timeline

| Milestone | Target |
|-----------|--------|
| Statistical detector ship | 2026-Q4 |
| Service dependency analytics | 2027-Q1 |
| ML detector evaluation | 2027-Q2+ |

## Related Artifacts

All children PRDs + RFC-011 + EVID-015.


