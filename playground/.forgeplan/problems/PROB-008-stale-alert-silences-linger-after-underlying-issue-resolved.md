---
depth: tactical
id: PROB-008
kind: problem
links:
- target: PRD-003
  relation: informs
status: active
title: Stale alert silences linger after underlying issue resolved
---

# PROB-008: Stale alert silences linger after underlying issue resolved

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-04-04 |
| Severity | Medium |
| Owner | alerting-eng |

## Symptom

When an SRE silences an alert during incident response, the silence
remains active long after the root cause is fixed. Customers report
discovering 6-month-old silences masking real signals during follow-up
incidents.

## Investigation

Helios silences default to "indefinite" (no TTL). Once silenced,
unless someone explicitly removes it, the silence persists.

Audit on `acme-corp` tenant (sample, 30-day):
- 142 silences created
- 38 of those silences had matching alerts that no longer fired for >30 days
- Only 4 silences explicitly removed
- The remaining 96 stayed active "for now" — accidental long-term mutes

## Customer feedback

Several customers asked for "auto-expire silences if their alerts
haven't fired in N days". This was an unprompted ask in 6/12
interviews (EVID-005 follow-up).

## Mitigations available

- Default new silences to 7-day TTL with explicit "indefinite" opt-in
- Periodic audit / nag email to silence creator if alert hasn't fired
  in N days
- UI surfacing "stale silences" report

## Status

In design; tied to PRD-003 alerting rules engine v2 work.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-003 | informs (feature scope) |


