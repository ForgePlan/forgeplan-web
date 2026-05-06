---
depth: standard
id: RFC-015
kind: rfc
last_modified_at: 2026-05-06T20:58:57.433107+00:00
last_modified_by: claude-code/2.1.131
links:
- target: PRD-016
  relation: based_on
status: draft
title: Mosaic split-tree layout engine for multi-graph canvas
---

# RFC-015: Mosaic split-tree layout engine for multi-graph canvas

## Summary

Replace the single-canvas-with-view-toggle in `pages/home` with a recursive **split-tree** mosaic that hosts 1–4 `DependencyGraph` panes. The tree is a binary structure: leaves are `{ kind: 'pane', view: GraphView }`, internal nodes are `{ kind: 'split', orientation: 'row'|'col', sizes: [a, 100-a], children: [Node, Node] }`. The same shape is what we serialize to localStorage. Dragging onto a leaf's edge subdivides it; dragging onto its centre swaps; Shift+click on a view-toggle adds a leaf to the right of the right-most leaf. CSS Grid renders each split natively (`grid-template-{rows,columns}: <a>% <b>%`), so the only JS at render time is recursive rendering + a pointer-driven splitter.

## Motivation

PRD-016 captures the user need: simultaneous multi-view comparison + persisted layout + drag-to-add/swap. The choice of layout model is the load-bearing decision because it dictates:
- the persistence schema (we cannot retrofit a flat-row model into a nested mosaic later without breaking saved layouts),
- the drag-and-drop semantics (a flat row only supports "insert" and "reorder", not "stack vertically"),
- complexity budget (≈ 600 lines of TS+Svelte vs ≈ 2 000 lines for general grid).

## Options Considered

### Option A — Flat row of panes (1 × N)

Single horizontal row. Sizes = `number[]` summing to 100. Splitters between adjacent panes.

- ✅ Trivial schema (`{ panes: GraphView[], sizes: number[] }`).
- ✅ ~150 lines of code.
- ❌ Cannot satisfy FR-001 in 2D (user expects "сетка" — grid). Rejected by user wording.
- ❌ No vertical splits — caps the comparison usefulness ("Force above Sankey" is a common pairing).

### Option B — Recursive binary split-tree (mosaic) — **CHOSEN**

Binary tree of horizontal/vertical splits. Each split has `[a%, (100-a)%]`. Leaves are panes.

- ✅ Naturally supports both row and column splits, arbitrarily nested.
- ✅ Drop semantics fall out for free: edge of a leaf → split that leaf in that direction; centre → swap views.
- ✅ Industry-validated (`react-mosaic`, VS Code editor groups, GoldenLayout core).
- ✅ Render path is `grid-template-{rows,columns}: <a>% <b>%` — zero layout math at runtime.
- ❌ Schema and tree ops (insert, remove, swap, normalise) are non-trivial; need unit tests.
- ❌ Pure binary tree can produce visually unbalanced 3-pane layouts; we mitigate with autolayout (rebalance to equal split when adding).

### Option C — `react-grid-layout`-style 12-column grid with row spans

Each pane has `{ x, y, w, h }` on a fixed 12 × N grid. Drag = move; resize = corner handles.

- ✅ Most flexible UX (true 2D rearrange).
- ❌ ~10× the code (collision detection, compaction algorithm, drag projection).
- ❌ Overkill for max 4 panes (PRD cap).
- ❌ Pixel-based grid units degrade on window resize unless we layer percentages on top — at which point we re-derived B.

### Option D — Use external dep (`svelte-splitpanes`, `svelte-mosaic`)

- ✅ Done-for-us.
- ❌ Adds a runtime dep to `template/package.json#dependencies`. The published `dist/` already inflates with each dep (rule 21). RFC-013 is actively trying to **shrink** the bundle. Buying flexibility we don't need at the cost of ~50–200 KB of JS.
- ❌ None of the candidates ship Svelte 5 runes — would need a wrapper.

## Proposed Direction

**Option B** — recursive binary split-tree, hand-rolled in Svelte 5.

### Data model

```ts
// widgets/mosaic/model/types.ts
export type Orientation = "row" | "col";
export type LeafId = string; // e.g. "leaf-3"

export type Leaf = { kind: "leaf"; id: LeafId; view: GraphView };
export type Split = {
  kind: "split";
  orientation: Orientation;
  sizes: [number, number]; // [a, 100-a], rounded to 0.1%
  children: [Node, Node];
};
export type Node = Leaf | Split;
export type Layout = { root: Node | null; nextId: number };
```

### Tree operations (pure, testable)

