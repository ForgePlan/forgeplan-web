---
depth: tactical
id: EVID-019
kind: evidence
links:
- target: PRD-016
  relation: informs
status: active
title: 'Customer interviews: 8 enterprise admins on hierarchy needs'
---

# EVID-019: Customer interviews — 8 enterprise admins on hierarchy needs

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-12 |
| Valid Until | 2026-10-12 |
| Target | PRD-016 (Multi-account organization hierarchy) |
| Author | product-research |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 2

## Sample

8 enterprise customer admins (5 Fortune 500, 3 mid-market). All
managing 50+ engineering team accounts internally. 60-min interviews,
recorded, coded jointly by 2 researchers.

## Findings

1. **All 8 reported the current "single tenant per company" model as
   a blocker.** Most have 6–40 internal "engineering tribes" wanting
   data separation while sharing billing.
2. **5/8 want billing rolled up across sub-accounts;** 2 want separate
   billing per division; 1 indifferent.
3. **6/8 require RBAC scoped to sub-account;** the remaining 2 use a
   bridge directory and want claims-based mapping.
4. **Top fear: cross-pollination of alert noise across teams** — this
   is the #1 reason they want sub-tenants instead of just tagging.

## Quote (anonymised)

> "We bought one big Helios contract because the admin couldn't
> stomach negotiating 12 separate ones. But now my SREs are seeing
> alerts from the marketing analytics team's services. That's
> exactly the noise we were trying to escape."
> — VP Eng, financial-services customer

## Implications for PRD-016

- Hierarchy MUST support: rollup billing + per-sub-account RBAC
- Cross-account data sharing should be opt-in, NEVER default
- Migration path from current single-tenant model is critical
  (4/8 customers won't migrate if they lose existing dashboards)

## Congruence Level Justification

CL2: qualitative interviews, n=8, not statistical; but interviewees
are high-leverage decision-makers and themes are unanimous.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-016 | informs |
| SPEC-014 | informs (data model) |


