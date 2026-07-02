---
depth: standard
id: PRD-034
kind: prd
last_modified_at: 2026-07-02T10:25:36.990561+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EPIC-001
  relation: refines
- target: RFC-028
  relation: based_on
status: active
title: Standalone idef0 decomposition view
---

## Status

draft — EPIC-001 Phase 2 (T2 track), GATE-A. Activation is owned by the guardian gate + orchestrator once conformance EVIDENCE is linked and R_eff > 0 (rule 11). This PRD ships `draft` by design.

Parent: EPIC-001 (T2 track). Consumes the T1 keystone core (RFC-028 / SPEC-004 / ADR-006 / ADR-007).

## Problem

The app ships **seven** graph views (Force, Radial, Tree, Sunburst, Matrix, Lanes, Sankey). They render *connections* well, but none of them gives a **readable altitude-decomposition** — a "top-down, layer-by-layer" reading of a very large forgeplan project (Epic → PRD → RFC/Spec → below). On a workspace of dozens-to-thousands of artifacts, a user trying to answer "where does artifact X live in the decomposition, and what feeds/governs it?" has no view that answers it directly; the existing hierarchical views (Tree/Sunburst) show shape but not the ICOM reading key (what is consumed, what governs, what is produced, what supports) and do not degrade honestly when the real spine is sparse.

Compounding this: EPIC-001's Phase 1 already shipped a **pure, deterministic, headless decomposition core** (the T1 keystone — RFC-028, frozen by SPEC-004, framed by ADR-006/ADR-007). That core derives, from the same artifact/relation snapshot the seven views already poll, an altitude-ordered outline, an ICOM decomposition diagram (with a non-null diagram in **both** the dense `idef0` mode and the honest `tier-stack` fallback mode), a density verdict, and a stable structural signature. **But the core is headless — nothing renders it.** A headless core delivers zero user-visible value until a surface consumes it. EPIC-001 Outcome 5 (reuse-not-fork) and Outcome 6 (honesty) both hinge on a *first* surface existing to prove the core is renderable without forking its algorithm and without dishonestly rendering derived structure as real.

### Decision context (alternatives weighed — input for ADI reasoning)

The load-bearing choice this PRD commits to is **how** to render the headless core:

- **(a) A dedicated, additive new view** selectable alongside the existing seven — the subject of this PRD.
- **(b) Extend an existing hierarchical view** (Tree or Sunburst) to render the core's output instead of adding a view — reuse the existing surface, no new selectable entry.
- **(c) Do nothing** — leave the core headless for now and defer any surface to a later wave (the null baseline the decision must beat).

Each carries a real trade-off (blast radius on the seven shipped views, honesty-fallback fidelity, discoverability of the new reading, effort). The ADI cycle on this PRD evaluated all three; its outcome is recorded below and the acceptance criteria are sharpened by it and by EPIC-001's measurable Outcomes 4/5/6.

## Goals

- Goal 1: A user can select a new decomposition view and immediately read the current workspace as an **altitude-ordered outline** plus a **one-level ICOM decomposition diagram**, sourced from the same live snapshot the other views already use.
- Goal 2: The view **renders honestly on today's sparse dogfood workspace** — where the real decomposition spine is below the density threshold — by showing the tier-stack fallback with a visible mode indicator and a permanent ICOM legend, never fabricating a dense diagram.
- Goal 3: The view **renders the dense `idef0` reading** — a focus box, its bounded set of children, and ICOM arrows on the correct sides — when the underlying snapshot is dense enough.
- Goal 4: Adding the view **does not regress** any of the seven existing views (they render unchanged) and adds **no** new host runtime dependency to the install-time CLI.
- Goal 5: The view is **a pure consumer** of the shared decomposition core — it re-implements none of the decomposition, ICOM-classification, numbering, or density logic (EPIC-001 Outcome 5).
- Goal 6: Real (authored) structure and derived (inferred) structure are **visually distinguishable at a glance** — authored solid, derived dashed — so the surface is honest by construction (EPIC-001 Outcome 6).

## Non-Goals / Out of scope

