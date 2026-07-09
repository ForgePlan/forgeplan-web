---
depth: standard
id: RFC-036
kind: rfc
last_modified_at: 2026-07-08T10:31:08.754877+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: based_on
- target: ADR-011
  relation: refines
- target: SPEC-006
  relation: informs
status: active
title: Lazy 3D iso-map widget in the Map minimap corner, 2D-synced via a three-free shared-drill-bus singleton
---

# RFC-036: Lazy 3D iso-map widget in the Map minimap corner, 2D-synced via a three-free shared-drill-bus singleton

## Status

draft

> Author leaves this RFC in `draft`. Activation is reviewer + guardian territory and requires a linked
> EvidencePack (rule 11, R_eff > 0) — not performed here.
>
> **ADI note (HARD RULE 2).** `forgeplan_reason PRD-039` was invoked for this RFC and returned
> *"LLM provider unavailable or not configured"* — the same workspace-MCP reasoning gap PRD-037 /
> PRD-038 / PRD-039 / ADR-011 all recorded. The gate is mandatory and was invoked; because the
> provider is unavailable at the MCP layer (an infra gap, not a skipped gate), the
> Abduction → Deduction → Induction cycle was run **manually** over the genuinely contested
> render/mount surfaces and is folded into **§ Options Considered** below.
>
> **Doc-accuracy reconciliation (EVID-101 Finding — shared-drill-bus API drift).** The
> Function-Signatures section and the flows around it were reconciled to the **shipped**
> `widgets/composed-map/model/shared-drill-bus.svelte.ts`: the bus exposes exactly
> `sharedFocusChain(): string[]` (reactive read), `focusTo(next): void` (the single content-guarded
> write), and `chainsEqual(a,b): boolean` (the loop guard) — it holds the focus **chain only**.
> Depth (1/2/3) and show/hide are local to the 3D view (`iso-map/model/iso-view-state` + `IsoControls`),
> not the bus; descend/ascend are consumer-level semantics (each surface computes the next chain and
> calls `focusTo`), not bus methods. No source code changed — this edit only aligns the documented
> contract to reality.

## Summary

Realize PRD-039's 3D isometric "exploded-pyramid" layered overview as an **on-demand-loaded widget
mounted in the Map view's bottom-right minimap corner only**, driven by a **plain-data shared
focus-chain singleton** (`shared-drill-bus`) that keeps the flat 2D composed map and the 3D overview
locked to one focus **bidirectionally** — while keeping `three` + `@threlte/*` out of the SSR server
bundle and behind a single lazy client chunk.

Three load-bearing design commitments:

1. **Mount by gate, not by fusion.** A thin `IsoMapCorner` component sits in the minimap slot and
   dynamic-imports the 3D widget **only when `view === 'map'`**; on every other minimap-bearing view
   the existing flat 2D `Minimap` renders unchanged. The main 2D `ComposedMapView` is **untouched**.
2. **A three-free shared bus is the single source of truth.** `shared-drill-bus.svelte.ts` is a
   plain-data module singleton holding the shared focus-**chain only** (`string[]`). It imports **no**
   `three` / `@threlte`, so the 2D + SSR render path stays three-free; both `ComposedMapView` (2D) and
   `iso-view-state` (3D) read it via `sharedFocusChain()` and write it via `focusTo(chain)`. A
   descend/ascend gesture on either surface computes the next focus chain locally and broadcasts it
   with `focusTo`; the other surface reacts and the 3D highlights and expands to the shared focus.
   Depth (1/2/3) and show/hide are the 3D view's own local state — not on the bus.
3. **The 3D is a parallel renderer over the same drill machinery.** It reuses `computeComposedLayout`,
   `deriveSubDocument`, `buildLevelDocuments`, and the `drill-state` seam (RFC-031) and the same
   read-only `/api/map` + `/api/map/layers/<zone>` data (SPEC-006) — **no schema change, no new
   server surface**.

This RFC documents the design **as built** on branch `feat/idef0-3d-iso-view` (an RFC MAY name
libraries; PRD-039 may not). The packaging decision (ship `three`+Threlte as a lazy chunk in the
default image; raise the per-image dist cap 3 → 3.5 MiB) is **inherited from ADR-011** — this RFC
`refines` it into a concrete render/mount architecture rather than re-deciding it.

## Motivation

PRD-039 identifies a **comprehension-at-altitude** gap: the flat composed-map view (PRD-036) shows a
single altitude at a time; drill-down (PRD-037 / RFC-031) makes deeper levels *reachable* but never
shows the altitude you are at together with the ones above and below. PRD-039 FR-001..FR-007 ask for
a 3D isometric overview in the Map-view minimap corner that (a) shows the whole layered stack at once,
(b) navigates altitudes bidirectionally with the flat map, (c) offers a depth control + show/hide
toggle, (d) loads on demand only on Map-view open, and (e) regresses nothing.

Those requirements pose three architecture questions the PRD deliberately left to this RFC:

- **Where does the 3D surface mount** without touching the flat map or the other views? (PRD-039
  FR-001/FR-006; Q3 depth defaults.)
