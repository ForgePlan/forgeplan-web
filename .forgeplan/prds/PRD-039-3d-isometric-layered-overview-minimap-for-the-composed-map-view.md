---
depth: standard
id: PRD-039
kind: prd
last_modified_at: 2026-07-08T01:27:46.769244+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-036
  relation: based_on
status: active
title: 3D isometric layered overview minimap for the composed-map view
---

# PRD-039: 3D isometric layered overview minimap for the composed-map view

> **Shaping note (SPARC Specification phase).** This is the SHAPE step for the 3D isometric
> layered overview built this session on branch `feat/idef0-3d-iso-view`. Functional requirements
> are phrased as observable capability; the rendering technique is stated as a capability ("3D
> isometric rendering", "on-demand-loaded render chunk") and **no library or framework is named**
> per rule 11 (no implementation leakage in FRs). Author leaves this `draft` — activation belongs
> to the orchestrator + guardian after an EvidencePack (rule 11, R_eff > 0).
>
> **ADI note (HARD RULE 2).** `forgeplan_reason PRD-036` was invoked on the lineage parent and
> returned *"LLM provider unavailable or not configured"* — the same workspace-MCP reasoning gap
> PRD-037 / PRD-038 recorded. The Abduction → Deduction → Induction cycle was therefore run
> **manually** over the three genuinely contested design surfaces before finalising the acceptance
> criteria; it is recorded in **§ ADI reasoning (manual)** below and folded into the FRs, Open
> Questions, and Constraints.

## Problem

The composed-map view (PRD-036, the 9th graph view) renders the project as a **single flat plane**:
zones, node cards, edges, flows. Phase 2 (PRD-037 / RFC-031) made deeper levels reachable by
drill-down (descend / climb / breadcrumb), but the altitude a user is *at* and the altitudes
*above and below* it are never visible **at the same time**. A newcomer landing on a large
multi-level map cannot see the shape of the whole layered system — "this is a 3-level project,
here is the top, here is where I am, here is what is underneath" — from the flat view; they only
ever see one slice, and the corner navigation minimap (the reused host `Minimap`, bottom-right on
the Map view) is itself only a flat thumbnail of the current slice.

This is a **comprehension-at-altitude** gap, adjacent to the Phase-3 onboarding work (PRD-038) but
distinct: PRD-038 walks a newcomer *through* one plane over time; this feature lets them *see the
stack of planes* at once and jump between altitudes directly from the overview. Parent lineage:
**EPIC-001 T4** → **PRD-036** (Phase-1 render-proof, `based_on`), reusing the Phase-2 drill-down
seam (PRD-037 / RFC-031).

Trigger: the Phase-1/2 composed map and its drill-down have landed and map-pack v0.7.1 now emits
multi-level material (per-zone `.forgeplan/map/layers/<zone>.json`), so a layered overview finally
has real depth to depict; the arc branch `feat/idef0-3d-iso-view` stacks on that work.

## Goals

Observable outcomes, not implementation:

- **Goal 1 — See the whole layered stack at a glance.** On the Map view, a user sees a 3D
  isometric "exploded pyramid" overview in the bottom-right corner (in place of the flat 2D
  navigation minimap **on that view only**): the top level plus deeper levels exploded downward,
  ancestor levels receding to faint frame outlines and the focused level shown in full detail.
- **Goal 2 — Navigate altitudes from the overview.** Clicking a zone or layer in the 3D overview
  descends into it, and the flat 2D map follows into the same zone; conversely, drilling or
  climbing in the flat 2D map moves and re-focuses the 3D overview — both surfaces stay locked to
  one shared focus.
- **Goal 3 — Control how deep the overview shows.** A small control sets the visible depth to 1, 2,
  or 3 levels and offers an ascend action, and the whole 3D overview can be hidden or shown by a
  toggle.
- **Goal 4 — Pay the 3D cost only when it is used.** The 3D rendering loads on demand only when the
  Map view is opened; the other views carry no cold-start cost from it.
- **Goal 5 — No regression, no new trust surface.** The flat 2D composed map is unchanged; every
  other view (and its own 2D minimap) is unchanged; the feature adds no browser-initiated mutation
  and reads only the same read-only map data the flat view already reads.

## Non-Goals / Out of scope

- **Out of scope — replacing the flat 2D composed map.** The 3D overview is a **minimap-scale
  navigation aid**, not a replacement for the flat 2D map. The main flat composed-map canvas
  (zones/cards/edges/flows, click-to-detail, drill-down) stays the primary reading surface and is
  **unchanged**.
- **Out of scope — any view other than the Map view.** The 3D overview replaces the corner 2D
  minimap **only on the Map (composed-map) view**. Every other graph view that renders the 2D
  navigation minimap keeps it byte-identical; no other view gains a 3D surface. (Informatively, the
  2D minimap continues to render on the other graph views that showed it — this feature touches
  none of them.)
- **Out of scope — any change to the map document or layer schema.** The 3D overview reads the
  fields map-pack already emits (`forgeplan.map/v1` + per-zone layers); it introduces no schema
  change and no new emitter output.
- **Out of scope — any browser-initiated forgeplan mutation or new server surface.** The overview
  reuses the existing GET-only read-only endpoints (`/api/map`, `/api/map/layers/<zone>`); rule 22
  is untouched — no new endpoint, no spawn, no write, no network.
- **Out of scope — deciding the packaged-image size-cap outcome.** The added 3D render chunk raises
  the packaged image size and presses against PRD-030's per-image dist-size cap; **this PRD states
  that constraint only.** The cap decision (stretch the cap / split / exclude the chunk) is
  recorded in a **companion ADR** and is explicitly **not decided here**.
- **Out of scope — motion polish** beyond "works + honors reduced-motion": easing curves,
  fly-in of a revealed sub-level, and camera-orbit affordances are deferred.
- **Out of scope — spawning any agent / model call.** The overview is a pure client-side render of
  read-only data; it invokes no model and no subprocess.

## Target users / actors

- **Newcomer** on a large, multi-level forgeplan-instrumented workspace — primary consumer; needs
  to see the shape of the whole layered system and jump into an altitude directly from the
  overview.
- **Returning maintainer** — uses the 3D overview to move quickly between altitudes without losing
  the sense of where a level sits in the stack.
- **The composed-map view (system actor)** — hosts the 3D overview in its bottom-right minimap slot
  (Map view only) and owns the single shared focus-chain that keeps 3D and 2D locked together.
- **The on-demand render chunk (system actor)** — the 3D rendering, loaded lazily only when the Map
  view opens; absent from the initial load of every other view.
- **The read-only web server process (system actor)** — serves the same map document + emitted
  per-zone layers read-only; it is unaware the 3D overview exists.
- **Reviewer / guardian agents** — verify Map-view-only scope, on-demand load, rule-22 read-only
  compliance, no-regression of the flat map and other views, and the packaged-size delta against
  the PRD-030 cap.

## Functional Requirements

Capability language only; component/file mapping is informative and lives in
Constraints → Affected surfaces. Priorities: `must` / `should` / `could`.

### FR-001 — 3D isometric layered overview in the Map view's minimap corner (Map-view only)
- **Description**: On the composed-map (Map) view, the system shall render a 3D isometric layered
  overview in the bottom-right minimap corner **in place of** the flat 2D navigation minimap. This
  replacement shall apply to the Map view **only**; on every other view the 2D navigation minimap
  shall render unchanged.
- **Priority**: must
- **Acceptance criteria**:
  - Given the Map view is selected, when it renders, then the bottom-right corner shows the 3D
    isometric layered overview and not the flat 2D minimap.
  - Given any non-Map view that renders the 2D minimap, when it is selected, then its minimap is
    identical to the base branch (no 3D surface appears).

### FR-002 — Layered planes rendered from the same read-only map data
- **Description**: The overview shall render the **same** data the flat 2D view reads — the
  read-only composed-map document plus its per-zone emitted layers — as **stacked isometric
  planes**: the top level plus deeper levels exploded downward. Ancestor levels (above the focused
  level) shall recede to **faint frame outlines**; the **focused** level shall be shown in full
  detail.
- **Priority**: must
- **Acceptance criteria**:
  - Given a multi-level map, when the overview renders, then the focused level appears in full
    detail and each ancestor level appears as a faint frame outline offset in the isometric stack.
  - Given the same document the flat 2D view is rendering, when the overview reads it, then the
    overview depicts the same zones/levels the flat view is showing (no divergent data source).

### FR-003 — Bidirectional drill synchronization via a shared focus-chain
- **Description**: Clicking a zone or layer in **either** the 3D overview **or** the flat 2D map
  shall descend **both** surfaces into that zone; ascending or collapsing in **either** shall drive
  the other; and the 3D overview shall highlight and expand to the flat 2D map's current focus.
  Both surfaces shall be driven by a **single shared focus-chain** (one source of truth), so they
  can never show divergent foci.
- **Priority**: must
- **Acceptance criteria**:
  - Given a zone visible in the 3D overview, when the user clicks it, then the flat 2D map descends
    into that zone and the 3D overview highlights/expands to it — both reflecting the same focus.
  - Given the user drills or climbs in the flat 2D map, when the focus changes, then the 3D
    overview moves and re-focuses to match, with no manual re-sync.
  - Given a descend followed by an ascend on either surface, when it completes, then both surfaces
    return to the same prior focus (the sync is stable — no runaway loop, no drift).

### FR-004 — Depth control (visible levels + ascend) and a show/hide toggle
- **Description**: The overview shall provide a small control that sets the visible depth to 1, 2,
  or 3 levels and offers an **ascend** action, and a separate toggle that **hides or shows** the
  whole 3D overview.
- **Priority**: must
- **Acceptance criteria**:
  - Given the depth control, when the user selects a visible depth of 1, 2, or 3, then the overview
    shows exactly that count of levels of the stack.
  - Given the ascend action, when activated, then the shared focus climbs one level and both
    surfaces reflect it (FR-003).
  - Given the show/hide toggle, when toggled off then on, then the 3D overview is hidden then
    restored without disturbing the flat 2D map's state.

### FR-005 — On-demand loading of the 3D render chunk
- **Description**: The 3D rendering shall be loaded **on demand only when the Map view is opened**.
  Opening any other view shall **not** load the 3D render chunk, so no other view pays a cold-start
  cost for it.
- **Priority**: must
- **Acceptance criteria**:
  - Given the app is opened on any non-Map view, when it loads, then the 3D render chunk is not
    fetched (verifiable from a network/asset trace).
  - Given the user then opens the Map view, when it renders, then the 3D render chunk is fetched at
    that point and the overview appears.

### FR-006 — Additive, zero-regression integration
- **Description**: The feature shall be **additive**: the flat 2D composed map (zones, cards, edges,
  flows, click-to-detail, drill-down) and all other views (including their own 2D minimaps) shall
  render and behave exactly as on the base branch. The overview shall own its own render surface and
  never share render state with the flat views beyond the shared focus-chain.
- **Priority**: must
- **Acceptance criteria**:
  - Given the flat 2D composed map, when rendered with the overview present, then its zones/cards/
    edges/flows/click-to-detail/drill-down behave identically to the base branch.
  - Given each of the other view ids, when selected, then rendering (including any 2D minimap) is
    identical to the base branch.

### FR-007 — Honest fallback when the 3D surface is unavailable
- **Description**: When the environment cannot provide a 3D render surface, the Map view shall
  degrade honestly — either falling back to the flat 2D navigation minimap or showing an explicit
  "3D overview unavailable" state — and shall **never** break the flat 2D composed map or leave the
  corner in a broken state.
- **Priority**: should
- **Acceptance criteria**:
  - Given a Map view where the 3D render surface cannot initialise, when it loads, then the flat 2D
    map still renders fully and the corner shows either the 2D minimap fallback or an explicit
    unavailable state (no crash, no blank/broken corner).

## Non-Functional Requirements

### NFR-001 — Shipped-bundle-size impact vs the active per-image dist-size cap
- **Category**: performance / packaging
- **Threshold**: The on-demand 3D render chunk raised the packaged image size. It shall be tracked
  against the **active per-image dist-size cap** — PRD-030 **NFR-001 / SC-4** and rule 21: *each
  emitted `dist*/` image directory ≤ 3 MB, asserted in `scripts/build.mjs`*. The measured packaged
  size delta of the 3D chunk is **TBD** (measured at prove-phase, never invented). **This PRD does
  not decide the cap outcome**: whether the added chunk fits within the ≤ 3 MB cap, requires the cap
  to stretch, or requires the chunk to be split/excluded is recorded in a **companion ADR** — the
  PRD states the constraint; the ADR decides. On-demand loading (FR-005) defers the chunk's
  *runtime* cost off non-Map views but does **not** remove its *packaged* cost, which still counts
  against the per-image cap.
- **Measurement**: `du -sb dist*/` (the existing build-pipeline assertion) before publish, plus the
  measured 3D-chunk size delta recorded in the prove-phase EvidencePack; the cap resolution is
  verified against the companion ADR before activation.

### NFR-002 — On-demand load / no cold-start cost on non-Map views
- **Category**: performance
- **Threshold**: Opening any non-Map view incurs **zero** load or initialisation cost from the 3D
  render chunk (it is not fetched, parsed, or initialised until the Map view opens). Map-view first
  render of the overview on the reference machine within **TBD ms** (budget set from the measured
  baseline in the RFC, not guessed).
- **Measurement**: network/asset trace showing the chunk absent on non-Map view load; manual timing
  of Map-view overview first render recorded in the EvidencePack.

### NFR-003 — Non-regression
- **Category**: reliability
- **Threshold**: All pre-existing template static checks and tests stay green; the flat 2D composed
  map, the Phase-2 drill-down, every other view, and every other view's 2D minimap behave unchanged
  (FR-006).
- **Measurement**: CI `svelte-check` (0 errors) + unit suite (`vitest`, 0 failures); manual smoke
  across all view ids + the drill-down path.

### NFR-004 — Focus-chain synchronization consistency
- **Category**: reliability
- **Threshold**: The bidirectional 3D↔2D sync is driven by a single shared focus-chain and is
  **idempotent**: a click/descend/ascend on one surface reconciles the other without a feedback
  loop, without drift, and without divergent foci; the same interaction sequence yields the same
  final focus on both surfaces every time.
- **Measurement**: unit tests over the shared focus-chain reducer (same interaction sequence → same
  final focus; a descend then ascend returns to the prior focus; no re-entrant emit loop).

### NFR-005 — Theming, accessibility, motion
- **Category**: accessibility
- **Threshold**: Zero raw color literals in the new overview components (token-only, dual-theme
  correct with no caller intervention, neutral chrome §16 preserved); the depth control, ascend
  action, and show/hide toggle are keyboard-reachable; a **reduced-motion** preference snaps the
  explode/camera motion with **0 ms** animation.
- **Measurement**: grep for hex/rgb literals in the new components; manual keyboard + reduced-motion
  pass on the Map view; dual-theme check.

### NFR-006 — Governance (rule 22, read-only)
- **Category**: security
- **Threshold**: The feature adds **0** new server endpoints, **0** browser-initiated forgeplan
  mutations, and **0** spawn/write/network call sites; it reads only the existing GET-only
  `/api/map` + `/api/map/layers/<zone>` responses.
- **Measurement**: rule-22 verification greps (spawn/execFile/fetch/write scans over route +
  `shared/server` files); reviewer diff check before merge.

## Constraints

### Technical
- **Rule 22 (read-only proxy).** No new server surface: the overview consumes the existing GET-only
  `/api/map` and `/api/map/layers/<zone>` file mirrors; no spawn, no write, no network.
- **Rule 11 (no implementation leakage).** FRs name the capability ("3D isometric rendering",
  "on-demand-loaded render chunk"), never a specific library/framework/graphics API.
- **Rule 23 (`bin/` allow-list) untouched.** The 3D overview is a `template/`/web concern; nothing
  is added to `bin/` (still `node:*` + `citty` only).
- **Rule 21 (template purity), rule 24 (shared/ui ownership), FSD layering** apply to all new files;
  token-only colors from the app stylesheet; dual-theme; neutral zone chrome (§16) preserved.
- **Reuse, don't fork.** The overview reuses the same read-only map data + emitted per-zone layers
  the flat view reads (the RFC-031 `deriveSubDocument` / prefer-emitted-layer seam), and lives in
  the composed-map view's existing bottom-right minimap slot (the reused host `Minimap` slot per
  RFC-030 — replaced on the Map view only).
