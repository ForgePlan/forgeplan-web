---
depth: standard
id: RFC-031
kind: rfc
last_modified_at: 2026-07-05T16:34:12.799010+00:00
last_modified_by: claude-code/2.1.201
links:
- target: PRD-037
  relation: based_on
- target: ADR-009
  relation: informs
- target: RFC-030
  relation: refines
- target: SPEC-006
  relation: based_on
status: active
title: Recursive drill-down via derive-subdocument + reused pure layout, with fit-relative zoom-to-descend thresholds
---

## Status

draft

> **SPARC Architecture phase.** This RFC architects **HOW** PRD-037 (Recursive IDEF0 drill-down,
> T4 Phase-2) is built. Three product decisions (D1 client-derived data source, D2 interaction
> contract, D3 honesty/invariants) are **fixed inputs** from the user — this RFC does not re-open
> them; it weighs the *implementation* options underneath them and picks one. The one genuinely
> contested decision (D2's zoom-to-descend reversing §15's magnify-only gesture) is recorded
> separately in **ADR-009** (this RFC `informs` it).
>
> **ADI note (HARD RULE 2).** `forgeplan_reason PRD-037` was invoked and returned
> *"LLM provider unavailable or not configured"* — the workspace MCP server is stale (the same gap
> PRD-037 itself recorded). The Abduction → Deduction → Induction cycle was therefore run **manually**
> over the two contested implementation choices (recursion strategy; threshold/hysteresis model). Both
> cycles and their synthesised recommendations are in **Options Considered** below.

## Summary

Make the composed-map (the 9th view, RFC-030 / SPEC-006) **navigable at depth** by letting the user
*descend* into a zone or collapsed mega-node and read its contents as a fresh **zoned sub-map at the
next altitude** (the IDEF0 decompose move), then *climb* back — with **no per-node x/y at any
altitude, append-stability preserved recursively, and zero regression** to the flat Phase-1 map or the
other 8 views.

The architecture rests on one move: **derive a sub-document, then reuse the existing pure layout
function verbatim.** A new pure `deriveSubDocument(doc, focusId)` un-hides the child nodes that
SPEC-006's validator (Rule 11) already requires to be present as full objects in `nodes[]`, groups them
into deterministic sub-zones, and hands the result to the **unchanged** `computeComposedLayout`. A
level is just a fold: `activeDoc = focusChain.reduce(deriveSubDocument, rootDoc)`; level 0 (empty chain)
is byte-identical to Phase 1. Interaction gains **dual, cursor-targeted entry** — a drag-free click on
empty zone area descends, and a Ctrl/⌘-wheel zoom-in over a zone descends once it crosses a
**fit-relative scale threshold** — with a breadcrumb + Esc to climb. Hit-testing runs in the
**transformed (post-pan/zoom) coordinate space**. No `map.json` change, no schema change, no new
`/api/*` surface (rule 22 intact).

## Motivation

PRD-037's measured ground truth: `forgeplan-map-pack` v0.6.0 on ForgePlanWeb emits **4 zones / 214
nodes**, where `z.decisions` = **170 artifacts collapsed into ONE** mega-node card. Of the 8 visible
cards, **0 carry an `artifact_id`** — every one of the 170 real, openable artifacts is hidden *inside*
a collapsed mega. A user can select nothing, open nothing, and see no decision structure: the flat map
is a visual dead end. `computeComposedLayout` deliberately *excludes* a collapsed mega's children from
the flat layout (so they do not double-draw), which is correct for Phase 1 but leaves the children with
nowhere to go.

**Load-bearing fact that shapes the whole design:** those 170 children are **already full node objects
in the served document's `nodes[]`** (SPEC-006 validate.ts Rule 11 mandates it for mega integrity — it
is *why* `computeComposedLayout` must exclude them). Drill-down therefore **un-hides what already
exists**: it fetches nothing, synthesises nothing, mints no node id. This is exactly why D1
(client-derived) is feasible with no emitter and no schema change.

**Constraints this RFC must honour recursively (from PRD-037 Constraints + SPEC-006 C3 + PROJECT-MAP-SPEC
§4/§19):** no node ever carries x/y; geometry at every altitude is the output of the pure layout
function; per-zone `cols` stays pinned (never derived from node count); append-stability holds at every
altitude; token-only neutral zones (§16); rule 22 read-only boundary; FSD layering + rule 24
(shared/ui ownership).

**Fixed user decisions baked in as constraints (do NOT re-open):**