- **How do 3D and 2D share one focus** without a sync loop or divergent foci, and without dragging
  `three` into the 2D/SSR path? (PRD-039 FR-003 / NFR-004; Q4 focus-chain hand-off.)
- **How is the 3D render surface degraded** when WebGL is unavailable? (PRD-039 FR-007; Q5.)

ADR-011 already fixed the *packaging* answer (lazy chunk in the default image, cap 3 → 3.5 MiB, `three`
out of SSR). This RFC fixes the *render/mount* answer and the shared-focus contract, and realizes the
ADR's invariants (INV-1 SSR-free, INV-2 lazy-only, INV-4 read-only) as concrete module boundaries.

## Module Breakdown

Narrow, cohesive modules. New unless marked *reused*.

- **`widgets/iso-map/`** — the 3D overview widget (graduated from the throwaway `/iso-spike` route,
  now removed). Owns the entire 3D render surface. Sub-modules:
  - **`ui/IsoMinimap.svelte`** — container-sized host; subscribes the **shared `mapPoller`**
    (RFC-030 SD-1, *reused*) and passes the `MapDocument` down. The 3D analogue of the flat
    minimap host.
  - **`IsoScene.svelte`** — Threlte composition root: the `<Canvas>`, `OrthographicCamera`,
    `OrbitControls`, and interactivity wiring. The single place that touches the WebGL context.
  - **`ui/*` (single-responsibility scene parts)** — `IsoPlane`, `IsoZoneFrame`, `IsoNodeBox`,
    `IsoFrustum`, `IsoIcomArrows`, `IsoControls` (depth 1/2/3 + ascend + show/hide), `IsoSliverPlane`,
    `IsoDeeperMarker`, `IsoA11yProxy` (keyboard-reachable proxy for the canvas controls), and
    `IsoNodeCard` / `IsoLayerCard` / `IsoLeaderLine` (gated behind `showInfoCards=false` — present but
    off by default).
  - **`lib/iso-projection`** — *pure* geometry: FIPS-183 non-centered plane nesting, the dashed
    frustum, and the ICOM arrows. No THREE object construction; coordinates only.
  - **`lib/iso-materials`** — token → `THREE.Color`, the matte material, and per-level depth falloff
    (ancestor planes fade to faint frames).
  - **`lib/motion`**, **`lib/leader-line`** — explode/camera motion (reduced-motion aware) and
    leader-line geometry.
  - **`model/iso-view-state.svelte.ts`** — the 3D drill/animation state; **owns the depth-window
    (1/2/3) + show/hide visibility locally (never shared)**, and reads `sharedFocusChain()` / writes
    `focusTo(...)` for shared focus.
- **`widgets/composed-map/model/shared-drill-bus.svelte.ts`** — **the load-bearing new contract.** A
  **plain-data** module singleton holding **only** the shared focus-chain (`string[]`, root→focus
  ids). Exposes exactly `sharedFocusChain()` (reactive read), `focusTo(next)` (the single
  content-guarded write), and `chainsEqual(a,b)` (the loop guard). **Depth (1/2/3) and the show/hide
  flag are NOT here** — they are local state in the 3D view (`iso-map/model/iso-view-state` +
  `IsoControls`). Imports **no** `three` / `@threlte` (this exclusion is the whole point — it keeps
  the 2D/SSR path three-free). Read and written by both the 2D and 3D surfaces.
- **`widgets/dependency-graph/ui/IsoMapCorner.svelte`** — the **mount gate**. Dynamic-imports
  `widgets/iso-map` and renders it in the bottom-right corner **only when `view === 'map'`**; on the
  other minimap-bearing views (the flat 2D `Minimap`, *reused, unchanged*) it does nothing. This is
  the sole `three`/`@threlte` reachability point in the static graph.
- **`template/vite.config.ts`** *(touched)* — a `resolve.alias` stub for the unused
  `@threlte/extras` draco/basis loaders (~1.5 MiB) + the `ssr=false` / browser-guard wiring that keeps
  `three` out of `dist/index.js`.
- **`scripts/build.mjs`** *(touched)* — `IMAGE_DIST_MAX_BYTES` raised 3 → 3.5 MiB (already applied in
  commit `a6ef030`, per ADR-011).
- **`template/package.json`** *(touched)* — `three` + `@threlte/*` added to `#dependencies` (runtime
  deps of the web app, rule 21).
- **Reused, unchanged:** `computeComposedLayout`, `deriveSubDocument`, `buildLevelDocuments`,
  `drill-state` (RFC-031), the `mapPoller` (RFC-030 SD-1), `entities/map` transport + validator
  (SPEC-006), and the flat `ComposedMapView` + 2D `Minimap`.

## Component Diagram (prose)

Topology in words (no drawn diagram per house rule):

