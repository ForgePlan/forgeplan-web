---
depth: standard
id: EVID-046
kind: evidence
last_modified_at: 2026-07-01T10:30:45.835711+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-028
  relation: informs
- target: EVID-049
  relation: supersedes
status: superseded
title: 'Architecture review of RFC-028: CONCERNS — 3 MEDIUM (tier-stack diagram drift, O(1)-DOM ≤6-box gap, id-collision edge) + 1 LOW'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit
review_verdict: CONCERNS

(`weakens` = this review surfaces material fitness gaps against the frozen SPEC-004 contract that must be reconciled before the RFC is activated; CL3 = review performed directly on the real stored artifacts + the real `develop` tree = same context; `audit` = architecture-fitness audit, no code executed.)

## Verdict

**CONCERNS**

- **PASS** — no findings above LOW. Not the case: three MEDIUM findings survive the gate.
- **CONCERNS** — MEDIUM findings present; activation requires the RFC author to reconcile them (or the orchestrator to accept them as explicit RFC-bound follow-ups). ← this review.
- **BLOCKER** — CRITICAL present. Not the case: the core is architecturally sound and salvageable; every finding is a contract-reconciliation / edge-case gap closable by an RFC edit, none needs an `architect` redesign.

One-line justification: RFC-028's pure-core/host-adapter boundary, FSD lift, id-index mandate, and ADR-007 Q2 table are all faithful and well-grounded on `develop`, but three MEDIUM gaps drift from or under-realize the **frozen** SPEC-004 contract — the tier-stack `diagram: null` return contradicts the frozen `Idef0Diagram.mode="tier-stack"` + Scenario 3, the O(1)-DOM ≤6-box-per-page scalability proof is unrealized by the core, and edge-endpoint resolution under id-collision is undefined against INV-8/E-ID-COLLISION.

## Ground-truth verification

This is a **design RFC review**, not a landed-code claim. There is no `base..head` diff to verify — the appropriate ground truth is the factual base the design rests on (the `develop` source facts and the absence of the not-yet-built core). All probes run in this session against the real tree.

- Repo / branch: `/Users/explosovebit/Work/ForgePlanWeb` @ HEAD `54a905c8` on `feat/idef0-decomposition-surfaces`.
- Diff probe: `n/a — RFC design review; no code mutation claimed by this dispatch`.
- Diff state: **n/a (no code delta claimed)**.
- Expected-delta token: the load-bearing source facts the RFC/ADR-006/ADR-007 assert.
- Token probes (all **FOUND / as-claimed**):
  - `ls template/src/shared/lib/{idef0,tier}/` → **absent** (both) — the core is genuinely un-built; no vacuous "already implemented" claim. `grep -rl classifyIcom|buildDecompForest|idef0-relation template/src` → **0 hits**.
  - `cluster.svelte.ts:8` declares `TYPE_ORDER = [epic,prd,spec,rfc,adr,evidence,note,problem,solution]` (RFC/ADR-006 said 8-18) → **FOUND**.
  - `type-tier.ts:13` `typeTier` (case-insensitive index, unknown ⇒ `TYPE_ORDER.length`=9), `:25` `compactTierMap` (gaps collapse inward) → **FOUND**, matches Scenario 1's frozen expectation exactly.
  - `SankeyView.svelte:35` `import { TYPE_ORDER } from '../lib/cluster.svelte'` (the shim-critical direct import) → **FOUND** verbatim.
  - `HIERARCHY_RELATIONS` + `normaliseHierarchyEdge` live in `type-tier.ts:63-94`; the set omits `based_on`/`contradicts` (→ `return null`) and maps `informs` to a hierarchy parent edge → **FOUND** — the exact divergence ADR-007's local table corrects, and the reason INV-9 must be measured at *symbol* granularity (the enclosing file legitimately changes for the re-export).
  - 7 existing views: `GraphView = force|tree|radial|matrix|lanes|sankey|sunburst` + 7 `*View.svelte` + 7 branches in `DependencyGraph.svelte` ending `{:else} LanesView` (line 168-169) → **FOUND** — the `{:else if view==='idef0'}` seam is real; "9th view" presumes the reserved (unregistered) `map` slot is 8th.
  - Tier-vocab consumers (blast radius): `cluster.svelte.ts, tree-layout.ts, sankey-layout.ts, sunburst-layout.ts, type-tier.ts, SankeyView.svelte` → **FOUND** — matches "Tree/Sankey/Sunburst + SankeyView direct".
  - `docs/PROJECT-MAP-SPEC.md §23` (T4 composed-map host contract) → **FOUND** (line 623).