- **PRD-030 per-image dist-size cap (≤ 3 MB, `scripts/build.mjs` assertion / rule 21)** is the live
  packaging constraint the added 3D chunk pressures (NFR-001).

### Affected surfaces (informative — not requirements)
- New: an on-demand-loaded 3D overview widget under the composed-map widget (its own isometric
  render surface + depth control + show/hide toggle), plus a shared focus-chain module driving both
  the 3D overview and the flat 2D map's drill/select state.
- Touched: the composed-map view's minimap slot wiring (Map-view-only swap of the 2D minimap for the
  3D overview); the drill/select state so the flat 2D map and the 3D overview read one shared focus;
  app stylesheet tokens for the isometric chrome; the build/lazy-load wiring for the on-demand
  chunk; `package.json#files` / image manifests if the chunk affects packed size (per the companion
  ADR).
- Out of this repo: the `forgeplan-map-pack` emitter (`map.json`, per-zone layers) — unchanged.

### Business
- Additive to the T4 program; nothing here regresses PRD-036/037/038 surfaces.
- The dist-size-cap outcome is **ADR-gated** (companion ADR), not decided in this PRD.
- Author leaves this PRD `draft`; the orchestrator + guardian own activation after an EvidencePack
  (rule 11, R_eff > 0).

### Regulatory
- None external. Internal bars: reduced-motion honored on the explode/camera motion; depth control
  and toggle keyboard-reachable; neutral token-only theming.