- **No forgeplan mutation from the browser.** The read path stays a read-only proxy (rule 22); the view never triggers create/link/activate/reindex/any write. It is a viewer, not an editor.
- **No graph-spine authoring or reindex (T3).** Recovering/authoring the real `refines` spine and minting real Epics is a separate PROB-060-gated wave (EPIC-001 T3). This PRD renders whatever the current snapshot honestly yields — it does not improve the data.
- **No composed-map graft (T4) and no compare-and-keep harness (T5).** Grafting the IDEF0 grammar onto a composed map / onboarding tour, and the multi-surface selection harness, are separate EPIC-001 children.
- **No regression or replacement of the seven existing views.** They remain intact and behaviourally unchanged; this view is purely additive.
- **No new install-time CLI dependency.** Nothing is added to the zero-/named-allowlist boundary of the install-time CLI (bin) to support this view.
- **No change to the decomposition/ICOM algorithm.** The view owns presentation only; all derivation stays in the frozen T1 core (SPEC-004 / ADR-006 / ADR-007). Layout choices for the diagram/outline are the driving RFC's concern, not this PRD's.
- **No new geometry or classification in the core.** The core is headless (no x/y) by SPEC-004 FR-007; the view supplies presentation geometry itself and must not push geometry back into the core.

## Target users / actors

- **The forgeplan practitioner (human, primary)** — an engineer or lead navigating a large workspace who needs altitude-decomposition to locate an artifact and read its ICOM relations. Triggers the view via the existing view switcher; consumes the outline + diagram; navigates by keyboard.
- **The accessibility-constrained user (human)** — relies on keyboard navigation and on reduced-motion being respected; reads the permanent ICOM legend and the honesty encoding (solid vs dashed) rather than relying on colour or motion alone.
- **The existing read-only snapshot poller (system actor)** — the same periodic (~10 s) dual-poll snapshot feed the seven current views consume; hands the view its raw artifact/relation data. Read-only.
- **The shared decomposition core (system actor, upstream)** — the frozen T1 keystone; the view calls its single public entry point and renders its output without re-deriving anything.
- **Reviewers (artifact-reviewer, architect-reviewer, guardian)** — verify reuse-not-fork, honesty, no-regression, and read-only conformance before activation.

## Functional Requirements

Capability language only; concrete module/registration/framework details and the exact core call signature are the driving RFC's / SPEC-005's concern (rule 11 — no implementation leakage here).

### FR-001 — A new, selectable decomposition view
- **Description**: The system shall offer a new altitude-decomposition view, selectable from the same view switcher as the existing views, without removing or reordering the existing ones.
- **Priority**: must
- **Acceptance criteria**:
  - Given the view switcher, when the user selects the new view, then it renders without error and the previously available views remain selectable and unchanged.
  - Given the new view is selected, when the workspace snapshot updates on the normal poll cycle, then the view refreshes from that same snapshot with no separate data source.

### FR-002 — Altitude-ordered outline pane
- **Description**: The system shall present an outline pane listing decomposition rows in a deterministic altitude order (most-abstract first, descending), each row carrying its stable decomposition number, kind, and depth.
- **Priority**: must
- **Acceptance criteria**:
  - Given a rendered workspace, when the outline pane is shown, then rows appear in the core's deterministic pre-order with each row's number and depth matching the core's output.
  - Given a workspace larger than one screen of rows, when the user scrolls the outline, then interactivity is preserved (the pane does not materialise every row eagerly at large N).

### FR-003 — One-level ICOM decomposition diagram
- **Description**: The system shall render a single decomposition level as a diagram: one focus box, its bounded set of child boxes (with a roll-up affordance when children exceed the per-page bound), and ICOM arrows representing the focus's non-tree relations placed on their conventional sides (input, control, output, mechanism).
- **Priority**: must
- **Acceptance criteria**:
  - Given a focus selection in dense data, when the diagram renders, then it shows the focus box plus at most the per-page bound of children (roll-up shown when exceeded) and ICOM arrows on the correct sides for each non-tree relation.
  - Given the diagram, when a box or arrow is inspected, then its role/number/provenance is taken from the core's diagram output, not recomputed by the view.

### FR-004 — Honest mode switch (dense vs tier-stack fallback), surfaced to the user
- **Description**: The system shall surface, to the user, which honest mode the core selected — the dense `idef0` decomposition or the tier-stack fallback — and render the mode the core returned, never overriding a fallback with a fabricated dense diagram.
- **Priority**: must
- **Acceptance criteria**:
  - Given a snapshot the core routes to the tier-stack fallback, when the view renders, then a visible mode indicator states the fallback is active and the tier-stack rendering is shown.
  - Given a snapshot the core routes to the dense mode, when the view renders, then the mode indicator reflects the dense mode and the ICOM diagram is shown.

### FR-005 — Permanent ICOM legend
- **Description**: The system shall display a persistent ICOM legend in every state of the view (dense and fallback), enumerating the roles in use and the honesty key (authored vs derived).
- **Priority**: must
- **Acceptance criteria**:
  - Given any state of the view (dense, fallback, or empty), when it renders, then the ICOM legend and the honesty key are visible.