- Verdict floor from ground-truth gate: **PASS-eligible** (the RFC and its factual base are present and accurate; the CONCERNS verdict is a fitness judgement, not a claim-vs-reality gap).

Literal probe output (excerpts): `SankeyView.svelte:35: import { TYPE_ORDER } from '../lib/cluster.svelte';` · `type-tier.ts:81: if (!HIERARCHY_RELATIONS.has(relation)) return null;` · `HIERARCHY_RELATIONS = new Set(["contains","belongs-to","refines","informs","supersedes"])` (no based_on/contradicts) · `forgeplan_validate RFC-028 → passed:true, error_count:0`.

## Scope

### RFC under review
- ID: `RFC-028` — "Pure staged idef0 decomposition core (shared/lib/idef0) with id-indexed port and tier lift".
- Sections inspected: Summary, Motivation, Module Breakdown, C4 (L1/L2), Data Flow, DecompInput port contract, HARD MANDATE (port id-index), Function Signatures, classifyIcom table, pure-core+N-host-adapter contract, Complexity+budget, Determinism+Q3, Options Considered, Proposed Direction, ADI, Implementation Phases, Invariants I-1..I-10, Rollback, Risks, Test Strategy Hooks.

### Parent contract (source of truth for acceptance)
- Frozen conformance contract: `SPEC-004` — INV-1..10, FR-001..007, NFR-001..004, AC-1..6, 12 `#### Scenario` blocks, density metric frozen, Q1/Q3/Q4 RFC-bound.
- Governing ADRs: `ADR-006` (tier-vocab lift + SankeyView shim), `ADR-007` (IDEF0-STYLE projection, Q2 letters, local relation table).
- Parent epic: `EPIC-001` (critical; Outcomes 4/5/6 are the relevant acceptance drivers). Prior review: `EVID-045` (SPEC-004 C4 audit, CONCERNS, F1-F6 — verified addressed in the SPEC revision this RFC consumes).

### Source / tree inspected
- `template/src/widgets/dependency-graph/lib/{cluster.svelte.ts,type-tier.ts}` — lift sources + frozen relation table.
- `template/src/widgets/dependency-graph/ui/{SankeyView,*View}.svelte`, `DependencyGraph.svelte` — shim-critical import + the 7-view/9th-view seam.
- `template/src/shared/config/ui-prefs.ts` — GraphView union / GRAPH_VIEWS / GRAPH_VIEW_IDS.
- `docs/PROJECT-MAP-SPEC.md §23` — T4 host contract.

### Not reviewed (out of scope)
- The T2 `idef0` view host + its adapter, and the T4 composed-map host — separate EPIC-001 children; only the core's boundary toward them is in scope.
- Content-domain correctness of IDEF0/ICOM as a modelling metaphor — ADR-007 territory (already decided).
- Runtime NFR-002 measurement — the 50 ms figure is target-until-measured; the actual number is guardian-required EVIDENCE at Phase 5, not producible at RFC time.

## Methodology

| Step | Detail |
|---|---|
| Fitness categories applied | Modular boundary (🏗), Coupling (🔗), Data flow (🔄), Blast radius (💥), Operability (⚙️), Scalability (📈), Testability (🧪) |
| Parent-contract cross-check | Every SPEC INV/FR/AC + EPIC Outcome mapped to an RFC section (see Parent-contract fit) |
| Recalled priors | `memory_recall` (9th-view registration triple-site, local idef0-relation.ts non-mutation, A3 outline+diagram surface, density-gate honest fallback, 16-box top-tier open question); `mm-gate-failures` mental model **absent from this bank (HTTP 404)** — recorded honestly, not fabricated; `mental_model_list` returned `[]` |
| Static analysers run | see table |

