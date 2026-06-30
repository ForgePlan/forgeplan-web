---
depth: standard
id: PRD-009
kind: prd
status: active
title: Risk overlay for workspace decay surface
---

# PRD-009: Risk overlay for workspace decay surface

## Problem

Forgeplan's R_eff (weakest-link evidence score) and `valid_until` decay
markers are computed but visually invisible at the graph level. Today
the user sees them only inside ArtifactPanel after clicking a node, OR
in the InsightsRail "Recent → Lowest R_eff" list. There's no way to
look at the whole workspace and see "where are my thin places, right
now, at a glance".

A 289-artifact workspace might have 7 critical R_eff < 0.3 artifacts —
they get lost in 282 healthy ones unless explicitly filtered.

**Impact**: Stale evidence and crumbling decisions accumulate silently
between releases. The team finds out at PR review (too late) or never.

## Target Users

| Persona            | Description         | Pain                                                   |
| ------------------ | ------------------- | ------------------------------------------------------ |
| Tech lead          | weekly health check | needs a glance to spot weak spots in the workspace     |
| Active developer   | working on a PRD    | wants to see if their decision rests on solid evidence |
| Stakeholder review | quarterly audit     | needs visual map "where is risk concentrated"          |

## Goals

| ID    | Criterion                                                                            | Metric                                        | Target                               | How to measure |
| ----- | ------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------ | -------------- |
| SC-1  | Risk toggle button in canvas-toolbar                                                 | DOM evaluate `[data-action="toggle-risk"]`    | button present                       | Playwright     |
| SC-2  | When ON, all artifacts with `R_eff < 0.6` get a glow halo                            | DOM `.node-risk` class count                  | matches expected                     | Playwright     |
| SC-3  | Glow uses `var(--bad)` colour with blur radius ∝ risk                                | computed style on `.node-risk` filter         | filter present                       | Playwright     |
| SC-4  | Toggle state persists in localStorage                                                | reload + check                                | preserved                            | Playwright     |
| SC-5  | New `Risk anatomy` section in ArtifactPanel sticky stack                             | `[data-test="risk-anatomy"]` present          | element + child evidence list        | Playwright     |
| SC-6  | Risk-section lists evidence sources with CL + evidence_type, weakest one highlighted | DOM evaluate                                  | weakest element has `.weakest` class | Playwright     |
| SC-7  | Decay timer shown when `valid_until` is set                                          | `[data-test="decay-timer"]` text matches "Nd" | matches                              | manual         |
| SC-8  | `riskScore(artifact)` pure function in lib                                           | function exported                             | unit-tested                          | vitest         |
| SC-9  | Risk overlay disabled in Sankey + Sunburst (their layouts already encode hierarchy)  | DOM check those views                         | no glow on either                    | Playwright     |
| SC-10 | svelte-check 0/0; smoke matrix green                                                 | CI                                            | 0/0 + 3-OS pass                      | CI             |

## Non-Goals

- Don't auto-create stub Evidence packs ("Suggest evidence" button) — rule 22 forbids mutations from web; show CLI hint instead.
- Don't add a 6th tab in InsightsRail — info is already in `Recent → Lowest R_eff`.
- Don't change the existing `reffTone()` semantic (`good / warn / bad`).
- Don't touch the Sankey + Sunburst views — they already encode hierarchy spatially; an additional glow channel would conflict.

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                                                                                        | Acceptance                      |
| ------ | ------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| FR-001 | Core          | Must     | Risk toggle button in canvas-toolbar                                                                                               | Toggle present + persists state |
| FR-002 | Core          | Must     | When toggle ON, every artifact with `R_eff < 0.6` gets `class="node-risk"`                                                         | DOM check                       |
| FR-003 | Core          | Must     | Glow filter on `.node-risk`: `box-shadow: 0 0 var(--glow-r) var(--bad)` where `--glow-r = clamp(2px, 14px·(1 - r_eff), 14px)`      | computed style                  |
| FR-004 | Core          | Must     | New `widgets/dependency-graph/lib/risk-score.ts` exports `riskScore(detail)` returning [0..1]                                      | function present + tested       |
| FR-005 | Core          | Must     | `riskScore = clamp(1 - r_eff)` × `decay_factor`; `decay_factor = 1` if no `valid_until`, else `clamp(0, 1 - days_remaining/90, 1)` | unit tests                      |
| FR-006 | Core          | Should   | New `Risk anatomy` section appears in ArtifactPanel between meta and links                                                         | sticky-row class applied        |
| FR-007 | Core          | Should   | Lists outgoing Evidence packs with CL + evidence_type; weakest gets `.weakest` class                                               | DOM                             |
| FR-008 | UX            | Should   | Decay timer shown when `valid_until` is set                                                                                        | "Expires in Nd" text            |
| FR-009 | UX            | Could    | Hover the glow → tooltip "R_eff X.XX, decay Y days, weakest: EVID-NNN"                                                             | tooltip with values             |
| FR-010 | Documentation | Should   | CHANGELOG entry describes FR-001..FR-008                                                                                           | grep                            |

