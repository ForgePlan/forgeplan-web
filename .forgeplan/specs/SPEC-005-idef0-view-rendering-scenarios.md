---
depth: standard
id: SPEC-005
kind: spec
last_modified_at: 2026-07-02T10:25:44.830358+00:00
last_modified_by: claude-code/2.1.196
links:
- target: SPEC-004
  relation: based_on
- target: PRD-034
  relation: based_on
status: active
title: idef0 view rendering scenarios
---

## Summary

SPEC-005 is the **view-level rendering conformance contract** for the T2 standalone `idef0` decomposition view (PRD-034). It **extends SPEC-004** — which froze the headless T1 core's derivation behaviour — with `#### Scenario` blocks that pin the *rendering* half: how a host surface must present the core's already-frozen output (`deriveIdef0(raw, opts) → { input, forest, tierStack, verdict, diagram, outline, signature }`) without re-deriving anything, without mutating forgeplan, and without regressing the seven existing views. SPEC-004 owns "did the core derive the right forest/diagram/mode?"; SPEC-005 owns "did the view render that output honestly, accessibly, and additively?". This SPEC does not design the view's layout or component tree (that is the T2 RFC's job) — it freezes the observable render behaviour as executable scenarios so the view is built against a conformance harness rather than a wish list.

Parent: EPIC-001 (T2 track, Phase 2 / GATE-A). `based_on` SPEC-004 (the core contract this one renders) and `based_on` PRD-034 (the render capability this one operationalises, so a guardian traversing from PRD-034 reaches its render contract). Driving PRD: PRD-034.

## Problem

SPEC-004 proved the core *derives* correctly, but a headless core renders nothing. The T2 view (PRD-034) is the first surface to consume it, and three rendering hazards need a frozen contract before the view is built:

1. **Honesty can be lost at the render boundary.** The core returns a **non-null** diagram in *both* the dense `idef0` mode and the honest `tier-stack` fallback (RFC-028 F1 / I-12), and marks every element `real`/`derived` (SPEC-004 INV-5). A view that "polishes" a fallback into a dense-looking diagram, or renders a `derived` element as solid — or, conversely, dashes a `real` outline row — breaks EPIC-001 Outcome 6 at the last mile. On today's dogfood workspace the core routes to the tier-stack fallback (density ≈0.095 < 0.3) — so the *fallback* render path is the primary real-data path and must be the primary tested scenario, not an afterthought.
2. **The algorithm can be forked at the view.** The diagram already carries per-box number, per-arrow ICOM `side`, and per-element `provenance` (SPEC-004 INV-10). A view that recomputes classification/numbering/placement instead of reading those fields forks the algorithm and violates Outcome 5 (reuse-not-fork).
3. **A new view can regress the seven existing ones.** Adding a selectable entry + one render branch must leave Force/Radial/Tree/Sunburst/Matrix/Lanes/Sankey byte-behaviourally unchanged and must not overflow/break the switcher (ADI H1 evidence need on PRD-034).

This SPEC freezes the render behaviour that neutralises all three, as Given/When/Then scenarios a Vitest/component harness executes.

## Goals

- Goal 1: The view renders the **mode the core returned** — dense `idef0` or tier-stack fallback — never overriding a fallback with a fabricated dense diagram, with a visible mode indicator in both.
- Goal 2: Every rendered structural element's **line style matches its core `provenance`** (authored = solid, derived = dashed/`≈`); no derived element is ever solid, and no real element is ever dashed.
- Goal 3: The view **reads** number/side/provenance from the core's `Idef0Diagram`/`Outline`; it recomputes none of them (reuse-not-fork observable from the render output).
- Goal 4: Selecting any of the **seven existing views** renders it unchanged; the switcher accepts the new entry without layout breakage.
- Goal 5: The view is **keyboard-operable**, **reduced-motion-respecting**, **dual-theme correct**, and shows a **permanent ICOM legend** in every state (incl. empty).