## SMART Acceptance Criteria (ship-or-not for this arc)

Each is Specific, Measurable, Achievable, Relevant, and Time-bound (bound to the
`feat/idef0-3d-iso-view` arc PR, matching the repo convention in PRD-036 / PRD-037 / PRD-038).

1. **AC-1 — layered overview, Map-view only (FR-001, FR-002):** On the Map view with a multi-level
   map loaded, the bottom-right corner shows the 3D isometric layered overview (focused level in
   full detail, ancestor levels as faint frame outlines, deeper levels exploded downward) and **not**
   the flat 2D minimap; on every other view the 2D minimap renders unchanged — demonstrated
   end-to-end before the arc PR merges.
2. **AC-2 — bidirectional drill sync (FR-003):** Clicking a zone in the 3D overview descends the
   flat 2D map into that zone **and** the 3D expands/highlights to it; drilling or climbing in the
   flat 2D map moves the 3D overview to match; a descend-then-ascend returns both surfaces to the
   same prior focus (no loop, no drift) — verified end-to-end + by focus-chain unit tests before the
   arc PR merges.
3. **AC-3 — depth control + toggle (FR-004):** The depth control sets a visible depth of 1, 2, or 3
   levels, the ascend action climbs one level in both surfaces, and the show/hide toggle hides then
   restores the 3D overview without disturbing the flat 2D map — verified by a manual pass before
   the arc PR merges.
