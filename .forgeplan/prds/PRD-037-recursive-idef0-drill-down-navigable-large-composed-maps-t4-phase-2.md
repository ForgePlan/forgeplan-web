---
depth: standard
id: PRD-037
kind: prd
last_modified_at: 2026-07-05T16:04:02.814045+00:00
last_modified_by: claude-code/2.1.201
links:
- target: PRD-036
  relation: based_on
- target: EPIC-001
  relation: refines
- target: SPEC-006
  relation: based_on
status: active
title: 'Recursive IDEF0 drill-down: navigable large composed-maps (T4 Phase-2)'
---

# PRD-037: Recursive IDEF0 drill-down — navigable large composed-maps (T4 Phase-2)

> **Shaping note (SPARC Specification phase).** This is the SHAPE step. An **RFC** (interaction
> design + data-source decision) and an **ADR** (the zoom-drill vs zoom-magnify reconciliation with
> the §15 nav contract) **follow this PRD** and resolve the Open Questions below. This PRD states the
> capability and the ship-or-not criteria only — it names no library/framework, fixes no geometry
> (geometry stays the host's pure layout function), and puts no x/y in the data model.
>
> **ADI note.** The `forgeplan_reason` ADI tool was unavailable in this workspace (LLM provider not
> configured), so the Abduction→Deduction→Induction cycle was performed manually before finalising the
> acceptance criteria. It surfaced four refinements folded in below: the *children-are-full-nodes* fact
> (Problem, FR-007, Constraints) grounding the preferred client-derived design; a honesty-tightened
> AC-1; the hit-test coordinate-space caveat (Q3); and a newly-surfaced click-semantics collision (Q8).

## Problem

The composed-map view (Phase 1, PRD-036 / SPEC-006) renders a *flat* zoned map: one level, no way in.
On small hand-authored maps that is enough. On the **first REAL generated map** it collapses.

Measured ground truth — `forgeplan-map-pack` v0.6.0 emitting on ForgePlanWeb itself: **4 zones /
214 nodes**, where the emitter's `>8 nodes → collapse` rule folds every large zone into a single
mega-node card: `z.decisions` = **170 artifacts → ONE** "170 collapsed nodes" card, `z.surfaces`
19 → 1, `z.core` 17 → 1. Of the **8 visible cards, 0 carry an `artifact_id`** — every one of the
170 real, openable artifacts is hidden *inside* a collapsed mega. Consequences for the user:

- They cannot select or open **anything** — the right-hand artifact tab (the markdown panel) only
  opens on a node that has an `artifact_id`, and none of the visible cards do.
- They cannot see any decision structure — the 170-artifact decision spine is one opaque box.
- A mega-node is a **visual dead end**: today `computeComposedLayout` (commit 3213607) deliberately
  *excludes* a collapsed mega-node's children from the layout so they don't double-draw — correct for
  Phase 1, but it means the children have nowhere to go. There is no expand.

**Load-bearing fact (grounds the preferred design):** the 170 child nodes are already present as **full
node objects in the document's `nodes[]`** — SPEC-006's validator requires it for mega-node integrity
(validate.ts Rule 11), and that is exactly why `computeComposedLayout` has to *exclude* them from the
flat layout. They are not absent; they are merely *hidden*. Drill-down **un-hides what already exists**
in the served document — it fetches nothing, synthesises nothing, mints no id.

This is exactly the "renderer-readiness for mega-node emission" gap **EVID-089 §12** flagged, now
exercised by real data. Recursive drill-down is the feature that makes a large map navigable: it lets
the user *descend* into a zone or mega and read its contents as a fresh zoned sub-map, one altitude at
a time — the classic **IDEF0** move (a parent activity box decomposes into a child diagram of a
handful of sub-activities; the reader chooses depth selectively) and the user's **layered-planes**
reference (Sys → Use → numbered scenarios, with Validate-&-Verify arrows between altitudes — IDEF0 /
IDEF6). Parent context: **EPIC-001 T4** (composed graft), building directly on **PRD-036 / SPEC-006**
(Phase-1 render-proof). This is §23's "drill/onboard" stage of the composed-map program.

Trigger: Phase-1 render-proof has landed and the first real `map.json` (map-pack v0.6.0) proves that a
flat map of a real workspace is unreadable without descent.

## Goals

Observable outcomes, not implementation:

- **Goal 1 — Navigability:** on a large real map a user can *descend* into a specific zone or mega-node
  and see its contents laid out as their own zoned sub-map at the next altitude, and can *climb* back.
- **Goal 2 — Reachability:** every real, openable artifact that is hidden inside a collapsed mega is
  reachable by descending, and once reached opens in the existing right-hand artifact tab.
- **Goal 3 — Selection always reflected:** the artifact tab always shows the *last thing the user
  selected on the canvas* — closing the Phase-1 "the cards aren't selectable / I can't open anything"
  complaint at every altitude.
- **Goal 4 — Dual, discoverable entry:** a user can descend either by *clicking* a zone/mega or by
  *zooming in* over one — whichever their hand reaches for — and the target is always the thing under
  the cursor.
- **Goal 5 — Orientation:** at any depth the user can see the path they descended (a breadcrumb) and
  return up one level or all the way, without losing their place.
- **Goal 6 — Determinism preserved at every altitude:** descending never introduces per-node x/y and
  never breaks append-stability; each altitude's layout is still the output of the pure layout function
  (the program's determinism bet, §19, holds recursively).
- **Goal 7 — Honesty:** a level with real sub-structure shows it; a leaf with nothing deeper says so
  plainly and never fabricates a sub-map to look busy.

## Non-Goals / Out of scope

- **Out of scope — the map-pack emitter changes (if any).** Whether `map.json` needs to carry
  per-level data is an Open Question (Q1) this PRD hands to the RFC; but the emitter itself lives in
  the **marketplace repo** (`forgeplan-map-pack`), not here. If the RFC chooses a schema-level option,
  the emitter work is a *separate* artifact in that repo — never built in this arc. The strong
  preference (Q1) is a client-derived design that needs **no** emitter change.
- **Out of scope — mega-collapse threshold tuning.** The `>8 nodes → collapse` rule (and any change to
  it) is a map-pack concern, decided and emitted upstream. This PRD consumes whatever collapse the
  document declares; it does not tune when a zone collapses.
- **Out of scope — animation/motion polish.** The camera-dive easing, FLIP between altitudes, fly-in of
  a newly-revealed sub-level — all deferred. This PRD requires that descend/climb *work* and honor
  reduced-motion; it does not require any particular animation quality. (The *transition model* — does
  state reset, does pan/zoom persist — is a design decision the RFC owns; the *polish* is later.)
- **Out of scope — onboarding tour, map chat, append loop** (PRD-036 FR-010/FR-011/FR-012) — separate
  later phases; drill-down is the navigation primitive several of them will reuse, not those features.
- **Out of scope — any browser-initiated forgeplan mutation.** Rule 22's read-only boundary is intact;
  drill-down is pure navigation over an already-served document.
- **Out of scope — replacing or regressing any existing view** (the 8 views + the Phase-1 flat map).
- **Out of scope — weighted multi-column tracks / `spill` overflow** as *new* behaviours; the schema
  already carries those fields (SPEC-006), but this arc exercises only what drill-down needs.

## Target users / actors

- **Newcomer** on a large forgeplan-instrumented workspace — primary consumer; needs to *get inside*
  the 170-artifact decision zone to understand structure, not stare at one opaque box.
- **Returning maintainer** — descends to a known zone, opens the artifact they came for, climbs out.
- **Curator / map author (human)** — authors the checkpoint/real document; benefits from being able to
  verify a collapsed mega actually contains the right children by descending into it.
- **The composed-map view (system actor)** — owns the per-altitude derivation + the pure layout run at
  each level; holds the descent stack (breadcrumb) as view state, never as document state.
- **The read-only `/api/map` endpoint (system actor)** — still serves one document; drill-down reads
  no new server surface in the preferred (client-derived) design.
- **Reviewer / guardian agents** — verify rule-22 compliance and the no-x/y invariant from the diff.

## Functional Requirements

Capability language only; any component/file mapping is informative and lives in Constraints → Affected
surfaces. Priorities: `must` / `should` / `could`.

### FR-001 — A zone or mega-node is a drill target
- **Description**: The system shall treat a zone and a collapsed mega-node as **drill targets**.
  Descending into a target shall present that target's contents as a fresh **zoned sub-map at the next
  altitude (level N+1)**: a mega-node's `children` become the next level's node set; a zone's contents
  become the next level's zones/nodes. Descent shall recurse — a sub-map is itself drillable where it
  has deeper structure.
- **Priority**: must
- **Acceptance criteria**:
  - Given a collapsed mega-node with K children, when the user descends into it, then a sub-map showing
    those K children (as their own cards, in one or more zones) renders at level N+1.
  - Given a zone at level N, when the user descends into it, then that zone's contents render as the
    level N+1 sub-map, laid out by the same pure layout function.

### FR-002 — Dual entry: click AND cursor-targeted zoom-in
- **Description**: The system shall offer **two** ways to descend into the target under the cursor:
  (a) a **click** on a zone or mega-node descends into it; (b) a **zoom-in gesture** (Ctrl/⌘-wheel)
  performed while the cursor is over a zone descends into **that** zone — the descent target is
  **hit-tested to the zone under the cursor**, not a fixed or globally-selected zone. A zoom-in over
  empty canvas (no zone under the cursor) shall not descend.
- **Priority**: must
- **Acceptance criteria**:
  - Given the cursor over zone Z and a click, when it lands without a drag, then the view descends into
    Z (and only Z).
  - Given the cursor over zone Z and a zoom-in gesture, when the descent condition is met, then the view
    descends into Z — the zone identified by cursor hit-test — and not any other zone.
  - Given the cursor over empty canvas, when a zoom-in gesture occurs, then no descent happens.
- **Notes (hand to the RFC/ADR):**
  - The Phase-1 nav contract (§15) makes Ctrl/⌘-wheel a *magnify* gesture and explicitly rejected
    click-to-zoom-into-a-zone. Reconciling *magnify* and *descend-on-zoom* — a zoom threshold that tips
    into descent, a distinct gesture, or an explicit mode — is Q2, owned by the RFC/ADR. This FR fixes
    the *capability* (zoom-in over a zone can descend into it), not the trigger geometry.
  - **Click-semantics collision (Q8):** Phase-1 §15 / PRD-036 FR-008 made "click a zone" *select* it
    (panel shows the zone's detail). This FR makes "click a zone" *descend*. The two meanings collide;
    the RFC/ADR must assign each gesture (e.g. click-title-descends vs click-body-selects, or
    single-select vs double-descend) so neither behaviour is silently lost.

### FR-003 — Breadcrumb trail with climb-back
- **Description**: The system shall show a **breadcrumb trail** of the descent path (level 0 → … →
  current level). Activating a crumb shall climb directly to that level; a single **Esc** shall climb
  up one level, and there shall be a way to climb all the way back to level 0. Climbing shall restore
  the level the user returns to.
- **Priority**: must
- **Acceptance criteria**:
  - Given the user has descended level 0 → z.decisions → (a sub-group), when the breadcrumb is shown,
    then it lists that full path in order, current level last.
  - Given any depth > 0, when the user presses Esc, then the view climbs exactly one level; when the
    user activates the level-0 crumb, then the view returns to the top-level map.

### FR-004 — Deepest-level artifact opens in the artifact tab; tab tracks last selection
- **Description**: At the altitude where a node has an `artifact_id`, selecting that node shall open it
  in the **existing right-hand artifact tab** (the markdown panel). The tab shall always reflect the
  **last canvas selection** at any altitude — this is the requirement that closes the Phase-1 "cards
  are not selectable / I can't open anything" complaint, because the 170 real artifacts become reachable
  by descent and openable on selection. (A node with no `artifact_id` — a pure code-dep node — has no
  open affordance; selecting it still updates the panel to that node's detail, never stale.)
- **Priority**: must
- **Acceptance criteria**:
  - Given a descent that reaches a node carrying an `artifact_id`, when the user selects it, then that
    artifact opens in the right-hand tab.
  - Given any two successive canvas selections (same or different altitude), when the second lands, then
    the tab reflects the second, not the first.

### FR-005 — Per-altitude determinism, no x/y, pinned cols
- **Description**: Every altitude's geometry shall be produced by the **pure layout function** run on
  that altitude's derived node/zone subset. No node shall ever carry x/y (the load-bearing invariant,
  SPEC-006 C3). Per-zone `cols` shall stay **pinned** and append-stability shall hold **at every
  altitude** — appending a node to a sub-level keeps the other nodes at that level (and unaffected
  levels) positionally stable.
- **Priority**: must
- **Acceptance criteria**:
  - Given the same document and the same descent path twice, when each altitude is laid out, then the
    two position sets at every altitude are deep-equal.
  - Given a node appended to a drilled-into sub-level without increasing that level's row count, when
    re-laid-out, then every other position at that altitude is byte-identical.
  - Given any rendered altitude, when inspected, then no node object carries an x or y field.

### FR-006 — Honest leaves; no fabricated sub-maps
- **Description**: A drill target with **real** deeper structure (a mega-node with `children`, a zone
  with layered/sub-groupable contents) shall reveal that structure on descent. A **leaf** — a node with
  no children and no deeper structure — shall not present a fake sub-map; the view shall indicate
  plainly that there is nothing deeper (and, where the node has an `artifact_id`, offer to open it
  instead). No altitude shall invent zones or nodes that are not derivable from the document.
- **Priority**: must
- **Acceptance criteria**:
  - Given a leaf node with no children, when the user attempts to descend into it, then the view shows a
    "nothing deeper here" affordance (and opens the artifact if one is linked) — never an empty or
    invented sub-map.
  - Given any sub-map, when its contents are compared to the document, then every zone and node shown is
    traceable to real `children` / zone membership / layer data — 0 fabricated elements.

### FR-007 — Sub-level derivation is deterministic and source-honest
- **Description**: The mechanism that produces an altitude's zones/nodes (whether **derived client-side**
  from the flat `nodes[]` + mega `children[]` + zone `layers[]`, or **read from per-level data** carried
  by the document — Q1, RFC-decided) shall be **deterministic** (same document + same path → same
  sub-level every run) and shall introduce **no** volatile or invented identity. The **preferred**
  design is client-derived from data the schema already carries (SPEC-006: `children`, `layers`,
  `collapsed`) — and rests on the load-bearing fact that a collapsed mega's `children` are already
  present as **full node objects in `nodes[]`** (SPEC-006 validator Rule 11) — so `map.json` and the
  map-pack emitter need **no** change.
- **Priority**: must
- **Acceptance criteria**:
  - Given the same document and descent path, when a sub-level is produced twice, then the two sub-levels
    are structurally identical (same zone ids, node ids, membership).
  - Given the chosen data source, when a sub-level is produced, then every node id in it already exists
    in the document (no new ids minted at render time).

### FR-008 — Additive, zero-regression, Phase-1 flat map preserved
- **Description**: Drill-down shall be additive to the composed-map view. A map with no drillable
  structure (the Phase-1 hand-authored flat checkpoint) shall behave exactly as in Phase 1. The 8
  existing views shall be untouched. Rule 22's read-only boundary shall stay intact.
- **Priority**: must
- **Acceptance criteria**:
  - Given the Phase-1 flat checkpoint document, when the map view loads, then it renders and behaves as
    on the Phase-1 baseline (no drill UI intrudes where there is nothing to drill into).
  - Given any of the 8 existing view ids, when selected, then rendering is identical to the base branch.

## Non-Functional Requirements

### NFR-001 — Per-altitude determinism / idempotency
- **Category**: reliability
- **Threshold**: identical document + descent path → deep-equal computed positions at every altitude;
  appends keep untouched positions byte-stable at every altitude (FR-005).
- **Measurement**: unit tests — per-level layout equality + per-level append-stability, extending the
  Phase-1 layout suite to the derived-subset case.

### NFR-002 — Governance / security (rule 22)
- **Category**: security
- **Threshold**: 0 new write / spawn / network surface. In the preferred client-derived design, 0 new
  endpoints; in any schema-level design, any new read stays GET-only, file-read, mutation-free.
- **Measurement**: rule-22 verification greps over route/server files; reviewer diff check before merge.

### NFR-003 — Interactive responsiveness of descend / climb
- **Category**: performance
- **Threshold**: a descend or climb transition presents the target altitude within **TBD ms** on the
  reference machine; descending into the 170-child `z.decisions` level renders an interactive sub-map
  within **TBD ms**. (Concrete budgets belong in the RFC + an EvidencePack, not invented here.)
- **Measurement**: TBD — budget + method fixed in the T4 Phase-2 RFC; manual timing acceptable at
  checkpoint against the real 214-node map.

### NFR-004 — Accessibility & theming at every altitude
- **Category**: accessibility
- **Threshold**: breadcrumb is keyboard-reachable and Esc climbs; descend/climb honor reduced-motion
  (snap, no motion) wherever motion exists; 0 raw color literals in new components (token-only,
  dual-theme); zone chrome stays neutral (§16) at every altitude.
- **Measurement**: manual keyboard + reduced-motion pass on the real map; grep for hex/rgb literals in
  the new components.

### NFR-005 — Non-regression
- **Category**: reliability
- **Threshold**: all pre-existing template static checks and tests stay green; the 8 existing views and
  the Phase-1 flat map behave unchanged (FR-008).
- **Measurement**: CI static-check + unit suite; manual smoke across all view ids + the flat checkpoint.

## Constraints

### Technical
- **No x/y, ever** — the load-bearing invariant (SPEC-006 C3, PROJECT-MAP-SPEC §4). Geometry at *every*
  altitude is the output of the pure layout function; drill-down adds altitudes, never coordinates.
- **The collapsed mega's children are already full node objects in `nodes[]`** (SPEC-006 validator
  Rule 11 integrity; map-pack v0.6.0 emits them) — client-derived descent *un-hides* what is already
  present; it does not fetch, synthesise, or re-key anything. This fact is what makes the preferred
  design (Q1 Option A) rule-22-free and emitter-free.
- **Pinned `cols` + stable sort** per altitude — append-stability must hold recursively (§19).
- **SPEC-006 already carries the fields** drill-down consumes: `MapNode.is_mega` / `children` /
  `collapsed` and `MapZone.layers?` / `capacity?` / `overflow?` — all "carried, Phase 2+". Drill-down is
  what finally *consumes* them.
- **§15 nav-contract tension (load-bearing):** Phase-1 §15 fixed Ctrl/⌘-wheel as *magnify* and
  explicitly rejected click-to-zoom-into-a-zone; §15/PRD-036 FR-008 made "click a zone" *select* it.
  This PRD's dual-entry decision (FR-002) reintroduces zoom-over-a-zone as a *descend* gesture and makes
  click *descend*. Magnify-vs-descend (Q2) and select-vs-descend (Q8) must both be reconciled — the ADR
  owns them. The reconciliation must not break the Phase-1 pan/magnify/minimap/Esc-reset behaviours
  where no drilling is involved.
- **Edges-only compatibility (§8):** the map node model is not shared with the 8 views; sub-level
  derivation stays inside the map entity/widget.
- **Rule 22 read-only**, rule 21 (template purity), rule 24 (shared/ui ownership), FSD layering for any
  new files.
- **Token-only colors, neutral zones (§16)** at every altitude — no per-zone accent fill, no rule bar.

### Affected surfaces (informative, from §8/§19/§23 — not requirements)
- The pure layout function (`widgets/composed-map/model/layout.ts`, `computeComposedLayout`) runs
  per-altitude on a derived subset; the composed-map widget (`ui/ComposedMapView` + `NodeCard` /
  `ZoneSlab` / `EdgeLayer` / `FlowChips`) gains a descent stack + breadcrumb; `handleNodeClick`'s
  select-only behaviour extends to drill/select at every altitude; the existing right-hand artifact tab
  is reused unchanged for FR-004.
- If Q1 chooses client-derived (preferred): **no** change to `entities/map/model/types.ts`,
  `routes/api/map/+server.ts`, or `map.json`. If Q1 chooses schema-level: a schema addition owned by a
  *separate* SPEC/RFC and (for emission) the marketplace repo — out of scope here.

### Business
- Build order fixed by §23: render-proof (done) → **drill/onboard (this)** → chat → append loop. This
  PRD is the drill primitive; onboarding/tour/chat reuse it later.
- An **RFC** (interaction design, data-source decision Q1, hit-test rules Q3, transition model) and an
  **ADR** (zoom-drill vs magnify Q2, click-select vs descend Q8) **follow this PRD**. Activation of this
  PRD is the orchestrator's, after an EvidencePack (rule 11, R_eff > 0) — the author leaves it `draft`.

### Regulatory
- None external. Internal accessibility bar: reduced-motion respected at every altitude; breadcrumb and
  view switcher keyboard-reachable.

## SMART Acceptance Criteria (Phase-2 drill-down — ship-or-not for this arc)

Each is Specific, Measurable, Achievable, Relevant, Time-bound (bound to the Phase-2 arc PR, matching
the repo convention in PRD-036 / SPEC-006).

1. **AC-1 — the real 214-node case (headline):** On the real `forgeplan-map-pack` v0.6.0 map of
   ForgePlanWeb (4 zones / 214 nodes, `z.decisions` = 170 collapsed), a user can **descend into
   `z.decisions`, reach the 170 real artifacts as cards, open one that carries an `artifact_id` in the
   right-hand artifact tab, and climb back to level 0** — with **no node carrying x/y at any altitude**
   and **every altitude's layout append-stable** — demonstrated end-to-end and captured in the Phase-2
   EvidencePack before the arc PR merges.
2. **AC-2 — dual, cursor-targeted entry:** Both entry paths descend into the zone **under the cursor**:
   a drag-free click on a zone/mega descends into it, and a zoom-in gesture over a zone descends into
   *that* zone (cursor hit-test), while a zoom-in over empty canvas does not descend — verified by
   interaction tests on the real map before the arc PR merges.
3. **AC-3 — recursion invariants hold at every altitude:** The pure layout function ships unit tests
   proving determinism (same document + path → deep-equal positions) and pinned-cols append-stability at
   **each** altitude of a ≥2-level descent, and an assertion that no node object carries x/y at any
   altitude — all green in CI at arc-PR time.
4. **AC-4 — orientation & climb:** From any depth, the breadcrumb lists the full descent path in order,
   activating a crumb climbs to that level, and a single Esc climbs exactly one level — verified by
   interaction tests before the arc PR merges.
5. **AC-5 — honesty:** Attempting to descend into a leaf (no children, no deeper structure) yields a
   "nothing deeper" affordance (and opens the linked artifact if any) and **never** an empty or invented
   sub-map; every element of every sub-map is traceable to real document data — verified by a
   fabrication-audit test fixture at arc-PR time.
6. **AC-6 — selection always reflected:** The right-hand artifact tab reflects the last canvas selection
   at every altitude (closing the "cards not selectable" complaint) — verified by interaction test
   before the arc PR merges.
7. **AC-7 — non-regression:** `svelte-check` reports 0 errors, the unit suite reports 0 failures, all 8
   existing views render as on the base branch, and the Phase-1 flat checkpoint map behaves unchanged —
   at PR time.

## Open Questions

Handed to the T4 Phase-2 **RFC** and **ADR**:

- **Q1 (data source) — client-derived vs schema-level.** Does the client derive each altitude's
  zones/nodes at render time from the flat `nodes[]` + mega `children[]` + zone `layers[]` (**Option A,
  preferred** — no schema change, no emitter change, consumes SPEC-006's carried fields, rests on the
  children-are-full-nodes fact), or does `map.json` carry explicit per-level data emitted by map-pack
  (**Option B** — richer authored sub-compositions, but a marketplace-repo emitter change and a larger
  contract), or a **hybrid (Option C)** — derive by default, allow an optional authored override? Prefer
  A if feasible. — owner: RFC.
- **Q2 (zoom-drill vs zoom-magnify) — the §15 reconciliation.** How do *magnify* (Phase-1 Ctrl/⌘-wheel)
  and *descend-on-zoom* (FR-002) coexist: a zoom-in threshold that tips into descent past a limit, a
  distinct gesture/modifier, or an explicit drill mode? Must preserve Phase-1 pan/magnify/minimap/reset
  where no drilling is involved. — owner: ADR (with the RFC).
- **Q3 (cursor hit-test rules).** When zooming to descend: the hit-test must resolve the zone rect under
  the cursor **in the current altitude's transformed (post-pan/zoom) coordinate space**, not raw screen
  space. Cursor over a *node inside* a zone — descend into the zone or (later) the node? cursor over a
  gap between zones — nearest zone or none? cursor over empty canvas — magnify only. Define the hit-test
  target precisely. — owner: RFC.
- **Q4 (children → sub-zones mapping).** A collapsed mega's `children[]` is a flat list; at the next
  altitude, do those children render as a **single** sub-zone of N cards, or are they grouped into
  derived sub-zones (by `layer`, by `kind`, or by a stable heuristic)? Must stay deterministic and
  honest (FR-006/FR-007). — owner: RFC.
- **Q5 (leaf / deepest-level definition).** Precisely when is a node a leaf (no `children`, no layer
  sub-structure, no further derivable grouping)? This bounds recursion and drives the FR-006 affordance.
  — owner: RFC.
- **Q6 (transition model).** On descend/climb, does canvas state reset (fit-to-sub-map) or does pan/zoom
  persist? Is the sub-map fit-to-screen or scroll (§22)? The animation *polish* is out of scope, but the
  state model is a decision. — owner: RFC.
- **Q7 (time-travel).** Does drill-down suspend during time-travel/snapshot mode like the Phase-1 map
  (SPEC-006 C6 live-only), or is descent allowed on a dimmed last-live frame? — owner: RFC.
- **Q8 (click-semantics collision) — select vs descend.** Phase-1 §15 / PRD-036 FR-008 made "click a
  zone" *select* it (panel shows the zone's detail); FR-002 makes "click a zone" *descend*. Assign each
  gesture (e.g. click-title-descends / click-body-selects, or single-select / double-descend) so neither
  behaviour is silently lost, and so the §15 "click that did not move must still select, suppressed
  after a drag > ~3px" rule is preserved. — owner: RFC/ADR.

## Related Artifacts

- **PRD-036** (`based_on` — Phase-1 parent): Composed-map graft + onboarding (T4). This PRD is Phase 2
  of the same T4 track; PRD-036's FR-010+ stage later phases, and its mega-node/`layers` fields are
  carried for exactly this feature to consume.
- **SPEC-006** (`based_on` — the render contract): `forgeplan.map/v1`. Its `MapNode.is_mega`/`children`/
  `collapsed` and `MapZone.layers?` are the "carried, Phase 2+" fields drill-down consumes; validator
  Rule 11 (children present as full nodes) is the fact the preferred design rests on; the no-x/y
  invariant (C3) and the pure-layout contract are the constraints drill-down must preserve recursively.
  Q1's schema-level option, if chosen, would extend SPEC-006 via a follow-on SPEC/RFC.
- **EPIC-001** (`refines` — program parent): IDEF0 decomposition surfaces, T4 "composed graft" row +
  GATE-C. Drill-down is the altitude-navigation the epic's vision calls for, grafted onto the
  composed-map.
- **RFC-030** — Phase-1 interaction design (nav contract, time-travel suspension). The Phase-2 RFC
  extends RFC-030's nav contract with descent; Q2/Q3/Q8 build on it. The §15 magnify + click-select
  decisions it encodes are what the ADR reconciles.
- **EVID-089 §12** — flagged the "renderer-readiness for mega-node emission" gap now exercised by the
  real 214-node map; this PRD is the response.
- **`forgeplan-map-pack` v0.6.0** (marketplace) — the emitter whose real output (214 nodes, 170-collapsed
  `z.decisions`, children present as full nodes) is the measured motivation; unchanged by the preferred
  (client-derived) design.
- **docs/PROJECT-MAP-SPEC.md** — §23 (drill/onboard build stage), §15 (nav contract + the magnify and
  click-select decisions this PRD reopens), §19 (grid engine — pure layout run per altitude), §22 (kind
  treatment), §4 (no-x/y invariant).
- **Following this PRD**: T4 Phase-2 **RFC** (interaction + Q1/Q3/Q4/Q5/Q6/Q7) and **ADR** (Q2 zoom-drill
  vs magnify, Q8 click-select vs descend). Both authored after this PRD is shaped.
- **EvidencePack** — Phase-2 drill-down checkpoint evidence (AC-1 headline), minted at prove-phase and
  linked before any activation (rule 11, R_eff > 0).