> The **`mapPoller`** (RFC-030) fetches the read-only `MapDocument` from `GET /api/map` (and per-zone
> layers from `GET /api/map/layers/<zone>`) and publishes it. Two consumers read that document:
> **`ComposedMapView`** (the flat 2D map, unchanged) and **`IsoMinimap`** (the 3D host).
>
> Both consumers read and write **one** shared object — **`shared-drill-bus`** — which holds the
> focus-chain (root → current focus) **only** and is the single source of truth for shared focus.
> **Visible depth (1/2/3) and the hidden flag are NOT on the bus; they are local state in the 3D
> view's `iso-view-state` + `IsoControls`.** The bus is plain data and imports no 3D code, so it is
> reachable from the SSR/2D graph without pulling `three`. It exposes exactly `sharedFocusChain()`
> (read), `focusTo(next)` (write), and `chainsEqual(a,b)` (guard).
>
> The 3D surface is reachable **only** through **`IsoMapCorner`**, which `import()`s
> `widgets/iso-map` lazily and browser-guarded, and renders it **only when the active view is
> `map`**. Inside, **`IsoScene`** builds the Threlte `<Canvas>` (OrthographicCamera + OrbitControls);
> **`iso-view-state`** reads the bus's focus-chain via `sharedFocusChain()`, calls `buildLevelDocuments` +
> `computeComposedLayout` per level, lifts each 2D layout into an isometric plane via
> `lib/iso-projection`, and renders the stack (focused level in full detail via `IsoPlane` /
> `IsoNodeBox`; ancestor levels as faint `IsoZoneFrame` outlines via `iso-materials` depth falloff;
> deeper levels exploded downward). A click on an `IsoZoneFrame` / `IsoNodeBox` computes the next
> chain (`sharedFocusChain()` + the clicked zone id) and calls `focusTo(nextChain)` — a no-op if
> `chainsEqual` finds the chain unchanged; both `ComposedMapView` and `iso-view-state` re-derive from
> the new focus-chain. **Descend/ascend are consumer-level, not bus methods.** `IsoControls` mutates
> the 3D view's **local** depth-window and visibility state (never the bus); ascend is the one control
> that touches shared focus — it computes the parent chain and calls `focusTo(parentChain)`.
>
> If the WebGL context / Threlte init fails, `IsoMapCorner` catches it and renders the flat 2D
> `Minimap` instead (FR-007) — the flat composed map is never affected.

**Data direction:** `mapPoller → {ComposedMapView, IsoMinimap}`; `{ComposedMapView, iso-view-state} ↔
shared-drill-bus` (bidirectional, via `sharedFocusChain()` read + `focusTo()` write);
`IsoMapCorner → dynamic import → IsoScene → three/@threlte` (one-way, lazy, browser-only).

## Data Flow

**Primary flow — descend from the 3D overview (happy path, FR-003).**
User clicks a zone frame in the 3D overview. `IsoScene`'s interactivity resolves the click to a real
`zoneId`, computes the next chain (the current `sharedFocusChain()` with the clicked zone id
appended), and calls `focusTo(nextChain)`. `focusTo` content-compares the incoming chain against the
current one via `chainsEqual` and is a **no-op** (no new array, no reactive notification) when they
match — the loop guard (NFR-004). Both surfaces are reactive readers via `sharedFocusChain()`:
`ComposedMapView` re-runs its drill derivation (`deriveSubDocument` → `computeComposedLayout`) and
descends the flat map into the zone; `iso-view-state` re-runs `buildLevelDocuments(doc,
sharedFocusChain())`, re-projects the stack, highlights the newly-focused plane, and expands to it.
One user action, one `focusTo` write, two reactive re-derivations — the `chainsEqual` guard plus each
view's reconciliation `$effect` pair (OUTBOUND/INBOUND, living in `ComposedMapView.svelte` /
`IsoMinimap.svelte`) prevents any re-emit back into the bus; a chain change that arrives
mid-animation is held pending and retried on animation-settle, which is how the two surfaces converge
without a loop.

**Mirror flow — drill/climb from the flat 2D map.**
User drills or climbs in `ComposedMapView`. `ComposedMapView` computes its next chain (append the
drilled zone id to descend; drop the tip to climb) and writes it via the same `focusTo`;
`iso-view-state` reacts through `sharedFocusChain()` and moves/re-focuses the 3D overview to match,
with no manual re-sync. A descend-then-ascend on **either** surface returns both to the same prior
focus (the chain is treated as a stack by the consumers — descend appends an id, ascend `focusTo`s the
parent chain).

**Depth + visibility flow (FR-004).**
`IsoControls` sets the 3D view's **local** depth-window (1/2/3 — the overview shows exactly that many
levels of the stack) and toggles its **local** visibility (hide/show the 3D overview) — **neither
touches the bus**, which is precisely why they never disturb the flat map's state. Only **ascend**
touches shared focus: it computes the parent chain and calls `focusTo(parentChain)`, and both
surfaces reflect it.

**Named failure path — 3D surface unavailable (FR-007).**
`IsoMapCorner`'s dynamic import or `IsoScene`'s WebGL/Threlte init throws. `IsoMapCorner` catches,
does not propagate, and renders the flat 2D `Minimap` (or an explicit "3D overview unavailable"
state). The flat composed map and every other view are untouched; the corner is never left broken.

**Cold-start exclusion (FR-005 / NFR-002).**
On any non-Map view, `IsoMapCorner` never reaches its dynamic `import()`, so the `three`/`@threlte`
chunk is never fetched, parsed, or initialised. On Map-view open, the import resolves and the chunk is
fetched at that point.

