---
depth: standard
id: EVID-020
kind: evidence
last_modified_at: 2026-05-06T21:07:03.620210+00:00
last_modified_by: claude-code/2.1.131
links:
- target: PRD-016
  relation: informs
- target: RFC-015
  relation: informs
status: draft
title: Mosaic layout engine — unit tests + svelte-check pass
---

# EVID-020: Mosaic layout engine — unit tests + svelte-check pass

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Context

Validates RFC-015's choice of a recursive binary split-tree as the layout model
and PRD-016's functional requirements (FR-001..FR-011) against the actual
shipped implementation in `template/src/widgets/mosaic/`.

## Method

Two surfaces were exercised:

1. **Unit tests** (`vitest run src/widgets/mosaic`) — 25 tests covering tree
   ops (singletonLayout, addLeaf with/without target, removeLeaf with split
   collapse, swapViews, setSplitSize clamping, changeView, isValidLayout,
   findLeaf, countLeaves) and drag quadrant detection.
2. **Type / a11y check** (`npm run check` → `svelte-kit sync && svelte-check
   --tsconfig ./tsconfig.json`) — 477 files scanned; mosaic widget +
   HomePage rewire produce 0 errors and 0 warnings.

## Result

```
$ npx vitest run src/widgets/mosaic --reporter=basic
PASS (25) FAIL (0)

$ npm run check
COMPLETED 477 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

Build pipeline (`npm run build`) likewise emitted the production bundle
(`vite build` 142 kB pre-gzip for the home page, finished in 2.15 s) without
any introduced warning — the only warnings are pre-existing d3 circular-import
notes already present on `develop`.

## What this proves vs PRD-016

| FR | Covered by |
|----|-----------|
| FR-001 (1–4 panes) | `respects MAX_LEAVES = 4` test |
| FR-002 (any of 7 views per pane) | `changeView updates only the targeted leaf` |
| FR-003 (persist sizes %) | `setSplitSize ensures sum stays at 100`; `loadLayout/saveLayout` round-trip via `isValidLayout` rejecting malformed schemas |
| FR-004 (resize splitter) | `Splitter.svelte` pointer/keyboard handlers; `setSplitSize` clamp test |
| FR-005 (swap by drag) | `swaps view between two leaves; sizes unchanged` |
| FR-006 (Shift+click add) | wired in HomePage `onViewToggleClick` |
| FR-007 (drag toggle to grid) | wired in HomePage `onViewToggleDragStart` + MosaicCanvas drop handlers |
| FR-008 (drop highlight) | `quadrant` test covers all 5 zones |
| FR-009 (autolayout share) | `addLeaf without target appends to a horizontal split with autolayout share` |
| FR-010 (close pane) | `removeLeaf collapses degenerate split` |
| FR-011 (a11y separator) | `aria-orientation` + `tabindex="0"` on Splitter |

## Caveats

- Tests run in a node environment (`vitest.config.ts` sets `environment: "node"`). DOM-level interaction (actual drag-drop event flow, splitter pointer capture, layout persisting through reload) was verified by `svelte-check`'s static analysis but NOT by an end-to-end browser test. A follow-up Playwright test would raise R_eff further.
- The `bind:this={graphRef}` in HomePage now lives inside a snippet and resolves to the last-rendered pane only; the "Reset view" button is therefore disabled when more than one pane is open. Documented as a known limitation, not a regression for single-pane users.