- `addLeaf(layout, view, target?, edge?)` — splits `target` along `edge` (top/bottom/left/right) or grows the rightmost split if no target.
- `removeLeaf(layout, leafId)` — deletes leaf; if its sibling was the only other child, replace the parent split with that sibling (collapse degenerate splits).
- `swapViews(layout, aId, bId)` — swaps `view` between two leaves; sizes unchanged.
- `setSplitSize(layout, splitPath, newA)` — clamps to [10, 90] %.
- `normalise(layout)` — ensures sizes sum to exactly 100, ids are unique, no orphan splits.
- `countLeaves(layout)` — for the FR-001 cap of 4.

### Rendering

`MosaicCanvas.svelte` renders the root recursively. Each `Split` becomes:

```svelte
<div class="split" data-orientation={node.orientation}
     style:grid-template-{node.orientation === 'row' ? 'columns' : 'rows'}={`${a}% ${b}%`}>
  <PaneOrSplit node={node.children[0]} />
  <Splitter on:resize={handleResize(path)} />
  <PaneOrSplit node={node.children[1]} />
</div>
```

Each `Leaf` renders `<PaneFrame><DependencyGraph view={leaf.view} ...sharedProps /></PaneFrame>` where `PaneFrame` provides:
- header with view label, change-view dropdown, close-x;
- a `data-leaf-id` attribute and `draggable`-style header for swap drags.

### Drag-and-drop

We use **HTML5 drag-and-drop** (not pointer events) for two reasons: (1) it gives us a native ghost image and Esc-to-cancel for free; (2) the existing splitter uses pointer events, so the two systems don't fight over capture.

- DataTransfer payload: `{ type: 'add', view }` (from view-toggle) or `{ type: 'swap', leafId }` (from pane header).
- During `dragover`, the canvas computes the hovered leaf and which quadrant (top/bottom/left/right/centre) the cursor is in. A single `<DropOverlay>` element absolutely positioned over the hovered leaf paints the highlight.
- On `drop`, we call `addLeaf` or `swapViews` and persist.
- Esc/cancel restores nothing because we never mutate during dragover.

### Persistence

Add a separate localStorage key — **do not overload** the existing `forgeplan-web:settings:v1` blob. Reason: layouts churn faster, and a corrupt layout shouldn't blow away unrelated settings (filters, notify).

```ts
// pages/home/lib/settings.ts (extended)
const LAYOUT_KEY = "forgeplan-web:layout:v1";
export function loadLayout(): Layout | null { /* try/catch JSON */ }
export function saveLayout(layout: Layout): void { /* try/catch quota */ }
```

`v1` schema is committed; future migrations bump to `v2`. On unparseable JSON the user gets the default single-pane (`{ root: { kind: 'leaf', id: 'leaf-1', view: 'force' }, nextId: 2 }`).

### Defaults & migration

- First load (no `forgeplan-web:layout:v1` key): single-pane, view = `force` (or whatever the legacy `:settings:v1#view` says — read once, then we own layout).
- Cap of 4 panes (FR-001) — Shift+click on a view-toggle when 4 are open is a no-op + brief toast / aria-live message.

## Implementation Phases

1. **P1 — model + persistence (no UI changes).** Land `widgets/mosaic/model/` with full vitest coverage. ~150 LOC + ~100 LOC tests.
2. **P2 — render path.** `MosaicCanvas.svelte` + `PaneFrame.svelte` + `Splitter.svelte`, single-pane default. Wire into `HomePage.svelte` behind the existing single-canvas behaviour. ~300 LOC.
3. **P3 — drag & drop.** Shift+click adds; pane header drag swaps; toggle-chip drag adds. `DropOverlay.svelte` for highlight. ~200 LOC.
4. **P4 — autolayout + edge cases.** Rebalance on add, normalise on remove, 4-pane cap with toast, keyboard splitter resize. ~100 LOC.

After P2 the feature is shippable with degraded UX (no DnD) — explicit gate so we can land in two PRs if review timing demands.

## Alternatives We Explicitly Rejected

- **Option A (flat row)** — fails the "сетка" requirement; user wording is unambiguous.
- **Option C (12-col grid)** — overkill for ≤ 4 panes; complexity not justified.
- **Option D (external dep)** — violates RFC-013 bundle-size pressure; ROI negative for ≤ 4 panes.

## Open Questions

- Should swap include sizes (drag pane A on B → A takes B's slot but **also** B's size)? — yes; PRD AC-4 says sizes unchanged → we swap views, not slots.
- Should the close-x on the last pane be hidden (always ≥ 1 pane) or do we allow zero panes with an empty-state CTA? — hidden when leaves == 1; matches FR-010 "reverts to single-pane defaults".