## Function Signatures / Component Contracts

Public surface as built (Svelte 5 runes idiom; the `.svelte.ts` singleton exposes reactive `$state`
via a getter + a single mutator + a pure guard).

**The shared bus — `widgets/composed-map/model/shared-drill-bus.svelte.ts` (the new contract).** A
plain-data singleton over `let chain = $state<string[]>([])`; the chain holds plain zone/node **ids**
(root excluded, deepest entry last — the same shape `drill-state.ts#focusChain(levelStack)` returns),
not objects. Exactly three exports:

- `sharedFocusChain(): string[]` — reactive read of the shared chain; call from inside an `$effect` /
  `$derived` to track changes. It is named `sharedFocusChain`, **not** a bare `focusChain`, to avoid
  colliding with `drill-state.ts`'s unrelated `focusChain(levelStack)` (a per-view *local* chain
  derivation) that the same call sites already import.
- `focusTo(next: readonly string[]): void` — the **single** mutation: set the shared chain to an
  explicit value. **Content-guarded** — a no-op (no new array, no reactive notification) when
  `chainsEqual(current, next)`. The internal comparison read is wrapped in `untrack` so calling
  `focusTo` from inside a reactive `$effect` (as both consuming views do) never makes that effect an
  accidental subscriber of the bus's own state.
- `chainsEqual(a: readonly string[], b: readonly string[]): boolean` — content-equality guard used by
  `focusTo` and by each view's reconciliation effects to suppress redundant re-fires.
- **Not on the bus:** depth (1/2/3) and the show/hide flag — those live in the 3D view's own local
  state (`iso-map/model/iso-view-state.svelte.ts` + `IsoControls`), never shared. **Descend/ascend
  are consumer-level semantics, not bus methods:** each surface computes the next chain (append the
  target id to descend; drop the tip to ascend) and calls `focusTo(nextChain)`; the bus has no
  per-action mutators.
- **Invariant:** imports no `three` / `@threlte` — enforced by review + the SSR-marker test hook.

**The mount gate — `widgets/dependency-graph/ui/IsoMapCorner.svelte`:**

- Reads the active `view`. When `view === 'map'`: `const { default: IsoMinimap } = await
  import('$widgets/iso-map')` (browser-guarded) → render it. Otherwise: render nothing (the flat 2D
  `Minimap` owns the slot on other views). Catches import/init failure → 2D `Minimap` fallback
  (FR-007).

**The 3D host — `widgets/iso-map/ui/IsoMinimap.svelte`:**

- Subscribes the shared `mapPoller` (RFC-030 SD-1), sizes to its container, and passes the
  `MapDocument` to `IsoScene`. Contract mirrors the flat minimap host so the slot swap is transparent.

**The composition root — `widgets/iso-map/IsoScene.svelte`:**

- Props: `{ doc: MapDocument }`. Builds `<Canvas>` + `OrthographicCamera` + `OrbitControls`; reads
  `sharedFocusChain()` for the shared focus and the 3D view's **local** depth-window for how many
  levels to show; on click it computes the next chain and calls `focusTo(nextChain)`. The **only**
  module that touches the WebGL context.

**Pure geometry — `widgets/iso-map/lib/iso-projection`:**

- `projectLevel(layout: ComposedLayout, level: number, depth: number) -> IsoPlane` — lift a 2D
  `ComposedLayout` (SPEC-006 C3) into a stacked isometric plane (FIPS-183 non-centered nesting).
- `buildFrustum(from: IsoPlane, to: IsoPlane) -> DashedFrustum` — the dashed connector between
  altitudes.
- `icomArrows(plane: IsoPlane) -> IcomArrow[]` — the ICOM arrows. All pure — no THREE, no DOM, no
  clock; deterministic like `computeComposedLayout`.

**Materials — `widgets/iso-map/lib/iso-materials`:**

- `tokenToColor(token: string, theme: 'light' | 'dark') -> THREE.Color` — resolves an app style token
  (never a raw hex) into a THREE color, dual-theme correct (NFR-005).
- `depthFalloff(levelsFromFocus: number) -> number` — opacity/detail falloff so ancestor planes
  recede to faint frames.

**Reused, unchanged (SPEC-006 / RFC-031):**

- `computeComposedLayout(canvas, composition, zones, nodes) -> ComposedLayout` — pure layout
  (SPEC-006 C3), run per level.
- `deriveSubDocument(doc, focus) -> MapDocument` and `buildLevelDocuments(doc, chain) ->
  MapDocument[]` — the RFC-031 drill seam (prefer emitted `/api/map/layers/<zone>`, else derive);
  `buildLevelDocuments` is fed the value of `sharedFocusChain()`.

## Options Considered

Manual Abduction → Deduction → Induction over the two genuinely contested render/mount surfaces
(`forgeplan_reason` unavailable — see Status). The *packaging* option space (inline vs lazy chunk vs
opt-in image, and the cap bump) was already decided in **ADR-011** and is **not re-litigated** here;
this RFC's decision space is the **mount topology** and the **3D↔2D sync mechanism**.

