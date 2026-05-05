---
depth: tactical
id: PROB-003
kind: problem
status: active
title: 'Alert fatigue: 70 percent of alerts ignored by on-call'
---

# PROB-003: Alert fatigue — 70% of alerts ignored by on-call

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-02-08 (compiled from 12 customer interviews) |
| Severity | Medium (chronic, not acute) |
| Owner | product + alerting-eng |

## Symptom

Customer SREs ignore the majority of alerts fired by Helios. EVID-005
(12 SRE interviews) found median alert silence/non-action rate of
70%. Of silenced alerts:
- 40% were duplicates of an alert from the past 5 min
- 30% were transient blips that self-resolved
- 30% were alerts on rules the SRE no longer trusted

## Customer impact

- NPS for "alerting" feature: +12 (lowest of 9 tracked sub-features)
- Retention risk: 3 customers in 2026-Q1 cited alerting noise as a
  reason for not expanding usage
- Real signal lost: at least one customer reported missing a real
  outage because of "the same alert fires 50 times so I muted it"

## Root causes (per EVID-005)

1. **No grouping**: each rule fires independently; one symptom across
   10 services = 10 alerts.
2. **Severity is broken**: 8/12 SREs said "everything is P2", so they
   ignore severity entirely.
3. **Storm during incidents**: dozens of alerts fire at once; SRE
   silences all to focus, then forgets to unsilence.

## Out-of-product workarounds

- 9/12 SREs maintain a private mute list (Slack reactions, Notion
  pages). Helios has no visibility into these.
- 4/12 disabled Slack notifications entirely; only watch dashboards
  during on-call shift.

## Long-term fix

SOL-003: smart alert grouping with dedup windows. Group fired alerts
by (service, symptom-fingerprint) within a configurable window
(default 5 min); deliver one rolled-up alert with member list.

PRD-003 elevates grouping to P0 in the alerting v2 scope.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-005 | informs (user research) |
| SOL-003 | refines (fix) |
| PRD-003 | refines (product response) |