4. **AC-4 — on-demand load + zero regression (FR-005, FR-006):** A network/asset trace shows the 3D
   render chunk is **not** fetched when any non-Map view is opened and **is** fetched only when the
   Map view opens; and the flat 2D composed map, the drill-down, and all other views (with their 2D
   minimaps) render exactly as on the base branch — verified in CI/review before the arc PR merges.
5. **AC-5 — governance & bundle-size constraint (NFR-001, NFR-006):** rule-22 greps report 0 new
   server endpoints and 0 spawn/write/network call sites; and the packaged per-image size is
   measured (`du -sb dist*/`) with the 3D-chunk delta recorded in the prove-phase EvidencePack and
   reconciled against the active ≤ 3 MB cap via the **companion ADR** (linked before activation) —
   the PRD does not decide the cap outcome.
6. **AC-6 — quality gate:** `svelte-check` reports 0 errors and the unit suite (`vitest`) reports 0
   failures on the arc branch at PR time.

## ADI reasoning (manual — `forgeplan_reason` unavailable)

Manual Abduction → Deduction → Induction over the three genuinely contested surfaces. Hidden
assumptions surfaced and conflicts flagged, folded into the FRs/NFRs/Open Questions.

### Cycle 1 — Where the 3D overview lives
- **Abduction.** H1: replace the flat 2D navigation minimap in the Map view's existing bottom-right
  corner (Map-view only). H2: a separate full-screen 3D mode/route. H3: a translucent 3D overlay on
  top of the flat 2D canvas.
