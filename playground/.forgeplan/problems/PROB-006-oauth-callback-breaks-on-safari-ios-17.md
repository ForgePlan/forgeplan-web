---
depth: tactical
id: PROB-006
kind: problem
status: draft
title: OAuth callback breaks on Safari iOS 17
---

# PROB-006: OAuth callback breaks on Safari iOS 17

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-03-15 |
| Severity | High (blocks mobile companion app) |
| Owner | frontend-eng + auth |

## Symptom

On Safari iOS 17.0–17.3, the OAuth2 authorization code callback flow
fails: after successful IdP redirect back to Helios, the session
cookie is not retained, and the user lands on the login screen
again. Reproducible 100% of attempts on iOS 17.

Older iOS Safari (≤16.6) and Safari macOS 17 are unaffected.

## Investigation

EVID-009 (browser compat matrix) traces this to iOS 17's stricter
cross-origin cookie partitioning. The callback URL was being processed
via fetch from a partial-page hydration, not as a top-level navigation.
iOS 17 partitions the cookie under the IdP's origin instead of the
Helios origin in this path.

Key trigger: `Set-Cookie` from a `fetch()` response in iOS 17 is
treated as third-party even when the request is same-site, if the
navigation chain includes a different origin.

## Impact

- iOS 17 users: 100% blocked from logging in (auto-update is
  ubiquitous; ~80% of iOS users have moved to 17+)
- PRD-008 (mobile companion app) is blocked from GA on iOS until fix
- Approximate revenue impact: 18% of customer base uses iOS daily

## Workarounds

Customers who ran into this:
- Some tenants: log in on Mac, then mobile via "trust this browser"
  flow (works but unergonomic)
- Some tenants: revert to iOS 16.6 (not realistic)

## Fix path

Restructure callback to:
1. IdP redirect lands on a top-level navigation (not fetch)
2. Server processes code exchange, sets session cookie via 302
   redirect (not via fetch response)
3. Client lands on dashboard with cookie intact

Tracked in SPEC-007 (auth token refresh flow) revision.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-009 | informs (compat matrix) |
| SPEC-007 | refines (fix design) |
| PRD-008 | informs (blocks mobile GA) |
| PRD-006 | informs (OAuth scope) |

