---
depth: standard
id: PRD-008
kind: prd
links:
  - target: PRD-010
    relation: informs
status: draft
title: Time-travel slider for workspace history
---

# PRD-008: Time-travel slider for workspace history

## Problem

`@forgeplan/web` shows the **current** state of `.forgeplan/`. Forgeplan
methodology — and its main value-prop — is the **temporal lifecycle** of
decisions: artifacts get drafted, activated, scored, superseded, marked
stale, deprecated. The journal records each transition with timestamps
and `valid_until` decay markers.

CLI exposes this via `forgeplan journal --json`. Web ignores it
entirely. Result: you can see what is true today but never "what changed
between v0.1.10 and v0.1.11" or "what state were we in when we activated
PRD-005".

**Impact**: PR review can't see WHAT decisions diverged from base; team
retrospectives have no scrubber to walk through "how did we get here";
decay-tracking value is invisible at the timeline level.

## Target Users

| Persona                 | Description                             | Pain                                                   |
| ----------------------- | --------------------------------------- | ------------------------------------------------------ |
| PR reviewer             | comparing PR branch to main             | needs visual diff of `.forgeplan/` between two commits |
| Tech lead retrospecting | walking team through decision evolution | needs scrubber to pause at any past moment             |
| Stakeholder onboarding  | inheriting a project                    | needs to replay "how the decision-tree grew"           |

## Goals

| ID    | Criterion                                                                                                         | Metric                                       | Target                               | How to measure |
| ----- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------ | -------------- |
| SC-1  | Timeline panel renders below `.canvas-body` with event tick-marks                                                 | DOM evaluate `[data-test="timeline"]`        | element present + ≥1 tick            | Playwright     |
| SC-2  | User can scrub to any past timestamp T; graph rerenders to snapshot at T                                          | DOM evaluate transform after scrub           | snapshot ID set differs from current | Playwright     |
| SC-3  | SINGLE mode shows state at one T                                                                                  | scrubber count == 1                          | 1 marker                             | DOM            |
| SC-4  | COMPARE mode (Alt-drag scrubber) shows diff between T1 and T2                                                     | scrubber count == 2                          | 2 markers + diff overlay             | DOM            |
| SC-5  | Diff overlay: added=green halo / activated=accent pulse / superseded=grey ghost / R_eff degraded=warn stroke      | inject 2 known commits → observe class names | classes match                        | Playwright     |
| SC-6  | Server endpoint `/api/snapshot?at=ISO[&compare=ISO]` returns JSON                                                 | curl localhost:port/api/snapshot?at=...      | 200 + valid JSON                     | manual         |
| SC-7  | Endpoint is read-only (rule 22) — invokes `forgeplan list --json` (allow-listed) + `git rev-list / worktree` only | grep handler for spawn calls                 | only read-only ops                   | code review    |
| SC-8  | Timeline collapsible — user can hide it                                                                           | toggle button                                | hidden state persisted localStorage  | DOM            |
| SC-9  | "Now" button returns to live state                                                                                | live state re-renders                        | snapshot ID === 'now'                | DOM            |
| SC-10 | svelte-check 0/0; smoke matrix green                                                                              | CI                                           | 0/0 + 3-OS pass                      | CI             |

## Non-Goals

- Don't show edits to artifact bodies (markdown diff) — only structural state (links, status, R_eff). That's a separate "diff body" feature.
- Don't allow editing past states ("rewriting history") — read-only viewer.
- Don't replay video-style auto-play with frame-rate-locked playback. Step buttons + scrubber drag suffice.
- Don't reconstruct workspaces > 5000 artifacts — out of scope; modal "history too large" message.

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                                                                                        | Acceptance                                 |
| ------ | ------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| FR-001 | Core          | Must     | User can open a timeline panel anchored below the canvas via toolbar toggle                                                        | Toggle button + collapsible panel rendered |
| FR-002 | Core          | Must     | Timeline shows tick-marks per event (created / activated / superseded / linked / scored)                                           | Events visible on time-axis                |
| FR-003 | Core          | Must     | User can drag a scrubber along the timeline to choose a past timestamp T                                                           | scrubber position updates state            |
| FR-004 | Core          | Must     | Graph view (any of 7) re-renders to reflect workspace snapshot at T                                                                | Same view layout, filtered to T            |
| FR-005 | Core          | Must     | "Now" button returns timeline to current live state                                                                                | scrubber resets to right edge; graph live  |
| FR-006 | Core          | Should   | Alt-drag (or shift-click) creates a second scrubber for COMPARE mode                                                               | 2 markers visible                          |
| FR-007 | Core          | Should   | COMPARE mode highlights diffs: added (green halo), activated (accent pulse), superseded (grey ghost), R_eff degraded (warn stroke) | Class names applied to nodes               |
| FR-008 | UX            | Should   | Timeline state (open/closed) persisted in localStorage                                                                             | survives reload                            |
| FR-009 | UX            | Should   | Step ◀ / ▶ buttons advance scrubber to next/previous event                                                                       | 1-event hop on click                       |
| FR-010 | UX            | Could    | Bookmark current scrubber position with a custom label                                                                             | persisted in localStorage                  |
| FR-011 | Documentation | Should   | CHANGELOG entry describes FR-001..FR-009                                                                                           | grep references                            |

