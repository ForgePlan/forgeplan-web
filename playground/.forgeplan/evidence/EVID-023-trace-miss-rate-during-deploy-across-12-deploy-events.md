---
depth: tactical
id: EVID-023
kind: evidence
links:
- target: PROB-012
  relation: informs
status: active
title: Trace miss rate during deploy across 12 deploy events
---

# EVID-023: Trace miss rate during deploy — 12 deploy events

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-29 |
| Valid Until | 2026-10-29 |
| Target | PROB-012 (Missed traces during rolling deploy) |
| Author | sre-platform |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Method

Tracked 12 production deploys (rolling restart of collector fleet,
24 pods total) from 2026-03 through 2026-04. For each, measured:

- Trace miss rate during the deploy window (10 min)
- Total spans dropped per deploy
- Per-tenant impact (some tenants more sensitive than others)

## Result

| Deploy | Duration | Miss rate | Spans dropped | Tenants impacted |
|--------|----------|-----------|---------------|------------------|
| 1 | 7 min | 0.42% | 1.4M | 8/12 |
| 2 | 8 min | 0.58% | 1.9M | 9/12 |
| ... | ... | ... | ... | ... |
| 12 | 9 min | 0.51% | 1.7M | 11/12 |

| Aggregate | Value |
|-----------|-------|
| Mean miss rate | 0.49% |
| Mean spans dropped per deploy | 1.7M |
| Tenants impacted (mean) | 9.4/12 |
| SLA breach incidents | 3 of 12 |

## Cause

During SIGTERM, collector pods stop accepting new connections but
have ~30s to drain in-flight batches before SIGKILL. Two issues:

1. Some clients have keep-alive past 30s → connection severed mid-
   request → spans for that batch lost
2. New pods aren't pre-warmed; first 5s of life see slow ingest as
   connections trickle in

## Interpretation

SOL-006 (pre-warmed dual-fleet rotation) is the correct fix — bring
new fleet to readiness before any old pod is terminated. Will also
address tail latency during deploy events.

## Congruence Level Justification

CL3: production deploys, real customer traffic, full-fidelity span
counting.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-012 | informs |
| SOL-006 | informs (fix design) |