### Option 1 — Corner gate + three-free plain-data shared bus (CHOSEN, as built)

`IsoMapCorner` dynamic-imports the 3D widget and mounts it in the minimap slot **only on the Map
view**; a plain-data `shared-drill-bus` singleton (no `three` import) is the single source of truth
that both the 2D `ComposedMapView` and the 3D `iso-view-state` read and write bidirectionally.

- **Pros:**
  - Keeps the mount **Map-view-scoped and additive** — `ComposedMapView` and every other view's 2D
    minimap are byte-untouched (FR-006). The slot swap is invisible to the flat map.
  - The **three-free bus** is what makes ADR-011 INV-1 (0 `three` markers in `dist/index.js`)
    achievable at the *module* level: the 2D/SSR reader of shared focus never transitively imports 3D
    code.
  - One source of truth ⇒ the two surfaces **cannot show divergent foci** (FR-003); the
    **content-guarded `focusTo`** (via `chainsEqual`) guards the click→re-render→re-emit loop
    (NFR-004).
  - `IsoMapCorner` is the single reachability chokepoint for `three`/`@threlte`, so the lazy boundary
    (FR-005) and the honest fallback (FR-007) live in exactly one place.
- **Cons:**
  - Introduces a **widget → widget import** (`iso-map` reads `composed-map/model/shared-drill-bus`) —
    an FSD lateral dependency (see Risks R-3); marked `// TODO(iso-promote)`.
  - Two reactive readers of one mutable singleton demand disciplined content-equality guarding
    (`chainsEqual` on both the write and the reconciliation effects) or the loop returns.

### Option 2 — Mount the 3D inside `ComposedMapView`, sync via its existing drill-state

Render the 3D surface as a child of `ComposedMapView` and reuse that component's own drill/select
state as the shared focus, with no separate bus.

- **Pros:** no new module; one component owns both surfaces; no widget→widget lateral import.
- **Cons:** `ComposedMapView`'s import graph would then transitively reach `three`/`@threlte`, and
  keeping that out of the SSR bundle becomes far more fragile — **directly threatens ADR-011 INV-1**.
  It also violates FR-006's "flat 2D `ComposedMapView` unchanged" and couples the flat map's lifecycle
  to WebGL availability, endangering the FR-007 fallback. **Rejected.**

### Option 3 — 3D as a one-way follower of the 2D map (no shared writable bus)

The 3D overview passively mirrors the flat map's focus (props-drilled copy); clicks in the 3D surface
do not navigate.

- **Pros:** trivially loop-free (data flows one way); simplest sync.
- **Cons:** loses "click the overview to navigate" — the entire point of an **overview** (FR-003 AC-1
  fails). A props-drilled copy also risks two foci drifting if the copy lags. **Rejected.**

### Chosen

**Option 1.** The manual ADI synthesis: only Option 1 satisfies the full FR set at once —
Map-view-scoped additive mount (FR-001/FR-006), true bidirectional navigation from one source of
truth (FR-003), a single chokepoint that makes lazy-load (FR-005) + honest fallback (FR-007) local,
and — decisively — a **three-free shared bus** that keeps ADR-011 INV-1 (SSR three-free) reachable at
the module level, which Option 2 structurally endangers. The one real cost (the widget→widget import,
R-3) is bounded and carries an explicit promote-later TODO. This matches the as-built branch
`feat/idef0-3d-iso-view`.

## Proposed Direction

### Mount + sync (the chosen architecture)

Adopt Option 1 exactly as built: the `IsoMapCorner` gate, the `widgets/iso-map/` widget, and the
plain-data `shared-drill-bus` singleton as the single source of truth for a bidirectionally-synced
**focus-chain** (`sharedFocusChain()` read / `focusTo(next)` write / `chainsEqual` guard). Depth
control (1/2/3 + ascend) and the hide/show toggle live in the 3D view's own local state
(`iso-view-state` + `IsoControls`), not the bus — only ascend touches shared focus, via
`focusTo(parentChain)`. The 3D is a **parallel renderer over the same drill machinery**
(`computeComposedLayout`, `deriveSubDocument`, `buildLevelDocuments`, `drill-state`, `mapPoller`) —
**no schema change** (SPEC-006 `forgeplan.map/v1` consumed as-is).

### Lazy-chunk boundary (the hexagonal port) + SSR-exclusion invariant

`three` + `@threlte/*` form a **separate async client chunk** reachable **only** through the
browser-guarded dynamic `import()` inside `IsoMapCorner`. The static import graph of `ComposedMapView`,
the 2D `Minimap`, the `entities/map` poller/validator, and the `shared-drill-bus` contains **zero**
`three`/`@threlte` references — that exclusion is what keeps the SSR server bundle
(`dist/index.js`) three-free. The invariants are restated in **§ Invariants** below.

`template/vite.config.ts` stubs the unused `@threlte/extras` draco/basis loaders (~1.5 MiB) via a
`resolve.alias` to an empty module. **This alias is load-bearing** (Risk R-4): if a future
`@threlte/extras` feature needs the real loaders, the stub silently breaks it —
`// TODO(iso-draco-basis)` guards it.

### Cap / bundle change (inherited from ADR-011)

