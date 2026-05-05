---
created: 2026-05-05
depth: standard
id: PRD-004
kind: prd
priority: P2
status: draft
title: 'Frontend graph UX (PR F2-graph): selection sans status-dot + hover-edge highlight'
updated: 2026-05-05
---

# PRD-004: Frontend graph UX

## Problem

User-reported during F1 live walkthrough:

- **UX-1 — Selection ring captures status dot.** When user clicks a
  graph node to open its panel, the selection highlight (`<rect>` with
  accent stroke) currently stretches over the entire bounding box of
  the node group — including the status indicator dot (green/orange,
  positioned just outside the card on its right). Visually the dot
  «is part of the selection» which conflicts with its purpose
  (independent status indicator). The dot's color also clashes with
  the accent stroke.

- **UX-2 — No hover affordance on edges.** Hovering an artifact node
  does nothing to its connected edges. On a graph of 17–270 nodes the
  user cannot quickly answer «what does this depend on / what depends
  on it?» without clicking and reading the side panel. d3-force has the
  data to do better.

These are not audit findings — they are user-driven ergonomics issues
spotted while testing F1. Fixing them improves the perceived quality of
the npm package's UX.

## Target Users

| Persona | Description | Pain |
|---|---|---|
| End-user developer | Browses workspace graph at `localhost:5174` | Selection ring eats status dot; hover gives no edge feedback |
| Repo contributor | Reads PR diffs, navigates many artifacts | Quick «what links here» answer needed without click-back |

## Goals

| ID | Criterion | Metric | Target | How to measure |
|----|-----------|--------|--------|----------------|
| SC-1 | Selected node `<rect>` does NOT overlap status dot | DOM bbox of selection rect ends before dot center-x | bbox.right < dot.center.x | Playwright eval |
| SC-2 | Hover on node adds CSS class `is-active` to its edges | mouseenter handler updates `$state hoveredId`; `$derived` applies class | observable in DOM after hover | Playwright eval |
| SC-3 | Hover dims unrelated edges to opacity 0.25 | computed style of unrelated `<line>`/`<path>` edges | opacity == 0.25 | Playwright eval |
| SC-4 | Hover affordance present on all 5 graph views | repeat SC-2 for Force/Tree/Radial/Matrix/Lanes | 5/5 | Playwright eval |
| SC-5 | Smoke matrix 3/3 OS × Node 22 green | `gh pr checks` | 3/3 | CI |
| SC-6 | `svelte-check` 0 errors / 0 warnings | `npx svelte-check` | 0/0 | shell |
| SC-7 | No new runtime deps | `git diff template/package.json` | 0 dep added | grep |

## Non-Goals

- Do **not** highlight connected nodes (Max variant) — Mid only: edges only.
- Do **not** add keyboard pan/zoom or `role="application"` rollback (separate F-future).
- Do **not** change selection color or animation timing.
- Do **not** add tooltip on hover — text already in side panel; out of scope.

## Functional Requirements

| ID | Category | Priority | Requirement | Acceptance |
|----|----------|----------|-------------|------------|
| FR-001 | Selection | Must | Selected node `<rect>` bounding box ends at the right edge of the card content, not including the status dot | DOM bbox check + visual screenshot diff |
| FR-002 | Hover | Must | Mouseenter on a graph node sets `hoveredId` shared state; mouseleave clears it | grep handler + Playwright observe class change |
| FR-003 | Hover | Must | Edges connected to `hoveredId` get CSS class `edge-active` (accent stroke, increased width) | DOM eval — count of `.edge-active` matches expected for selected node |
| FR-004 | Hover | Must | Edges NOT connected to `hoveredId` get CSS class `edge-dim` (opacity 0.25) when any node is hovered | DOM eval after hover |
| FR-005 | Hover | Must | All 5 views (Force/Tree/Radial/Matrix/Lanes) implement the same hover behaviour | repeat FR-002..FR-004 across views |
| FR-006 | Cleanup | Must | `mouseleave` from canvas / node clears state; CSS classes removed from edges | DOM eval after mouseleave |
| FR-007 | Documentation | Should | CHANGELOG `[Unreleased]` describes both UX changes | grep |

## Non-Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-001 | Perf | Hover updates do not drop below 60 fps on a 270-node graph | Performance.now() probe |
| NFR-002 | Compatibility | Works on ubuntu/macos/windows × Node 22 in CI smoke | matrix 3/3 |
| NFR-003 | Reversibility | Each FR is independently revertable | 4+ commits per FR |
| NFR-004 | Bundle drift | No measurable bundle size delta | `du -sh dist/` before/after |

## Affected Files

- `template/src/widgets/dependency-graph/ui/{ForceView,TreeView,RadialView,MatrixView,LanesView}.svelte` — FR-001 + FR-002..FR-006
- `template/src/widgets/dependency-graph/lib/highlight.svelte.ts` (new) — shared `hoveredId` state + helpers
- `CHANGELOG.md` — FR-007

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-003 | Prior frontend recovery + a11y (F1 model) | active |
| EVID-010 | Live-verification template for F1 | active |
| RFC-F3 | Panel UX (markdown render + resizable sidebar) | planned |

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-1 | Selection bbox shrink breaks hit-testing on click | Medium | Medium | Click handler stays on `<g>` parent; only the visible rect shrinks. Visual + click test in MCP Playwright. |
| R-2 | Hover handlers cause re-render storms on big graphs (270 nodes) | Medium | Medium | Use `$state` not full graph rebuild; CSS-class swap, not DOM remount. Probe with Performance.now(). |
| R-3 | Mid variant (dim unrelated) feels too aggressive on small workspaces (<10 nodes) | Low | Low | Tune dim opacity to 0.4 if user complains; revert to Min if rejected. |
| R-4 | Edges in some views are SVG `<line>` vs `<path>` — class application varies | Medium | Medium | Use `classList.toggle()` programmatically per view; don't rely on CSS-only selectors. |
