---
depth: standard
id: RFC-019
kind: rfc
last_modified_at: 2026-05-07T20:54:28.518672+00:00
last_modified_by: claude-code/2.1.132
links:
- target: PRD-022
  relation: based_on
status: active
title: Force 3D rendering — Threlte canvas + d3-force-3d bridge
---

---
id: RFC-019
title: "Force 3D rendering — Threlte canvas + d3-force-3d bridge"
status: Draft
author: claude-code
created: 2026-05-07
updated: 2026-05-07
prd: PRD-022
depth: standard
---

# RFC-019: Force 3D rendering — Threlte canvas + d3-force-3d bridge

## Progress

```
Phase 1  ████████████████████░░░░  4/5  ( 80%)
Phase 2  ░░░░░░░░░░░░░░░░░░░░░░░░  0/3  (  0%)
─────────────────────────────────────────────────
TOTAL                               4/8  ( 50%)
```

---

## Summary

Add a new `force3d` view mode that renders the dependency graph in a Threlte
canvas, simulating positions with `d3-force-3d` (the 3-axis sibling of
`d3-force` we already use). The chunk is lazy-loaded; non-3D users pay
nothing.

## Motivation

PRD-022 is the user-facing motivation. From an engineering standpoint:

- The 2D `d3-force` simulation we already run is naturally extensible to a
  third axis — `d3-force-3d` is API-compatible enough that the existing
  link / charge / collide setup ports near-1:1.
- Threlte v8 provides Svelte 5-native (runes) bindings on top of Three.js,
  so we get declarative scenes (`<T.Mesh>`, `<T.Line>`) and a `useTask` for
  per-frame work — no manual rAF loop, no manual cleanup.
- The view-mode plumbing is already a discriminated union (`GraphView`); a
  new entry is a one-line append + a new branch in `DependencyGraph.svelte`.
- We can lazy-load the chunk with `await import(...)` so Three.js never
  enters the main bundle (NFR-003).

If we do nothing: dense workspaces remain hairballs in 2D; the only escape
is filtering, which is per-user effort.

## Goals

- A new `force3d` view mode, last in the dropdown, with an `experimental` badge.
- Same data shape as 2D Force (artifacts + edges + scores) — no new endpoints.
- Same visual grammar (kind colors, status rings, R_eff sizing).
- Lazy-loaded — zero bundle cost for users who never open Force 3D.
- Camera orbit + zoom out of the box.
- Hover highlight parity with 2D Force.
- Reduced-motion preference honoured.

## Non-Goals

- Persisting camera state across sessions / URLs (deferred).
- Custom shaders / bloom / FXAA / post-processing.
- Touch / mobile optimisation.
- VR / WebXR.
- An in-Force-mode 2D ↔ 3D switch (recorded as TODO; separate PRD).
- Per-node sprite labels (hover-only for MVP).

## Options Considered

### Option A: Threlte v8 + d3-force-3d (chosen)

**Description**: Render with Threlte's declarative `<T.*>` components,
simulate with `d3-force-3d` (drop-in 3D version of the 2D forces we already
use), bridge sim ticks → reactive `$state` arrays via Threlte's `useTask`.

**Pros**:
- Svelte 5 runes-native; no foreign reactivity model.
- Declarative scene graph reads like the rest of our codebase.
- `d3-force-3d` reuses our knowledge of `d3-force` exactly.
- Smallest authoring surface — no React, no Vue, no DOM-imperative Three.js.

**Cons**:
- Threlte v8 is recent — fewer Stack Overflow answers than r3f.
- Adds Three.js (≈150KB gzip) — must lazy-load.

### Option B: Vanilla Three.js + d3-force-3d

**Description**: Hand-rolled Three.js scene inside a Svelte component;
manual rAF loop; manual disposal.

**Pros**:
- Smallest dependency footprint (no Threlte).
- Total control over the render loop.

**Cons**:
- We re-implement Threlte's lifecycle / cleanup / reactivity bridge by hand.
- Cleanup-on-unmount is the #1 source of WebGL memory leaks; Threlte's
  context handles it.
- Verbose; reads nothing like the rest of the codebase.

### Option C: 3d-force-graph (the reference library)

**Description**: Drop-in `3d-force-graph` (vasturiano) — a high-level
wrapper that builds the scene + simulation + camera for you.

**Pros**:
- Fastest path to a working demo (literally `new ForceGraph3D(el)`).

**Cons**:
- Vanilla-DOM API; we'd wrap it in Svelte for no gain.
- It pulls in **its own** copy of Three.js + d3-force-3d, no tree-shaking.
- Visual customisation is via callbacks (`nodeThreeObject(node)`) — fine,
  but harder to keep in sync with our tokens and our `bits-ui` patterns.