`scripts/build.mjs` `IMAGE_DIST_MAX_BYTES` is 3 → 3.5 MiB (already applied in commit `a6ef030`). This
RFC does not re-decide it — it `refines` ADR-011. Measured this session: draco/basis stub −~1.5 MiB,
`three` excluded from SSR, `three`+Threlte as a ~808 KiB lazy chunk, `dist/` **6.0 → ~3.4 MiB**. The
**authoritative packaged-size delta is TBD** — measured at prove-phase (`du -sb dist*/`) and recorded
in the EvidencePack (PRD-039 Q2 / AC-5), never invented here. The raised cap is **3.5 MiB, not a blank
check** (ADR-011 INV-3): the build assertion still fires above 3.5 MiB.

### Accessibility / theming / motion

`iso-materials` resolves colors from app style tokens only (0 raw hex/rgb in new components,
dual-theme). `IsoA11yProxy` + `IsoControls` keep the depth control, ascend, and show/hide toggle
keyboard-reachable. A reduced-motion preference snaps the explode/camera motion to **0 ms**
(NFR-005). The `showInfoCards=false` gate keeps `IsoNodeCard` / `IsoLayerCard` / `IsoLeaderLine`
present-but-off by default.

## Invariants

What this design must NEVER violate (mirrors + extends ADR-011 INV-1..INV-4 at the module level):

- **INV-A (= ADR-011 INV-1) — SSR three-free.** `dist/index.js` carries **0** `three` markers.
  `three`/`@threlte` are reachable only via `IsoMapCorner`'s SSR-guarded (`ssr=false` + browser guard)
  dynamic `import()`; `shared-drill-bus`, `ComposedMapView`, the 2D `Minimap`, and `entities/map`
  import no 3D code.
- **INV-B (= ADR-011 INV-2) — lazy-only.** The 3D rendering stays a **separate lazy client chunk**
  loaded only on Map-view open — never inlined into the base bundle.
- **INV-C — three-free shared bus.** `shared-drill-bus.svelte.ts` imports **no** `three`/`@threlte`
  and is the single source of truth for shared focus — the focus-**chain** only
  (`sharedFocusChain()` / `focusTo` / `chainsEqual`); depth and visibility are the 3D view's local
  state, not shared. (This is what makes INV-A achievable at the module level.)
- **INV-D — additive, flat-map untouched.** `ComposedMapView` and every non-Map view's 2D `Minimap`
  render byte-identically to base (FR-006); the 3D swap is Map-view-scoped.
- **INV-E — guarded sync.** The shared focus-chain reconciles both surfaces without a feedback loop,
  drift, or divergent foci; `focusTo(currentChain)` is a content-guarded no-op via `chainsEqual` — no
  new array, no reactive notification (NFR-004).
- **INV-F (= ADR-011 INV-4) — read-only.** The overview is a pure client render of the existing
  read-only `/api/map` + `/api/map/layers/<zone>` data — no new server surface, no spawn, no network
  (rule 22).
- **INV-G — cap is a bound, not a blank check.** No emitted image exceeds 3.5 MiB
  (`IMAGE_DIST_MAX_BYTES`); the build assertion still fires above it (ADR-011 INV-3).

## Implementation Phases

The code exists as built on `feat/idef0-3d-iso-view`; these phases are the review/prove ordering the
downstream pipeline should target, each independently verifiable.

1. **Phase 1 — Shared contract + mount gate.** Land `shared-drill-bus.svelte.ts` (plain-data, three-
   free) and `IsoMapCorner.svelte` (gate + dynamic import + 2D fallback). Verify: `ComposedMapView`
   and all non-Map minimaps byte-unchanged (FR-006); bus unit tests (`focusTo` content-guard via
   `chainsEqual`, `sharedFocusChain()` reactivity, consumer-computed descend/ascend chain math, no
   re-entrant loop — NFR-004).
2. **Phase 2 — 3D widget over the drill machinery.** Land `widgets/iso-map/` (`IsoMinimap`,
   `IsoScene`, `ui/*`, `lib/*`, `iso-view-state`) reading the shared bus and reusing
   `buildLevelDocuments` / `computeComposedLayout` / `deriveSubDocument`. Verify: bidirectional sync
   end-to-end (click 3D → 2D descends + 3D expands; drill 2D → 3D re-focuses); depth control + toggle
   (FR-003/FR-004).
3. **Phase 3 — Lazy boundary + SSR exclusion.** Land the `vite.config.ts` draco/basis stub +
   `ssr=false`/browser-guard wiring; add `three`+`@threlte/*` to `template/package.json#dependencies`.
   Verify: 0 `three` markers in `dist/index.js` (INV-A); asset trace shows the chunk absent on non-Map
   view load, present on Map open (FR-005/NFR-002).
4. **Phase 4 — Cap + packaging proof.** Confirm `IMAGE_DIST_MAX_BYTES = 3.5 MiB` (`a6ef030`); build
   passes the assertion; measure `du -sb dist*/` and record the 3D-chunk delta in the prove-phase
   EvidencePack (PRD-039 AC-5; ADR-011 reconciliation).
