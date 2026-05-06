---
depth: standard
id: PRD-016
kind: prd
last_modified_at: 2026-05-06T20:57:52.610355+00:00
last_modified_by: claude-code/2.1.131
status: draft
title: Multi-graph mosaic dashboard with persistent layout
---

# PRD-016: Multi-graph mosaic dashboard with persistent layout

## Problem

Today the home page hosts a single graph view at a time (force / tree / radial / matrix / lanes / sankey / sunburst). Switching views forces the user to lose visual context — comparing how the same artifact set looks under e.g. Force vs Sankey requires alternating clicks and mental diff. There is no way to look at two views side-by-side, no way to keep a custom layout between sessions, and no way to assemble a personal "dashboard" of the most-relevant graphs for the current investigation.

**Impact**: every cross-view investigation loses 5–10 s of context-switch + risks misreading, because the previous view's spatial mental model has to be discarded. Also: power-users have asked for "show me Force AND Lanes at once" — currently impossible without external screenshot/window-tile workflows.

## Goals

- Multi-pane workspace where the user can have ≥2 graph views visible simultaneously.
- Each pane is independently selectable from the existing 7 graph views.
- Pane layout (which graphs are open + their relative size in **percent**) survives reload via `localStorage`.
- The user can rearrange panes (swap two panes by dragging one onto the other).
- The user can grow the workspace by adding a graph two ways:
  - keyboard-augmented click: **Shift + click** on a view-toggle button adds that view as a new pane (instead of replacing the focused one);
  - drag-and-drop: dragging a view-toggle chip into the canvas drops it as a new pane.
- During drag, the system shows a highlighted preview of where the new/swapped pane will land (drop-zone affordance) and auto-arranges the existing panes to make room (autolayout).
- Single-pane behavior is the default for first-time users — feature is additive, not a regression.

## Non-Goals

- Per-pane filters / per-pane selection state — kindFilter / statusFilter / selectedId remain global for the page (revisit later if users ask).
- Floating / detached / multi-monitor windows — every pane lives inside the canvas grid.
- Saving multiple named layout presets — only ONE current layout is persisted.
- Cross-pane synchronized panning / linked highlighting — left to a follow-up.
- Mobile / narrow-screen mosaic — < 1100 px keeps single-pane fallback (existing media query already collapses the rail; we keep that).

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | User can have between 1 and 4 graph panes visible in the canvas at the same time | J1 |
| FR-002 | Core | Must | User can choose any of the 7 GRAPH_VIEWS for each pane independently | J1 |
| FR-003 | Persistence | Must | The set of open panes and their sizes (as percentages summing to 100% per axis) is saved to localStorage and restored on reload | J1 |
| FR-004 | UX | Must | User can drag a splitter handle to resize two adjacent panes; the change persists | J1 |
| FR-005 | UX | Must | User can swap the views of two open panes by dragging the header of one onto the body of another | J2 |
| FR-006 | UX | Must | User can add a new pane by Shift+clicking a view-toggle button | J2 |
| FR-007 | UX | Must | User can add a new pane by dragging a view-toggle chip into the canvas; on drop the new pane appears in the highlighted region | J2 |
| FR-008 | UX | Must | While dragging (either swap or add), the candidate target region is visually highlighted; on cancel/Esc the layout returns to its pre-drag state | J2 |
| FR-009 | UX | Should | When a new pane is added, existing panes shrink proportionally so the new one gets a sensible default share (≈ 1/N) — autolayout | J2 |
| FR-010 | UX | Should | User can close a pane via an "x" affordance in the pane header; closing the last pane reverts to single-pane defaults | J1 |
| FR-011 | A11y | Should | Splitter handles have role="separator", keyboard arrow-key resize, and visible focus | J1 |

## Target Users

| Persona | Description | Key pain |
|---------|-------------|---------|
| Architect / TL | Reviews dependency structure across multiple lenses (Force for clusters, Sankey for flow, Lanes for kind balance) | Has to switch views, loses spatial context |
| Methodology user | Compares "what changed" by spatial diff across two views | No way to see two views at once |

## Differentiators

- Layout is **percent-based**, not pixel-based — survives window resize cleanly.
- Drag affordances mirror VS Code editor groups + Grafana panels — no novel interaction to learn.

## Acceptance Criteria

### AC-1: Persisted layout

```gherkin
Given the user has opened panes [Force, Sankey, Lanes] with sizes [40%, 30%, 30%]
When  the user reloads the page
Then  the canvas restores those three panes in the same order with the same sizes (within 1% tolerance)
```

### AC-2: Add by Shift+click

```gherkin
Given the canvas currently has one pane (Force)
When  the user holds Shift and clicks the "Sankey" view-toggle button
Then  the canvas now has two panes (Force, Sankey) and Force does not lose its scroll/zoom state if its instance is preserved
```

### AC-3: Drop-zone highlight + autolayout

```gherkin
Given the canvas has [Force, Lanes]
When  the user drags the "Tree" toggle chip over the canvas
Then  the system displays a highlighted region showing where the new pane will land (e.g. right edge of Lanes → new column)
And   on drop the layout becomes [Force, Lanes, Tree] with sizes auto-redistributed
```

### AC-4: Swap by drag

```gherkin
Given the canvas has [Force, Sankey]
When  the user drags the Force pane header onto the Sankey pane body
Then  the layout becomes [Sankey, Force]; sizes are unchanged
```

## Functional Requirements

### Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| RFC-015 | Architecture proposal — split-tree model + drag overlay | Draft |

## Affected Files

- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — unchanged surface (graph already self-contained)
- `template/src/widgets/mosaic/**` — NEW widget (FSD: widgets/mosaic)
- `template/src/pages/home/ui/HomePage.svelte` — replace single-canvas with `<MosaicCanvas>`
- `template/src/pages/home/lib/settings.ts` — add layout key
- `template/src/widgets/mosaic/lib/*.test.ts` — vitest unit tests for tree ops