### FR-006 — Keyboard navigation
- **Description**: The system shall provide full keyboard operation of the view: the user traverses outline rows and changes the diagram focus using the keyboard alone — every navigation and focus-change action has a keyboard path (no pointer-only control) — and the currently active element carries a visible focus indicator.
- **Priority**: must
- **Acceptance criteria**:
  - Given keyboard-only input, when the user moves through outline rows and selects a focus, then the diagram updates to that focus and the currently focused element is visibly indicated.

### FR-007 — Reduced-motion respect
- **Description**: The system shall honour the user's reduced-motion preference, suppressing non-essential transitions/animation when reduced motion is requested.
- **Priority**: must
- **Acceptance criteria**:
  - Given a reduced-motion preference is set, when focus or mode changes, then no non-essential animated transition plays; the change is applied without motion.

### FR-008 — Token-driven dual-theme
- **Description**: The system shall render using the shared design tokens so the view is correct in both light and dark themes with no per-caller theming, consistent with the shared UI primitives' theming model.
- **Priority**: must
- **Acceptance criteria**:
  - Given the theme is toggled, when the view is shown in each theme, then all boxes, arrows, outline rows, legend, and mode indicator remain legible using token-driven colours (no hard-coded colour that breaks a theme).

### FR-009 — Parity with existing views' data source
- **Description**: The system shall consume the same live read-only snapshot the existing views consume (the periodic dual-poll), with no additional endpoint, spawn, or write.
- **Priority**: must
- **Acceptance criteria**:
  - Given the running app, when the new view is active, then it issues only the existing read-only snapshot reads and no mutation or new data source is introduced.

### FR-010 — Honesty encoding (authored solid, derived dashed)
- **Description**: The system shall render authored (real) structure as solid and derived (inferred) structure as dashed/marked, taking the provenance from the core's output so no derived element is presented as authored.
- **Priority**: must
- **Acceptance criteria**:
  - Given output containing both authored and derived elements, when rendered, then authored elements are solid and derived elements are dashed/marked per the core's provenance; on a fully-fallback (all-derived) snapshot every rendered structural element is dashed/marked.

### FR-011 — Reuse the shared core, do not fork its algorithm
- **Description**: The system shall obtain its outline, diagram, mode/verdict, numbering, and provenance from the shared decomposition core's single public output; it shall not re-implement decomposition, ICOM classification, numbering, or density logic in the view layer.
- **Priority**: must
- **Acceptance criteria**:
  - Given the view's source, when its imports and logic are inspected, then the decomposition/ICOM/numbering/density derivation is imported from the shared core, not duplicated in the view (EPIC-001 Outcome 5).

## Non-Functional Requirements

