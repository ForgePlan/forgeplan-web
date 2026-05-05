---
depth: standard
id: RFC-011
kind: rfc
links:
- target: PRD-009
  relation: refines
status: active
title: 'Anomaly detection: statistical vs ML approach'
---

# RFC-011: Anomaly detection — statistical vs ML approach

## Summary

For PRD-009 (anomaly detection rules engine), evaluate three candidates:
EWMA + 3-sigma, Seasonal Hybrid ESD, Isolation Forest. Decision: ship
**Seasonal Hybrid ESD** in v1; revisit ML in 2027 once MLOps capacity
exists.

## Motivation

EVID-015 measured F1 0.70 / 0.76 / 0.81 respectively across 142
labelled prod incidents. ML wins F1 by 0.05; statistical wins on
operational simplicity, latency, and explainability.

## Goals

- Ship a v1 detector that beats hand-tuned rules on F1
- No new MLOps dependency in 2026
- Detector is explainable to SREs ("here's why we fired")

## Options

| Option | F1 | Op cost | Explainability |
|--------|----|---------|-----------------|
| EWMA + 3σ | 0.70 | low | high |
| Seasonal Hybrid ESD | 0.76 | low | high |
| Isolation Forest | 0.81 | high | low |

## Decision

**Seasonal Hybrid ESD for v1.** Will deploy in shadow mode for
30 days per service before user-visible firing. The 0.05 F1 gap to
ML does not justify the MLOps investment in 2026.

## Implementation Phases

| Phase | Scope |
|-------|-------|
| 1 | Detector library (Rust) integrated into rule engine |
| 2 | DSL extension for "auto" mode (SPEC-010 v2) |
| 3 | Shadow mode rollout, per-service |
| 4 | User-visible firing (opt-in by tenant) |

## Risks

- Seasonality detection on services <14 days old is unreliable; v1
  defers detection until 14d of training data exists
- "Anomaly" is fuzzy; without active learning, false positives drift
  into noise. Mitigation: SOL-003 (alert grouping) helps absorb noise

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-009 | refines |
| EVID-015 | informs |