- **Deduction.** H2 duplicates navigation and competes with the Phase-3 `/onboard` surface (PRD-038);
  H3 occludes the flat map that must stay the primary reading surface. H1 reuses the minimap slot
  the host already renders (RFC-030 "zero new minimap code"), keeps the change Map-view-scoped, and
  keeps the flat map fully visible.
- **Induction.** **H1.** Hidden assumption surfaced: the minimap slot is **Map-view-specific**, so
  every other view keeps its 2D minimap untouched — hence FR-001's Map-view-only clause and FR-006
  zero-regression.

### Cycle 2 — Drill coupling between 3D and 2D
- **Abduction.** H1: bidirectional sync via a single shared focus-chain (either surface drives
  both). H2: 3D is a passive follower of the 2D map only. H3: 3D navigates independently of the 2D
  map.
- **Deduction.** H2 loses "click the overview to navigate" — the whole point of an overview. H3
  yields two divergent foci (the overview and the flat map disagree → confusion). H1 makes one
  focus-chain the single source of truth that reconciles both.
- **Induction.** **H1.** Conflict flagged (**C-2**): a naive two-way binding risks a
  click→descend→re-render→re-emit **sync loop** — mitigated by an **idempotent** focus-chain reducer
  (NFR-004).

### Cycle 3 — Bundle cost of the 3D rendering
- **Abduction.** H1: an on-demand render chunk loaded only when the Map view opens. H2: the 3D
  rendering inlined into the base bundle for every image. H3: a separate opt-in image (a `dist-*`
  track) that carries the 3D rendering.
