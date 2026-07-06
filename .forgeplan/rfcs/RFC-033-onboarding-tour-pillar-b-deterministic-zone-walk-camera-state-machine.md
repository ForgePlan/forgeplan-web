---
depth: standard
id: RFC-033
kind: rfc
last_modified_at: 2026-07-06T12:14:05.333991+00:00
last_modified_by: claude-code/2.1.201
links:
- target: PRD-038
  relation: based_on
- target: RFC-030
  relation: refines
status: active
title: 'Onboarding tour (Pillar B): deterministic zone-walk camera state machine'
---

## Status

draft

## Summary

Design for **Pillar B** of PRD-038 (composed-map T4 Phase-3): a deterministic, **model-free**,
data-driven **onboarding tour** that walks a newcomer through the project **zone-by-zone**. Three
surfaces: a new **pure, rune-free** state module `widgets/composed-map/model/tour-state.ts`
(`buildTourStops(doc)` + a small `{active,index}` reducer family), a new overlay
`widgets/composed-map/ui/OnboardTour.svelte` (narration card composed from `shared/ui` primitives,
keyboard + a11y, dual-theme, reduced-motion), and a bounded change to
`widgets/composed-map/ui/ComposedMapView.svelte` that (a) generalizes the existing `fitToView` fit math
into **`fitToRect(rect, animated)`** reusing the *same* fit-scale computation (no forked math), (b) holds
a `$state` tour controller that on each step calls `fitToRect(layout.zoneRects.get(stop.zoneId))`, (c)
renders `<OnboardTour>` when active, (d) adds a "Start tour" affordance, and (e) routes `Esc` to
`exitTour` **before** the existing Phase-1 Esc reset. A **thin** `routes/onboard/+page.svelte` lands the
app on the map view with the tour auto-started; if wiring it proves heavy it is stubbed with a
`// TODO(onboard-route)` and the in-view tour ships regardless (the route never blocks the tour).

This is a **zone-walk, NOT a flow-walk**: project `flows[]` are known-broken upstream (they reference
nodes hidden inside collapsed megas), so the tour must not depend on flows. Reading order is derived from
`composition.placements` (top-to-bottom by `cell.row` then `cell.col`), with `zones[]` array order as the
fallback. Narration is the map's own `description_ru` (RU); a zone with no `description_ru` is shown with
label + what's-inside only — narration is **never fabricated** (MASTER-SPEC §15 honesty). The tour reads
**only** the already-loaded composed-map document — no new server surface, no new runtime dep, no
regression to the 8 legacy views, the flat map, or the Phase-2 drill-down.

Scope is **Pillar B only**. Pillar A (node-detail cards + emitted-layer descend, RFC-032) and Pillar C
(the live local-agent daemon chat, PRD-038 FR-007..FR-011) are separate arcs and are out of scope here.

## Motivation

PRD-038 Goal 3 / **FR-004, FR-005, FR-006** (Pillar B) and MASTER-SPEC §23 fix "a calm way in": a
newcomer opens the project and is walked through it zone-by-zone with a camera-moving, narrated tour
grounded in the map's real data. Phase-1 (RFC-030) shipped the renderer + d3-zoom camera; Phase-2
(RFC-031) added drill-down (descend/climb/breadcrumb) and the `fitToView`/`computeFitTransform`
fit-scale plumbing this feature generalizes. The camera, the layout (`computeComposedLayout` →
`zoneRects`), and the minimap `onViewState` wiring already exist — the tour is a thin state machine on
top of them, not new rendering.

Two constraints from the parent narrow the design below the full PRD-038 FR-005 wording:

1. **Flows are not a safe tour spine.** PRD-038 FR-005 lists `flows[]` and `zone_connectors[]` as tour
   inputs, but the shipped map-pack v0.7.1 flows reference nodes hidden inside collapsed mega-cards, so a
   flow-walk would try to frame invisible targets. This RFC **refines** FR-005 to a **zone-walk**: the
   spine is the zone reading order, not flows. (Recorded as a deliberate refinement, not a contradiction
   — see Options Considered, Cycle 2, and the conflict note.)
