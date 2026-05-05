---
depth: standard
id: PRD-007
kind: prd
status: draft
title: Web stale + blind-spot push notifications
---

# PRD-007: Web stale + blind-spot push notifications

## Problem

Workspace health changes between sessions, but `@forgeplan/web` requires
the user to actively look at the dashboard. By the time someone opens the
browser tab, R_eff has decayed, evidence has gone stale, or a new
blind_spot appeared. The Lance index tracks decay timestamps; the UI
ignores them in any active sense.

**Impact**: Decay catches the team off-guard. A PRD whose evidence aged
past `valid_until` shows up as a problem at PR review time, not when it
happened. Forgeplan's main value-prop (evidence half-life) is invisible to
anyone not running `forgeplan health` daily.

## Target Users

| Persona          | Description                | Pain                                                 |
| ---------------- | -------------------------- | ---------------------------------------------------- |
| Active developer | switches Slack / IDE / web | misses health degradation between glances            |
| Tech lead        | owns workspace health      | finds decay at PR review, too late                   |
| Stakeholder      | weekly check-in            | full week of decay accumulated; impossible to triage |

## Goals

| ID   | Criterion                                                | Metric                                    | Target              | How to measure |
| ---- | -------------------------------------------------------- | ----------------------------------------- | ------------------- | -------------- |
| SC-1 | User can opt-in to push notifications via toggle         | DOM `button[data-action="toggle-notify"]` | functional          | Playwright     |
| SC-2 | Permission flow handles granted/denied/default correctly | unit tests on 3 states                    | 3/3                 | vitest         |
| SC-3 | New blind_spot fires `Notification`                      | mock health → observe ctor call           | called              | vitest         |
| SC-4 | Stale-count increase fires once per delta                | digest dedup                              | 1/delta             | vitest         |
| SC-5 | Opt-in state persists in localStorage                    | `forgeplan-web.notify` key                | true after toggle   | Playwright     |
| SC-6 | HealthBar shows current opt-in state                     | `.notify-status` visible                  | badge present       | DOM            |
| SC-7 | Notification click focuses tab + selects artifact        | manual flow                               | user lands on panel | manual         |
| SC-8 | svelte-check 0/0                                         | shell                                     | 0/0                 | shell          |
| SC-9 | smoke matrix 3-OS green                                  | gh pr checks                              | 3/3                 | CI             |

## Non-Goals

- No Service Worker — `Notification` API works from main thread.
- No native OS push (FCM/APNs).
- No notification on every R_eff jiggle — only blind_spot increase / stale increase / new orphan.
- No alarm sound — `silent: true`.
- No multi-tab dedup (BroadcastChannel deferred).

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                                              | Acceptance                                   |
| ------ | ------------- | -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| FR-001 | Core          | Must     | User can toggle "Notify on health changes" in HealthBar                                  | Toggle + persistent state                    |
| FR-002 | Core          | Must     | First toggle-on triggers `Notification.requestPermission()`                              | Permission flow runs once; UI reflects state |
| FR-003 | Core          | Must     | When permission is `denied`, toggle is disabled with tooltip explaining how to re-enable | DOM `disabled` + `title`                     |
| FR-004 | Core          | Must     | New blind_spot fires `Notification` with title + link                                    | `new Notification(...)` called               |
| FR-005 | Core          | Must     | Stale-count increase fires (dedup by id-set digest)                                      | digest in localStorage; fire only on diff    |
| FR-006 | UX            | Should   | Notification click focuses tab + sets `selectedId` to affected artifact                  | `notification.onclick` handler               |
| FR-007 | UX            | Should   | At most 1 notification per category per 60 s                                             | timestamp gating                             |
| FR-008 | A11y          | Must     | `aria-live="polite"` mirror in HealthBar                                                 | hidden live region                           |
| FR-009 | Documentation | Should   | CHANGELOG `[Unreleased]` lists FR-001..FR-008                                            | grep                                         |

## Non-Functional Requirements

| ID      | Category | Requirement                                               | Metric                                          | Method    |
| ------- | -------- | --------------------------------------------------------- | ----------------------------------------------- | --------- |
| NFR-001 | Bundle   | No new npm deps; pure-frontend                            | `git diff template/package.json` empty for deps | shell     |
| NFR-002 | Privacy  | No body content in notification payload — only id + title | code review                                     | review    |
| NFR-003 | Compat   | Graceful fallback when Notification API absent            | `if (!('Notification' in window))` guard        | unit test |
| NFR-004 | Throttle | ≤ 1 notification per category per 60 s                    | unit test                                       | vitest    |
| NFR-005 | A11y     | Live region announced by VoiceOver / NVDA                 | manual                                          | manual    |

## Affected Files

- `template/src/widgets/health-bar/ui/HealthBar.svelte` (toggle + live region)
- `template/src/entities/health/lib/notify.svelte.ts` (new — permission + dispatch + throttle)
- `template/src/entities/health/lib/notify.test.ts` (new)
- `template/src/pages/home/lib/settings.ts` (persist pref)
- `CHANGELOG.md`

## Related Artifacts

| Artifact | Relation                                        | Status  |
| -------- | ----------------------------------------------- | ------- |
| RFC-006  | Architecture — permission UX + breach detection | planned |
| EVID-015 | Acceptance pack                                 | planned |

## Risks & Mitigations

| ID  | Risk                                   | Prob   | Impact | Mitigation                                     |
| --- | -------------------------------------- | ------ | ------ | ---------------------------------------------- |
| R-1 | User dismisses permission → stuck off  | High   | Low    | Tooltip explains browser-settings re-enable    |
| R-2 | Notifications spam                     | Medium | Medium | Throttle 1/min per category (FR-007)           |
| R-3 | Multi-tab duplicate notifications      | Medium | Low    | Document limitation; BroadcastChannel deferred |
| R-4 | Browser w/o Notification API breaks UI | Low    | High   | Feature-detect; toggle hidden when unsupported |
| R-5 | Body content leaks to notification     | Low    | High   | NFR-002 — only id + title                      |