- **D1 — data source = Option A (client-derived).** Sub-levels are derived client-side from
  `nodes[] + children[] + zone.layers[]`. Resolves PRD-037 **Q1**.
- **D2 — interaction contract.** (a) Click empty zone area → **descend** into that zone; click a node
  **card** → **select** (open in the right artifact tab); the existing >3px drag-suppression still
  gates both. (b) Ctrl/⌘-wheel zoom **in** over a zone past `T_descend` → descend into *that* zone
  (reset new level to fit); zoom **out** past `T_ascend` → ascend one level; between the two thresholds
  it is ordinary §15 magnify/pan. (c) Breadcrumb + Esc/crumb-click = climb. (d) Cursor→zone hit-testing
  in the **transformed** coordinate space. Resolves **Q2** (the reversal → ADR-009), **Q3**, **Q8**.
- **D3 — honesty + invariants.** No x/y ever; pure geometry at every altitude; append-stability
  recursive; a leaf is honest ("nothing deeper"), never a fabricated sub-map; additive with zero
  regression; drilling is **live-only** (Invariant 8 / SPEC-006 C6). Resolves **Q7** (this RFC picks
  *suspend + reset-to-root*).

## Options Considered

### ADI cycle A — Recursion strategy (task-named: re-run on a filtered sub-document per level, vs a single layout with nested groups)

**Abduction (≥3 hypotheses).**
- **A1 — Derive-then-reuse.** A new pure `deriveSubDocument(doc, focusId)` produces the child
  altitude's `MapDocument`; the existing `computeComposedLayout` runs on it **unchanged**. Levels
  compose as `focusChain.reduce(deriveSubDocument, rootDoc)`.
- **A2 — Focus parameter inside the layout.** Extend `computeComposedLayout(doc, focus?)` to filter to
  the focused subtree and lay out nested groups in a single pass.
- **A3 — Eager whole-tree.** Pre-expand and lay out every altitude at once; show/hide by depth.

**Deduction (against: no-x/y, recursive append-stability FR-005, deterministic FR-007, zero-regression FR-008, testability).**
- **A1**: level 0 = `rootDoc` verbatim ⇒ `computeComposedLayout` output is *byte-identical* to Phase 1
  (FR-008 by construction). Append-stability holds because it is the **same proven function** on a
  deterministic subset (the Phase-1 layout test suite already certifies determinism / pinned-cols /
  append-stability — it now applies per altitude). New logic is isolated in one separately-unit-testable
  pure function. Cost: `deriveSubDocument` must synthesise a deterministic sub-composition — the real
  work, but bounded and pure.
- **A2**: the proven Phase-1 path now **branches on focus** ⇒ regression risk to the load-bearing
  function; two responsibilities (derive + place) muddy the pure-geometry contract; append-stability
  reasoning now spans derive *and* layout inside one function; the derive step can no longer be tested in
  isolation.
- **A3**: unbounded on deep trees; wasteful memory; contradicts "one altitude at a time"; over-engineered
  for the 214-node case and every larger one.

**Induction (synthesis).** A1 dominates: it keeps the load-bearing invariant untouched, isolates all new
logic in a pure, independently-testable function, and makes recursion a trivial fold. **Chosen: A1.**

### ADI cycle B — Threshold / hysteresis model for zoom-to-descend

**Abduction (≥3 hypotheses).**
- **B1 — Absolute-k thresholds.** Descend when `transform.k ≥ 2.4`, ascend when `k ≤ 0.45`.
- **B2 — Fit-relative RATIO thresholds.** Each level records its fit scale `kFit`; descend when
  `k / kFit ≥ R_DESCEND` over a zone, ascend when `k / kFit ≤ R_ASCEND`; reset-to-fit lands at
  ratio 1.0 (mid-band) + a post-transition cooldown + cross-once semantics + clamp-on-restore.
- **B3 — Accumulated-delta / velocity thresholds.** Descend when summed wheel `deltaY` over a zone
  exceeds a magnitude within a time window.

**Deduction (against: preserve the §15 magnify band; one physical gesture = one transition / no bounce;
scale-invariance across altitudes; discoverability).**
- **B1**: an absolute k is meaningless across altitudes — a big sub-map fits at `k≈0.3`, a small one at
  `k≈1.2`; a fixed threshold fires inconsistently and a reset-to-fit can itself sit above/below the
  threshold ⇒ bounce.
