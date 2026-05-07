---
depth: standard
id: SPEC-001
kind: spec
status: active
title: 'Sankey adaptive height + label-collision (issue #69)'
---

---
id: SPEC-001
title: "Sankey adaptive height + label-collision (issue #69)"
status: Draft
author: fedorovvvv
created: 2026-05-08
updated: 2026-05-08
prd: PRD-020
type: UI Spec
depth: standard
---

# SPEC-001: Sankey adaptive height + label-collision (issue #69)

## Summary

Phase 1 of RFC-017 — make `SankeyView.svelte` legible at workspace sizes ≥100 artifacts.

## Scope

Owns:

- `template/src/widgets/dependency-graph/ui/SankeyView.svelte` — view component.
- `template/src/widgets/dependency-graph/lib/sankey-layout.ts` — pure layout helpers.
- `template/src/widgets/dependency-graph/lib/sankey-layout.test.ts` — tests for new helpers.

Does NOT touch:

- `TreeView.svelte` / `tree-layout.*` (owned by SPEC-002).
- Other view components (Force/Radial/Matrix/Lanes/Sunburst).
- DependencyGraph.svelte parent — public props and `onViewState` contract preserved.

## Required behaviour

1. **Adaptive canvas height**: compute `VIEW_H = max(760, maxColumnNodeCount * MIN_NODE_HEIGHT_PX)` where `MIN_NODE_HEIGHT_PX = 14`. Floor at 760 so small workspaces are unaffected.
2. **Label-collision drop**: column-by-column, hide labels (`opacity: 0` at idle, full opacity on hover/selection) when adjacent labels would overlap (use y-distance < `LABEL_LINE_HEIGHT`).
3. **fitToView**: widen scale clamp to `[0.1, 1.5]` so dense layouts can scale down to fit viewport.

## Data Models

```ts
// New helpers in lib/sankey-layout.ts
export function adaptiveCanvasHeight(
  nodes: Pick<SankeyPayloadNode, "column">[],
  minHeight?: number,
  minNodeHeight?: number,
  nodePadding?: number,
  margin?: number,
): number;

export function dropCollidingLabels(
  nodes: Array<{ id: string; column?: number; x0?: number; y0?: number; y1?: number }>,
  lineHeight?: number,
): Set<string>;

export const MIN_NODE_HEIGHT_PX: number;
export const MIN_CANVAS_HEIGHT_PX: number;
export const LABEL_LINE_HEIGHT_PX: number;
```

## Acceptance criteria

- AC-1.1 At 123 artifacts no two visible Sankey labels overlap each other or sit on top of a bar (visual + DOM measurement).
- AC-1.2 At 62 artifacts the layout matches develop branch exactly (regression).
- AC-1.3 Selection/hover preserves label visibility for the focused node even if it was dropped at idle.

## Related

- PRD-020 — product requirements.
- RFC-017 — architecture decision (Option A).
- GitHub issue #69 — source.