2. **Reading order has no first-class field yet.** There is no `zones[].order` / `reading_order` field in
   `forgeplan.map/v1` (SPEC-006). PRD-038 FR-005 says "the `zones[]` reading order"; the map's *visual*
   reading order is actually carried by `composition.placements` (row-major placement), which is the same
   ordering the renderer already lays out top-to-bottom. This RFC derives the tour order from placements
   with `zones[]` as fallback (Cycle 2).

`forgeplan_reason PRD-038` was invoked (HARD-RULE gate) and returned *"LLM provider unavailable or not
configured"* — the same workspace gap PRD-038 and RFC-031 recorded. The Abduction → Deduction →
Induction cycle was therefore run **manually** over the two genuinely contested surfaces below and folded
into the FRs, contracts, and risks. The user has pre-approved the top-level architecture direction
(in-view tour + thin route, zone-walk); the manual ADI records the recommendation and the dismissed
alternatives per the override path, and no fixed decision is silently reopened.

## Options Considered

Manual ADI over the two contested design surfaces (fixed decisions inherited from PRD-038 FD-6/FD-7 are
inputs, not re-litigated).

### Cycle 1 — Where the tour lives: dedicated `/onboard` page vs in-view tour-mode + thin route

- **Abduction.** H1: build the whole tour as a **dedicated `/onboard` page** that owns its own map mount
  and camera. H2: build the tour as an **in-view tour-mode inside `ComposedMapView`** (the widget that
  already owns the camera, layout, and drill state) and make `/onboard` a **thin wrapper** that auto-starts
  it. H3: a standalone tour overlay component with its *own* camera controller, decoupled from
  `ComposedMapView`.
- **Deduction.** H1 forks the map mount: it would duplicate the poller acquisition, the d3-zoom wiring,
  the drill-state, and the minimap `onViewState` contract, and would drift from the dashboard map — a
  second renderer to keep in sync (violates PRD-038 FR-004 "one widget, two hosts", NFR-002
  non-regression). H3 double-owns the camera: two controllers writing `zoomBehavior.transform` fight over
  `transform`, exactly the tour-vs-drill contention PRD-038 flagged. H2 reuses the *single* camera the
  widget already owns, adds one `$state` controller and one overlay, keeps the dashboard map and drill-down
  byte-identical when the tour is inactive, and makes `/onboard` a near-empty wrapper.
- **Induction — CHOSEN: H2 (in-view tour-mode + thin route).** The tour is a state machine on the
  widget's existing camera; `/onboard` only *requests* the map view + auto-start. This is the user's
  pre-approved direction. Hidden assumption surfaced: the thin route needs one signal to reach the map
  branch (a query param or a small shared store flag HomePage reads), which slightly widens the host wiring
  — bounded to one boolean, the `isLive` precedent (RFC-030 SD-1), and made optional (the route may be
  stubbed without blocking the tour — see Proposed Direction → `/onboard` route).

### Cycle 2 — Tour reading-order source: `composition.placements` vs `zones[]` array

- **Abduction.** H1: derive the stop order from **`composition.placements`** sorted by `(cell.row,
  cell.col)`. H2: derive it from the **`zones[]` array order** as authored. H3: derive it from the
  **`flows[]`** spine (a flow-walk).
- **Deduction.** H3 is **refuted** by the known-broken-flows constraint above (flows reference
  megahidden nodes → framing invisible targets). H2 is authoring-order, which need not match the *visual*
  top-to-bottom reading order the renderer paints (the renderer positions zones by `placements`, not by
  `zones[]` index) — a `zones[]`-ordered tour could jump the camera around out of reading sequence. H1
  matches exactly what the newcomer *sees* scrolling the map (placements are the render order), and every
  real map-pack map carries `placements`; but a hand-written or degenerate doc might omit them.