## Non-Functional Requirements

| ID      | Category    | Requirement                                                                                                                                                                                         | Metric                          | Method |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------ |
| NFR-001 | Performance | Snapshot reconstruction < 300ms for workspaces ≤ 500 artifacts                                                                                                                                      | server-side timing              | manual |
| NFR-002 | Bundle      | Timeline UI ≤ 30 KB gzip on top of current bundle                                                                                                                                                   | dist client chunks delta        | shell  |
| NFR-003 | Security    | Only read-only operations from `/api/snapshot`: `forgeplan list --json` + `git rev-list` / `git worktree add --detach` / `git worktree remove`. No mutating subcommands; no writes to `.forgeplan/` | code review                     | review |
| NFR-004 | A11y        | Scrubber is keyboard-accessible: Left/Right arrows step, Home/End jump to extremes                                                                                                                  | keyboard test                   | manual |
| NFR-005 | Accuracy    | Snapshot at T matches what `git checkout commit-before-T && forgeplan list` would return for ≥95% of cases                                                                                          | spot-check 5 historical commits | manual |

## Affected Files

- `template/src/routes/api/snapshot/+server.ts` (new)
- `template/src/widgets/timeline/ui/Timeline.svelte` (new)
- `template/src/widgets/timeline/lib/snapshot-state.svelte.ts` (new — current scrubber state)
- `template/src/widgets/timeline/lib/event-axis.ts` (new — pure event-to-pixel math)
- `template/src/widgets/timeline/lib/event-axis.test.ts` (new — unit tests)
- `template/src/pages/home/ui/HomePage.svelte` (modified — render Timeline)
- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` (modified — accept `snapshot` prop, pass to active view)
- 7 view files (modified — apply snapshot filter to nodes/edges)
- `template/src/app/styles/app.css` (modified — `.timeline` tokens, diff classes `.node-added` / `.node-activated` / `.node-superseded` / `.node-degraded`)
- `CHANGELOG.md`

## Related Artifacts

| Artifact | Relation                                             | Status           |
| -------- | ---------------------------------------------------- | ---------------- |
| RFC-007  | Architecture — snapshot reconstruction + scrubber UI | planned          |
| EVID-016 | Acceptance pack                                      | planned          |
| PRD-009  | Sibling F19 (Risk overlay)                           | parallel feature |

## Risks & Mitigations

| ID  | Risk                                                                                     | Prob   | Impact | Mitigation                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------- | ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | Snapshot reconstruction wrong on cycles or partial events                                | Low    | High   | Reconstruct via `git worktree add --detach <sha>` + `forgeplan list --json` inside the worktree (markdown source-of-truth, no event-replay logic); spot-check against 5 historical commits. F18-T1 (2026-05-06) verified `forgeplan journal --json --until=ISO` does NOT exist; pivoted to git-based per RFC-007 Path D |
| R-2 | Timeline panel takes too much vertical space on small viewports                          | Medium | Medium | Collapsible by default; 60px height when open; respect `prefers-reduced-motion` for collapse animation                                                                                                                                                                                                                  |
| R-3 | COMPARE mode visually overwhelming on dense workspaces                                   | Medium | Medium | Tune diff stroke widths down; gate "show all changes" via opacity threshold; default-collapse for first-time users                                                                                                                                                                                                      |
| R-4 | Server endpoint rate-limited by spawn cap (PRD-002 NFR)                                  | Low    | Low    | Existing 4-process semaphore is fine — scrubbing produces ≤1 request per ~200ms (debounce)                                                                                                                                                                                                                              |
| R-5 | Reconstruction at far past commits where artifact didn't exist yet — undefined behaviour | Medium | Low    | Treat missing artifacts as opacity:0 ghosts in COMPARE; in SINGLE mode just don't render them                                                                                                                                                                                                                           |