- **Deduction.** H2 pays a cold-start on all other views and inflates **every** image toward the
  ≤ 3 MB cap for users who never open the Map view. H3 fragments the install UX that PRD-030 just
  consolidated. H1 keeps the other views cold-start-free (FR-005) — but the chunk **still ships in
  the tarball**, so it still counts against PRD-030's per-image size cap.
- **Induction.** **H1** for load behaviour. Hidden assumption surfaced: "on-demand" defers the
  chunk's **runtime** cost, **not** its **packaged** cost — so the cap tension is real (**C-1**) and
  is deferred to a **companion ADR** (this PRD states the constraint only, NFR-001).

### Conflicts flagged (carried into Open Questions / NFRs)
- **C-1** (Cycle 3): PRD-030 NFR-001/SC-4 per-image ≤ 3 MB cap vs the added 3D render chunk raising
  packaged size → deferred to the companion ADR (**Q1**); PRD states the constraint, ADR decides.
- **C-2** (Cycle 2): 3D↔2D sync-loop risk → idempotent shared focus-chain (**NFR-004**).
- **C-3**: reduced-motion vs the explode/camera animation → 0 ms snap (**NFR-005**).
- **C-4**: the shared focus-chain (this feature) vs the Phase-3 onboarding tour + Tier-1
  `show_on_map` camera (PRD-038) both wanting to move the view → hand-off unresolved (**Q4**).