5. **Phase 5 — Fallback, a11y, motion.** Verify FR-007 honest fallback (force WebGL-init failure → 2D
   `Minimap`, flat map intact); reduced-motion 0 ms snap; token-only theming grep; keyboard reach; the
   full `svelte-check` (0) + `vitest` (0) gate (NFR-003).

## Rollback Plan

Backout mirrors ADR-011's rollback plan (the earlier "Force 3D" revert `7f907dd` proves it is clean);
if the design fails (unacceptable size slack, `three` maintenance/security burden, or the 3D minimap
is dropped), reverse in this order:

1. **Drop the mount.** Remove `widgets/dependency-graph/ui/IsoMapCorner.svelte`'s dynamic import (or
   the component) so nothing reaches the 3D chunk; the Map view falls back to the flat 2D `Minimap`
   (FR-007 already specifies the honest 2D fallback) — the flat composed map is unaffected.
2. **Remove the widget + bus.** Delete `widgets/iso-map/` and
   `widgets/composed-map/model/shared-drill-bus.svelte.ts`; `ComposedMapView`'s own drill-state is
   already self-sufficient, so removing the bus does not regress 2D drill-down.
3. **Revert the cap bump.** Revert commit `a6ef030` so `IMAGE_DIST_MAX_BYTES` returns to 3 MiB.
4. **Drop the deps + alias.** Remove `three` + `@threlte/*` from `template/package.json#dependencies`
   and the `vite.config.ts` draco/basis stub alias (it goes with them).
5. **Rebuild + verify.** `npm run build` must re-pass the restored 3 MiB assertion; `npm run smoke`
   green on the `stable` image; `svelte-check` + `vitest` green.