### Static analysers

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| forgeplan_validate | `forgeplan_validate RFC-028` | executed | ok | passed=true, 0 errors, 0 warnings (schema-complete) |
| forgeplan_score | `forgeplan_score RFC-028` | executed | ok | R_eff=0.0, weakest_link=EPIC-001 (expected at draft) |
| FSD import grep | `grep -rn "from '.*widgets'" template/src/shared/` | executed | 0 hits | shared/ has zero widgets/ imports today — lift target clean |
| cloc | (module LOC distribution) | **N/A** | — | `cloc` present (2.06) but the `shared/lib/idef0` module does not exist yet — nothing to measure (greenfield RFC) |
| madge | (circular-dep graph) | **skipped** | — | not installed; and no TS module graph to build pre-implementation |
| pydeps/cargo tree | — | **N/A** | — | not a Python/Rust surface |

Honest negative coverage: code-graph analysers cannot run on a not-yet-written module; the load-bearing verification here is the SPEC-contract cross-check + the `develop` source-fact grounding above.

## Parent-contract fit

| Contract item | RFC section | Coverage | Note |
|---|---|---|---|
| SPEC INV-1 tier purity | Module Breakdown `shared/lib/tier/` + shims; Phase 0 | ✅ covered | byte-identity + import-graph tests |
| SPEC INV-2 informs=Mechanism, never structural | `idef0-relation.ts` + I-5; forest uses `refines` only | ✅ covered | matches ADR-007 P-2 |
| SPEC INV-3 total/explicit/no-drop | classifyIcom explicit switch; I-6 | ✅ covered | based_on-not-null regression guard |
| SPEC INV-4 ≤1 structural parent | `buildDecompForest` E-MULTI-PARENT tier-then-key; I-4 | ✅ covered | Q3 resolved |
| SPEC INV-5 honesty edge-scoped | provenance per element; roots stay real; I-10 | ✅ covered | consumes the post-EVID-045 F1 fix correctly |
| SPEC INV-6 density routing (metric frozen) | `density.ts`, threshold Q1=0.3; I-3 | ⚠️ partial | metric OK, but ≤6-box-per-page bound not realized — see F2 |
| SPEC INV-7 stable (id,title) numbering | `numbering.ts`; composite key; I-3 | ⚠️ partial | node numbering OK; **edge** endpoint resolution under collision undefined — see F3 |
| SPEC INV-8 determinism | canonical sort key `[typeTier, serialiseKey]`; I-3 | ⚠️ partial | orderings deterministic; collision-bucket resolution not pinned to the key — see F3 |
| SPEC INV-9 no shared mutation | symbol-frozen table; I-7 | ✅ covered | correctly requires symbol-granular (not whole-file) identity — verified `type-tier.ts` co-locates both |
| SPEC INV-10 headless metadata sufficiency | diagram carries side+provenance+number; I-9 | ⚠️ partial | holds for idef0 mode; tier-stack mode returns `diagram:null` → host cannot render from the diagram — see F1 |
| SPEC 12 scenarios → 12 Vitest files | Test Strategy Hooks table | ✅ covered | 1:1 mapping + NFR hooks; strong conformance harness |
| SPEC Q1/Q3/Q4 (RFC-bound) | 0.3 / tier-then-key + lowest-key / ≤50 ms | ✅ resolved | correct ownership; each justified |
| ADR-006 tier lift + SankeyView shim | Phase 0 + `cluster.svelte.ts` TYPE_ORDER shim + marker | ✅ covered | targets the verified fragile `SankeyView.svelte:35` |
| ADR-007 Q2 letters | classifyIcom table (based_on⇒input, supersedes/contradicts⇒control) | ✅ exact match | consumes ADR decision, does not re-open |
| EPIC Outcome 5 reuse-not-fork | structural port boundary + NFR-004 import test | ✅ covered | strongest part of the design |
| EPIC Outcome 6 honesty | edge-scoped provenance + density fallback | ✅ covered | — |
| EPIC Outcome 4 scale N≥1000 | id-index mandate + O(1)-DOM proof | ⚠️ partial | id-index sound; DOM proof gap (F2); budget unmeasured (residual) |

Honest mapping: the RFC covers the contract densely and consumes the revised (post-EVID-045) SPEC faithfully. The three ⚠️-partial rows are the substance of the findings below — each is a drift from or under-realization of the **frozen** contract, which is exactly what an activation gate must catch.

## Findings