## Open Questions

- **Q1 (dist-size-cap outcome) — companion ADR.** Does the on-demand 3D chunk fit within PRD-030's
  per-image ≤ 3 MB cap, or must the cap stretch / the chunk be split or excluded from the packed
  image? **Not decided in this PRD.** — owner: companion ADR.
- **Q2 (measured packaged-size delta).** The measured size the 3D chunk adds to the packed image
  (NFR-001 number) — measured at prove-phase, recorded in the EVID, never invented. — owner:
  RFC / EVID.
- **Q3 (depth-control defaults).** The default visible depth on Map-view open (1, 2, or 3 levels)
  and whether more than 3 levels are ever addressable. — owner: RFC.
- **Q4 (focus-chain hand-off).** When the shared focus-chain, the Phase-3 onboarding tour, and the
  Tier-1 `show_on_map` camera (PRD-038) all want to move the view, who drives and how do they hand
  off? — owner: RFC.
- **Q5 (3D-unavailable fallback UX).** The exact fallback when a 3D render surface cannot initialise
  (fall back to the 2D minimap vs an explicit unavailable state) (FR-007). — owner: RFC.

## Related Artifacts

- **PRD-036** (`based_on` — Phase-1 render parent): Composed-map graft + onboarding (T4). Provides
  the 9th "map" view and the bottom-right minimap slot this feature replaces **on the Map view
  only**; the edges-only compatibility + additive-registration + zero-regression discipline carries
  forward (FR-006).
- **PRD-037 / RFC-031** (Phase-2 drill-down): the recursive descend/climb + `deriveSubDocument` /
  prefer-emitted-layer seam whose focus this feature extends into the shared bidirectional
  focus-chain (FR-003).
- **PRD-038** (Phase-3 onboarding + live guide): the onboarding tour + Tier-1 `show_on_map` camera
  the shared focus-chain must hand off with (Q4).
- **SPEC-006 / RFC-030**: the `forgeplan.map/v1` render contract + §15 nav/interaction; the layered
  planes read the same document + emitted per-zone layers — **no schema change**.
- **PRD-030 (NFR-001 / SC-4)** + **rule 21** (`.claude/rules/21-template-purity.md`): the active
  per-image ≤ 3 MB dist-size cap (asserted in `scripts/build.mjs`) the added 3D chunk pressures
  (NFR-001).
- **Rule 22** (`.claude/rules/22-readonly-proxy.md`): the read-only proxy boundary — untouched (no
  new server surface; reuses `/api/map` + `/api/map/layers/<zone>`).
- **Companion ADR (planned, draft-only)** — resolves the dist-size-cap tension (Q1 / C-1); the
  size-cap decision lives there, **not** in this PRD.
- **EvidencePack** — prove-phase evidence (bidirectional 3D↔2D sync + on-demand load trace +
  measured packaged-size delta + no-regression smoke), minted at prove-phase and linked `informs`
  before any activation (rule 11, R_eff > 0).