## Non-Goals / Out of scope

- Out of scope: the view's concrete **layout / component decomposition / focus-navigation model** — the T2 RFC owns those; this SPEC freezes only observable render behaviour.
- Out of scope: the core's derivation behaviour — **owned by SPEC-004** (this SPEC never re-freezes forest/numbering/density derivation; it consumes them).
- Out of scope: any forgeplan **mutation** — the read path stays a read-only proxy (rule 22); no scenario exercises a write.
- Out of scope: **T3** graph-spine authoring/reindex, **T4** composed-map graft, **T5** compare-and-keep — separate EPIC-001 children.
- Out of scope: the numeric per-frame **budget** for the N≥1000 scenario (**TBD**, bound by RFC-028 Q4 / T1 NFR-002) and the exact accessibility-scan tool/threshold (bound by the T2 RFC).

## Target users / actors

- **The T2 view implementer** — consumes these scenarios as the render conformance harness.
- **The conformance harness** (component/Vitest) — executes each `#### Scenario`; CI gate for GATE-A.
- **Reviewers** (artifact-reviewer, architect-reviewer, guardian) — verify each scenario maps to a committed test before activation.
- **The shared decomposition core** (upstream, read-only) — supplies `deriveIdef0` output; never modified by the view.
- **The read-only snapshot poller** (system actor) — the existing ~10 s dual-poll feed both the seven views and this view consume.

## Contract

The view is a **pure render consumer** of the core's single public output. For a given snapshot the view MUST call the core once per snapshot and render exactly what it returns. The core entry point is an **options-object** signature (not positional):

```
deriveIdef0(raw: RawSnapshot, opts: { threshold: number; focus?: CompositeKey | null; window?: Window; takenAt?: string }): DeriveResult
  where DeriveResult = { input, forest, tierStack, verdict, diagram, outline, signature }

snapshot (existing read-only dual-poll)
   -> host adapter -> RawSnapshot
   -> deriveIdef0(raw, { threshold, focus?, window?, takenAt? }) -> { input, forest, tierStack, verdict, diagram, outline, signature }
   -> RENDER: outline pane (from `outline`) + ICOM diagram (from `diagram`) + mode indicator (from `verdict.mode`) + permanent legend (from `diagram.legend`)
```

Frozen render obligations (each has a scenario below):