Ranked by severity. Recommendations are fitness gaps to close — not alternative designs.

| # | Severity | Category | Location | Description | Recommended next step |
|---|---|---|---|---|---|
| F1 | MEDIUM | 🔄 Data flow | RFC §Data Flow ("diagram: null") + §Signatures (`densityGate … diagram: Idef0Diagram \| null`; `deriveIdef0 … diagram: … \| null`) vs SPEC-004 Data Models `Idef0Diagram.mode:"idef0"\|"tier-stack"` + Scenario "densityGate…" | The RFC returns `diagram: null` in tier-stack mode and carries the mode on the forest/verdict, but SPEC-004's **frozen** `Idef0Diagram` type defines a `"tier-stack"` mode value and the frozen Scenario 3 asserts "the returned **diagram** `mode == "tier-stack"`". A conformance test written to the frozen scenario dereferences a null diagram; and INV-10 ("host renders from the `Idef0Diagram`") cannot hold in tier-stack mode because the host must instead reach into the `TierStackForest`. The RFC also states it "does not re-open" the frozen shapes, so this is an internal contradiction. | RFC author reconciles the tier-stack representation with the frozen `Idef0Diagram`: either emit a non-null tier-stack `Idef0Diagram` (mode="tier-stack", derived boxes/legend, no arrows) so Scenario 3 + INV-10 hold uniformly, or record an explicit, SPEC-author-blessed deviation (and adjust Scenario 3's wording). Do not activate until the diagram nullability is contract-consistent. |
| F2 | MEDIUM | 📈 Scalability | RFC §"Complexity + budget" O(1)-DOM proof ("an IDEF0 page renders ≤6 boxes"); §Module Breakdown `diagram.ts` / `computeIdef0Diagram(forest, edges)`; SPEC INV-6 "≤6-box-per-page … upper bound" | The headline N≥1000 scalability rests on an O(1)-DOM proof whose premise is "≤6 boxes per page", but the core neither **enforces** it (`buildDecompForest` sorts children with no cap; the top tier can be 16 roots — the real dogfood "16 parentless PRDs" case flagged in memory + EPIC data-shape notes) nor **realizes** it: `computeIdef0Diagram(forest, edges)` takes the whole forest with no focus/page/rollup parameter and emits a flat `boxes` array, and — unlike the outline, which ships a windowed `flattenOutline(window)` primitive — the diagram has no paging/mega-node-rollup enabling contract. So a dense node with >6 children (or the 16-root top tier) yields a >6-box diagram and the O(1)-DOM claim fails at the core level. | RFC author closes the proof: add a diagram paging/focus or mega-node-rollup primitive to the core contract (the enabling counterpart to `flattenOutline(window)`), OR explicitly relocate the ≤6-box realization to the T2 host and downgrade the core-level O(1)-DOM claim to "host-paged", and state how the 16-root top tier is handled. |
| F3 | MEDIUM | 🔄 Data flow | RFC §"DecompInput port contract" ("resolves every edge's from/to by id") + §HARD MANDATE (`byId: Map<string, NodeIn[]>` buckets of length>1) vs SPEC EdgeIn `{from:CompositeKey,to:CompositeKey}`, INV-7/INV-8, E-ID-COLLISION | Edges arrive id-only (`RawSnapshot.edges.from/to: string`) but post-`port` `EdgeIn` endpoints are `CompositeKey`. When an id collides (two `(id,title)` share one id — the explicitly-motivating PROB-060 merge-dup case), `byId[id]` has length>1 and the RFC does not define **which** composite-key node the edge binds to. If resolution falls back to bucket insertion order it violates INV-8 ("never Map insertion order"); if arbitrary it is non-deterministic. The design surfaces collision on *nodes* (`idCollision=true`) but leaves *edge* attachment under collision unspecified — a determinism hole at the exact case the core claims to handle. | RFC author pins a deterministic edge-endpoint tie-break for collided ids (e.g. bind to the lexicographically-lowest composite key in the bucket, mark the other candidate binding `derived`), and add a Scenario/fixture for "edge references a collided id". Cheap to specify; keeps INV-8 intact. |
| F4 | LOW | 🏗 Modular boundary | RFC §"DecompInput port contract" (`RawSnapshot.takenAt?`) vs §Signatures (`deriveIdef0(raw, threshold, takenAt)` / `port(raw, threshold, takenAt)`) | `takenAt` has two sources — a field on `RawSnapshot` and an explicit pipeline argument that lands in `DecompInput.takenAt`. The RFC does not say which is authoritative if they disagree, a minor contract ambiguity for the coder (and a determinism nit if a host populates both). | One clarifying sentence: the explicit `takenAt` arg is authoritative and `RawSnapshot.takenAt` is ignored (or vice-versa); state precedence. |