- **B2**: **scale-invariant** (ratio to each level's own fit); the reset-to-fit = ratio 1.0 sits inside
  the neutral band `[R_ASCEND, R_DESCEND]` *by construction* ⇒ inherent anti-bounce; the §15 magnify
  band is literally d3-zoom's own continuous zoom between the thresholds; a short cooldown absorbs the
  trackpad inertial-delta tail; clamp-on-restore stops an ascend from immediately re-descending. Cost:
  track `kFit` per level and relativise d3's `scaleExtent` per level.
- **B3**: heavy state (accumulation + windows); mouse-wheel vs trackpad emit wildly different delta units
  ⇒ untunable; poor discoverability; unpredictable.

**Induction (synthesis).** B2 dominates on scale-invariance and *inherent* hysteresis. **Chosen: B2**,
with concrete values `R_DESCEND = 2.5`, `R_ASCEND = 0.55`, `COOLDOWN_MS = 350`. (Rationale + the §15
reconciliation live in **ADR-009**; the numbers are calibration-pending — see Risks + EVID.)

### Chosen

**A1 (derive-then-reuse) + B2 (fit-relative thresholds).** A1 preserves SPEC-006 C3 (no-x/y, pure
geometry) recursively and the FR-008 zero-regression bet for free; B2 keeps §15's magnify gesture intact
in the neutral band while making "zoom in to dive in" discoverable and bounce-free. Both follow the
manual ADI synthesis above and the PRD-037 constraints (client-derived, pinned-cols, append-stable,
live-only).

## Proposed Direction

### Module Breakdown

- **`entities/map/lib/derive-subdocument.ts`** *(NEW, pure)* — the drill derivation. Turns one altitude
  into the next: `deriveSubDocument`, `resolveDrillTarget`, `isDrillable`, `collectDirectChildren`,
  `groupIntoSubZones`, `synthesizeComposition`. Deterministic, no x/y, mints no node id.
- **`entities/map/lib/composed-layout.ts`** *(UNCHANGED)* — `computeComposedLayout(doc)` runs per
  altitude on the derived subset. Not one line changes ⇒ the FR-008 no-regression guarantee.
- **`entities/map/model/types.ts`** *(UNCHANGED schema)* — no `MapDocument`/`MapNode`/`MapZone` change
  (D1). View-only state types live in the widget, not here (keeps entity types = document schema only).
- **`widgets/composed-map/lib/hit-test.ts`** *(NEW, pure)* — `toLayoutPoint` (invert pan/zoom) +
  `hitTestZone` (point-in-zone-rect in layout space). One helper used by BOTH click-descend and
  wheel-descend (Q3).
- **`widgets/composed-map/model/drill-state.ts`** *(NEW; pure reducers + constants)* — the level /
  breadcrumb state model: `LevelFrame`, the `descend`/`ascend`/`climbTo` reducers, `focusChain`,
  `clampBelowDescend`, and the threshold constants `R_DESCEND` / `R_ASCEND` / `COOLDOWN_MS`. Pure and
  unit-testable; the `.svelte` view holds only the rune-state array and calls these.
- **`widgets/composed-map/ui/ComposedMapView.svelte`** *(CHANGED)* — wires it together: `activeDoc`
  fold, `layout` from `activeDoc`, threshold wheel routing, click-empty-vs-card hit-test, per-level fit
  recording `kFit`, cooldown, Esc routing, time-travel reset-to-root, `onViewState` reads `activeDoc`.
- **`widgets/composed-map/ui/LevelBreadcrumb.svelte`** *(NEW)* — the breadcrumb trail UI + the "nothing
  deeper" leaf affordance. Composes `shared/ui` primitives (rule 24 — no primitive re-skinning),
  keyboard-reachable (NFR-004), emits `onCrumb(index)`.

### Component Diagram (prose)

`ComposedMapView` is the single stateful host. It owns the reactive `levelStack: LevelFrame[]` (view
state, never document state) and reads the validated root document from the widget-owned `mapPoller`
(RFC-030 SD-1, unchanged). It computes `activeDoc` by folding `deriveSubDocument` (imported from
`entities/map/lib`) over `focusChain(levelStack)`, then calls `computeComposedLayout(activeDoc)` (also
`entities/map/lib`) for geometry — a strictly one-way data path `poller → rootDoc → activeDoc → layout →
SVG`. On a wheel or canvas click it calls `hitTestZone` (from `widgets/composed-map/lib/hit-test`) to
resolve the zone under the cursor **in the transformed coordinate space**, then invokes the
`descend`/`ascend`/`climbTo` reducers (from `widgets/composed-map/model/drill-state`) which return a new
`levelStack`; the fold re-runs and the canvas re-renders. `LevelBreadcrumb` is a pure child that renders
`levelStack` and calls back `climbTo`. `deriveSubDocument` and `computeComposedLayout` are pure
entity-lib functions with **no** view awareness; d3-zoom continues to own the continuous pan/magnify, and
the threshold check merely *rides on top of* its `zoom` events. No module talks to `/api/*` beyond the
existing read-only `mapPoller`.

### Data Flow

**Render (any altitude).** `mapPoller` fetches `/api/map` (unchanged) → `validateMapDocument` → `rootDoc`
→ `focusChain = levelStack.slice(1).map(f => f.focusId)` → `activeDoc = focusChain.reduce((d, fid) =>
deriveSubDocument(d, fid), rootDoc)` → `layout = computeComposedLayout(activeDoc)` → zones/edges/cards
paint under the `translate(t.x,t.y) scale(t.k)` group. At level 0 `focusChain` is empty ⇒ `activeDoc ===
rootDoc` ⇒ the render is the Phase-1 flat map (happy path, FR-008).

**Descend (primary flow — the 170-child case, AC-1).** Cursor over `z.decisions`; user either (a)
drag-free clicks its empty area, or (b) Ctrl/⌘-wheels *in* until `k/kFit` crosses `R_DESCEND`. Either
path calls `hitTestZone(clientX, clientY) → "z.decisions"`, then `descend("z.decisions")`:
1. if `!isLive` → return (live-only, Invariant 8);
2. `isDrillable(activeDoc, "z.decisions")` → true (it contains a collapsed mega);
3. save `levelStack[top].transform = {...transform}`; push `{ focusId: "z.decisions", ... }`; start the
   cooldown;
4. the fold re-runs: `deriveSubDocument(rootDoc, "z.decisions")` expands the one mega → its 170 child
   nodes, groups them into sub-zones by `layer` (or one sub-zone), pins each sub-zone's `cols` to
   `z.decisions.cols`, synthesises a `stack-ttb` composition, filters edges to intra-altitude endpoints;
5. `computeComposedLayout` lays out the 170 cards; on the next paint `fitToView` records the child
   `kFit` and resets the transform to the child's fit ⇒ ratio 1.0, safely mid-band (no bounce).
The user selects a card carrying an `artifact_id` → `onSelect` → the existing right-hand artifact tab
opens it (FR-004, unchanged wiring).

**Failure path — descend into a leaf / already-flat zone (FR-006 honesty).** `isDrillable` returns false
(a leaf node has no `children`; an already-flat zone's cards *are* its leaves). No level is pushed; the
view shows a "nothing deeper here" affordance (and offers to open the linked artifact if any); a
`SHOULD` is a gentle magnify-to-zone-rect. Never an empty or invented sub-map.

**Climb (FR-003).** Esc at depth>0, a crumb click, or a Ctrl/⌘-wheel *out* crossing `R_ASCEND` →
`ascend()` / `climbTo(i)`: pop to the target frame; restore that frame's saved `transform`, **clamped**
so its ratio ≤ `R_DESCEND − ε` (prevents an ascend from immediately re-descending); start the cooldown.
At level 0, Esc falls back to the Phase-1 reset (clear selection + fit).

**Time-travel (Q7 = suspend + reset-to-root).** On `isLive → false` the map freezes on the last live doc
and `.map-content.frozen` already sets `pointer-events: none` ⇒ no gesture can fire. Additionally the
`levelStack` is **reset to `[rootFrame]`**, because a saved `focusId` may not exist in the next live
document (stale). When live resumes, the (possibly new) doc renders flat at level 0; the user re-descends.

### Function Signatures / Component Contracts

```ts
// entities/map/lib/derive-subdocument.ts  — NEW, pure, deterministic
export type DrillTarget =
  | { kind: "zone"; zone: MapZone }
  | { kind: "mega"; node: MapNode };

// Resolve a focus id (real zone id OR mega node id) to a drill target within `doc`.
export function resolveDrillTarget(doc: MapDocument, focusId: string): DrillTarget | null;

// Q5 leaf rule: true iff descending reveals structure not already flat here —
// a mega with children, OR a zone holding a collapsed mega, OR a zone whose
// `layers[]` would split its contents into >1 sub-zone. Else false (honest leaf).
export function isDrillable(doc: MapDocument, focusId: string): boolean;

// Direct child nodes revealed by descending into `target` (ONE level):
//   mega -> nodes named in children[]; zone -> non-mega nodes in the zone
//   UNION expand(each collapsed mega in the zone). A nested mega among the
//   children stays a (drillable) mega card at this altitude. Cycle-guarded.
export function collectDirectChildren(doc: MapDocument, target: DrillTarget): MapNode[];

// THE derivation. Pure: same (doc, focusId) -> structurally identical MapDocument.
// - groups children into sub-zones by `layer` (parent zone `layers[]` order;
//   trailing "ungrouped" sub-zone only when non-empty; single sub-zone when no layers) — Q4
// - pins each sub-zone `cols` to the parent zone `cols` (never node-count) — FR-005
// - synthesises a `stack-ttb` composition (one sub-zone per macro row, col 0)
// - reuses `doc.canvas` cell dims/gaps/margin verbatim (identical card sizing)
// - filters `edges` to intra-altitude endpoints; drops `flows`
// - node ids carried from `doc` VERBATIM (no minting); sub-zone container ids
//   are `sub:<focusId>:<layer>` — VIEW-ONLY, never written to nodes[]/map.json — FR-007
export function deriveSubDocument(doc: MapDocument, focusId: string): MapDocument;
```

```ts
// entities/map/lib/composed-layout.ts  — UNCHANGED
export function computeComposedLayout(doc: MapDocument): ComposedLayout; // byte-identical to Phase 1
```

```ts
// widgets/composed-map/lib/hit-test.ts  — NEW, pure
export interface Transform { x: number; y: number; k: number; }

// Invert the current pan/zoom: client pixel -> layout-space point.
// svgRect = svgEl.getBoundingClientRect(); assumes no viewBox scaling
// (the current .map-canvas has none: 1 SVG user unit = 1 CSS px). If a viewBox
// is ever added, this must also divide by the viewBox scale (see Risks).
export function toLayoutPoint(
  clientX: number, clientY: number, svgRect: DOMRect, t: Transform,
): Point;

// Zone whose layout rect contains the point (first match in document zone order),
// or null (empty canvas / between zones). Used identically by click + wheel (Q3).
export function hitTestZone(
  p: Point, zones: readonly MapZone[], zoneRects: ReadonlyMap<string, Rect>,
): string | null;
```

```ts
// widgets/composed-map/model/drill-state.ts  — NEW, pure reducers + constants
export interface LevelFrame {
  focusId: string | null;                              // null = root (level 0)
  transform: { x: number; y: number; k: number };      // last pan/zoom AT this altitude
  kFit: number;                                        // this altitude's fit scale (ratio denominator)
}
export const R_DESCEND  = 2.5;    // descend when k/kFit >= this while over a zone (calibration-pending)
export const R_ASCEND   = 0.55;   // ascend  when k/kFit <= this
export const COOLDOWN_MS = 350;   // one physical gesture = one transition (absorbs inertial tail)

export function rootFrame(kFit: number): LevelFrame;
export function pushLevel(
  stack: readonly LevelFrame[], focusId: string, savedTop: LevelFrame["transform"],
): LevelFrame[];                                        // saves top.transform, pushes child placeholder
export function popLevel(stack: readonly LevelFrame[]): LevelFrame[];          // ascend one
export function climbTo(stack: readonly LevelFrame[], index: number): LevelFrame[]; // crumb click -> level `index`
export function focusChain(stack: readonly LevelFrame[]): string[];            // stack.slice(1).map(f => f.focusId!)
export function clampBelowDescend(
  t: LevelFrame["transform"], kFit: number,
): LevelFrame["transform"];                             // cap ratio <= R_DESCEND - eps on restore
```

```svelte
<!-- widgets/composed-map/ui/LevelBreadcrumb.svelte — NEW -->
<!-- props -->
let { stack, onCrumb, labelFor }: {
  stack: readonly LevelFrame[];
  onCrumb: (index: number) => void;                    // climb to level `index`
  labelFor: (focusId: string | null) => string;        // "All" for root; zone/mega label else
} = $props();
```

**ComposedMapView contract deltas (signatures of the changed internals):**
```ts
let levelStack = $state<LevelFrame[]>([rootFrame(1)]);
const activeDoc = $derived.by<MapDocument | null>(() =>
  okDoc ? focusChain(levelStack).reduce((d, fid) => deriveSubDocument(d, fid), okDoc) : null);
const layout = $derived.by(() => activeDoc ? computeComposedLayout(activeDoc) : null);

function descend(focusId: string): void;   // guards isLive + isDrillable; else nothing-deeper affordance
function ascend(): void;                    // popLevel + restore clamped parent transform + cooldown
function climbTo(index: number): void;      // crumb click
function handleWheel(event: WheelEvent): void;      // rides d3 zoom; threshold cross -> descend/ascend
function handleCanvasClick(event: MouseEvent): void; // hitTestZone -> descend zone | reset (empty canvas)
function handleNodeClick(node: MapNode, event: Event): void; // select (open artifact) — UNCHANGED
function handleKeydown(event: KeyboardEvent): void; // Esc: ascend at depth>0, else Phase-1 reset
```

### Threshold / hysteresis contract (D2, ADR-009)

- **Neutral band.** `k / kFit ∈ (R_ASCEND, R_DESCEND) = (0.55, 2.5)` is ordinary §15 magnify/pan —
  d3-zoom's own continuous zoom, untouched.
- **Descend.** Ctrl/⌘-wheel *in* while `hitTestZone` returns a zone AND `k/kFit` **crosses up** through
  `R_DESCEND` → `descend(zone)`. The new level resets to its own fit (ratio 1.0).
- **Ascend.** Ctrl/⌘-wheel *out* while `k/kFit` **crosses down** through `R_ASCEND` and `depth > 0` →
  `ascend()`.
- **Hysteresis (three mechanisms, so one physical gesture = one transition).** (1) reset-to-fit lands at
  ratio 1.0, mid-band, so it cannot re-trigger; (2) `COOLDOWN_MS` after any transition passes wheel
  events straight to magnify/pan; (3) *cross-once* — a transition fires only on the threshold **crossing**
  (was inside the band last event, is outside now), never while merely sitting past it; plus
  `clampBelowDescend` caps a restored parent transform below `R_DESCEND`.
- **d3 `scaleExtent` per level.** Set `[kFit·R_ASCEND·0.9, kFit·R_DESCEND·1.1]` so both thresholds sit
  inside the reachable range with headroom (a fixed `[0.2,3]` would clip the threshold on small/large
  sub-maps and silently disable zoom-drill).
- **Empty canvas.** `hitTestZone → null` ⇒ no descend; zoom stays pure §15 magnify.

## Implementation Phases

- **Phase 1 — Pure derivation core (`entities/map/lib`).** Implement `deriveSubDocument` + helpers
  (`resolveDrillTarget`, `isDrillable`, `collectDirectChildren`, `groupIntoSubZones`,
  `synthesizeComposition`). Land its unit suite first: determinism, per-altitude append-stability,
  pinned-cols, no-x/y, no-minted-node-ids, fabrication-audit, leaf rule. `computeComposedLayout` stays
  untouched; assert level-0 `activeDoc` deep-equals `rootDoc`.
- **Phase 2 — Hit-test + drill state (`widgets/composed-map/{lib,model}`).** `hit-test.ts` (transformed
  space) + `drill-state.ts` reducers + threshold constants, each with its own unit suite (hit-test under
  pan/zoom; ratio-crossing fires once; reset-mid-band no bounce; cooldown; clamp-on-restore).
- **Phase 3 — View wiring (`ComposedMapView.svelte`).** `activeDoc` fold; per-level fit recording `kFit`
  + per-level `scaleExtent`; `handleWheel` threshold routing riding d3 zoom; `handleCanvasClick`
  hit-test (descend-zone vs reset-empty); Esc routing; time-travel reset-to-root; `onViewState` →
  `activeDoc`. Guard: the 8 existing views and the flat checkpoint render unchanged.
- **Phase 4 — Breadcrumb + honesty UI (`LevelBreadcrumb.svelte`).** Breadcrumb trail (keyboard-reachable,
  shared/ui primitives, reduced-motion), "nothing deeper" leaf affordance, optional magnify-to-zone.
- **Phase 5 — Prove.** Manual end-to-end on the real 214-node map (AC-1), `svelte-check` + unit suite
  green (AC-7), reduced-motion + keyboard pass (NFR-004), threshold calibration timing → **EvidencePack**
  (structured fields) linked `informs` PRD-037 before any activation. NFR-003 latency budget: **TBD —
  measured and recorded in the Phase-2 EVID, never invented here.**

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Threshold values (`R_DESCEND`/`R_ASCEND`) feel wrong on real hardware (trackpad vs mouse-wheel delta differ) | med | med | Constants centralised in `drill-state.ts`; calibrate on the real map; record in EVID (NFR-003). No magic numbers scattered in the view. |
| Inertial wheel tail double-fires a transition (bounce) | med | high | Three-mechanism hysteresis: reset-to-fit mid-band + `COOLDOWN_MS` + cross-once + clamp-on-restore. Dedicated hysteresis unit test. |
| Hit-test wrong if a `viewBox` is later added to `.map-canvas` (current code has none) | low | med | `toLayoutPoint` documents the no-viewBox assumption; test asserts inversion under pan/zoom; a `// TODO(viewbox)` guard if a viewBox lands. |
| `deriveSubDocument` accidentally mints/mutates node ids or leaks x/y | low | high | Pure fn; fabrication-audit + no-minted-id + no-x/y tests; node ids carried verbatim; sub-zone ids are view-only container ids never written to `nodes[]`. |
| Regression to the Phase-1 flat map or the 8 views | low | high | `computeComposedLayout` is **not touched**; level-0 `activeDoc` deep-equals `rootDoc`; non-regression test + manual smoke across all view ids (FR-008, AC-7). |
| Stale `focusId` after a live doc version bump | low | med | Time-travel resets stack to root; a live-doc version change re-folds from `rootDoc`; `descend` re-checks `isDrillable` against the current `activeDoc`. |
| 170 cards in one sub-zone overwhelm / slow render | low | med | Layout already wraps rows deterministically; grouping by `layer` splits where the doc allows; latency measured in EVID (NFR-003), not assumed. |
| Rule 24 violation (breadcrumb re-skins a shared/ui primitive) | low | med | `LevelBreadcrumb` composes primitives via props only; reviewer greps upper-layer `:global()` per rule 24. |

## Test Strategy Hooks

Targets for the downstream `tester`/`coder` (hooks, not full cases):

- **Recursive append-stability** — extend `entities/map/lib/composed-layout.test.ts` (or a sibling
  `derive-subdocument.test.ts`) with *derived-subset* fixtures: append a node to a drilled sub-level
  without adding a row ⇒ every other position at that altitude byte-identical; assert at ≥2 altitudes of
  a ≥2-level descent (AC-3).
- **Hit-test-in-transformed-space** — `hit-test.test.ts`: a client point under a non-identity
  `{x,y,k}` transform resolves to the correct zone; a point over empty canvas → `null`; boundary points
  on a zone rect edge (Q3).
- **Threshold descend/ascend + hysteresis** — `drill-state.test.ts`: `k/kFit` crossing `R_DESCEND` fires
  descend exactly once; reset-to-fit (ratio 1.0) does not re-fire; a second wheel event within
  `COOLDOWN_MS` does not transition; `clampBelowDescend` keeps a restored transform below `R_DESCEND`
  (AC-2, AC-4).
- **Leaf-honesty** — `isDrillable` is false for a childless node and for an already-flat zone;
  `deriveSubDocument` on a leaf is never called / never fabricates; a fabrication-audit fixture asserts
  every sub-zone id and node id traces to real document data (AC-5).
- **No-regression-to-flat-map** — level-0 `activeDoc` deep-equals `rootDoc`; `computeComposedLayout`
  output on the Phase-1 checkpoint is byte-identical to the base branch; all 8 view ids render unchanged
  (AC-7, FR-008).
- **Time-travel-suspension** — `isLive=false` ⇒ `levelStack` resets to `[rootFrame]`; frozen
  `pointer-events:none` blocks descend; resuming live renders flat at level 0 (Q7).
- **Determinism / no-x/y** — same doc + descent path twice ⇒ deep-equal positions at every altitude;
  every node id in every sub-document already exists in `rootDoc`; no node object carries x or y at any
  altitude (FR-005, FR-007, AC-3).

## Requirement & Open-Question Trace

**PRD-037 Functional Requirements → mechanism:**

| FR | Closed by |
|---|---|
| FR-001 zone/mega is a drill target; recurse | `resolveDrillTarget` + `deriveSubDocument` + iterative `focusChain.reduce`; a nested mega among children stays a drillable card at the next altitude |
| FR-002 dual, cursor-targeted entry | `handleCanvasClick`→`hitTestZone`→descend; `handleWheel` threshold descend; empty canvas → no descend |
| FR-003 breadcrumb + Esc + climb | `LevelBreadcrumb` + `climbTo`/`ascend`; Esc→ascend at depth, reset at root |
| FR-004 artifact opens; tab tracks last selection | `handleNodeClick`→`onSelect` (unchanged wiring); panel driven by `selectedId` |
| FR-005 per-altitude determinism, no x/y, pinned cols | unchanged `computeComposedLayout` on derived subset + `deriveSubDocument` pinned cols + stable order |
| FR-006 honest leaves; no fabricated sub-maps | `isDrillable` gate + "nothing deeper" affordance; fabrication-audit test |
| FR-007 deterministic, source-honest derivation; no minted ids | pure `deriveSubDocument`; node ids carried verbatim; sub-zone container ids view-only |
| FR-008 additive, zero regression, flat map preserved | `computeComposedLayout` untouched; level 0 = `rootDoc` verbatim; 8 views + rule 22 intact |

**PRD-037 Open Questions → resolution owner:**

| Q | Resolution |
|---|---|
| Q1 data source | **D1 fixed** → Option A client-derived (recorded as constraint, not re-opened) |
| Q2 zoom-drill vs magnify | **ADR-009** — fit-relative two-threshold band (this RFC `informs` it) |
| Q3 cursor hit-test | `hit-test.ts` — invert transform, point-in-zone-rect in layout space; node-inside-zone → descend the zone; gap/empty → none |
| Q4 children → sub-zones | `groupIntoSubZones` — by `layer` (parent `layers[]` order; trailing ungrouped only if non-empty; single sub-zone when no layers) |
| Q5 leaf / deepest-level | `isDrillable` — mega-with-children OR zone-with-collapsed-mega OR zone whose `layers[]` split contents; else leaf |
| Q6 transition model | descend resets to child fit (ratio 1.0); climb restores parent's saved transform (clamped); polish deferred |
| Q7 time-travel | **suspend + reset-to-root** (stale-focusId avoidance; frozen `pointer-events:none` already blocks gestures) |
| Q8 click-select vs descend | click card = select; drag-free click empty zone area = descend; empty canvas = reset; >3px drag suppresses both (§15 preserved) |

## Related Artifacts

- **PRD-037** — parent (`based_on`). This RFC architects its FR-001..FR-008 and resolves Q3–Q7 (Q1 via
  D1, Q2/Q8 via ADR-009).
- **SPEC-006** — the render contract consumed (`based_on`). `MapNode.is_mega`/`children`/`collapsed` +
  `MapZone.layers?` are the carried fields drill-down finally uses; validator Rule 11 (children present
  as full nodes) is the fact the design rests on; C3 (no-x/y) is preserved recursively.
- **ADR-009** — the zoom-to-descend threshold decision this RFC triggers (`informs`); reconciles D2 with
  §15 magnify.
- **RFC-030** — Phase-1 interaction/nav contract (`refines`). This RFC extends RFC-030's nav contract
  with descent; §15's magnify + click-select decisions it encodes are what ADR-009 qualifies.
- **EPIC-001 T4** — program parent (transitive via PRD-037): composed graft, drill/onboard stage (§23).
- **EVID-089 §12** — flagged the mega-node renderer-readiness gap now exercised by the real 214-node map.
- **`forgeplan-map-pack` v0.6.0** (marketplace) — the emitter whose real output motivates this; unchanged
  by the client-derived design.
- **EvidencePack (pending)** — Phase-2 drill-down checkpoint (AC-1 headline + threshold calibration),
  minted at prove-phase and linked `informs` before any activation (rule 11, R_eff > 0).

## References

- `template/src/entities/map/lib/composed-layout.ts` — the pure layout function reused verbatim per
  altitude (note: PRD-037 "Affected surfaces" names `widgets/composed-map/model/layout.ts`; the actual
  location is `entities/map/lib/` per RFC-030 SD-2 amendment / EVID-083 finding 3).
- `template/src/entities/map/model/types.ts` — `MapDocument`/`MapNode`/`MapZone` schema (unchanged).
- `template/src/widgets/composed-map/ui/ComposedMapView.svelte` — the d3-zoom host, `transform` state,
  §15 drag-suppression + wheel routing, `fitToView`, Invariant-8 freeze — the surfaces this RFC extends.
- `docs/PROJECT-MAP-SPEC.md` — §15 (nav contract: Ctrl/⌘-wheel magnify, click-select, Esc/empty reset,
  >3px drag suppression), §16 (neutral zones), §19 (pure grid engine, pinned cols, stable sort,
  idempotency), §22 (fit-vs-scroll, kind treatment), §23 (drill/onboard build stage), §4 (no-x/y).