Because the shared bus is three-free and the mount is a single gated component, steps 1–2 alone
already restore the pre-feature UX without touching the flat 2D map or the other 8 views.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **R-1 Sync loop** — click→descend→re-render→re-emit runaway between 2D and 3D | med | high | One writable source of truth; **content-guarded `focusTo`** (`chainsEqual`: writing the chain's current value = no-op, no new array / no notification); the view reconciliation effects also compare via `chainsEqual` before firing, and a mid-animation change is held pending + retried on settle; reactive readers never write back on read; covered by bus unit tests (NFR-004 / INV-E) |
| **R-2 SSR leak** — a static import accidentally pulls `three` into `dist/index.js` | med | high | `three`/`@threlte` reachable only via `IsoMapCorner`'s browser-guarded dynamic import; `shared-drill-bus` is three-free by contract; SSR-marker grep test hook (INV-A / ADR-011 INV-1) |
| **R-3 FSD widget→widget import** — `iso-map` imports `composed-map/model/shared-drill-bus` (lateral) | high (present) | low–med | Documented + `// TODO(iso-promote)`: promote the shared drill logic to `entities/` on a later pass; does not re-skin primitives (rule 24) or invert FSD *direction*, it is a lateral widget coupling only |
| **R-4 draco/basis stub is load-bearing** — future `@threlte/extras` loader use silently breaks against the vite alias | low | med | `// TODO(iso-draco-basis)` on the alias; ADR-011 revisit trigger; any real-loader need re-opens the stub decision |
| **R-5 Bundle regression hides under the raised cap** — +0.5 MiB slack lets future growth pass unnoticed | med | med | Cap is 3.5 MiB **not** blank check (INV-G / ADR-011 INV-3); `scripts/build.mjs` assertion still fires > 3.5 MiB; ADR-011 metric revisit trigger on any image > 3.5 MiB |
| **R-6 Focus-chain contention** — the shared bus vs the PRD-038 onboarding tour + Tier-1 `show_on_map` camera all want to move the view | med | med | Bus is the single writer of shared focus; precedence/hand-off with PRD-038 is **unresolved** (PRD-039 Q4) — flagged as an Open Question, not silently assumed |
| **R-7 WebGL unavailable** — headless / no-GPU / context-loss leaves the corner broken | med | med | `IsoMapCorner` catches import/init failure → flat 2D `Minimap` fallback (FR-007); flat map never coupled to WebGL availability |
| **R-8 Packaged-size delta unknown** — the real on-disk cost is not yet measured | high | low | Stated **TBD**; measured `du -sb dist*/` recorded in prove-phase EVID (never invented) — PRD-039 AC-5 / Q2 |

## Test Strategy Hooks

Targets for the downstream `tester` / reviewer agents (hooks, not full cases):

- **Build-under-cap assertion** — `scripts/build.mjs` `du -sb dist*/` ≤ `IMAGE_DIST_MAX_BYTES`
  (3.5 MiB) for every emitted image (NFR-001; ADR-011 metric trigger). Record the 3D-chunk delta in
  the EVID (TBD → EVID).
- **SSR-exclusion assertion** — grep `dist/index.js` for `three` markers → **0** (INV-A / ADR-011
  INV-1). Property test on the module graph: `shared-drill-bus`, `ComposedMapView`, 2D `Minimap`,
  `entities/map` import no `three`/`@threlte`.
- **Lazy-load asset trace** — network/asset trace shows the `three`/`@threlte` chunk **absent** on any
  non-Map view load and **present** only after Map-view open (FR-005 / NFR-002; first-render budget
  **TBD ms** → EVID).
- **shared-drill-bus properties** (the load-bearing new contract, NFR-004 / INV-E) — `focusTo(nextChain)`
  then `focusTo(parentChain)` returns to the prior focus; `focusTo(currentChain)` is a no-op
  (`chainsEqual` guard — no new array, no notification); `sharedFocusChain()` reflects the last
  `focusTo`; the consumer-computed descend/ascend chain math is tested at the view level; no
  re-entrant emit loop across the outbound/inbound effect pair.
- **Bidirectional-sync contract test at the `ComposedMapView` ↔ `iso-view-state` bus boundary** —
  click zone in 3D ⇒ 2D descends + 3D expands/highlights; drill/climb in 2D ⇒ 3D re-focuses; the 3D
  view's local depth control shows exactly N levels; the local toggle hides/restores without
  disturbing the flat map (FR-003 / FR-004).
- **Honest-fallback failure injection** — force `IsoScene` WebGL/Threlte init failure ⇒ flat 2D
  `Minimap` renders, flat composed map intact, corner not broken (FR-007).
- **No-regression gate** — `svelte-check` 0 errors + `vitest` 0 failures; manual smoke across all view
  ids + the drill-down path; each non-Map minimap byte-identical to base (NFR-003 / FR-006 / INV-D).
- **Theming / a11y / motion** — grep for hex/rgb literals in new `iso-map` components → 0 (token-only,
  NFR-005); `iso-materials.tokenToColor` dual-theme resolution; keyboard reach of `IsoControls` via
  `IsoA11yProxy`; reduced-motion ⇒ 0 ms explode/camera.
- **Governance (rule 22)** — spawn/execFile/fetch/write greps over new route + `shared/server` files
  → 0 new endpoints / 0 mutation call sites; the overview reads only existing GET-only `/api/map` +
  `/api/map/layers/<zone>` (NFR-006 / INV-F).

## Related Artifacts

- **PRD-039** — parent product spec (3D isometric layered overview minimap). This RFC is `based_on`
  it and realizes FR-001..FR-007 / NFR-001..NFR-006; it answers the PRD's deferred Q3 (depth control),
  Q4 (focus-chain hand-off — flagged unresolved, R-6), Q5 (fallback — FR-007).
- **ADR-011** — companion decision (ship `three`+Threlte as a lazy client chunk in the default image;
  raise per-image dist cap 3 → 3.5 MiB). This RFC `refines` it into the concrete render/mount
  architecture and realizes its INV-1..INV-4 as module boundaries (INV-A..INV-G above).
- **SPEC-006 / RFC-030** — the `forgeplan.map/v1` render contract, the `computeComposedLayout` pure
  function (C3), the read-only `/api/map` endpoint (C5), and the `mapPoller` (SD-1). Consumed as-is —
  **no new SPEC, no schema change**; the 3D reads the same document the 2D view reads.
- **PRD-037 / RFC-031** — the recursive drill-down seam (`deriveSubDocument`, `buildLevelDocuments`,
  `drill-state`, prefer-emitted-layer) the 3D is a parallel renderer over.
- **PRD-038** — Phase-3 onboarding + Tier-1 `show_on_map` camera the shared focus-chain must hand off
  with (R-6 / PRD-039 Q4).
- **PRD-030 / rule 21** — the per-image dist-size cap ADR-011 amends (3 → 3.5 MiB); rule 22 — the
  read-only proxy boundary (untouched).
- **EVID-101** — the re-review finding that surfaced the shared-drill-bus API drift this RFC's
  Function-Signatures + flows were reconciled against (see Status).
- **EvidencePack (PRD-039 prove-phase)** — measured `du -sb dist*/` delta + on-demand-load trace +
  bidirectional-sync + no-regression smoke; linked `informs` before activation (rule 11, R_eff > 0).

## References

- Branch `feat/idef0-3d-iso-view` — the as-built implementation this RFC documents.
- `widgets/iso-map/` (widget), `widgets/composed-map/model/shared-drill-bus.svelte.ts` (bus — exports
  `sharedFocusChain` / `focusTo` / `chainsEqual`),
  `widgets/iso-map/model/iso-view-state.svelte.ts` (local depth/visibility + shared-focus read/write),
  `widgets/dependency-graph/ui/IsoMapCorner.svelte` (mount gate), `template/vite.config.ts` (draco/
  basis stub + SSR guard), `scripts/build.mjs` (`IMAGE_DIST_MAX_BYTES`), `template/package.json`
  (`three` + `@threlte/*`).
- commit `a6ef030` — "build(idef0): raise dist cap 3M -> 3.5M for lazy 3D Map minimap" (`TODO(iso-adr)`
  closed by ADR-011).
- commit `7f907dd` / `dffbe25` (#103 / #104) — the reverted "Force 3D" Threlte view mode (reversibility
  precedent cited by ADR-011).
- Threlte (`@threlte/core`, `@threlte/extras`) + three.js — the WebGL runtime named per RFC latitude
  (an RFC MAY name libraries; PRD-039 may not).



