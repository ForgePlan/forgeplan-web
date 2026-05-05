---
depth: tactical
id: PROB-007
kind: problem
status: deprecated
title: Tenant onboarding silently fails 8 percent of attempts
---

# PROB-007: Tenant onboarding silently fails 8% of attempts

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-04-30 |
| Severity | High (revenue impact) |
| Owner | growth + platform-eng |

## Symptom

EVID-018 funnel analysis (n=1,847) shows 8% of users who attempt
onboarding past the form never ingest a span. They don't error; they
just disappear. No support ticket created — they churn silently.

## Root cause distribution

From EVID-018:
- 41% workspace provisioning hung at "PROVISIONING"
- 24% API key issued but quota not allocated
- 18% OAuth callback dropped (PROB-006 related, iOS)
- 11% tenant ID collision retry failed
- 6% other

## Impact

8% of paid-tier conversions lost. At 2026 sign-up rate, this is
~$240k annualised lost revenue assuming median plan size.

## Investigation

Server logs show the operator (ADR-007) waits indefinitely on a
Postgres advisory lock when concurrent provisioning hits the same
shard. The lock is intentional (prevents duplicate IDs) but lacks
a timeout — wedged stays wedged.

## Mitigations applied

- Added 5-min timeout on advisory lock acquisition (deployed 2026-05-02)
- Operator emits `provisioning.timeout` metric on lock failures

## Long-term fix

SOL-009 (onboarding flow self-healing retry chain) — the operator
detects stuck states and attempts targeted recovery: retry a single
sub-resource without re-running the whole flow.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-018 | informs |
| SOL-009 | refines (fix) |
| ADR-007 | informs (operator pattern) |



