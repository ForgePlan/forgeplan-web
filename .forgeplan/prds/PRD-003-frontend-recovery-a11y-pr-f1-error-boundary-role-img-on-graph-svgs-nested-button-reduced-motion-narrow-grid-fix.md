---
created: 2026-05-04
depth: standard
id: PRD-003
kind: prd
priority: P1
status: active
title: 'Frontend recovery + a11y (PR F1): error boundary, role=img on graph SVGs, nested button, reduced-motion, narrow-grid fix'
updated: 2026-05-04
---

# PRD-003: Frontend recovery + a11y (PR F1)

## Problem

Today's multi-expert code audit (`frontend-auditor` domain) flagged **5
HIGH** issues on the SvelteKit UI of `@forgeplan/web`. None blocks
release; together they erode robustness and accessibility of the npm
package's UX:

- **HIGH-1 — no `+error.svelte`.** Any throw in a `$effect` (e.g. one of
  the 8 pollers on `HomePage`) crashes the app to the default unstyled
  SvelteKit error page. Users see a generic "500 Internal Error" with no
  recovery path. SvelteKit ships error boundary primitives — the repo
  doesn't use them.

- **HIGH-2 — `<li role="button">` with `svelte-ignore` suppression.**
  `InsightsRail.svelte:114-122,142-150` use `role="button"` on `<li>` +
  `tabindex="0"` + a comment-suppressed a11y rule. This bypasses the
  rule rather than fixing it; nested `<button>` inside the `<li>` is the
  conformant pattern. Keyboard focus order is currently masked.

- **HIGH-3 — `role="application"` on 5 graph SVGs.** All views
  (`Force/Lanes/Matrix/Radial/Tree`) declare `role="application"` —
  screen readers treat that as "do not interpret content". Today these
  views have only click interaction, no custom keyboard navigation —
  `role="img"` + an `aria-label` describing the graph is the correct
  semantic.

- **HIGH-4 — no `prefers-reduced-motion` handling.** Force simulation
  runs full physics, and `Tree/Radial/Matrix/Lanes` use
  `.transition().duration(300)` on `fitToView`. Users with vestibular
  disorders or motion sensitivity get unmitigated animation.

- **HIGH-5 — `.has-panel` grid breaks at < 1100 px.**
  `HomePage.svelte` declares `grid-template-columns: 200px 1fr 320px
380px` (4 columns) but at narrow viewports the media query hides
  `.rail` while keeping the markup with 4 children — yields an
  implicitly-flowed 4th item in a 3-col grid. Layout misaligns the
  moment a node is selected on viewport < 1100 px.

**Impact**: package looks polished on the marketing screenshot, but a
power user opening an artifact panel on a 13" laptop sees a broken
layout; an error in the polling stack crashes the whole UI; assistive
technology users get a hostile experience on the graph view.

## Target Users

| Persona                               | Description                                                | Pain                                                                          |
| ------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| End-user developer (laptop ≤ 1100 px) | Runs `npx @forgeplan/web start`, opens at `localhost:5174` | `.has-panel` 4-col grid misaligns when artifact panel opens                   |
| Assistive technology user             | Screen-reader / keyboard-only                              | `role="application"` mutes graph; `role="button"` on `<li>` traps focus order |
| User with motion sensitivity          | OS sets `prefers-reduced-motion: reduce`                   | Force simulation + 300 ms transitions ignore the preference                   |
| Any user                              | Hits a transient API failure / poll error                  | App crashes to the generic unstyled SvelteKit error page                      |

## Goals

| ID   | Criterion                                                                                       | Metric                                                                   | Target                                      | How to measure |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- | -------------- |
| SC-1 | `template/src/routes/+error.svelte` exists and renders custom UI                                | `test -f` + grep `<h1>`                                                  | file exists, has heading                    | shell          |
| SC-2 | All 5 graph views use `role="img"`, not `role="application"`                                    | grep `role="application"` in `template/src/widgets/dependency-graph/ui/` | 0 matches                                   | shell          |
| SC-3 | `InsightsRail.svelte` has no `svelte-ignore a11y_no_noninteractive_element_to_interactive_role` | grep                                                                     | 0 matches                                   | shell          |
| SC-4 | `prefers-reduced-motion` guards present in graph views                                          | grep `prefers-reduced-motion` in `widgets/dependency-graph`              | ≥ 1 match per file using `.transition`      | shell          |
| SC-5 | `.has-panel` layout aligned at viewport < 1100 px                                               | manual viewport test in dev tools                                        | no orphan 4th item, panel renders correctly | manual         |
| SC-6 | Smoke matrix 3/3 OS × Node 22 green                                                             | `gh pr checks`                                                           | 3/3 pass                                    | CI             |
| SC-7 | `svelte-check` 0 errors / 0 warnings after changes                                              | `npx svelte-check` in template/                                          | 0/0                                         | shell          |

