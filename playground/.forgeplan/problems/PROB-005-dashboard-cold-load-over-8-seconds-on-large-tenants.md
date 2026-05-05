---
depth: tactical
id: PROB-005
kind: problem
links:
- target: PRD-008
  relation: informs
status: deprecated
title: Dashboard cold load over 8 seconds on large tenants
---

# PROB-005: Dashboard cold load > 8s on large tenants

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-03-12 |
| Severity | Medium |
| Owner | frontend-eng |

## Symptom

For tenants with > 100 services and > 50 saved dashboards, the
dashboard SPA cold load (first paint after browser cache miss) takes
8–14 seconds on a 4G connection. Onboarding-call NPS surveys cited
"dashboard is slow on phone" as the #1 surprise after sign-up.

## Investigation

Cold-load waterfall (4G, large tenant):

| Phase | Time |
|-------|------|
| TLS + DNS | 250 ms |
| HTML download | 80 ms |
| `/api/list` (blocking) | 2,400 ms |
| JavaScript bundle (590 KB gzipped) | 3,600 ms |
| Hydration + first paint | 1,800 ms |
| **Total to first interactive** | **~8.1 s** |

Three contributors:
1. `/api/list` returns ALL artifacts; large tenants have 800+. Should
   paginate or stream.
2. JS bundle includes the force-directed graph library (180 KB) on
   every page, even where it's not used.
3. Hydration is single-threaded; large initial state trees stall
   the main thread.

## Impact

- Onboarding NPS: cited by 31% of new accounts
- Mobile use specifically penalised: 4G + ARM CPU = worst case

## Long-term fix

RFC-009 (SSR vs CSR tradeoffs): server-render critical paths,
lazy-load heavy components, paginate list endpoint.

PRD-008 (mobile companion app) takes a different approach: build
focused mobile UI rather than retrofitting the dashboard.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-009 | refines (fix path) |
| PRD-008 | informs (alternative path) |



