---
depth: tactical
id: EVID-007
kind: evidence
links:
- target: EPIC-002
  relation: informs
status: active
title: 'Chaos drill: AZ failure recovery time measurement'
---

# EVID-007: Chaos drill — AZ failure recovery time

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-03-10 |
| Valid Until | 2026-09-10 |
| Target | EPIC-002 (Multi-region deployment), RFC-008 |
| Author | sre-chaos |

## Structured Fields

evidence_type: test
verdict: weakens
congruence_level: 3

## Scenario

Simulated full AZ failure (eu-west-1a) on staging cluster mirroring
production topology. Drill type: black-box — on-call team paged
without forewarning.

## Method

At 2026-03-08 09:00 UTC, kill all pods in eu-west-1a via
`chaos-mesh PodChaos` (label selector: `topology.kubernetes.io/zone=eu-west-1a`).
Network policy blocks reentry. AZ remains down for 60 min.

Measurements: time to detection, time to mitigation, time to full
recovery, error budget burn during outage.

## Result

| Metric | SLO | Observed |
|--------|-----|----------|
| Detection (auto-alert) | <60s | 47s |
| Failover (read traffic) | <2min | 4min 22s |
| Failover (write traffic) | <5min | 12min 18s |
| Full recovery (post-AZ-restore) | <10min | 23min |
| Data loss during outage | 0 | 0 (replicated) |

Read failover within target (slightly over). **Write failover
breached SLO by 2.5×**. Root cause: control-plane election timeout
fires at 8 min for the ingest coordinator; should be 30s.

## Interpretation

Multi-AZ failover works for reads but not writes within stated SLO.
Before EPIC-002 (multi-region) ships, write-path election timeout
must be tuned. RFC-008 (multi-tenant blast radius isolation) needs
to be re-scoped to include this finding.

## Congruence Level Justification

CL3: drill on staging mirror of production topology with identical
config and traffic shape. Same on-call rotation as prod. Behaviour
observed translates directly to prod (modulo data volume scaling).

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-002 | informs (gap blocks epic) |
| RFC-008 | informs (rescope trigger) |


