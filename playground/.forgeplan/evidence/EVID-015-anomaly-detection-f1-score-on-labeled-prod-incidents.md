---
depth: tactical
id: EVID-015
kind: evidence
links:
- target: PRD-009
  relation: informs
status: active
title: Anomaly detection F1-score on labeled prod incidents
---

# EVID-015: Anomaly detection F1-score on labeled prod incidents

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-30 |
| Valid Until | 2026-10-30 |
| Target | RFC-011 (statistical vs ML approach), PRD-009 |
| Author | ml-platform |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 2

## Method

Manually labelled 142 production incidents (2025-Q4 + 2026-Q1) as
anomaly / normal / unclear. For each, replayed corresponding telemetry
through 3 candidate detectors:

1. EWMA + 3-sigma threshold (statistical baseline)
2. Seasonal Hybrid ESD (statistical, season-aware)
3. Isolation Forest with hourly retraining (ML)

## Result

| Detector | Precision | Recall | F1 | False alerts/day (per 100 services) |
|----------|-----------|--------|----|--------------------------------------|
| EWMA + 3σ | 0.62 | 0.81 | 0.70 | 14.2 |
| Seasonal Hybrid ESD | 0.78 | 0.74 | 0.76 | 5.1 |
| Isolation Forest | 0.84 | 0.79 | 0.81 | 4.3 |

ML detector wins on F1 (+0.05) with the lowest false-alert rate.
Statistical detector competitive at fraction of operational cost.

## Interpretation

The 0.05 F1 gap may not justify the operational overhead of training
pipelines, model versioning, and explainability. Recommend phase-1
ship statistical (Seasonal Hybrid ESD) and revisit ML in 2027 once
team capacity for MLOps lands.

## Congruence Level Justification

CL2: real production incidents but historical replay (not live).
Sample skews toward severe incidents (those that warranted manual
investigation); precision on minor anomalies under-measured.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-011 | informs (decision) |
| PRD-009 | informs (rule engine scope) |