(No CRITICAL/BLOCKER finding: the core's structure is sound; all four are closable by RFC edits without an `architect` redesign.)

## Blast radius

- **If this RFC is implemented and wrong, what fails?** The core is a **pure, read-only** library (rule 22 — no `/api/*` mutation, no `spawn`, no workspace write). A wrong core produces a wrong/absent **9th `idef0` view**, not corrupted data or a downed write path. The only change touching *existing production surface* is the **tier-lift**: if `typeTier`/`compactTierMap` drift by one index during relocation, the "altitude" of all **7 existing hierarchical views** (Force/Radial/Tree/Sunburst/Matrix/Lanes/Sankey) silently shifts — the single highest-impact failure mode, verified to touch `tree-layout.ts`, `sankey-layout.ts`, `sunburst-layout.ts`, `cluster.svelte.ts`, and the direct `SankeyView.svelte:35`.
- **Production scope:** client-side render only. 7 existing views (tier-lift) + 1 new view (idef0). Zero server surface, zero data mutation, zero user-data risk.
- **Recovery path:** per-phase `git revert` (pure lib ⇒ zero behavioural residue); tier-lift rollback governed by ADR-006 with the byte-identity golden test proving equivalence in either direction; Q1 threshold re-bind = one-line + test refresh (no ADR); Q2 re-letter = local-table edit (ADR-007-owned). De-facto kill-switch: the view is invisible until the `{:else if view==='idef0'}` branch + `ui-prefs` entry land in Phase 5 — not registering it is the off switch.
- **Detection time:** immediate at CI — the 12-scenario conformance harness + the ADR-006 byte-identity golden + the NFR-002 micro-benchmark all gate the phase PR; a red conformance test blocks merge. Altitude drift is caught by the golden snapshot before any relocation lands (GATE-0, captured pre-lift).

## Operability concerns

- **Observability:** N/A in the meaningful sense — the core is synchronous pure compute inside a Svelte reactive effect; no logs/metrics/traces are warranted or possible (NFR-001 forbids I/O). Correct for a pure lib.
- **Deploy / rollback:** fully reversible except the tier relocation (semi-irreversible, ADR-006-owned, made cheap by byte-identity). No schema, no migration, no backfill.
- **Runbook / paging:** not applicable (no runtime service component introduced).
- **Capacity:** the NFR-002 ≤50 ms @ N=1000 budget is **target-until-measured** — honestly flagged by the RFC (no invented benchmark), derivation ~9 ms + 5× margin. It is therefore **unverified at RFC time**; the actual figure is guardian-required EVIDENCE at Phase 5. This is the correct posture, but the headline scalability number is a projection, not a measurement, until then — and F2 shows the O(1)-DOM half of the claim needs closing regardless of the ms figure.

## Positive observations

- **Strong — the pure-core/host-adapter port boundary.** `RawSnapshot`/`DecompInput` are strictly structural + serialisable (no `ArtifactSummary`/`GraphEdge`/`MapNode`), both adapters live in the hosts, and the core imports only `shared/lib/tier/`. Verified: `classifyIcom`/`buildDecompForest` exist nowhere yet, entities are not imported by the core. This is a clean hexagonal seam and the direct enforcer of EPIC Outcome 5 (reuse-not-fork) via the NFR-004 import-not-reimplement test — the best part of the design.
- **Strong — surgical tier-lift blast-radius control.** The `cluster.svelte.ts` TYPE_ORDER re-export shim + `rule-24-shim` marker + a committed test asserting `SankeyView` resolves TYPE_ORDER post-lift + **symbol-granular** (not whole-file) byte-identity on `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge` — precisely targets the one fragile path I verified real (`SankeyView.svelte:35`) and the one file that co-locates the frozen table with the lifted symbols.
- **Strong — 1:1 scenario↔module↔test conformance harness.** Twelve `#### Scenario` blocks map to twelve Vitest files plus NFR property/purity/benchmark/reuse hooks; the RFC consumes the **revised** SPEC (all six EVID-045 findings F1-F6 verified addressed — edge-scoped honesty, symbol-granular INV-9, INV-10/error-mode scenarios, Q5 resolved). Option 1's per-stage isolability is a genuine testability win, correctly reinforced by the ADI (H1 High).
- **Strong — the `port()` id-index HARD MANDATE.** Elevating O(N+E) resolution to a BLOCKER-class invariant (vs naive O(N×E)) with an N=100→1000→5000 linear-scaling micro-benchmark is the right architectural call and the right thing to gate on.

## Residual risks

- **Chain trust:** parent `EPIC-001` is `draft` / R_eff=0 (evidence-less); RFC-028's activation R_eff is chain-gated by the parent — a chain-level observation (same as EVID-045 noted for SPEC-004), not a defect in RFC-028's body. `forgeplan_score RFC-028` → weakest_link=EPIC-001.
- **Recursive-DFS stack depth:** `numbering`/`signature`/`outline`/`forest` DFS a pathological all-`refines` chain; V8's ~10-15k frames tolerate N=1000 but a 5000-deep single chain (well past the NFR floor, unrealistic for a shallow document graph, EPIC Outcome 2 depth ≈3-5) could overflow. Honestly disclosed in the RFC risk table with a deferred iterative-DFS fallback — not a new finding.
- **NFR-002 ms budget unmeasured** until Phase 5 (see Operability/Capacity).
- **T2/T4 host navigation model** (which ≤6-box page is shown, drill-down, mega-node rollup) is out of this core RFC's scope but is where F2's ≤6-box realization must ultimately live; flagged so it is not lost at the host boundary.

## Recommended next steps

- [→ orchestrator] **CONCERNS — hold activation.** Do not activate RFC-028 until F1/F2/F3 are reconciled (F4 is a one-line clarification). None requires a redesign; a focused RFC revision closes all four. The gate remains additionally blocked by the guardian-required conformance-harness + NFR-002 benchmark EVIDENCE (not producible at RFC time) and by parent EPIC-001's evidence debt.
- [→ RFC author / architect-in-authoring-mode] Reconcile F1 (tier-stack diagram nullability vs frozen `Idef0Diagram.mode` + Scenario 3), close F2 (diagram paging/rollup primitive or downgrade the core-level O(1)-DOM claim + handle the 16-root top tier), pin F3 (deterministic edge-endpoint tie-break under id-collision + a fixture), clarify F4 (`takenAt` precedence). These are fitness-gap closures, not new designs.
- [→ spec-author (if F1 is resolved by editing the scenario side)] If the team elects to keep `diagram:null` for tier-stack, SPEC-004 Scenario 3 + the `Idef0Diagram.mode` field need a blessed edit — that is a SPEC-owner call, since the shape is frozen there.
- [→ tester] The F3 fixture (edge referencing a collided id) and an INV-10-in-tier-stack-mode assertion should join the conformance harness once F1/F3 land.

## References

- RFC under review: `RFC-028`
- Frozen contract: `SPEC-004` (INV-1..10, FR-001..007, NFR-001..004, AC-1..6, 12 scenarios, Q1/Q3/Q4)
- Governing ADRs: `ADR-006` (tier lift + SankeyView shim), `ADR-007` (IDEF0-STYLE projection, Q2 letters, local relation table)
- Parent: `EPIC-001` (critical); prior review `EVID-045` (SPEC-004 CONCERNS, F1-F6 — verified addressed in the SPEC revision this RFC consumes)
- Ground-truth tree: HEAD `54a905c8` `feat/idef0-decomposition-surfaces` — `type-tier.ts:13/25/63-94`, `cluster.svelte.ts:8`, `SankeyView.svelte:35`, `ui-prefs.ts:19/64`, `DependencyGraph.svelte:168`, `docs/PROJECT-MAP-SPEC.md:623`
- Mental models consulted: `mm-gate-failures` — **absent from this bank (HTTP 404)**; `mental_model_list` → empty. Checked phase/contract coherence directly instead.



