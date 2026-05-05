---
depth: tactical
id: EVID-009
kind: evidence
links:
- target: PROB-006
  relation: informs
status: active
title: Browser compatibility matrix for dashboard SPA
---

# EVID-009: Browser compatibility matrix for dashboard SPA

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-03-15 |
| Valid Until | 2026-09-15 |
| Target | PRD-008 (Mobile dashboard companion app), PROB-006 (OAuth Safari iOS 17) |
| Author | frontend-eng |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Method

Automated Playwright matrix on BrowserStack covering 14 browser
versions × 3 viewports (desktop, tablet, mobile). Test suite: 142
critical-path scenarios (login, query, dashboard render, alert ack,
export).

## Result

| Browser | Versions tested | Pass rate | Notable failures |
|---------|-----------------|-----------|------------------|
| Chrome | 119–122 | 100% | none |
| Firefox | 121–123 | 100% | none |
| Safari (macOS) | 16.4, 17.0, 17.3 | 99.3% | export-csv fails on 17.0 only |
| Safari (iOS) | 16.6, 17.0, 17.3 | 87% | OAuth callback breaks on 17.0+ (PROB-006) |
| Edge | 120–122 | 100% | none |
| Samsung Internet | 23.0 | 96.5% | minor layout in graph zoom |
| WebView (Android) | Chrome 119 base | 100% | none |

## Critical findings

1. **Safari iOS 17.0+: OAuth callback breaks** — `redirect_uri` with
   `localhost`-style dev cert triggers iOS 17's stricter cross-origin
   handling. Reproducible 100% on iOS 17.0, 17.1, 17.2, 17.3.
   Workaround: `prompt=none` + sandbox redirect domain.
2. **Safari macOS 17.0**: CSV export fails due to a regression in the
   File API. Fixed in 17.1+; we should detect and warn.
3. **Samsung Internet**: zoom on force-directed graph occasionally
   misregisters touches. Cosmetic only.

## Interpretation

Mobile SPA is broadly compatible except for the Safari iOS 17 OAuth
issue, which is a hard blocker for that platform. PROB-006 must be
fixed before PRD-008 (mobile companion app) GA.

## Congruence Level Justification

CL3: real browsers (BrowserStack physical devices for Safari iOS),
critical-path tests reflect actual user flows. No simulated devices
in counted results.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-008 | informs (compat scope) |
| PROB-006 | informs (root cause + fix path) |