- **Induction — CHOSEN: H1 (placements, with `zones[]` fallback).** `buildTourStops` walks
  `composition.placements` sorted `(row, col)`, maps each `placement.zone` → its `MapZone`, and dedupes;
  **if `placements` is empty/absent it falls back to `zones[]` array order**. Recorded chosen ordering:
  **placement-order (row-major), zones-array fallback.** Conflict flagged (**C-1**): PRD-038 FR-005 says
  "zones[] reading order" — this RFC reads that as *the map's visual reading order*, which is
  `placements`, and keeps `zones[]` as the honest fallback; no data or narration is invented.

### Cycle 3 (folded, not a standalone shape) — canvas-click behaviour during the tour

PRD-038 FR-006 requires "any canvas click pauses it (the user drives)". The chosen `{active,index}` state
has no separate *paused* sub-state, so "pause" collapses to **exit-to-free-browse**: while the tour is
active, a canvas click (and `Esc`) calls `exitTour` and returns before the normal
select/descend/reset path runs; the user is then in ordinary free-browse and the *next* click behaves
exactly as today. The alternative (a click both descends AND exits) was rejected for MVP because it
couples tour teardown to a drill transition mid-animation. Folded into the controller contract, not a
separate module.

## Proposed Direction

### Module Breakdown

- **`widgets/composed-map/model/tour-state.ts`** (NEW — pure, **rune-free**, unit-testable) — owns the
  tour's data + transitions with zero Svelte/DOM coupling: the `TourStop` / `TourState` /
  `MemberSummary` types, `buildTourStops(doc)` (placement-order derivation + `zones[]` fallback +
  member-summary), the reducer family `startTour` / `nextStop` / `prevStop` / `goToStop` / `exitTour`, and
  the `currentStop` / progress derivations. Deterministic: same `doc` → same stops; same state + input →
  same next state. No camera, no rendering, no clock, no randomness.
- **`widgets/composed-map/ui/OnboardTour.svelte`** (NEW) — the narration overlay: project title
  (opener), the current stop's EN `label`, its RU `narrationRu` **only when present**, the "what's
  inside" member summary, progress `n / N`, and `Next` / `Prev` / `Exit` controls. Composes `shared/ui`
  primitives (`Button`, `Badge`, `Card`) per rule 24 — layout/positioning CSS only, never re-skinning a
  primitive's internals. `role="dialog"` + `aria-label`, focus moved to the card on mount, dual-theme via
  tokens (0 raw hex), reduced-motion respected. Keyboard for step navigation is owned by the view
  (single window-level handler — see below); the overlay owns its buttons + focus + roles.
- **`widgets/composed-map/ui/ComposedMapView.svelte`** (CHANGED — bounded, additive) —
  1. **`fitToRect(rect, animated)`**: generalizes `fitToView` to center + fit an arbitrary `Rect`,
     reusing the SAME fit-scale computation (see Fit-math below). `fitToView` is refactored to call the
     shared helper so the math is not forked.
  2. a `$state` **tour controller** (`let tour = $state(exitTour-initial)` + `currentStop`/stops
     derivations from `tour-state.ts` fed the **root** document), which on each active-step change calls
     `fitToRect(layout.zoneRects.get(stop.zoneId), animated)`.
  3. renders `<OnboardTour …>` when `tour.active`.
  4. a **"Start tour"** affordance (a `shared/ui` `Button`, level-0 only, shown when there are ≥1 stops).
  5. `Esc` / canvas-click **routed to `exitTour` first** (before the existing ascend/reset), and
     `ArrowRight`/`Space` → next, `ArrowLeft` → prev while `tour.active`.
  - **Guard (invariant):** every one of these is gated on `tour.active`; when the tour is inactive the
    widget behaves byte-identically to today — the 8 legacy views, the flat level-0 render, and the
    Phase-2 drill-down are untouched.