- Doesn't fit Forgeplan's design language without heavy override; the user
  brief says explicitly "more beautiful + adapted to forgeplan specifics",
  not "ship the demo".

### Option D: react-three-fiber

**Description**: Use r3f via the Svelte/React boundary.

**Pros**: Largest ecosystem.
**Cons**: Foreign reactivity model; adds React; defeats the rationale of a
Svelte-first repo. Rejected outright.

## Trade-off Analysis

| Критерий | A (Threlte) | B (Vanilla Three) | C (3d-force-graph) | D (r3f) |
|----------|-------------|-------------------|--------------------|---------|
| Complexity | Low | Medium-High | Lowest | High |
| Cost (bundle, gzip) | ~155KB (Three+Threlte) | ~145KB (Three only) | ~165KB (Three + lib) | +React |
| Scalability | High (declarative scene scales) | Medium | Limited (callbacks) | High |
| Migration risk | Low (Svelte 5 native) | Medium (manual cleanup) | Medium (wrapping library) | High (React) |
| Developer experience | Best (matches repo style) | Worst (imperative) | OK | Foreign |
| Operational burden | Same as 2D | Higher (manual disposal) | Same | High |
| Visual customisation | Full (declarative `<T.*>`) | Full | Indirect (cb-driven) | Full |

## Proposed Direction

**Option A** — Threlte v8 + `d3-force-3d`. Lazy-loaded. Visual styling via
existing `kindBorder` / `statusRing` / `r_eff` mappings (so 2D ↔ 3D parity
is structural). Camera via Threlte's `<OrbitControls>` (or `@threlte/extras`).

## Risks & Open Questions

- **R-1 Bundle size**: Threlte + Three.js add ~155KB gzip. Mitigation:
  dynamic `import()` in `DependencyGraph.svelte` so the chunk is only
  fetched when Force 3D is selected. Verification: `du -sb
  dist/client/_app/immutable/` against baseline (NFR-003).
- **R-2 SSR**: Three.js touches DOM globals. Mitigation: SvelteKit's
  client-only branch; the `Force3DView` is mounted under `{#if browser}`.
- **R-3 Threlte v8 churn**: Threlte is on a fast cadence. Mitigation: pin
  exact version in `dependencies`; quarterly bump as a chore.
- **R-4 Hover edge highlight**: `<T.Line>` doesn't support per-segment
  hover-state cheaply. Mitigation: rebuild the relevant `BufferGeometry`
  on hover (cheap at 200 nodes).
- **Open**: do we need a minimap in 3D? **A**: not for MVP — the 2D Minimap
  doesn't generalise; defer.
- **Open**: do we render labels? **A**: not for MVP — sprite labels at 200
  nodes are noise; tooltip-on-hover only.

## Implementation Phases

### Phase 1: Wiring + minimum viable 3D
- [x] **1.1** Add `threlte`, `three`, `d3-force-3d`, types to `template/package.json`.
- [x] **1.2** Extend `GraphViewMeta` with optional `badge`; register `force3d` last in `GRAPH_VIEWS` + `GraphView`.
- [x] **1.3** New widget `widgets/dependency-graph-3d/` (Threlte canvas, sim, spheres, edges, OrbitControls).
- [x] **1.4** Wire dynamic-import branch in `DependencyGraph.svelte`.
- [ ] **1.5** Render badge in `Select.svelte` (next to label).

### Phase 2: Polish + parity
- [ ] **2.1** Hover highlight parity (neighbours bright, others dim).
- [ ] **2.2** Reduced-motion: alpha decay 2× faster.
- [ ] **2.3** TODO marker in `ForceView.svelte` for the future in-mode switch.

## Affected Files

- `template/package.json` — add `threlte`, `three`, `d3-force-3d`, `@types/three`, `@types/d3-force-3d`.
- `template/src/shared/config/ui-prefs.ts` — `force3d` entry + `badge?: string` field.
- `template/src/shared/ui/select/Select.svelte` — render `item.badge` next to label, in trigger and dropdown.
- `template/src/widgets/dependency-graph-3d/{ui/Force3DView.svelte,ui/index.ts,index.ts,model/types.ts,lib/sim-3d.ts,lib/theme-3d.ts}`.
- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — `force3d` branch with `await import(...)`.
- `template/src/widgets/dependency-graph/ui/ForceView.svelte` — `// TODO(force-mode-2d3d-switch)`.

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-022 | PRD | based_on |
| EVID-XX | EvidencePack | informs (after smoke) |

---

> **Next step**: validate, build, smoke, evidence, activate.



