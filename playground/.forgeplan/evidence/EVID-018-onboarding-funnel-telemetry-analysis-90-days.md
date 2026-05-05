---
depth: tactical
id: EVID-018
kind: evidence
links:
- target: PROB-007
  relation: informs
status: active
title: Onboarding funnel telemetry analysis 90 days
---

# EVID-018: Onboarding funnel telemetry analysis (90-day window)

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-05-01 |
| Valid Until | 2026-11-01 |
| Target | PROB-007 (silent onboarding failures) |
| Author | growth-analytics |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Funnel (n = 1,847 sign-ups, 2026-02 to 2026-04)

| Step | Reached | Conversion | Drop notes |
|------|---------|------------|------------|
| Sign-up form submitted | 1,847 | — | — |
| Email verified | 1,734 | 93.9% | normal |
| Workspace created | 1,720 | 99.2% | minor: 14 timed out |
| OTel SDK link clicked | 1,589 | 92.4% | normal |
| First span ingested | 1,487 | 93.6% | — |
| First dashboard saved | 1,243 | 83.6% | drop is product-shape |
| Activated (7-day retention) | 1,189 | 95.7% | — |

## Silent failure analysis (PROB-007)

Of the 232 (1,847 − 1,615 effectively activated), **8% (151)**
showed evidence of attempting onboarding past the form but never
ingesting a span. Server-side traces revealed:

| Failure cause | % of silent failures |
|---------------|----------------------|
| Workspace provisioning hung at "PROVISIONING" | 41% |
| API key issued but no quota allocated | 24% |
| OAuth callback dropped (PROB-006 related, iOS) | 18% |
| Edge case: tenant ID collision retry failed | 11% |
| Other / unclassified | 6% |

## Interpretation

The 41% "PROVISIONING hung" matches the operator pattern noted in
ADR-007 — operator's reconciliation can stall when concurrent
provisioning hits a Postgres advisory-lock contention. SOL-009 (self-
healing retry chain) should specifically cover this case.

## Congruence Level Justification

CL3: real production funnel telemetry, no extrapolation; all silent-
failure cases triaged manually with server traces.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-007 | informs (root cause distribution) |
| SOL-009 | informs (fix design) |