- **`routes/onboard/+page.svelte`** (NEW, **thin**, optional) — lands the app on the composed-map view
  with the tour auto-started. Preferred: renders `HomePage` and sets a small shared flag (an
  `onboardStore` / query param) that `HomePage` reads once on mount to force `view = "map"` and forward a
  single `autoStartTour` boolean into the map branch (the `isLive` prop precedent). If mounting `HomePage`
  under a second route proves heavy, ship the in-view tour and stub the route with a
  `// TODO(onboard-route): auto-start wiring deferred` — the route **never blocks** the tour.

### Component Diagram (prose)

> `ComposedMapView` (unchanged data path) acquires the ref-counted `mapPoller`, validates, and computes
> `layout = computeComposedLayout(roomyDoc(activeDoc))`. **New:** on "Start tour" (or the `/onboard`
> auto-start signal), the controller first climbs the drill stack to level 0 (`climbTo(0)` if
> `levelStack.length > 1`) so `layout.zoneRects` keys correspond to the **root** zones the stops
> reference, then calls `tour = startTour(tour)`. `stops = buildTourStops(okDoc)` (the root document) is
> derived purely in `tour-state.ts`. A `$derived` `currentStop` resolves `stops[tour.index]`; a
> `$effect` tracking `(tour.active, tour.index)` calls `fitToRect(layout.zoneRects.get(currentStop.zoneId),
> !reducedMotion)`. `fitToRect` writes through the SAME `zoomBehavior.transform` call the drill camera
> uses, so the existing zoom handler updates `transform`, which flows to `onViewState` and the host's
> `Minimap` with **zero new minimap code**. `<OnboardTour>` renders over the canvas (absolute overlay),
> reading `currentStop` + progress; its `Next`/`Prev`/`Exit` buttons and the window-level
> arrow/space/esc handler call the pure reducers, which reassign `tour`. Any canvas click while
> `tour.active` calls `exitTour` and returns before the drill/select/reset path. Nothing in
> `entities/graph`, `entities/map`, the 8 legacy views, or the server proxy is touched.

### Data Flow

**Start → walk → exit (happy path):** user clicks "Start tour" (or opens `/onboard`) → controller climbs
to level 0 → `tour = startTour(tour)` (`{active:true, index:0}`) → `stops = buildTourStops(okDoc)` walks
`composition.placements` sorted `(row,col)`, maps each to its `MapZone`, computes each `TourStop`
(`label`, `narrationRu = zone.description_ru` *(may be undefined)*, `memberSummary` from
`nodes.filter(n => n.zone === id && !n.is_mega)`) → step effect fires `fitToRect(zoneRects.get(stop0),
animated)` → camera centers zone 0 → `<OnboardTour>` shows title + label + (RU narration if present) +
what's-inside + `1 / N`. `Next` → `tour = nextStop(tour, stops.length)` → index 1 → camera moves →
card updates. At the last zone `Next` (or reaching it, per FR-006) → `exitTour` → free browse, camera
left where it is. `Prev` → `prevStop` (clamped at 0). `Exit`/`Esc`/canvas-click → `exitTour`.

**Honesty path (no narration):** a stop whose `zone.description_ru` is absent → `narrationRu` is
`undefined` → `<OnboardTour>` renders label + what's-inside **only**, no fabricated text (§15 / FD-7).

**Empty / degenerate doc:** `buildTourStops` returns `[]` when the doc has no zones/placements → the
"Start tour" affordance is hidden (guard `stops.length > 0`) and `/onboard` shows the map's normal empty
state; no crash.

**Reduced-motion:** `prefers-reduced-motion: reduce` → every `fitToRect` call passes `animated = false`
(0 ms snap). The tour is inherently manual (no auto-advance), so it is always effectively "paused" waiting
for `Next` — satisfying FR-006's "start paused" honestly.

**Non-regression path:** while `tour.active === false`, the added `Esc`/click branches early-return on
the guard and the drill-down / level-0 / legacy views run exactly as before.

### Fit-math (do NOT fork the fit-scale computation)

