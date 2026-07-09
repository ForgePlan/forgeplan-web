---
depth: standard
id: EVID-059
kind: evidence
last_modified_at: 2026-07-01T17:46:07.146359+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-034
  relation: informs
status: active
title: 'Architecture fitness review of PRD-034 / SPEC-005 (T2 idef0 view): CONCERNS — 1 data-flow, 1 coupling, 1 blast-radius'
---

## Verdict

**CONCERNS**

One-line justification: the T2 design is architecturally sound and tightly bound to EPIC-001 Outcomes 4/5/6 (dedicated additive view, pure consumer of the frozen `shared/lib/idef0` core, honest tier-stack default, one-change revert) — but the render-conformance contract in SPEC-005 (and PRD-034's Constraints) mis-states the shipped core's public surface and asserts an "all-derived" fallback that conflicts with the core's edge-scoped honesty model, so the harness the view is built against would freeze against a phantom API and an unsatisfiable honesty assertion unless reconciled first.

## Structured Fields

verdict: supports
congruence_level: 2
evidence_type: audit

## Ground-truth verification

This is a **shaping-wave** review (design artifacts), not a code-change claim — so the ground truth is the forgeplan artifact store + the referenced frozen core on disk, not a git base..head diff.

- Base..head: **not applicable** (no code delta claimed; deliverables are PRD-034, SPEC-005, EVID-057).
- Artifacts verified present with full bodies via `forgeplan_get`: PRD-034 (draft), SPEC-005 (draft), EVID-057 (draft), EPIC-001 (active), RFC-028 (active). Not vacuous — all three T2 artifacts exist and are non-stub.
- `based_on RFC-028` premise verified on disk: `template/src/shared/lib/idef0/` exists (11 source files + 2 test files: `index.ts`, `port.ts`, `forest.ts`, `numbering.ts`, `relation.ts`, `diagram.ts`, `density.ts`, `signature.ts`, `outline.ts`, `keys.ts`, `types.ts`, `idef0.test.ts`, `nfr002.test.ts`). The shipped barrel exports `deriveIdef0`. The "shipped headless core" the PRD is `based_on` is **real**, not a phantom dependency.
- Registration surfaces verified: `template/src/shared/config/ui-prefs.ts` (`GraphView` union + `GRAPH_VIEWS` + `GRAPH_VIEW_IDS`, 7 ids) and `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` (`force/tree/radial/matrix/sankey/sunburst` branches + final `{:else} LanesView` at line 168).
- Verdict floor from ground-truth gate: **PASS-eligible** (artifacts present + non-empty + core premise real) → downgraded to CONCERNS by the findings below, none CRITICAL.

## Scope

### Artifacts under review
- **PRD-034** "Standalone idef0 decomposition view" (draft) — sections inspected: Problem, Goals, Non-Goals, Target users, FR-001…FR-011, NFR-001…NFR-004, Constraints, ADI Outcome, AC-1…AC-7, Risks + Reversibility, Related Artifacts.
- **SPEC-005** "idef0 view rendering scenarios" (draft) — sections inspected: Summary, Problem, Contract (RC-1…RC-8), Data Models, Errors (V-*), all 13 `#### Scenario` blocks, NFR-001…NFR-003, AC-1…AC-5, Open Questions.

### Parent context (source of truth for acceptance)
- **EPIC-001** (active) — Outcomes 4 (scale N≥1000), 5 (reuse-not-fork ≥2 hosts, one core), 6 (honesty real=solid/derived=dashed, honest density-gate fallback); Phase 2 / GATE-A; "Standalone idef0 decomposition view" child row; the "explicitly NOT the reserved map/composed slot" registration invariant.
- **RFC-028** (active, frozen T1 core) — `deriveIdef0` public surface, non-null diagram in both modes (F1/I-12), headless FR-007, port contract, pure-core + N-host-adapter contract, reserved-`map`-slot note (line 223).
- **EVID-057** (draft) — the sibling ADI-reasoning evidence (dedicated-view vs extend vs do-nothing); cross-read for consistency, not re-audited.

### Source / core inspected (independent verification, not trusting the shape report)
- `template/src/shared/lib/idef0/index.ts` — the shipped `deriveIdef0` barrel (actual public surface).
- `template/src/shared/lib/idef0/types.ts` — frozen data shapes + provenance scoping.
- `template/src/shared/lib/idef0/outline.ts` — `flattenOutline` (outline data source).
- `template/src/shared/lib/idef0/density.ts` — `densityGate` mode routing.
- `template/src/shared/config/ui-prefs.ts`, `.../DependencyGraph.svelte` — registration surface.
- `docs/PROJECT-MAP-SPEC.md` §8 — the reserved 8th `map` view.

### Not reviewed (out of scope)
- SPEC-004 core conformance internals (frozen upstream; consumed, not re-audited).
- The T1 core's algorithmic correctness (already gated by EVID-046/047/048 on RFC-028).
- The not-yet-authored T2 view RFC (owns layout/component/focus model + TBD budget numbers).

## Methodology

| Step | Detail |
|---|---|
| Fitness categories applied | Data flow, Coupling, Blast radius, Modular boundary, Testability |
| Parent-PRD/EPIC cross-check | Outcome 5 (a): covered ✅ · Outcome 6 (b): covered but render-boundary gap ⚠️ · dense-fixture decoupling (c): covered ✅ · single reversible view (d): covered ✅ · hexagonal adapter (e): covered, port-contract fidelity gap ⚠️ |
| Recalled priors | memory_recall (12 hits): [9] the 9th `idef0` id must register in the triple and NOT take the reserved 8th `map` slot; [4] real data shape (0 epics, 16 parentless PRDs, density-gate fallback); [3] Phase 2/GATE-A framing. `mm-gate-failures` mental model: **unavailable** (404 not found in bank). |
| Static analysers | see table (this is a design + contract-fidelity review; the code-level analysers apply to the not-yet-written view) |

### Static analysers

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| filesystem probe | `ls template/src/shared/lib/idef0/` | executed | 0 | core present (11 src + 2 test files) |
| barrel surface read | `Read index.ts` | executed | 0 | actual `deriveIdef0` signature captured |
| registration grep | `grep GraphView/GRAPH_VIEWS/GRAPH_VIEW_IDS ui-prefs.ts` + branch grep | executed | 0 | 7 view ids; final `{:else}`=Lanes |
| reserved-slot grep | `grep -niE "8th\|reserved\|map.*slot" docs/PROJECT-MAP-SPEC.md` | executed | 0 | `map` = reserved 8th view, same triple |
| madge (cycles) | `madge --circular` | skipped | — | not the review surface; the view is unwritten, no new edges to analyse yet |
| cloc / npm ls / cargo tree | — | skipped | — | design-artifact review; no dependency-graph delta to score |

## Parent-EPIC / PRD fit

| Fitness question (from dispatch) | Where delivered | Coverage | Note |
|---|---|---|---|
| (a) Outcome 5 — view CONSUMES the core, no fork | PRD FR-011, NFR-004, Goal 5, AC-4; SPEC RC-3, "reuse-not-fork" scenario, AC-5 | ✅ covered | strongly bound: import-not-reimplement assertion + read-number/side/provenance-from-core |
| (b) Outcome 6 — honest fallback, real=solid/derived=dashed, not hidden | PRD FR-004/FR-005/FR-010, Goal 2, AC-1/AC-5; SPEC RC-1/RC-2, "honest tier-stack fallback" + "honesty encoding" scenarios | ⚠️ partial | framing is correct and fallback is the primary tested path — but the SPEC's blanket "all-derived" fallback assertion conflicts with the core's edge-scoped node-real provenance (Finding 1) |
| (c) dense capability provable under test WITHOUT T3 live data | PRD AC-2; SPEC "dense idef0 render" scenario + AC-2 (committed dense fixture, density ≥ threshold, depth ≥ 3) | ✅ covered | cleanly decoupled from PROB-060/T3; Risk row 1 acknowledges fixture-only exercise |
| (d) single reversible view, no T3/T4/T5 creep | PRD Non-Goals + Reversibility; SPEC no-regression scenario ("one-change revert") | ✅ covered | purely additive: one selectable entry + one render branch |
| (e) clean host-renderer/adapter over the T1 port (hexagonal), ADR-007 projection framing | PRD Constraints (view owns geometry, pushes none back); SPEC Contract (`host adapter → RawSnapshot → deriveIdef0`) | ⚠️ partial | topology is correct hexagonal ports-and-adapters — but the restated port signature does not match the shipped barrel (Finding 2) |

Net: the design **passes** the reuse-not-fork (a), fixture-decoupling (c), and reversibility (d) fitness bars outright, and adopts the **correct** honesty (b) and hexagonal-adapter (e) shapes — the two `⚠️` cells are contract-fidelity gaps between the T2 render contract and the frozen core, not design-direction errors.

## Findings

Ranked by severity. Each recommendation is a **fitness gap to close**, not an alternative design.

| # | Severity | Category | Location | Description | Recommended next step |
|---|---|---|---|---|---|
| 1 | MEDIUM | 🔄 Data flow | SPEC-005 "honest tier-stack fallback" scenario vs `types.ts:24-26` + `index.ts:87` + `outline.ts:31` | The fallback scenario asserts "**every structural element is dashed/marked ≈ (all-derived)**". But the frozen core sources the outline pane from `flattenOutline(forest)` — the **DecompForest**, not `tierStack` — and `OutlineRow.provenance = node.provenance`, where the core states "**Nodes are real by default (roots too)**" (honesty is **edge-scoped**). In tier-stack mode the diagram is all-derived (from `tierStack`) but outline rows for real artifacts carry `provenance: "real"` → **solid**. A conformance test asserting a blanket "all-derived" fallback either fails against the real core or forces the view to dishonestly dash real artifact rows — the exact Outcome 6 hazard the SPEC exists to prevent, inverted. | Ask SPEC author to scope the all-derived assertion to the diagram's ICOM arrows / inferred spine (derived in fallback) and let outline rows reflect per-row `provenance` (real nodes solid); explicitly name the outline's data source (`forest` vs `tierStack`) in fallback mode. |
| 2 | MEDIUM | 🔗 Coupling | SPEC-005 "Contract" + "Data Models" (`deriveIdef0 result` row); PRD-034 Constraints/Technical; vs `template/src/shared/lib/idef0/index.ts:38-90` | SPEC-005 restates the core's public surface (claiming faithful restatement, "not re-declared") as **positional** `deriveIdef0(raw, threshold, takenAt, focus?) → { forest, diagram, verdict, outline, signature }` (5 fields, `forest` as a `DecompForest\|TierStackForest` union). The **shipped barrel** is an **options object** `deriveIdef0(raw, opts:{threshold, focus?, window?, takenAt?}) → { input, forest, tierStack, verdict, diagram, outline, signature }` (7 fields, **separate `tierStack`**, plus `input`; `forest` typed `DecompForest`). The dispatch prompt itself names `tierStack` as a distinct field — so the T2 artifacts, not the orchestrator, carry the drift. A harness/adapter coded to the SPEC's stated port signature will not type-check, and the reuse-not-fork import assertion (AC-4) can pass while the actual call site diverges. | Reconcile SPEC-005 Contract + Data Models and PRD-034 Constraints to the shipped barrel signature (options object; `tierStack` as a first-class result field distinct from `forest`). If RFC-028's positional prose is meant to be authoritative, then the "frozen" core has already drifted from it — flag that to the core owner. |
| 3 | LOW | 💥 Blast radius | PRD-034 FR-001 / SPEC-005 "no-regression" scenario (omission); vs `docs/PROJECT-MAP-SPEC.md §8` + RFC-028 line 223 + recalled prior [9] | `PROJECT-MAP-SPEC §8` reserves a **`map`** view as the 8th view, registered via the **same triple** (`GraphView` union + `GRAPH_VIEWS` + `GRAPH_VIEW_IDS`) and inserted **before the same LanesView fallthrough** the T2 `idef0` view uses. RFC-028 (core) flags "idef0 explicitly does NOT take the reserved map/composed slot," but **neither PRD-034 nor SPEC-005** — the T2 artifacts that own the registration surface and gate GATE-A — restate this. The registration triple is shared mutable state across two epic children (T2 idef0, T4 map); without an explicit non-collision constraint in the T2 render contract, id/ordering collision with T4 is unguarded. | Add a Non-Goal / no-regression assertion to PRD-034 + SPEC-005 that the new view id is `idef0` (distinct from the reserved `map`/8th slot) and does not reorder or occupy the composed-map slot; the no-regression scenario should assert the reserved slot stays free. |

## Blast radius

- **If this RFC/view is implemented and wrong, what fails?** Bounded to the **new `idef0` view render path only**. The view is purely additive (one selectable entry + one `{:else if view==='idef0'}` branch before `DependencyGraph.svelte:168`). It shares one mutable surface with the rest of the app: the `ui-prefs.ts` `GraphView` registration triple. The realistic blast vectors are (i) a switcher-layout/overflow regression on the shared picker (PRD AC-3 guards this), and (ii) a registration-id/ordering collision with the T4-reserved `map` slot (Finding 3, currently unguarded in the T2 artifacts).
- **Production scope:** read-only viewer surface; no `/api/*` mutation, no host filesystem write, no CLI/bin dependency added (rule 22 / rule 23 respected by design). No user data at risk; worst case is a broken/absent view tab and/or a mis-rendered decomposition.
- **Recovery path:** remove the one selectable entry + the one render branch → exact seven-view state restored; **no data migration, no `/api/*` change, no core change** (PRD Reversibility, confirmed against the additive registration shape). One-commit revert.
- **Detection time:** fast — a switcher/registration regression surfaces at build/CI (type error on the union or a component render error in the no-regression scenario) or on first manual view-switch; the honesty gaps (Findings 1/2) surface when the conformance harness is written against the real core.

## Operability concerns

- **Observability:** N/A at design altitude — this is a client render surface with no new server telemetry; the existing read-only poller is unchanged.
- **Deploy / rollback:** reversible by construction (additive entry + branch); no schema, no migration. Backward-compatible with the seven existing views.
- **Runbook:** none required beyond the existing app; no new paging surface.
- **Capacity:** the N≥1000 interactive budget is correctly deferred to empirical T2 profiling (PRD AC-6 / SPEC NFR-001). Note: the T2 artifacts label this budget "TBD (bound by RFC-028 Q4)" — this is **correct**, not drift: RFC-028 Q4's ≤50 ms is the core's **derivation** budget, whereas the T2 quantity is the **render/interaction** frame budget for focus-change/scroll, a genuinely distinct number the view must measure. Checked and sound.

## Positive observations

- **Strong (Outcome 5, reuse-not-fork):** FR-011 + NFR-004 + AC-4 + SPEC RC-3 + the "reuse-not-fork observable from the render output" scenario bind the view to *import* the core's derivation/classification/numbering/density symbols and read number/side/provenance from the core output — the derivation lives in exactly one place. This is the cleanest possible expression of the epic's load-bearing constraint.
- **Strong (Outcome 6 framing):** the SPEC makes the **tier-stack fallback the primary real-data tested scenario** (not an afterthought) and explicitly forbids upgrading a fallback to a fabricated dense diagram (RC-1, V-FALLBACK, Risk "honesty polish"). The honesty-encoding scenario keys assertions off per-element `provenance` — robust. (Finding 1 is a wording/data-source gap on top of an otherwise-correct honesty posture.)
- **Strong (fitness decoupling):** the dense-IDEF0 capability is provable on a **committed dense fixture** independent of the PROB-060-gated T3 live-data authoring — the flagship capability is testable now without waiting on data recovery, and Risk row 1 honestly flags that the dense reading is fixture-only until T3.
- **Strong (rule 11 discipline):** PRD-034 FRs are capability-only — no framework/library names leaked into functional requirements; implementation (registration triple, layout) is correctly deferred to the T2 RFC.

## Residual risks

- SPEC-004's frozen data-model shapes were **not** independently re-read (out of scope); Finding 2's reconciliation should be checked against SPEC-004's actual `Idef0Diagram`/`OutlineRow` freeze, not only RFC-028 prose, in case SPEC-004 and the shipped barrel also diverge.
- `mm-gate-failures` mental model was **unavailable** (404) — the recurring gate-failure priors that would normally cross-check this review came only from `memory_recall`; a gate-failure pattern not surfaced there may be uncovered.
- The N≥1000 interactive budget is genuinely unset (deferred to T2 profiling); this review cannot confirm Outcome 4 scale, only that the artifacts route it correctly to a future measurement.

## Recommended next steps

- **[→ orchestrator]** Proceed with T2 **with mitigations**: this is CONCERNS, not BLOCKER — the design direction is fit. Require Findings 1 + 2 reconciled in SPEC-005 (and PRD-034 Constraints) **before** the T2 view RFC/build freezes against SPEC-005, so the conformance harness is written against the real port and a satisfiable honesty assertion. Finding 3 is a cheap constraint to add to the same pass.
- **[→ adr-architect]** Not required — no new architectural decision; the gaps are contract-fidelity fixes to existing artifacts, and the projection framing (ADR-007) is already correctly consumed.
- **[→ coder]** When the view is built: implement the adapter against the shipped options-object barrel (`deriveIdef0(raw, {threshold, focus, window, takenAt})`), render the outline from the correct forest per mode, and register `idef0` as a distinct id that leaves the reserved `map` slot free.
- **[→ tester]** The conformance harness must resolve the outline-provenance semantics (Finding 1) before encoding the fallback scenario; add a test asserting the reserved `map` slot remains unregistered by the T2 change (Finding 3).

## References

- Artifacts under review: `PRD-034`, `SPEC-005`
- Parent: `EPIC-001` (Outcomes 4/5/6, Phase 2 / GATE-A); frozen core `RFC-028`; sibling `EVID-057` (ADI reasoning)
- Related ADRs: `ADR-006` (tier lift), `ADR-007` (idef0 = IDEF0-STYLE projection, informs=Mechanism, relation→ICOM table)
- Core source cross-checked: `template/src/shared/lib/idef0/{index,types,outline,density}.ts`; `template/src/shared/config/ui-prefs.ts`; `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte`; `docs/PROJECT-MAP-SPEC.md` §8
- Mental models consulted: `mm-gate-failures` (unavailable — 404)


