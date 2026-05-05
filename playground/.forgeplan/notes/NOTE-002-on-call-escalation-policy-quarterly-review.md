---
depth: tactical
id: NOTE-002
kind: note
status: active
title: On-call escalation policy quarterly review
---

# NOTE-002: On-call escalation policy — quarterly review

## Current rotation (2026-Q2)

- Primary: 1-week rotation, 6 engineers in pool
- Secondary: 1-week rotation, separate 6-engineer pool, paged after
  primary unanswered for 5 min
- Manager-on-call: 1-week rotation, paged for SEV-2+
- Customer-comms: same as manager-on-call (single role for now)

## Page targets

| Severity | Primary | Secondary | Manager | Comms |
|----------|---------|-----------|---------|-------|
| SEV-1 | immediate | immediate | immediate | immediate |
| SEV-2 | immediate | +5 min | +5 min | + after triage |
| SEV-3 | immediate | (no page) | (no page) | n/a |
| SEV-4 | next business day | (no page) | (no page) | n/a |

## Quarterly review checklist

Each quarter, the platform team lead must:

- [ ] Audit page volume per engineer; rebalance if any single person
      took >25% of pages
- [ ] Audit non-actionable pages (those that result in "ack and
      ignore"); reduce noisy alerts via SOL-003 grouping
- [ ] Tabletop a SEV-1 scenario with the rotating team
- [ ] Update this note with rotation membership changes

## Review history

| Quarter | Reviewer | Outcome |
|---------|----------|---------|
| 2026-Q1 | platform-lead | Reduced SEV-3 pages 38%; 1 engineer rotated out |
| 2025-Q4 | platform-lead | Established secondary rotation |
| 2025-Q3 | platform-lead | Initial draft of this policy |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-003 | informs (alert fatigue motivates dedup work) |