The existing `computeFitTransform(w, h)` computes `k = max(0.1, min(1.5, min((viewportW-40)/w,
(viewportH-40)/h)))` then centers a box whose top-left is the origin. Extract the clamp into a shared
**`fitScale(w, h): number`**; `computeFitTransform` calls it (unchanged output), and `fitToRect` calls
the **same** `fitScale` then translates to center the rect at its own origin:

- `fitToRect(rect, animated)`: `const k = fitScale(rect.w, rect.h); const tx = viewportW/2 - (rect.x +
  rect.w/2) * k; const ty = viewportH/2 - (rect.y + rect.h/2) * k;` then apply via
  `zoomBehavior.transform` (transition when `animated`, snap otherwise) — the same application path as
  `fitToView` / `applyTransform`.
- An optional `TOUR_FRAME_PAD` may inflate `rect` (grow w/h before `fitScale`) for breathing room; it
  changes only the *input rect*, never the clamp. A unit test asserts `fitToRect` centers a rect's center
  on the viewport center at the shared `k` (parity with `fitScale`).

### Function / Component Contracts

`widgets/composed-map/model/tour-state.ts` (pure):

- `interface MemberSummary { total: number; labels: string[] }` — `total` counts the zone's non-mega
  member nodes; `labels` is the first N (e.g. 6) member labels for the "what's inside" summary.
- `interface TourStop { zoneId: string; label: string; narrationRu?: string; memberSummary: MemberSummary }`
  — `label` EN verbatim; `narrationRu` = `zone.description_ru` (**optional — omitted, never faked**).
- `interface TourState { active: boolean; index: number }`.
- `buildTourStops(doc: MapDocument): TourStop[]` — walk `doc.composition.placements` sorted by
  `(cell.row, cell.col)`, resolve each `placement.zone` → `MapZone` (skip unknown), dedupe by `zoneId`;
  **fallback to `doc.zones` array order when `placements` is empty/absent**; each stop's `memberSummary`
  from `doc.nodes` filtered `zone === id && !is_mega`. Deterministic, total, never throws.
- `startTour(state: TourState): TourState` → `{ active: true, index: 0 }`.
- `nextStop(state: TourState, count: number): TourState` → advance one; **at the last index return
  `exitTour(state)`** (FR-006 "reaching the last zone exits").
- `prevStop(state: TourState): TourState` → `{ ...state, index: max(0, index-1) }`.
- `goToStop(state: TourState, index: number, count: number): TourState` → clamp `index` to `[0, count-1]`.
- `exitTour(state: TourState): TourState` → `{ active: false, index: 0 }`.
- `currentStop(stops: TourStop[], state: TourState): TourStop | null` → `state.active ? (stops[state.index]
  ?? null) : null`.

`widgets/composed-map/ui/OnboardTour.svelte`:

- Props: `{ stop: TourStop | null; index: number; total: number; projectTitle: string; onNext: () => void;
  onPrev: () => void; onExit: () => void; reducedMotion?: boolean }`. Renders nothing when `stop === null`.
  `role="dialog"`, `aria-label="Onboarding tour"`, focus moved to the card on mount; `Next` disabled UI
  cue is unnecessary (last-Next exits), `Prev` disabled at `index === 0`. RU narration block rendered only
  when `stop.narrationRu` is truthy. Composes `Button` / `Badge` (progress) / `Card`; token-only styling.

`widgets/composed-map/ui/ComposedMapView.svelte` (added surface only):

- `function fitScale(w: number, h: number): number` — the shared clamp (factored out of
  `computeFitTransform`).
- `function fitToRect(rect: Rect, animated = true): void` — center + fit a zone rect (contract above); no-op
  when `svgEl`/`zoomBehavior`/`rect` is absent.
- `let tour = $state<TourState>({ active: false, index: 0 })`; `const tourStops = $derived.by(() => okDoc ?
  buildTourStops(okDoc) : [])`; `const currentTourStop = $derived.by(() => currentStop(tourStops, tour))`.