## Non-Goals

- Do **not** split `InsightsRail.svelte` (680 LOC) yet — that's PR F2.
- Do **not** extract `useZoomPan()` composable — also F2.
- Do **not** introduce a new error-tracking dep (Sentry, etc.) — `+error.svelte` is markup-only.
- Do **not** add Force-view keyboard pan/zoom to justify keeping `role="application"` — out of scope; if user asks, we can add it as a follow-up and revert that one role.
- Do **not** redesign the layout at narrow widths — minimum viable fix to the grid mismatch.

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                                                                                                               | Acceptance                                                                |
| ------ | ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| FR-001 | Recovery      | Must     | Add `template/src/routes/+error.svelte` with a styled error UI showing status, message, and a "go home" link                                              | file exists, renders status code + message + nav link                     |
| FR-002 | A11y          | Must     | Replace `role="application"` with `role="img" aria-label="..."` on `ForceView`, `LanesView`, `MatrixView`, `RadialView`, `TreeView` SVGs                  | 5 files, each with `role="img"` + descriptive `aria-label`                |
| FR-003 | A11y          | Must     | In `InsightsRail.svelte`, replace `<li role="button" tabindex="0" onclick=...>` with `<li><button onclick=...>` pattern; remove `svelte-ignore` directive | 2 occurrences (lines 114, 142) — both replaced; 0 `svelte-ignore`         |
| FR-004 | A11y          | Must     | Wrap `.transition().duration(...)` calls in graph views with a `prefers-reduced-motion` check (skip animation, jump straight to final state)              | grep finds the guard in each file using `.transition`                     |
| FR-005 | Layout        | Must     | Fix `HomePage.svelte` `.has-panel` grid at viewport < 1100 px (so 4-child markup never flows into a 3-col grid)                                           | manual test in dev tools at 1024 px shows aligned layout when panel opens |
| FR-006 | Documentation | Should   | CHANGELOG.md `[Unreleased]` describes each FR                                                                                                             | grep `FR-001`..`FR-005` references                                        |

## Non-Functional Requirements

| ID      | Category      | Requirement                                            | Metric                             |
| ------- | ------------- | ------------------------------------------------------ | ---------------------------------- |
| NFR-001 | Compatibility | All 5 fixes work on ubuntu / macos / windows × Node 22 | smoke matrix 3/3 green             |
| NFR-002 | TS            | `svelte-check` reports 0 errors / 0 warnings           | `npx svelte-check`                 |
| NFR-003 | Reversibility | Each FR is independently revertable                    | 5+ commits, each `git revert`-able |
| NFR-004 | Bundle drift  | Dist size unchanged within 5 KB                        | `du -sh dist/` before/after        |

## Affected Files

- `template/src/routes/+error.svelte` (new) — FR-001
- `template/src/widgets/dependency-graph/ui/{ForceView,LanesView,MatrixView,RadialView,TreeView}.svelte` (5 files) — FR-002 + FR-004
- `template/src/widgets/insights-rail/ui/InsightsRail.svelte` — FR-003
- `template/src/pages/home/ui/HomePage.svelte` — FR-005
- `CHANGELOG.md` — FR-006

## Related Artifacts

| Artifact | Relation                                                              | Status  |
| -------- | --------------------------------------------------------------------- | ------- |
| PRD-002  | Prior security tactical (PR S1 model)                                 | active  |
| EVID-009 | Evidence pattern for tactical PRs                                     | active  |
| RFC-F2   | Frontend refactor (InsightsRail split + composables) — separate scope | planned |
| EVID-F1  | Smoke matrix + per-FR acceptance                                      | planned |

## Risks & Mitigations

| ID  | Risk                                                                                                | Probability | Impact | Mitigation                                                                                       |
| --- | --------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------ |
| R-1 | `+error.svelte` styling drifts from app shell visual                                                | Medium      | Low    | Reuse `app/styles/app.css` tokens; visual review before merge                                    |
| R-2 | `role="img"` change makes Force-view (planned to add keyboard pan/zoom in F2) non-interactive again | Low         | Low    | Document the swap; F2 can flip back to `role="application"` if it adds real keyboard interaction |
| R-3 | `<li><button>` nesting breaks current click-handler binding                                         | Medium      | Medium | Local smoke + manual click-test before push                                                      |
| R-4 | `prefers-reduced-motion` guard misses some `.transition()` site                                     | Low         | Low    | grep verification + visual diff                                                                  |
| R-5 | Narrow-grid fix breaks wide-grid layout                                                             | Medium      | Medium | Test viewport 1100/1440/1920 before push                                                         |