### NFR-001 — Interactive scale at N ≥ 1000
- **Category**: performance
- **Threshold**: the view maintains an interactive frame budget on a workspace of **N ≥ 1000** artifacts. Exact per-frame budget = **TBD** (bound by the T1 core's NFR-002 / RFC-028 Q4, and to be fixed empirically by the ADI-flagged N=1000 windowed-outline profiling). The design lever is that the diagram materialises only one bounded decomposition level and the outline is windowed, so rendered DOM stays bounded independent of N; the core layout input is deterministic and pure.
- **Measurement**: render the view over an N ≥ 1000 fixture and measure interaction latency (focus change, scroll) against the T1-bound budget once fixed.

### NFR-002 — Accessibility
- **Category**: accessibility
- **Threshold**: full keyboard operability (outline traversal + focus change), a visible focus indicator, reduced-motion honoured, and information not conveyed by colour/motion alone (honesty key available as line-style + label). No unlabelled interactive control.
- **Measurement**: keyboard-only walkthrough + an automated accessibility scan of the view with 0 critical violations (tool/threshold detail = TBD, set by the driving RFC).

### NFR-003 — Read-only conformance
- **Category**: security
- **Threshold**: zero mutation surface — the view adds no write endpoint, no spawn of a mutating subcommand, and no host filesystem write (rule 22).
- **Measurement**: static review of the view's data path confirming only read-only snapshot reads; no new mutating call sites.

### NFR-004 — Reuse-not-fork
- **Category**: maintainability
- **Threshold**: the decomposition/ICOM/numbering/density derivation exists in exactly one place (the shared core); zero duplicate implementations in the view layer.
- **Measurement**: a test/inspection asserting the core symbols are imported (not re-implemented) by the view (EPIC-001 Outcome 5).

## Constraints

### Technical
- Consumes the frozen T1 core public surface (RFC-028); the core is headless (no geometry — SPEC-004 FR-007), so the view owns all presentation geometry and must not push geometry back into the core.
- The core returns a **non-null** diagram in both `idef0` and `tier-stack` modes (RFC-028 F1 / I-12), so the view has a renderable diagram to show even in the honest fallback.
- The view rides the existing periodic read-only snapshot; no new data source.

### Business
- This is the **first surface** of EPIC-001 (GATE-A gate for Phase 2); it is what proves the core is renderable (Outcome 5) and honest (Outcome 6) end-to-end.

### Regulatory (project rules)
- rule 22: `/api/*` stays read-only; the view mutates nothing.
- rule 24 / FSD: the view composes shared UI primitives and consumes the shared core; it does not re-skin primitives from above or fork core logic.
- rule 11: MUST sections filled; the downstream EvidencePack MUST carry `## Structured Fields` (verdict / congruence_level / evidence_type) or R_eff collapses to 0.1.

## ADI Reasoning Outcome (forgeplan_reason PRD-034, gemini-3-flash-preview, 2026-07-01)

Three genuinely-considered hypotheses; recommendation **H1** at High confidence. This sharpens AC-3 and AC-6 below.

- **H1 — Dedicated additive view** (recommended, High): the only path that guarantees zero regression of the seven existing views (AC-3) while proving the T1 core renderable without forking (Outcome 5). Clean separation lets the outline be windowed (NFR-001) without adding DOM weight to Force/Sankey, and honesty (solid/dashed) is cleanest in a clean-slate surface where it cannot conflict with existing graph styling.
- **H2 — Reuse/extend an existing hierarchical view (Tree/Sunburst)** (Low): would force a fork of the existing render logic (raising its complexity and risking regression of hierarchical rendering for non-idef0 projects) → directly contradicts AC-4 (reuse-not-fork) and Goal 4 (no regression). Rejected.
- **H3 — Headless-to-overlay side-panel** (Medium): aids discovery but loses the standalone top-down altitude reading (Goal 1) and cannot fit the altitude-ordered outline (FR-002) in a constrained panel; strategically misaligned with "standalone". Rejected.
- **Null baseline — do nothing** (documented above): leaves the shipped core headless, delivering zero user value and blocking GATE-A / Outcomes 5+6. The decision must beat this; H1 does.

Two ADI-flagged evidence needs are folded in: (i) the view switcher must accept the new entry without layout breakage/overflow → AC-3; (ii) N=1000 windowed-outline profiling fixes the NFR-001 budget → AC-6.

## SMART Acceptance Criteria (ship-or-not-ship for T2)

1. **AC-1 (renders honestly on live sparse data)**: on the current dogfood workspace (density below threshold, ≈0.095 vs 0.3 today), selecting the view — fed by the **same read-only live snapshot the seven existing views poll, with no separate data source (FR-009)** — renders **without error** in the **tier-stack fallback**, with the fallback mode indicator visible **(FR-004)** and the **permanent ICOM legend present (FR-005)**; **metric** = render errors, **threshold** = 0; **horizon** = GATE-A (EPIC-001 Phase 2 entry).
2. **AC-2 (renders the dense reading on a dense fixture)**: on a committed dense fixture (density ≥ threshold, depth ≥ 3), selecting the view renders the dense `idef0` diagram — focus box + its ≤ per-page-bound children (roll-up when exceeded) + ICOM arrows on the correct sides (input=left, control=top, output=right, mechanism=bottom) **(FR-003)**; **metric** = arrows on the wrong side + boxes over the per-page bound without roll-up, **threshold** = 0; **horizon** = GATE-A.
3. **AC-3 (no regression of the seven existing views)**: with the new view added **(FR-001)**, selecting each of the seven existing views renders it unchanged (no new console error, no visual regression vs baseline), and the view switcher accepts the new entry without CSS overflow / layout breakage (ADI H1 evidence); **metric** = regressed views + switcher-layout defects, **threshold** = 0; **horizon** = GATE-A (pre-merge).
4. **AC-4 (reuse-not-fork, Outcome 5 — FR-011)**: the view imports the shared core's derivation/classification/numbering/density symbols and re-implements none of them; **metric** = duplicated core algorithms in the view layer, **threshold** = 0; **horizon** = GATE-A.
5. **AC-5 (honesty visible, Outcome 6 — FR-010)**: on a snapshot containing both authored and derived elements, authored structure renders solid and derived structure renders dashed/marked per core provenance, and on the all-derived fallback every rendered structural element is dashed/marked; **metric** = derived elements mislabelled as authored, **threshold** = 0; **horizon** = GATE-A.
6. **AC-6 (interactive scale, Outcome 4)**: on an N ≥ 1000 fixture the view stays within the interactive frame budget for focus-change and scroll (bounded DOM: one materialised level + windowed outline — FR-002), with the budget value **TBD** fixed by the ADI-flagged N=1000 windowed-outline profiling (T1 NFR-002 / RFC-028 Q4); **metric** = interaction latency vs budget, **threshold** = within budget; **horizon** = GATE-A.
7. **AC-7 (accessibility + theming floor)**: the view is fully operable by keyboard with a visible focus indicator **(FR-006)** and honours reduced-motion **(FR-007)**, and renders legibly in both light and dark themes via design tokens with no hard-coded colour that breaks a theme **(FR-008)**; **metric** = critical accessibility violations + keyboard-unreachable controls + theme-breaking colours, **threshold** = 0; **horizon** = GATE-A.

## Risks + Reversibility

| Risk | Impact | Mitigation |
|------|--------|------------|
| The dense `idef0` reading is unreachable on real data today (density ≈0.095), so a reviewer over-claims a dense capability that only a fixture exercises | Med | Honest default is the tier-stack fallback (AC-1 on real data); the dense reading is fixture-validated (AC-2) and gated on T3 spine authoring for real data. T1 evidence already reframes this (RFC-028 S-1). |
| A future contributor re-skins a shared UI primitive from the view to get a diagram look | Med | Compose primitives; extend a primitive with a variant if a look is missing (rule 24). Reviewer greps upper-layer `:global()` for primitive class names. |
| The view accidentally re-derives ICOM/numbering instead of consuming the core (forks the algorithm) | High | AC-4 / NFR-004 assert import-not-reimplement; the core's diagram carries per-box number + per-arrow side + provenance (INV-10) so the view has no reason to recompute. |
| A well-meaning "honesty polish" renders a fallback as a dense diagram | High | FR-004/FR-010 + AC-5: render the mode the core returned; never override a fallback; all-derived ⇒ all-dashed assertion. |
| Adding a view perturbs the existing seven (switcher overflow, shared state) | Med | AC-3 no-regression + switcher-capacity gate (ADI H1 evidence); the view is purely additive (new selectable entry + one render branch), reverted by removing that entry. |

**Reversibility**: the view is **purely additive** — a new selectable view entry plus one render branch consuming an already-shipped core. Removing the entry and its branch fully reverts to the seven-view state with no data migration, no `/api/*` change, and no core change (the core stays regardless). Low-cost, one-change revert.

## Related Artifacts

- **EPIC-001** — parent (T2 track, Phase 2 / GATE-A, Outcomes 4/5/6, "Standalone idef0 decomposition view" child row); this PRD `refines` it.
- **RFC-028** — the shipped headless T1 core: a single public derivation entry point that, from the live snapshot, returns an altitude outline, an ICOM decomposition diagram (non-null in **both** the dense `idef0` and tier-stack fallback modes), a density verdict, and a stable structural signature; this PRD is `based_on` it (the view is its first consumer). The exact call signature and result shape are frozen by SPEC-004 / SPEC-005, not restated here (rule 11 — no implementation leakage in the PRD).
- **SPEC-004** — frozen TADD + ICOM conformance contract the core honours; the view relies on its INV-2/5/6/10 guarantees (informs=Mechanism, honesty, density routing, headless metadata sufficiency).
- **SPEC-005** — the view-level rendering conformance contract (`#### Scenario` blocks: honest two-pane fallback, dense render, no-regression, honesty encoding, a11y); `based_on` this PRD, and the render half of the GATE-A evidence.
- **ADR-006** — behaviour-preserving tier-vocabulary lift enabling the core (tier altitude the outline reads).
- **ADR-007** — `idef0` = IDEF0-STYLE projection, `informs` = Mechanism, local relation→ICOM table (I=left/C=top/O=right/M=bottom, real=solid/derived=dashed) — the reading key this view renders.
- **(planned) RFC (T2 view)** — the implementation RFC deriving from this PRD (registration, layout, focus model); owns the concrete surfaces and the TBD budget/threshold numbers.
- **EVIDENCE (this reasoning)** — captures the ADI decision rationale (dedicated view vs extend-existing vs do-nothing); `informs` this PRD.