- `startTourFromUi()` — `if (levelStack.length > 1) climbTo(0); tour = startTour(tour);`.
- `handleKeydown` gains a **leading** `if (tour.active) { … arrow/space → next/prev, Esc → exitTour; return }`
  block placed **before** the existing `levelStack.length > 1` ascend / level-0 reset — so tour Esc never
  also ascends or resets.
- `handleCanvasClick` / `handleNodeClick` gain a leading `if (tour.active) { tour = exitTour(tour); return; }`.
- The step effect: `$effect(() => { if (!tour.active) return; const s = currentTourStop; const r = s ?
  layout?.zoneRects.get(s.zoneId) : null; if (r) fitToRect(r, !reducedMotion); })`.

`routes/onboard/+page.svelte` (thin, optional) — sets the onboard flag + renders `HomePage`, or stubs with
`// TODO(onboard-route)` per SCOPE.

### Governance / non-functional posture

- **No new server surface, no new dep.** The tour reads only the already-loaded document; it adds no
  `/api/*` route (rule 22 untouched) and no runtime dependency. `/onboard` reads the map exclusively via
  the existing `/api/map` mirror.
- **Rule 24 (shared/ui ownership).** `OnboardTour` and the "Start tour" button **compose** `shared/ui`
  primitives; new `:global()` in the widget targets only consumer-supplied layout/positioning classes,
  never a primitive's internal class names. Any genuinely new look becomes a primitive variant, not an
  in-widget re-skin.
- **A11y / theming / language (§15, §16, NFR-004).** EN labels + RU narration; reduced-motion honored on
  every camera move; the overlay is keyboard-reachable with roles + focus; 0 raw color literals
  (token-only, dual-theme). Neutral-zone treatment is unchanged (the tour only moves the camera).
- **Determinism (NFR-003).** `tour-state.ts` is pure and model-free; same map → same stop sequence and
  narration on every run.

## Implementation Phases

Ordered so each phase lands testable; no phase edits `entities/graph`, `entities/map`, the server proxy,
or any legacy view.

1. **Pure tour state (no UI).** `tour-state.ts` + `tour-state.test.ts`: placement-order derivation,
   `zones[]` fallback, empty-doc → `[]`, no-`description_ru` → `narrationRu` undefined (not fabricated),
   `start/next/prev/goTo/exit` transitions, last-`next` → exit, `currentStop`. Gate: vitest green (node env).
2. **`fitToRect` + fit-scale extraction.** Factor `fitScale` out of `computeFitTransform`; add `fitToRect`;
   refactor `fitToView` to reuse `fitScale`. Add the fit-math unit test (rect center → viewport center at
   the shared `k`; `computeFitTransform` output unchanged). Gate: vitest green + `svelte-check` 0 errors.
3. **`OnboardTour.svelte` + controller wiring.** The overlay (primitives, roles, focus, reduced-motion,
   RU-optional narration); the `$state` tour controller, the step `$effect`, the "Start tour" affordance,
   and the Esc/arrow/space/click routing in `ComposedMapView`. Render-harness test: overlay shows label +
   RU narration + what's-inside + progress + controls; button/keyboard next/prev/exit fire the reducers;
   a no-`description_ru` stop renders no narration. Non-regression harness: `tour.active === false` → the
   existing empty/error/ok/drill/Esc-reset cases render identically. Gate: full suite + `svelte-check` 0.
4. **`/onboard` thin route (optional).** The wrapper + auto-start signal, or the stubbed
   `// TODO(onboard-route)` fallback per SCOPE. Gate: `/onboard` lands on the map with the tour started
   (or the stub is documented); dashboard view + 8 legacy views render identically to base.
5. **Prove + evidence.** Manual dual-theme + reduced-motion + keyboard pass on `/onboard`; determinism by
   the unit suite; first-impression legibility check; smoke across all view ids + drill path → mint the
   CL3 EvidencePack (`verdict` / `congruence_level` / `evidence_type`), link `informs` to
   PRD-038 / RFC-033. Activation stays with the orchestrator (R_eff > 0, rule 11).

## Invariants

