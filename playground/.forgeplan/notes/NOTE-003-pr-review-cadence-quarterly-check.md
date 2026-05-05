---
depth: tactical
id: NOTE-003
kind: note
status: active
title: PR review cadence quarterly check
---

# NOTE-003: PR review cadence — quarterly check

## Current cadence

- Code review SLA: 1 business day for PRs ≤ 200 lines, 2 days otherwise
- Required reviewers: 1 from CODEOWNERS + 1 cross-team (for
  cross-cutting changes)
- ADR / RFC / PRD review: 1 week comment window before activation

## Quarterly review checklist

Each quarter, the engineering process owner must:

- [ ] Audit PR review SLA breach rate; investigate if > 15%
- [ ] Review merged PR sizes; investigate any > 1500 lines
- [ ] Audit CODEOWNERS coverage — files with no owner should not exist
- [ ] Refresh review templates (.github/PULL_REQUEST_TEMPLATE.md)

## Past quarters

| Quarter | Review breach rate | Notable changes |
|---------|---------------------|-----------------|
| 2026-Q1 | 9% | Added "do-not-merge" label workflow |
| 2025-Q4 | 14% | Reduced required reviewers from 3 to 2 |
| 2025-Q3 | 22% | Started tracking; identified review bottleneck on backend team |

## Out of scope here

- Branch protection (covered in repo-architect tooling)
- Specific reviewer assignment (CODEOWNERS file)

## Related Artifacts

None directly — this is a process note.


