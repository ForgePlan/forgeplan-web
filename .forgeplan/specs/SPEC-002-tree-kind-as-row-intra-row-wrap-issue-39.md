---
depth: standard
id: SPEC-002
kind: spec
status: active
title: 'Tree kind-as-row + intra-row wrap (issue #39)'
---

---
id: SPEC-002
title: "Tree kind-as-row + intra-row wrap (issue #39)"
status: Draft
author: fedorovvvv
created: 2026-05-08
updated: 2026-05-08
prd: PRD-020
type: UI Spec
depth: standard
---

# SPEC-002: Tree kind-as-row + intra-row wrap (issue #39)

## Summary

Phase 2 of RFC-017 — make `TreeView.svelte` legible at workspace sizes ≥100 artifacts.

## Scope

Owns:

- `template/src/widgets/dependency-graph/ui/TreeView.svelte` — view component.
- `template/src/widgets/dependency-graph/lib/tree-layout.ts` — new pure helpers.
- `template/src/widgets/dependency-graph/lib/tree-layout.test.ts` — tests.

Does NOT touch:

- `SankeyView.svelte` / `sankey-layout.*` (owned by SPEC-001).
- Other view components.
- DependencyGraph.svelte parent.

## Required behaviour

1. **Kind-as-row layer assignment**: replace topological `dfs(incoming)` with `compactTierMap(kinds)` (already exists in `lib/type-tier.ts`). Layer N = Nth kind tier in compact-tier order (EPIC, PRD, SPEC, RFC, ADR, EVIDENCE, NOTE, PROBLEM, SOLUTION).
2. **Intra-row wrap**: when a kind row's natural width exceeds `1.5 * viewport.w`, wrap excess nodes onto sub-rows of equal cardinality (`ceil(n / subRowCount)`). Spacing: `SUB_ROW_GAP` (≈12 px) between sub-rows of the same kind, full `ROW_GAP` between different kinds.
3. **Edge geometry**: edges still emit from node bottom-center to node top-center using `placed.x/y/h` by id. Wrapping must not break this.

## Data Models

```ts
// New helpers in lib/tree-layout.ts
export function kindTierLayer(kind: string, allKinds: string[]): number;

export function wrapColumns(
  ids: string[],
  widths: Map<string, number>,
  maxRowW: number,
  colGap: number,
): string[][];
```

## Acceptance criteria

- AC-2.1 At 123 artifacts the rendered Tree fills ≥40% of viewport vertically.
- AC-2.2 No kind-row spans more than 1.5× viewport width.
- AC-2.3 At 62 artifacts the layout matches develop branch exactly (regression).
- AC-2.4 Edges preserve correct from/to coords (clicking a Tree node still selects the right artifact).

## Related

- PRD-020 — product requirements.
- RFC-017 — architecture decision (Option A).
- GitHub issue #39 — source.



