---
depth: tactical
id: EVID-024
kind: evidence
links:
- target: PROB-013
  relation: informs
status: active
title: Postmortem INC-217 double billing event
---

# EVID-024: Postmortem INC-217 — double billing event

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-03-18 |
| Valid Until | 2027-03-18 |
| Target | PROB-013 (double-billed usage spikes) |
| Author | sre-incident-response + finance |
| Severity | SEV-2 |

## Structured Fields

evidence_type: audit
verdict: supports
congruence_level: 3

## Incident summary

On 2026-03-15, customer support tickets reported that 4 enterprise
tenants saw their daily usage meters jump 2× over the previous 24h.
Usage spike happened over a 7-hour window beginning 2026-03-14 23:00
UTC. Affected tenants: acme-corp, globex, initech, soylent.

## Investigation

Usage meter pipeline is:
```
ingest → meter aggregator → minute rollup → daily aggregate → invoice
```

Telemetry showed daily aggregate values exactly 2× the minute-rollup
sums for the affected tenants for the affected window. Other tenants
unaffected.

Root cause: a bug introduced in the daily aggregator on 2026-03-14
22:48 UTC during a routine deploy. New code path inadvertently
incremented the daily counter both during initial aggregation AND
during the cross-region replication catch-up step. Other tenants
unaffected because they reside in regions where replication catch-up
ran on a different code version (mid-rollout).

## Mitigation

- Hotfix deployed 2026-03-15 09:00 UTC
- Affected tenant invoices manually corrected before issue
- Customer notification sent within 2h of detection

## Root-cause fix

SOL-007 (idempotent meter aggregation with sequence numbers) makes
aggregation idempotent — repeated execution produces the same
result. Sequence numbers prevent double-counting during replay or
catch-up.

## Lessons

- No telemetry alerted us to the doubling; customers found it first.
  Add an SLO: daily total must equal sum of minute rollups within
  0.5%. Page on breach.
- Cross-region replication has subtle code-version skew during
  rollouts. Need to harden the replication path with version
  compatibility tests.

## Congruence Level Justification

CL3: real production incident, audit trail intact, root cause
forensically confirmed.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-013 | informs |
| SOL-007 | informs (fix) |


