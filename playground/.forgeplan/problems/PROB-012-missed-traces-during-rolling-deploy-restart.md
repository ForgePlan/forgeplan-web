---
depth: tactical
id: PROB-012
kind: problem
status: active
title: Missed traces during rolling deploy restart
---

# PROB-012: Missed traces during rolling deploy restart

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-03-12 |
| Severity | Medium (chronic) |
| Owner | sre-platform |

## Symptom

Each rolling deploy of the collector fleet causes ~0.49% trace miss
rate during a 7–9 minute window. Across 12 measured deploys
(EVID-023), this loses an average of 1.7M spans per deploy.

## Customer impact

- 9.4/12 tenants impacted on average per deploy
- 3 of 12 deploys breached SLA (>1% miss rate for >5 min)
- Deploys happen every 1–2 weeks → ~26 deploys/yr × 1.7M = 44M
  spans lost annually

## Root cause

During SIGTERM, collector pods stop accepting new connections but
have ~30s drain time. Two issues:
1. Long-lived keep-alive connections from clients are severed mid-
   request → batch lost
2. New pods aren't pre-warmed; first 5s of life see slow ingest as
   connections trickle in

## Mitigations available

- SOL-006 (pre-warmed dual-fleet rotation): bring new fleet to
  readiness BEFORE any old pod is terminated; clients gradually
  migrate to new fleet
- Increase drain time to 60s (partial mitigation; doesn't address
  pre-warm gap)

## Long-term fix

SOL-006 deployment.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-023 | informs |
| SOL-006 | refines |