- **RC-1 (render the returned mode)**: the diagram region renders `verdict.mode` as-is; a `tier-stack` verdict renders the tier-stack diagram; an `idef0` verdict renders the ICOM diagram. The view never recomputes the mode and never upgrades a fallback to dense.
- **RC-2 (provenance ⇒ line style)**: for every rendered box/arrow, `provenance == "real"` ⇒ solid; `provenance == "derived"` ⇒ dashed and marked `≈`. No `derived` element renders solid; no `real` element renders dashed.
- **RC-3 (read, don't recompute)**: box **number**, arrow **side** (`left`/`top`/`right`/`bottom`), and **provenance** are taken from the core's `Idef0Diagram`; outline row **number**/**depth**/**kind**/**provenance** from the core's `Outline`. The view computes none of them.
- **RC-4 (permanent legend)**: the ICOM legend (roles present + honesty key `{real: solid, derived: dashed ≈}`) renders in every state — dense, fallback, and empty.
- **RC-5 (one materialised level)**: the diagram renders exactly one decomposition level — the `focus` box + its ≤ per-page-bound children, with a roll-up affordance when the core signals more than the bound; DOM stays bounded independent of total N.
- **RC-6 (additive, no regression)**: adding the view leaves the seven existing views' render output unchanged and does not break/overflow the switcher.
- **RC-7 (read-only)**: the view issues only existing read-only snapshot reads; no mutation, no new endpoint, no spawn, no host write.
- **RC-8 (a11y floor)**: full keyboard operability with a visible focus indicator; reduced-motion suppresses non-essential transitions; honesty is conveyed by line-style + label (not colour alone); dual-theme via tokens.

## Data Models

The view **reads** these core-frozen shapes (defined in SPEC-004 / RFC-028 — restated here as the render input contract, not re-declared) and adds a small set of **view-local** render-state shapes it owns. The core entry point is called via the **options-object** form `deriveIdef0(raw, { threshold, focus?, window?, takenAt? })`.

| Type | Source | Shape (view-relevant fields) | View obligation |
|---|---|---|---|
| `deriveIdef0(raw, opts)` result (`DeriveResult`) | core (RFC-028) | `{ input, forest, tierStack, verdict: DensityVerdict, diagram: Idef0Diagram, outline: OutlineRow[], signature: string }`, obtained via `deriveIdef0(raw, { threshold, focus?, window?, takenAt? })` | call once per snapshot; render `diagram`, `outline`, `verdict.mode`, `diagram.legend` |
| `Idef0Diagram` | core (SPEC-004) | `{ boxes: {key, number}[], arrows: {edge, side}[], legend: IcomLegend, mode }` — **no x/y** | supply own geometry from `side`; never read/write x/y on the core |
| `ClassifiedEdge` (per arrow) | core (SPEC-004) | `{ from, to, relation, icom, provenance }` | line style from `provenance`; side from `icom`→`side` mapping already in `arrows[].side` |
| `IcomLegend` | core (SPEC-004) | `{ roles: IcomClass[], honestyKey: {real:"solid", derived:"dashed ≈"} }` | render persistently in every state |
| `DensityVerdict` | core (SPEC-004) | `{ metric, threshold, mode: "idef0"\|"tier-stack", reason }` | drive the mode indicator + fallback banner text from `mode`/`reason` |
| `OutlineRow` | core (SPEC-004) | `{ number, key, depth, kind, provenance }` | render row indent from `depth`, label from `number`+`kind`, style from `provenance` |
| `ViewFocusState` | **view-local** | `{ focus: CompositeKey \| null; source: "outline" \| "diagram" \| "default" }` | sets the `focus` passed to the next `deriveIdef0(raw, { threshold, focus })` call, selecting which level materialises; keyboard-updatable |
| `ViewModeIndicator` | **view-local** | `{ mode: "idef0" \| "tier-stack"; visible: true }` | mirrors `verdict.mode`; always visible; never diverges from the core verdict |
| `ViewRenderState` | **view-local** | `{ empty: boolean; rollupOpen: boolean; theme: "light"\|"dark"; reducedMotion: boolean }` | governs empty state, roll-up, theme tokens, motion suppression |

## Errors

The view **never throws** on core output or on an empty/degraded snapshot; failure modes are rendered as honest, deterministic states (the core already normalises adversarial poller data — SPEC-004 Errors).

| Code | Trigger | View handling (deterministic, no throw) |
|---|---|---|
| `V-EMPTY` | core returns an empty forest/diagram/outline (SPEC-004 `E-EMPTY`) | render an explicit empty state + the permanent ICOM legend; no crash, no blank screen |
| `V-FALLBACK` | `verdict.mode == "tier-stack"` (SPEC-004 `E-DENSITY-BELOW`) | render the tier-stack **diagram** + a visible fallback mode indicator naming `verdict.reason`; all **diagram** structural elements dashed/`≈`, while the **outline** pane (from the real forest) stays solid/real |
| `V-ROLLUP` | a level has more than the per-page bound of children | render the ≤bound children + a roll-up affordance; never render more than the bound of boxes at once |
| `V-DERIVED-ONLY` | every **diagram** element is `derived` (all-fallback tier-stack diagram) | every rendered **diagram** structural element (box/arrow) is dashed/marked and no solid diagram element appears — while the **outline** rows, sourced from the real decomposition forest, stay solid (real); the panes carry different honesty by construction |
| `V-COLLISION` | outline/diagram contains id-collision-flagged nodes (SPEC-004 `E-ID-COLLISION`) | render both, visually distinguished; never coalesce; surface the collision, do not hide it |
| `V-UNKNOWN-ROLE` | an arrow carries a `derived` non-canonical role (SPEC-004 `E-UNKNOWN-RELATION`) | render it dashed on its supplied side; never drop it silently, never treat it as a tree edge |

## View Rendering Scenarios (frozen)

The conformance harness MUST implement **one test per `#### Scenario`**. Each is Given/When/Then, order-stable, and extends the SPEC-004 core scenarios into the render layer. These are the freeze; a view that fails any is non-conformant. The first three are the PRD-034-mandated minimum; the remainder complete the render contract.

#### Scenario: honest tier-stack fallback
- **Given** a sparse workspace whose density is below the threshold (the live dogfood case, density ≈0.095 < 0.3), such that `deriveIdef0(raw, { threshold }).verdict.mode == "tier-stack"`, the returned `diagram` is the non-null tier-stack diagram whose every **box carries `provenance == "derived"`** and which contains **no `real` ICOM arrow**, while the returned `outline` (the core's `flattenOutline(forest)` — the *real* decomposition forest's artifacts) carries rows whose `provenance == "real"`.
- **When** the `idef0` view renders that result — the **outline pane** from `outline`, the **ICOM-diagram pane** from `diagram`, the mode indicator from `verdict.mode`, and the permanent legend from `diagram.legend`.
- **Then** the **OUTLINE pane** renders its rows as **REAL (solid)** — because they are the real decomposition forest's artifacts — and **never dashes a real artifact row**; each row's number/depth/kind/provenance is read from the core `outline`.
- **And** the **ICOM DIAGRAM pane** renders the tier-stack boxes as **derived (dashed, marked `≈`)** with **no `real` (solid) ICOM arrow**, shows the **permanent ICOM legend** (roles present + honesty key), and shows a visible **"honest fallback" mode indicator** whose text derives from `verdict.mode` / `verdict.reason`; no dense `idef0` diagram is fabricated in place of the fallback.
- **And** the assertion holds against the shipped `deriveIdef0` (it does **not** force real rows to dash): `count(outline rows with provenance=="real" drawn dashed) == 0` **and** `count(diagram boxes/arrows with provenance=="derived" drawn solid) == 0` — the two panes carry different honesty because the core sources them differently (`outline` from the real forest, `diagram` from the derived tier-stack).

#### Scenario: dense idef0 render
- **Given** a dense fixture (density ≥ threshold, depth ≥ 3) and a `focus` node, such that `deriveIdef0(raw, { threshold, focus }).verdict.mode == "idef0"`.
- **When** the `idef0` view renders with that focus.
- **Then** it shows the **focus box** plus its children **capped at the per-page bound (≤6)** — with a **roll-up affordance** when the core reports more than the bound — and renders each of the focus's non-tree ICOM arrows on the **side the core assigned**: input = left, control = top, output = right, mechanism = bottom.
- **And** authored (`real`) boxes/arrows render **solid**; box numbers, arrow sides, and provenance are read from the core's `Idef0Diagram` (the view recomputes none of them).

#### Scenario: no-regression of the seven existing views
- **Given** the view switcher with the new `idef0` entry registered alongside Force, Radial, Tree, Sunburst, Matrix, Lanes, and Sankey.
- **When** the user selects each of the seven existing views in turn.
- **Then** each renders **unchanged** versus its pre-`idef0` baseline — no new console error, no visual regression — and the switcher accepts the new entry **without CSS overflow / layout breakage** (ADI H1 evidence).
- **And** removing the `idef0` entry + its single render branch returns the surface to the exact seven-view state (purely additive, one-change revert).

#### Scenario: reuse-not-fork observable from the render output
- **Given** a rendered dense diagram and outline.
- **When** the view's source and its rendered DOM are inspected.
- **Then** the decomposition/ICOM-classification/numbering/density logic is **imported from the shared core**, not re-implemented in the view; every box `number`, arrow `side`, and `provenance` in the DOM traces to a field on the core's `Idef0Diagram` / `Outline`.
- **And** `count(core algorithms re-implemented in the view layer) == 0` (EPIC-001 Outcome 5).

#### Scenario: permanent legend in every state
- **Given** three snapshots routing respectively to `idef0` mode, `tier-stack` mode, and an empty forest (`V-EMPTY`).
- **When** the view renders each.
- **Then** the ICOM legend (roles present + honesty key `{real: solid, derived: dashed ≈}`) is **visible in all three**, including the empty state; the legend is never conditionally hidden.

#### Scenario: honesty encoding — solid vs dashed
- **Given** a snapshot whose core output mixes `real` authored elements and `derived` inferred elements (multi-parent demotion / tier-stack region).
- **When** the view renders.
- **Then** every `real` element is **solid** and every `derived` element is **dashed and marked `≈`**, matching the core `provenance` field element-for-element.
- **And** `count(rendered elements with provenance=="derived" drawn solid) == 0` and `count(rendered elements with provenance=="real" drawn dashed) == 0`.

#### Scenario: keyboard navigation + focus change
- **Given** keyboard-only input on a rendered dense view.
- **When** the user traverses outline rows and selects a row as the diagram focus.
- **Then** the diagram re-materialises to that focus (a fresh one-level render), the currently focused element shows a **visible focus indicator**, and every interactive control was reachable by keyboard alone (no pointer-only control).

#### Scenario: reduced-motion respected
- **Given** a reduced-motion preference is active.
- **When** the focus or the mode changes.
- **Then** **no non-essential animated transition** plays; the new state is applied immediately without motion.

#### Scenario: dual-theme token correctness
- **Given** the view rendered in a `tier-stack` fallback.
- **When** the theme is toggled between light and dark.
- **Then** boxes, arrows, outline rows, the legend, and the mode indicator remain legible in both themes using token-driven colours, with **no hard-coded colour** that breaks a theme and no per-caller theming.

#### Scenario: read-only conformance (no mutation)
- **Given** the `idef0` view active over a live snapshot.
- **When** its network/data path is observed across renders and focus changes.
- **Then** it issues **only** the existing read-only snapshot reads — **no** mutating request, **no** new endpoint, **no** spawn of a mutating subcommand, **no** host filesystem write (rule 22).

#### Scenario: roll-up beyond the per-page bound
- **Given** a focus level whose core output lists **more than the per-page bound (>6)** children.
- **When** the diagram renders.
- **Then** at most the bound of child boxes render at once, a **roll-up affordance** represents the remainder, and expanding/collapsing it never exceeds the bound of simultaneously-rendered boxes (bounded DOM — RC-5).

#### Scenario: empty / degraded snapshot renders honestly
- **Given** an empty snapshot (or one whose nodes are all dropped by the core's `port()`), so the core returns an empty forest/diagram/outline (`V-EMPTY`).
- **When** the view renders.
- **Then** it shows an explicit empty state **plus the permanent legend**, with **no throw** and no blank screen; a subsequent non-empty snapshot on the next poll renders normally.

## Non-Functional Requirements

### NFR-001 — Bounded render at N ≥ 1000
- **Category**: performance
- **Threshold**: on an N ≥ 1000 fixture the rendered DOM stays bounded (one materialised level + windowed outline) and interaction (focus change, scroll) stays within the interactive frame budget = **TBD** (RFC-028 Q4 / T1 NFR-002, fixed by the N=1000 profiling).
- **Measurement**: component render + interaction-latency benchmark over the N ≥ 1000 fixture.

### NFR-002 — Accessibility floor
- **Category**: accessibility
- **Threshold**: full keyboard operability, visible focus indicator, reduced-motion honoured, honesty conveyed by line-style + label (not colour alone), 0 critical automated-scan violations (tool/threshold = TBD, T2 RFC).
- **Measurement**: keyboard-only walkthrough + automated a11y scan of the view.

### NFR-003 — Read-only + no-fork
- **Category**: security / maintainability
- **Threshold**: 0 mutation call sites introduced by the view; 0 core algorithms re-implemented in the view layer.
- **Measurement**: static review of the view data path (rule 22) + reuse-not-fork import assertion (Outcome 5).

## Constraints

### Technical
- Consumes the frozen core public surface (`deriveIdef0`, RFC-028); the core is headless (SPEC-004 FR-007), so the view owns presentation geometry and pushes none back into the core.
- The core diagram is **non-null in both modes** (RFC-028 F1 / I-12), so the fallback always has a renderable diagram.
- Rides the existing read-only dual-poll; no new data source.

### Business
- Gates GATE-A (EPIC-001 Phase 2 entry): these scenarios are the render half of the evidence that the core is renderable (Outcome 5) and honest (Outcome 6).

### Regulatory (project rules)
- rule 22 (read-only proxy), rule 24 (compose shared primitives, no re-skin from above), rule 11 (MUST sections + downstream EvidencePack `## Structured Fields`).

## SMART Acceptance Criteria

1. **AC-1 (fallback scenario is green on real data)**: the `honest tier-stack fallback` scenario passes against a committed authentic dogfood snapshot (density ≈0.095) — outline rows real/solid, diagram boxes derived/dashed, legend + fallback indicator present, 0 solid arrows; **threshold** = 0 render errors + 0 real-rows-dashed + 0 derived-diagram-elements-solid; **horizon** = GATE-A.
2. **AC-2 (dense scenario is green on a fixture)**: the `dense idef0 render` scenario passes against a committed dense fixture — ≤6 children (roll-up when exceeded), arrows on the correct sides; **metric** = wrong-side arrows + over-bound boxes without roll-up, **threshold** = 0; **horizon** = GATE-A.
3. **AC-3 (no-regression scenario is green)**: the `no-regression` scenario passes — all 7 existing views render unchanged and the switcher takes the new entry without layout breakage; **threshold** = 0 regressed views + 0 switcher-layout defects; **horizon** = GATE-A (pre-merge).
4. **AC-4 (every frozen scenario maps to a committed test)**: each `#### Scenario` in this SPEC has exactly one passing conformance test; **metric** = scenarios lacking a test, **threshold** = 0; **horizon** = GATE-A.
5. **AC-5 (honesty + reuse assertions hold)**: the `honesty encoding` and `reuse-not-fork` scenarios pass — 0 derived-drawn-solid, 0 real-drawn-dashed, and 0 re-implemented core algorithms; **threshold** = 0 + 0 + 0; **horizon** = GATE-A.

## Open Questions

- Q1: the interactive per-frame **budget number** for NFR-001 — owner: T1 pseudocode/Big-O step + T2 RFC (RFC-028 Q4).
- Q2: the automated **accessibility-scan tool + threshold** for NFR-002 — owner: T2 view RFC.
- Q3: the exact **per-page child bound** rendering (fixed at ≤6 by IDEF0 convention; the roll-up interaction detail) — owner: T2 view RFC.

## Related Artifacts

- **SPEC-004** — the frozen core (TADD + ICOM) conformance contract; this SPEC is `based_on` it and extends it into the render layer (never re-freezing core derivation).
- **PRD-034** — the driving PRD (standalone `idef0` view); this SPEC is `based_on` it, and these scenarios operationalise its FR-001…FR-011 + AC-1…AC-7.
- **RFC-028** — the shipped headless core (`deriveIdef0`, non-null diagram in both modes) the view renders.
- **ADR-007** — the ICOM reading key rendered here (I=left/C=top/O=right/M=bottom, real=solid/derived=dashed).
- **ADR-006** — tier-vocabulary lift (the altitude the outline reads).
- **EPIC-001** — parent (Outcomes 4/5/6, GATE-A).
- **(planned) T2 view RFC** — owns layout/component/focus model + the TBD budget/scan numbers; consumes these scenarios.