1. **Additive / gated.** Every added branch in `ComposedMapView` is gated on `tour.active`; with the tour
   inactive the widget is byte-behaviour-identical to base — legacy views, flat map, and drill-down
   unchanged (NFR-002). Removing `tour-state.ts` + `OnboardTour.svelte` + the gated branches is a complete
   rollback.
2. **Single camera owner.** The tour writes through the widget's existing `zoomBehavior.transform` path
   only; it never instantiates a second zoom controller. It pins to level 0 (climbs first) so stop
   `zoneId`s always resolve in `layout.zoneRects`.
3. **Fit-math not forked.** `fitToRect` and `fitToView` share one `fitScale`; there is exactly one clamp.
4. **Never fabricate narration.** `narrationRu` is `zone.description_ru` or `undefined`; the overlay never
   substitutes placeholder RU text (§15 / FD-7).
5. **Model-free + deterministic.** No model call, no network, no clock, no randomness in the tour path;
   same document → same tour.
6. **Esc precedence.** Tour Esc → `exitTour` returns before the Phase-1 ascend/reset, so exiting the tour
   never also ascends a drill level or resets the map.
7. **Token-only, dual-theme, reduced-motion.** No raw hex in the overlay; camera moves are 0 ms under
   reduced-motion.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tour camera fights the drill-down camera (both write `transform`) | med | high | Single-owner invariant: tour pins to level 0 (climbs first), writes through the one `zoomBehavior`; any canvas click during the tour exits it (Cycle 3) |
| `fitToRect` forks the fit-scale math → drift from `fitToView` | med | med | Shared `fitScale` helper (Invariant 3) + a parity unit test; `fitToView` refactored to reuse it |
| Esc double-fires (exit tour AND ascend/reset) | med | med | Leading `if (tour.active) return` in `handleKeydown` before the existing branches (Invariant 6); harness asserts tour-Esc leaves the drill level unchanged |
| Fabricated narration when a zone has no `description_ru` | low | high | `narrationRu?` optional, never defaulted; overlay renders narration only when present; unit + render test (§15 / FD-7) |
| Reading order wrong (placements vs authored) | med | low | Placement-order chosen to match the *rendered* top-to-bottom order the user sees; `zones[]` fallback for docs without placements; unit test on both paths |
| Broken project `flows[]` pull the tour off the rails | med (flows are known-broken) | med | Zone-walk by construction — the tour never reads `flows[]`; recorded as the FR-005 refinement (C-1) |
| `/onboard` auto-start widens the `DependencyGraph`/`HomePage` prop contract | med | low | One boolean signal (the `isLive` precedent) OR a stubbed route (`// TODO(onboard-route)`) — the route never blocks the tour (SCOPE) |
| Rule-24 violation (overlay re-skins a primitive) | low | med | `OnboardTour` composes primitives; new `:global()` targets only layout classes; reviewer grep per rule 24 |
| Empty / degenerate document breaks the tour | low | med | `buildTourStops` → `[]` hides "Start tour"; `currentStop` returns `null`; overlay renders nothing |

## Test Strategy Hooks

Hooks for the downstream tester (not test cases):

- **Pure state (`tour-state.test.ts`)** — stops built in placement order; `zones[]` fallback when
  placements absent; empty doc → `[]`; a zone with no `description_ru` → `narrationRu` undefined (not
  fabricated); `start` → index 0 active; `next`/`prev`/`goTo` clamping; last-`next` → `exit`; `currentStop`
  active/inactive; determinism (same doc → deep-equal stops twice).
- **Fit-math** — `fitToRect` maps a rect's center to the viewport center at the shared `fitScale` `k`;
  `computeFitTransform` output is unchanged after the extraction (regression guard).
- **Overlay render** — `OnboardTour` shows project title + label + RU narration (when present) +
  what's-inside + `n / N`; button click and window `ArrowRight`/`Space`/`ArrowLeft`/`Esc` fire the
  callbacks; a no-narration stop shows no RU block.
