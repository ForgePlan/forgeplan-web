---
depth: tactical
id: EVID-004
kind: evidence
links:
- target: PROB-001
  relation: informs
status: active
title: 'Production incident INC-204: ingest backlog postmortem'
---

# EVID-004: Production incident INC-204 — ingest backlog postmortem

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-02 |
| Valid Until | 2027-04-02 |
| Target | PROB-001, PROB-002 |
| Author | sre-incident-response |
| Severity | SEV-2 |

## Structured Fields

evidence_type: audit
verdict: supports
congruence_level: 3

## Incident summary

On 2026-03-29 at 14:22 UTC, ingest backlog grew from <1s lag to 14 min
lag over 23 minutes. Two tenants (acme-corp, globex) breached the
3-min ingest SLO. Mitigation by manual horizontal scaling (collector
fleet 12 → 24 pods); full recovery at 15:08 UTC.

## Timeline

| Time (UTC) | Event |
|------------|-------|
| 14:22 | Ingest lag alert fires (SLO 3 min, observed 4 min) |
| 14:31 | Lag at 9 min; on-call paged (severity escalated) |
| 14:39 | RCA: collector OOMKilled cascade due to memory leak under burst |
| 14:44 | Mitigation: doubled fleet, triggered Kafka rebalance |
| 15:08 | Lag returns to <30s; incident resolved |

## Root cause

The 09:00 UTC traffic peak from CI fleet (2.3× normal) hit the unbounded
batch buffer described in EVID-003. Successive collector pods OOMKilled,
shifting load to remaining pods and accelerating the cascade.

## Contributing factors

1. No bounded-buffer backpressure (PROB-002) — primary cause.
2. Alert threshold (3 min lag) too lenient; should fire at 60s.
3. HPA scaled on CPU, not on Kafka consumer lag.

## Action items

- [x] Hotfix: 8 GB memory limit per collector pod (deployed 2026-03-30)
- [ ] SOL-002: bounded-buffer backpressure (in progress)
- [ ] Alert tuning: lag threshold 60s, page on burst rate (open)
- [ ] HPA: scale on consumer lag, not CPU (open, blocked on metric pipeline)

## Congruence Level Justification

CL3: real production incident on the exact target system; not a drill,
not a synthetic reproduction.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-001 | informs (latency tail tied to ingest backpressure) |
| PROB-002 | informs (memory leak directly caused cascade) |