## Non-Functional Requirements

| ID      | Category    | Requirement                                                                    | Metric                 | Method     |
| ------- | ----------- | ------------------------------------------------------------------------------ | ---------------------- | ---------- |
| NFR-001 | Performance | SVG `filter` glow on N=300 artifacts ≤ 16ms render                             | Performance API timing | manual     |
| NFR-002 | Bundle      | New CSS + lib ≤ 5 KB gzip                                                      | dist diff              | shell      |
| NFR-003 | A11y        | Glow alone not the only signal — `aria-label` includes risk score for SR users | DOM check              | manual     |
| NFR-004 | Color       | New glow colour is `var(--bad)` only; doesn't introduce a new palette          | CSS review             | review     |
| NFR-005 | Compat      | Toggle hidden when active view is Sankey or Sunburst                           | DOM                    | Playwright |

## Affected Files

- `template/src/widgets/dependency-graph/lib/risk-score.ts` (new)
- `template/src/widgets/dependency-graph/lib/risk-score.test.ts` (new)
- `template/src/widgets/dependency-graph/ui/{Force,Tree,Radial,Lanes,Matrix}View.svelte` (modified — apply `class:node-risk` when toggle ON)
- `template/src/widgets/artifact-panel/ui/ArtifactPanel.svelte` (modified — Risk anatomy section)
- `template/src/pages/home/ui/HomePage.svelte` (modified — risk toggle + state)
- `template/src/pages/home/lib/settings.ts` (modified — `riskOverlay: boolean` field)
- `template/src/app/styles/app.css` (modified — `.node-risk` filter rule)
- `CHANGELOG.md`

## Related Artifacts

| Artifact | Relation                                                    | Status           |
| -------- | ----------------------------------------------------------- | ---------------- |
| RFC-008  | Architecture — riskScore composition + SVG filter rendering | planned          |
| EVID-017 | Acceptance pack                                             | planned          |
| PRD-008  | Sibling F18 (Time-travel)                                   | parallel feature |

## Risks & Mitigations

| ID  | Risk                                                                         | Prob   | Impact | Mitigation                                                                                                                     |
| --- | ---------------------------------------------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| R-1 | SVG `filter` causes paint jank on N>200 nodes                                | Medium | Medium | Test on Helios 123-artifact playground; if jank, switch to `box-shadow` (HTML) or simulate via outer `<circle>` halo (cheaper) |
| R-2 | `--bad` glow conflicts with selection-ring's `--accent` outline              | Low    | Low    | Selection-ring on top (z-index 1); risk glow underneath. Visual test                                                           |
| R-3 | `valid_until` may not be on every artifact — decay_factor missing field path | Medium | Low    | Default `decay_factor = 1` (no decay) when field absent                                                                        |
| R-4 | Color-blind users (red-green deficiency) miss the bad-glow signal            | Medium | Medium | NFR-003: aria-label has numeric R_eff; in a future PRD add second cue (radius-only if accessibility plugin enabled)            |
| R-5 | Performance regression on 7-view scroll                                      | Low    | Low    | NFR-001 timing budget; if exceeded, fall back to glow only on currently-visible nodes (via IntersectionObserver)               |