- **Non-regression harness** — with `tour.active === false`, the existing `ComposedMapView` render-harness
  cases (empty / error / ok / drill-descend / Esc-reset / time-travel freeze) render identically to base;
  the 9-view registry and the 8 legacy views are untouched.
- **A11y / reduced-motion (manual, prove-phase)** — keyboard-only walk of the tour; `prefers-reduced-motion`
  → 0 ms camera snaps; dual-theme (light/dark) legibility; recorded in the EVID.

## Related Artifacts

- **PRD-038** (`based_on` — parent): "Composed-map onboarding tour + live local-agent guide (T4
  Phase-3)". This RFC delivers **Pillar B** (FR-004 `/onboard` route, FR-005 data-driven tour, FR-006
  tour-is-a-suggestion + reduced-motion) and refines FR-005's "zones[] reading order" to a
  placement-ordered zone-walk (conflict C-1). Pillars A and C are out of scope.
- **RFC-030** (`refines` — Phase-1 render-proof): this RFC extends RFC-030's d3-zoom camera,
  `computeComposedLayout` → `zoneRects`, `computeFitTransform`/`fitToView` fit-scale, and the minimap
  `onViewState` contract with a tour-mode; the §15 nav contract (Esc, drag-suppression, wheel routing) is
  preserved and Esc gains a tour-first branch.
- **RFC-031** (informs — Phase-2 drill-down): the tour pins to level 0 and reuses `climbTo(0)`,
  `levelStack`, and the fit plumbing this RFC generalizes.
- **RFC-032** (informs — Pillar A partial): node-detail + emitted-layer descend; sibling arc, no shared
  surface with the tour beyond the same widget.
- **SPEC-006** — `forgeplan.map/v1`: the `MapDocument` / `MapZone.description_ru` / `MapComposition.
  placements` / `MapNode` fields the tour reads (no schema change; no `zones[].order` field exists —
  motivation for the placement-order derivation).
- **`docs/PROJECT-MAP-SPEC.md` / MASTER-SPEC** §15 (EN/RU language + interaction), §17 (onboarding
  layout), §22 (fit-vs-scroll), §23 (FINAL: `/onboard` route + data-driven tour engine).
- **`.claude/rules/24-shared-ui-ownership.md`** — the overlay composes primitives (no re-skin).
- **EvidencePack (pending)** — per rule 11, a CL3 EvidencePack (`verdict` / `congruence_level` /
  `evidence_type` structured fields) is minted at prove-phase and linked `informs` before any activation;
  `R_eff > 0` and `active` are the orchestrator's gate. **This RFC ships `draft`.**

## References

- `template/src/widgets/composed-map/ui/ComposedMapView.svelte` — `transform` $state, `zoomBehavior`,
  `computeFitTransform` (~L324), `fitToView`/`applyTransform` (~L336-360), `layout.zoneRects`,
  `handleKeydown` (~L676), `handleCanvasClick`, `climbTo`, `levelStack`, `onViewState`.
- `template/src/widgets/composed-map/ui/ZoneDetailCard.svelte` — the member-summary / RU-narration
  derivation pattern the tour narration reuses (own component, not re-skinned).
- `template/src/entities/map/model/types.ts` — `MapDocument`, `MapZone` (`label`, `description_ru?`,
  `kind`, `accent`), `MapComposition.placements` (`{ zone, cell:{row,col} }[]`), `MapNode`.
- `template/src/entities/map/lib/composed-layout.ts` — `ComposedLayout.zoneRects: ReadonlyMap<string,
  Rect>`, `Rect`.
- `template/src/shared/config/ui-prefs.ts` — `GraphView` union + `GRAPH_VIEWS` (map is the 9th view);
  the `/onboard` route targets `view = "map"`.
- `template/src/pages/home/ui/HomePage.svelte` + `template/src/routes/+page.svelte` — the mount path and
  the `isLive` single-boolean prop precedent for the optional `autoStartTour` signal.
- `template/src/shared/ui/` — `Button` / `Badge` / `Card` primitives the overlay composes (rule 24).





