---
depth: tactical
id: PROB-013
kind: problem
status: deprecated
title: Customer-reported double-billed usage spikes
---

# PROB-013: Customer-reported double-billed usage spikes

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-03-15 |
| Severity | High (financial) |
| Owner | sre-incident-response + finance |

## Symptom

INC-217 (EVID-024 postmortem): 4 enterprise tenants saw daily usage
meters jump exactly 2× over a 7-hour window. Customer support tickets
identified the issue before our internal monitoring did.

## Root cause

Bug introduced 2026-03-14 22:48 UTC: new code path inadvertently
incremented daily usage counter both during initial aggregation AND
during cross-region replication catch-up. Affected tenants resided in
the region where mid-rollout code-version skew applied.

## Impact

- 4 tenants with double-billed usage
- Manual invoice correction required ($82k in adjustments)
- Trust damage: customers found this before we did

## Mitigations applied

- Hotfix deployed 2026-03-15 09:00 UTC; double-counting halted
- Customer notification within 2h of detection
- All 4 invoices corrected manually before issuance

## Long-term fix

SOL-007 (idempotent meter aggregation with sequence numbers): each
aggregation event is associated with a monotonic sequence; second
application with same sequence is a no-op. Removes the entire class
of double-counting bugs.

Additionally, an SLO has been added: daily total must equal sum of
minute rollups within 0.5%. Page on breach.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-024 | informs (postmortem) |
| SOL-007 | refines (fix) |



