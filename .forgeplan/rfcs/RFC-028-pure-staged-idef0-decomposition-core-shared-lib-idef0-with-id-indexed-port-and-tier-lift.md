---
depth: standard
id: RFC-028
kind: rfc
last_modified_at: 2026-07-01T11:02:07.704866+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EPIC-001
  relation: refines
- target: SPEC-004
  relation: based_on
- target: ADR-006
  relation: based_on
- target: ADR-007
  relation: based_on
status: active
title: Pure staged idef0 decomposition core (shared/lib/idef0) with id-indexed port and tier lift
---

## Status

draft — pending guardian activation gate. EVIDENCE not yet linked; R_eff == 0 by design at draft (rule 11). Do NOT activate: guardian gates activation once the conformance harness (SPEC-004's 12 `#### Scenario` tests + the new real-data tier-stack fixture) + NFR-002 micro-benchmark land as linked EVIDENCE.

Parent: EPIC-001 (T1 keystone track). Conformance contract: SPEC-004 (INV-1..10, FR-001..007, NFR-001..004, AC-1..6, Open Q1/Q3/Q4 — FROZEN; this RFC HONORS it, never contradicts). Framing + relation table: ADR-007. Tier lift: ADR-006.

**Revision r2 (2026-07-01)** reconciles the C4 review chain — architect-reviewer (EVID-046, CONCERNS, F1–F4), system-dev (EVID-047, CONCERNS, S-1 HIGH + S-2..S-6), guardian (EVID-048, CONCERNS). This was an RFC edit + honest reframe, not an architect redesign — all three reviewers classified every finding as salvageable by a focused RFC edit. See `## Review reconciliation` below for the per-finding map.

## Review reconciliation (EVID-046 / EVID-047 / EVID-048)

Every finding from the C4 chain is resolved in this revision. This table is the guardian re-review index.

| Finding | Sev | Resolution in this RFC | Section |
|---|---|---|---|
| **EVID-046 F1** tier-stack `diagram:null` contradicts frozen `Idef0Diagram.mode:"idef0"\|"tier-stack"` + Scenario 3 + INV-10 | MED | `computeTierStackDiagram` now returns a **NON-NULL** `Idef0Diagram` (`mode:"tier-stack"`, boxes = tier members, arrows = none / tier-derived-dashed, legend present, all `derived`). The `null` path is **removed** everywhere; `densityGate`/`deriveIdef0` return a non-null `Idef0Diagram` in both modes ⇒ INV-10 + Scenario 3 hold uniformly. | §Function Signatures, §Data Flow, §Module Breakdown, I-12 |
| **EVID-046 F2** O(1)-DOM ≤6-box proof unenforced (whole forest in; 16-root top tier) | MED | `computeIdef0Diagram` / `computeTierStackDiagram` take a `focus` (+ optional `window`) that materialises **ONE** decomposition level (focus node + ≤6 sorted children) with a **mega-node rollup** (`+N more`, `derived`) for >6 members — the enabling counterpart to `flattenOutline(window)`. Bounded-materialised-set O(1)-DOM proof is now **real regardless of N** and the 16-root top tier. | §Function Signatures, §Complexity+budget (O(1)-DOM proof), F2 fixture |
| **EVID-046 F3** edge endpoint binding undefined under id-collision (`byId[id].length>1`) | MED | `port()` resolves per **INV-PORT-EDGE**: emit **one EdgeIn per matching `(from,to)` composite-key pair**, enumerated in ascending `[serialiseKey(from), serialiseKey(to)]` order (reorder-invariant ⇒ INV-8); lowest pair keeps the authored `real` binding, fan-out extras are `derived` (INV-5). + a collided-id-edge fixture. | §HARD MANDATE, §Determinism, I-11, F3 fixture |
| **EVID-046 F4** `takenAt` two sources, precedence unstated | LOW | Precedence pinned: the explicit `takenAt` **argument wins** when non-empty; else `RawSnapshot.takenAt`; else `""`. **No wall-clock** in core (NFR-001). | §DecompInput port contract |
| **EVID-047 S-1** flagship idef0 mode empirically unreachable on real data (density ≈0.095 « 0.3) | **HIGH** | **REFRAME (keeps 0.3):** TIER-STACK is the **first-class honest default render** for today's data and the **PRIMARY real-data conformance fixture**; the dense idef0 diagram is **synthetic-fixture-validated + activating post-T3**. New `## Current-data reality` subsection. No threshold in [0,1) fixes sparsity — tuning would fabricate structure (dishonest). Synergises with F1: the non-null tier-stack diagram is the robust primary path. | §Current-data reality, §Summary, §Data Flow, §Proposed Direction, §Test Strategy Hooks |
| **EVID-047 S-2** Phase-0 sequencing hazard (reindex-overwrite gotcha) | MED | Phase 0 gains a **HARD precondition gate**: PROB-060 landed on a clean trunk + clean working tree + before/after artifact-count capture, before the tier-lift or any T3-A reindex runs. | §Implementation Phases (GATE-0), §Risks |
| **EVID-047 S-3** relation-drift: a NEW upstream relation silently hits E-UNKNOWN-RELATION | MED | A **canonical-relation registry** (`CANONICAL_RELATIONS`) + a **drift guard** test/CI check asserting `classifyIcom`'s cases cover **exactly** the live `forgeplan_link` canonical set — FAILS loudly on a new relation. | §Module Breakdown, §Function Signatures, §Test Strategy Hooks, I-13, §Risks |
| **EVID-047 S-4** T4 composed-map reuse contradicted by PROJECT-MAP-SPEC §23 (ComposedMap owns `MapNode`, no adapter) | MED | **Outcome 5 no longer hinges on T4.** Reuse-not-fork rests on **T2 (standalone idef0 view) + a builder surface (Mechanism Atlas / ASSAY)** — both consume `ArtifactSummary + GraphEdge` via the same core. T4 §23 reconciliation is an explicit **Open Question / risk**, flagged for the EPIC, not assumed. | §pure-core + N-host-adapter contract, §Open Questions, §Risks |
| **EVID-047 S-5** no API-stability posture (core feeds ≥6 surfaces) | LOW | New **§API stability posture**: the `index.ts` barrel is the semver-governed public surface; internal modules are `@internal`; signature changes are breaking-change-disciplined across N importers. | §API stability posture, S-5 |
| **EVID-047 S-6** `serialiseKey` NUL-delimiter ambiguity | LOW | `serialiseKey` guards NUL: `port()` strips/rejects `\0` control chars in `id`/`title` before joining (titles are NUL-free by precondition) + a `\0`-title fixture asserting two distinct keys do not collapse. | §DecompInput port contract, §Test Strategy Hooks |
| **EVID-048 (guardian)** | CONCERNS | This revision closes F1–F4 + S-1..S-6; the RFC re-enters the gate. R_eff=0 / draft-foundation sequencing is an orchestrator activation-prerequisite (EPIC-001 needs ≥1 `supports` EVID; activate EPIC → SPEC-004 → ADR-006+ADR-007 → RFC-028), not an RFC-body defect. | §Related Artifacts |

**Preserved good parts (unchanged in substance):** the pure-core/host-adapter port boundary; the ADR-006 tier-lift + `cluster.svelte.ts` `TYPE_ORDER` shim; the `port()` id-index HARD MANDATE (I-1); the 12-scenario → 12-Vitest conformance mapping.

## Summary

RFC-028 is the **implementation contract** for the EPIC-001 T1 keystone: the ONE pure, deterministic, headless decomposition core at `template/src/shared/lib/idef0/`, plus its prerequisite tier-vocabulary lift to `template/src/shared/lib/tier/` (the ADR-006 relocation). The core is a **staged pipeline of independent pure passes** (`port → forest builders → numbering → classify → diagram → density-gate → signature → outline`) over a flat `Map<serialisedCompositeKey, ForestNode>` representation frozen by SPEC-004. It ships its own local `idef0-relation.ts` (ADR-007) and never mutates the shared `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge`.

**The honest default on the real project today is the tier-stack render, not the dense ICOM diagram.** The live dogfood workspace is sparse (decomposition density ≈ 0.095 — 11 `refines` edges over 117 nodes — far below the 0.3 gate), so `densityGate` routes **real data to `tier-stack` mode** and will keep doing so until T3 authors the `refines` spine (a separate EPIC track, ~6 mo out). This RFC therefore makes the **non-null tier-stack `Idef0Diagram` the first-class, robustly-rendered primary path**, and frames the dense `idef0`-mode diagram as **synthetic-fixture-validated + activating post-T3** (see `## Current-data reality`). This is the honest posture SPEC INV-5/INV-6 demand: a sparse workspace degrades to a labelled tier-stack, it never fabricates a spine, and it never *lies* — it under-delivers the marquee visual on real data until the structure exists.

This RFC resolves the SPEC's RFC-bound open questions: **Q1** density threshold = **0.3** (metric + N≤2 gate frozen by INV-6; kept at 0.3 — no threshold in [0,1) makes today's data render as idef0, and lowering it would fabricate structure); **Q3** tie-breaks (E-MULTI-PARENT = tier-then-key ascending; E-CYCLE = lexicographically-lowest composite key); **Q4** NFR-002 budget = **≤50 ms at N=1000** on commodity hardware (target-until-measured). It pins two **BLOCKER-class design invariants**: (I-1) `port()` MUST build an `id → NodeIn[]` index for O(1) per-edge resolution (naive per-edge scan is O(N×E) and fails NFR-002 at scale); and (I-11/INV-PORT-EDGE) under id-collision, edge endpoints are resolved by emitting one deterministic EdgeIn per matching composite-key pair. Two or more hosts consume the core through their **own** adapters; the core owns zero host types (SPEC NFR-004 reuse-not-fork). The two load-bearing reuse hosts are the standalone **T2 `idef0` view** and a **builder surface (Mechanism Atlas / ASSAY)** — both feed `ArtifactSummary + GraphEdge`; the composed-map graft (T4) is explicitly **not** a load-bearing reuse host (see S-4 / Open Questions).

## Current-data reality (why tier-stack is the honest default today)

**This subsection exists so no reviewer or downstream host mistakes the dense ICOM diagram for the real-data behaviour.** It resolves EVID-047 S-1 (HIGH).

Measured on the live dogfood workspace this session (`forgeplan graph --json`): **117 nodes**, **131 edges = informs 100 (76%) / based_on 20 (15%) / refines 11 (8%)**. The decomposition spine is `refines`-**only** (INV-4; ADR-007 makes `based_on → Input`, non-structural). So:

- `density = (N − roots.length) / max(1, N − 1) ≤ (117 − 106) / 116 = 11/116 ≈ 0.095` — an **upper bound** (multi-parent demotions only lower it), well below the 0.3 gate.
- ⇒ `densityGate` routes **the real workspace to `tier-stack` mode**, every render, today.
- Crossing 0.3 needs ~35 `refines` edges (~3× more authored spine) — that is **T3's** remit (graph-spine recovery/authoring), a separate EPIC-001 track, ~6 months out.

**Consequence, held explicitly:**

1. The **tier-stack render is the honest default** users see on the real project, and this RFC treats it as a first-class, robustly-materialised path (F1: non-null tier-stack `Idef0Diagram`; F2: windowed/rolled-up ≤6-box pages), not a degraded corner case.
2. The **dense `idef0`-mode ICOM diagram** — the most complex, highest-value code path — is **synthetic-fixture-validated** (the 12-scenario dense fixtures are constructed) and **activates on real data only post-T3**. Its conformance is real; its real-data exercise is deferred.
3. **Tuning the threshold cannot fix this.** No value in [0,1) makes today's sparse data render as `idef0`; a threshold low enough to trip on ≈0.095 would fabricate a spine from noise — dishonest, and a direct INV-5 violation. **0.3 is kept.** Only authored structure (T3) moves the real data into `idef0` mode.
4. **T1 evidence MUST NOT be used to claim EPIC Outcome 2** ("real depth ≥3 / idef0 renders") **or the idef0 half of Outcome 5.** Those are T3-gated. The conformance harness therefore carries an **authentic `graph --json` dogfood fixture asserting the `tier-stack` outcome on real data** as the PRIMARY real-data contract (see Test Strategy Hooks), so the real default is a tested contract, not an accident.

The host (T2) must surface `DensityVerdict.reason` prominently when it falls back, so the tier-stack reads as *honest* ("not enough authored `refines` structure yet") rather than *broken* — a host concern, flagged so it is not lost.

## Motivation

SPEC-004 froze *what "correct" means* (10 invariants, 12 executable scenarios) but deliberately deferred *how the algorithms achieve it* to this T1 core-RFC and its two ADRs. Three forces make the contract non-trivial and worth an RFC rather than ad-hoc code:

1. **Scale + determinism under adversarial, sparse data.** forgeplan#397 (0.33 `get --json` returns `slug=null`, omits `id_display`/`id_canonical`; `graph --json` lacks `nodes`) means the only stable identity the dual-poller can hand the core is the composite `(id, title)`. The core must be pure, order-invariant, never throw on missing fields, hold an interactive frame budget at N≥1000 (SPEC NFR-002, Q4), and — the real-data case — **degrade honestly to a tier-stack** when the `refines` spine is too thin (the common case today, ≈0.095 density). The algorithmic core (pseudocode phase, per `idef0-pseudocode-working-notes.md`) proved this is FEASIBLE-WITH-CONSTRAINTS, and named the load-bearing constraints: the `port()` id-index and the windowed diagram/outline.

2. **Reuse-not-fork across ≥2 hosts.** EPIC-001 Outcome 5 requires that `buildDecompForest`/`computeIdef0Diagram`/`classifyIcom` exist in exactly one module and are *imported*, not re-implemented, by every host. The load-bearing reuse hosts are the standalone **T2 `idef0` view** and a **builder surface (Mechanism Atlas / ASSAY)** — both feed `ArtifactSummary + GraphEdge`. The composed-map graft (T4) is **not** assumed as a reuse host: PROJECT-MAP-SPEC §23 designs `ComposedMap` to own its `MapNode` (no adapter; node-superset excluded) — reconciling that is an open question, not a T1 dependency (S-4). If the core leaks any host type, a second host is forced to fork. The contract that prevents this is a structural, serialisable `DecompInput` port boundary.

3. **Honesty + framing must be data, not chrome.** SPEC INV-5 (edge-scoped provenance) and ADR-007 (IDEF0-STYLE *projection*, persistent ICOM legend, local relation table) require that real-vs-derived be carried as `provenance` on every element and that the ICOM legend be a `data` descriptor the core always emits. A sparse workspace must honestly degrade to a `tier-stack` (density-gate) — and, per this revision, that tier-stack must itself be a **fully-rendered, non-null `Idef0Diagram`** so the host renders it uniformly from the diagram (INV-10), never a fabricated spine and never a null.

Constraints bounding the design space (all hard):
- **Purity (SPEC FR-007 / NFR-001 / rule 22):** no I/O, no wall-clock, no randomness, no DOM, no `spawn`, no forgeplan mutation. Framework-free pure TS.
- **FSD (rule 24 / SPEC INV-1 / ADR-006):** `shared/lib/{idef0,tier}/` import nothing from `widgets/`. The tier vocabulary must be *lifted*, with a `cluster.svelte.ts` re-export shim so `SankeyView.svelte:35` keeps resolving `TYPE_ORDER`.
- **No shared mutation (SPEC INV-9 / NFR-003 / ADR-006 / ADR-007):** the exported `HIERARCHY_RELATIONS` value and `normaliseHierarchyEdge` function stay byte-identical at symbol granularity.
- **No geometry (SPEC INV-10 / FR-007):** the diagram carries topology + ICOM `side` roles, no x/y. Hosts own layout.

## Module Breakdown

### `template/src/shared/lib/idef0/` (the pure core — new)

- **`port.ts`** — `port(raw: RawSnapshot, threshold: number, takenAt: string) → DecompInput`. Normalises the untrusted poller payload: tolerates forgeplan#397 omissions, drops identity-less nodes (E-MISSING-IDENTITY) into a `dropped` tally, retains id-only nodes with `degradedKey`, deduplicates exact `(id,title)` duplicates, marks `idCollision`, and resolves every edge's `from`/`to` by id **via the `byId` index, emitting one EdgeIn per matching composite-key pair under collision (INV-PORT-EDGE)**. **Owns the composite-key serialiser** `serialiseKey(k: CompositeKey) → string` (`id + "\0" + title`, with a **NUL guard** — see port contract) and `deserialiseKey`, re-exported for the rest of the core. **Owns the BLOCKER-class `byId` index (see HARD MANDATE below).** Pins `takenAt` precedence (explicit arg wins).
- **`idef0-relation.ts`** — the ADR-007 local table + `classifyIcom(relation: Relation) → IcomClass` + the **`CANONICAL_RELATIONS` registry** (the frozen canonical set the drift guard checks). Explicit case per canonical relation; never imports/mutates `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge`; non-canonical relations hit a defined `derived`, non-structural fallback (E-UNKNOWN-RELATION). A CI drift guard asserts the case set == the live `forgeplan_link` canonical enum (S-3).
- **`forest.ts`** — `buildDecompForest(input) → DecompForest` (the dense IDEF0 `refines`-spine path, one-parent-per-node, E-MULTI-PARENT + E-CYCLE resolution, secondary `derived` links, **collision-fanned edges beyond the lowest-key binding marked `derived`**) **and** `buildTierStackForest(input) → TierStackForest` (the honest fallback path built from `compactTierMap`, entirely `derived`).
- **`numbering.ts`** — `assignNodeNumbers(forest) → void` (mutates `ForestNode.number`). DFS pre-order A-numbering (`A1`, `A1.1`, …) over sorted roots + sorted children; keyed on composite `(id,title)`, order-invariant (INV-7).
- **`icom.ts`** — the ICOM side-convention + legend descriptor (geometry-free): `icomToSide(icom: IcomClass) → "left" | "top" | "right" | "bottom"` (I←, C↑, O→, M↓) and `buildIcomLegend(rolesPresent) → IcomLegend`. Classification itself lives in `idef0-relation.ts` (ADR-007 boundary); `icom.ts` owns only the role→side mapping + the persistent-legend data descriptor (ADR-007 P-6).
- **`diagram.ts`** — owns **two non-null diagram assemblers, neither of which ever returns null**:
  - `computeIdef0Diagram(forest, classifiedEdges, focus, window?) → Idef0Diagram` (`mode:"idef0"`) — materialises **ONE** decomposition level (focus node + its ≤6 sorted children, or the ≤6 sorted roots when `focus` is null) with a **mega-node rollup** for >6 members. **No x/y** (INV-10 / FR-007).
  - `computeTierStackDiagram(tierStackForest, window?) → Idef0Diagram` (`mode:"tier-stack"`) — boxes = the tier members (from `TierStackForest`), arrows = none / tier-derived-dashed, legend present, **every element `derived`**. Same ≤6-box windowing/rollup discipline per tier. This is the non-null tier-stack diagram that makes Scenario 3 + INV-10 hold in fallback (F1).
- **`density.ts`** — `densityGate(decompForest, tierStackForest, input, focus?) → { forest, verdict: DensityVerdict, diagram: Idef0Diagram }`. Computes the frozen metric, applies the N≤2 gate and the RFC-bound threshold (Q1 = 0.3), routes to `idef0` (calls `computeIdef0Diagram`) or `tier-stack` (calls `computeTierStackDiagram`) mode, and **always returns a non-null `Idef0Diagram`** (F1).
- **`signature.ts`** — `structuralSignature(forest) → string`. Order-independent shape hash: sorted set of `ROOT:`/`EDGE:`/`NODE:` tokens hashed with FNV-1a (synchronous, deterministic, non-cryptographic — equality only, INV-8).
- **`outline.ts`** — `flattenOutline(forest, window?) → OutlineRow[]`. Deterministic pre-order DFS producing indented outline rows; windowed lazy-generator variant keeps the hot render path O(W). This is the windowing primitive the diagram's `focus`/`window` mirrors (F2).
- **`index.ts`** — the barrel + the composed pipeline runner `deriveIdef0(raw, threshold, takenAt, focus?) → { forest, diagram, verdict, outline, signature }`. **The semver-governed public surface (S-5); the only import target for hosts.**

### `template/src/shared/lib/tier/` (the lifted vocabulary — new, per ADR-006)

- **`index.ts`** (barrel) — authoritative home of `TYPE_ORDER = ["epic","prd","spec","rfc","adr","evidence","note","problem","solution"]`, `typeTier(kind) → number`, `compactTierMap(kinds) → Map<string, number>`. Behaviour byte-identical to the pre-lift widget version (INV-1 / AC-1). Imports nothing from `widgets/` (rule 24 / I-1).

### Widget re-export shims (edited — the ADR-006 blast-radius guards)

- **`template/src/widgets/dependency-graph/lib/type-tier.ts`** — re-exports `TYPE_ORDER`, `typeTier`, `compactTierMap` from `@/shared/lib/tier`. `HIERARCHY_RELATIONS` + `normaliseHierarchyEdge` stay in place, byte-identical (INV-9).
- **`template/src/widgets/dependency-graph/lib/cluster.svelte.ts`** — retains a `TYPE_ORDER` re-export (`export { TYPE_ORDER } from "@/shared/lib/tier"`) **specifically so the direct `SankeyView.svelte:35` import keeps resolving** (ADR-006 I-4). A `rule-24-shim` marker comment (per the comments policy) documents why the shim must not be "cleaned up" — its removal without repointing Sankey silently breaks the view.

## C4 diagrams (prose)

### Level 1 — System Context

The **idef0 decomposition core** is one headless pure-TS library inside the `@forgeplan/web` template. Four external actors touch it, all read-only:

- The **dual-poller** (existing `/api/*` read path; system actor) polls the host's `forgeplan` CLI and hands raw JSON snapshots downstream. It never calls the core directly — a host adapter converts poller output into a `RawSnapshot`.
- The **standalone T2 `idef0` view host** (a `widgets/`/`pages/` surface) is the first renderer. It owns an adapter `ArtifactSummary[] + GraphEdge[] → RawSnapshot`, calls the core, and renders the two-pane outline + (on real data today) the tier-stack diagram; the dense ICOM diagram appears once the workspace crosses the density gate (post-T3).
- The **builder surface (Mechanism Atlas / ASSAY)** is the second reuse renderer. It also feeds `ArtifactSummary + GraphEdge` through its own adapter and consumes `classifyIcom` / the core output — the second proof of reuse-not-fork that does NOT depend on the T4 composed-map graft.
- The **conformance harness** (Vitest) executes SPEC-004's 12 `#### Scenario` blocks + the real-data tier-stack fixture against the core as the CI gate.

Direction: all point *into* the core (data in, derived projection out). The core points *out to nothing* — it has no I/O, no dependencies beyond `shared/lib/tier/`. This is the topology that enforces reuse-not-fork: hosts adapt inward; the core stays host-agnostic. (The T4 composed-map host is a *candidate* third renderer, not a load-bearing one — see S-4.)

### Level 2 — Container / Component

Two containers inside `shared/lib/`:

- **`shared/lib/tier/`** — a leaf container. Exposes `TYPE_ORDER` / `typeTier` / `compactTierMap`. Consumed by `shared/lib/idef0/forest.ts` (tier computation, tier-stack grouping, tie-break ordering) and by the existing 7 widget views via re-export shims. It depends on nothing.

- **`shared/lib/idef0/`** — the pipeline container. Components and their internal edges (all synchronous function calls, data flows left→right):

  > `port.ts` produces a `DecompInput` consumed by `forest.ts`. `forest.ts` produces a `DecompForest` (dense path) and a `TierStackForest` (fallback path); it calls `shared/lib/tier` for `typeTier`/`compactTierMap`. `numbering.ts` consumes the `DecompForest` and mutates `number` fields in place. `idef0-relation.ts` (`classifyIcom`) consumes the `DecompInput.edges` to produce `ClassifiedEdge[]`, and is also called by `forest.ts` (to know which edges are structural `decomposition`). `diagram.ts` consumes the numbered forest + `ClassifiedEdge[]` + a `focus` and calls `icom.ts` (`icomToSide`, `buildIcomLegend`) to produce a non-null `Idef0Diagram` — the dense one via `computeIdef0Diagram`, the fallback one via `computeTierStackDiagram`. `density.ts` consumes both forests + the `DecompInput` + `focus` and selects the mode, returning the chosen forest + `DensityVerdict` + a **non-null** `Idef0Diagram`. `signature.ts` and `outline.ts` each consume the chosen forest independently. `index.ts` orchestrates this order and re-exports `port.ts`'s `serialiseKey`.

  The only inbound edge from outside the container is host adapters → `port.ts` (via `index.ts#deriveIdef0`). The only outbound edge is `index.ts` → nothing external besides `shared/lib/tier`. No component imports `widgets/`.

## Data Flow

**Primary real-data path (the honest default today) — sparse workspace → non-null tier-stack diagram.** A host adapter converts its native shape (`ArtifactSummary+GraphEdge`) into a structural `RawSnapshot` and calls `index.ts#deriveIdef0(raw, 0.3, takenAt, focus?)`. `port()` walks nodes once — building `nodeList`, the `byKeyStr` dedup map, and the `byId` index — then walks edges once, resolving each `from`/`to` via `byId` (O(1)) and emitting one EdgeIn per matching composite-key pair (INV-PORT-EDGE); it returns a `DecompInput` with the `dropped` tally. On the live dogfood workspace (density ≈0.095 < 0.3), `densityGate` routes to `buildTierStackForest`'s output and `computeTierStackDiagram`: `mode: "tier-stack"`, every element `provenance: "derived"`, `DensityVerdict.reason` names the below-threshold cause, and the returned **`diagram` is a non-null `Idef0Diagram`** whose `boxes` are the tier members (windowed + rolled-up to ≤6 per page) and whose `legend` is present with the honesty key. The host renders the tier-stack **from the diagram alone** (INV-10 holds in fallback — this is the F1 fix). No fabricated spine is ever rendered as real (INV-5 / EPIC Outcome 6).

**Post-T3 dense path (synthetic-fixture-validated today) — dense workspace → IDEF0 diagram.** Same entry, but with an authored `refines` spine crossing 0.3 and N ≥ 3 (today only reachable via synthetic fixtures; on real data after T3). `buildDecompForest` collects `refines`-parent candidates, applies the E-MULTI-PARENT tie-break to pick ≤1 structural parent per node (demoting the rest to `derived` secondary links), breaks any `refines` cycle (E-CYCLE), sorts children + roots by `[typeTier(kind), serialiseKey]`, and materialises the flat `Map<string, ForestNode>`. `assignNodeNumbers` DFS-walks sorted roots/children assigning `A`-numbers. `classifyIcom` maps every edge to an `IcomClass`. `densityGate` returns `mode: "idef0"` and calls `computeIdef0Diagram(forest, edges, focus, window?)`, which materialises **one decomposition level** — the `focus` node's ≤6 sorted children (or the ≤6 sorted roots when `focus` is null), with a mega-node rollup (`+N more`, `derived`) for >6 members — as boxes + ICOM arrows + legend (no geometry). `structuralSignature` + `flattenOutline` produce the shape hash and the outline rows. The host renders from the non-null `Idef0Diagram` + `Outline` alone (INV-10), one bounded page at a time, drilling down by passing a new `focus`.

**16-root top-tier handling (F2).** When `focus` is null and the top level has >6 members (the real 16-parentless-PRD shape), `computeIdef0Diagram`/`computeTierStackDiagram` keep the first `W−1` sorted members as boxes + one synthetic mega-node box (`+N more`, `provenance: derived`), so `boxes.length ≤ W` (W=6, the INV-6 convention bound). The host drills into a rolled-up mega-node by re-invoking with `window` paging or a narrower `focus`. The ≤6-box O(1)-DOM bound is thus **enforced by the core**, not merely assumed.

**Adversarial path — never throws.** Empty/all-dropped input ⇒ empty forest + empty (non-null) diagram + empty outline + stable empty `structuralSignature` (E-EMPTY). Missing title ⇒ degraded key `(id, "")`, `degradedKey=true`, retained (E-MISSING-IDENTITY). Two `(id,title)` sharing an `id` ⇒ both retained, `idCollision=true` (E-ID-COLLISION); an edge referencing that collided id fans out to one EdgeIn per matching composite-key pair (INV-PORT-EDGE, F3). Non-canonical relation ⇒ defined `derived` non-structural role (E-UNKNOWN-RELATION), and a NEW upstream relation trips the drift guard at CI (S-3). A `\0` in a title is stripped by the `serialiseKey` NUL guard so two distinct keys never collapse (S-6).

## DecompInput port contract (the host boundary)

`port()` is the **only** ingress. Its input `RawSnapshot` and output `DecompInput` are **structural + serialisable** — plain data, no host classes, no functions, no forgeplan SDK types. This is the load-bearing boundary for SPEC NFR-004 (reuse-not-fork): the core owns zero host types.

```
RawSnapshot  = { nodes?: Array<{ id?: string; title?: string; kind?: string }>;
                 edges?: Array<{ from?: string; to?: string; relation?: string }>;
                 takenAt?: string }
DecompInput  = { nodes: NodeIn[]; edges: EdgeIn[]; threshold: number; takenAt: string; dropped: number }
```

Tolerances (forgeplan#397, all deterministic, no throw):
- `raw.nodes` / `raw.edges` absent ⇒ treated as `[]`.
- `slug` / `id_display` / `id_canonical` absent ⇒ ignored; identity is composite `(id, title)` only.
- node with neither `id` nor `title` ⇒ dropped, `dropped++` (E-MISSING-IDENTITY).
- node with `id` but no `title` ⇒ retained as `(id, "")`, `degradedKey=true` (NOT dropped).
- `kind` absent ⇒ defaults to `"note"`.
- edge with any of `from`/`to`/`relation` null ⇒ skipped.
- `threshold` is **injected** by the caller (host passes the RFC-configured 0.3), never looked up internally — purity: the core has no config read.

**`takenAt` precedence (resolves EVID-046 F4).** `takenAt` has exactly one authoritative source: the **explicit `takenAt` argument** to `deriveIdef0`/`port`. Precedence: if the explicit arg is a non-empty string it **wins** and `RawSnapshot.takenAt` is ignored; if the explicit arg is empty/undefined, `port()` falls back to `RawSnapshot.takenAt`; if both are absent, `DecompInput.takenAt = ""` (empty-string sentinel). The core **never reads a wall-clock** (`Date.now()` is forbidden by NFR-001 / I-2) — `takenAt` is always caller-supplied data, so the pipeline stays a pure function of its inputs.

**`serialiseKey` NUL guard (resolves EVID-047 S-6).** `serialiseKey(k) = id + "\0" + title` uses `\0` as the delimiter, so a literal `\0` embedded in an `id` or `title` (adversarial/pasted markdown content) could make two *distinct* composite keys serialise to the same string and silently coalesce the exact nodes the id-collision machinery exists to keep distinct. `port()` therefore **strips ASCII control characters (including `\0`) from `id` and `title` before serialising** (titles are NUL-free by precondition after this strip). A fixture asserts a `\0`-bearing title does not collapse two keys.

## HARD MANDATE (two BLOCKER-class design invariants) — the `port()` id-index + deterministic edge fan-out

### I-1 (INV-PORT-IDX, BLOCKER) — the id-index

`port()` **MUST** build an `id → NodeIn[]` index (`byId: Map<string, NodeIn[]>`) during its single node pass, and resolve every edge's `from`/`to` against that index in **O(1)**. A naive implementation that scans the node list per edge to resolve an endpoint is **O(N × E)** = O(N²) on dense graphs, which **fails NFR-002 at scale** (at N=1000, E=2000 the naive form is ~2M ops and degrades badly past N=5000; the id-index keeps `port()` at O(N + E)).

- **INV-PORT-IDX (BLOCKER):** `port()` resolves edge endpoints via the `byId` map; no code path performs a linear node scan inside the edge loop.
- The index doubles as the **id-collision detector**: after the node pass, any `byId` bucket with `length > 1` (distinct `(id,title)` sharing one `id`) marks every member `idCollision = true` (E-ID-COLLISION, surfaced not coalesced — the PROB-060 merge-dup case).
- Reviewer-verifiable: a code review + a micro-benchmark showing `port()` scales linearly (not quadratically) from N=100→1000→5000. Recorded in the NFR-002 EVIDENCE.

### I-11 (INV-PORT-EDGE, BLOCKER) — deterministic edge-endpoint resolution under id-collision (resolves EVID-046 F3)

Edges arrive id-only (`RawSnapshot.edges.from/to: string`) but post-`port` `EdgeIn` endpoints are `CompositeKey`. When an id collides (`byId[id].length > 1` — two `(id,title)` share one id, the motivating PROB-060 merge-dup case), the binding was previously undefined. It is now pinned deterministically, **per SPEC-004's `port()` semantics of surfacing (not coalescing) collisions**:

- **INV-PORT-EDGE (BLOCKER):** for an edge whose `from`/`to` ids resolve to buckets `B_from`, `B_to` (each of size ≥ 1), `port()` emits **one EdgeIn per matching `(from, to)` composite-key pair** — the full `B_from × B_to` product — enumerated in ascending `[serialiseKey(from), serialiseKey(to)]` order.
- The common (non-collision) case: both buckets size 1 ⇒ **exactly one EdgeIn** (behaviour unchanged).
- **Determinism (INV-8):** the enumeration order is the canonical composite-key sort, never `byId` bucket insertion order and never input array order ⇒ identical input set ⇒ identical `EdgeIn` list ⇒ identical forest/diagram/signature.
- **Honesty (INV-5):** exactly one fan-out binding — the **lexicographically-lowest `(from,to)` pair** — carries the authored edge's `real` provenance when it becomes a `ClassifiedEdge`/forest link; every **additional** fan-out binding is `derived` (an inferred disambiguation of a collided id). No derived edge is ever mislabelled `real`, and the ambiguity is surfaced, not hidden.
- Reviewer-verifiable: a "edge references a collided id" fixture asserts the fan-out set, its order, and the real/derived split (F3 fixture).

## Function Signatures / Component Contracts (language-agnostic TS idiom)

Public surface (`shared/lib/idef0/index.ts` — the semver-governed barrel, S-5):

- `deriveIdef0(raw: RawSnapshot, threshold: number, takenAt: string, focus?: CompositeKey | null) -> { forest: DecompForest | TierStackForest; diagram: Idef0Diagram; verdict: DensityVerdict; outline: OutlineRow[]; signature: string }` — the composed pipeline; the only host entry point. **`diagram` is NON-NULL** in both modes (F1). `focus` (default `null` ⇒ top level) selects the one materialised decomposition level (F2).
- `port(raw: RawSnapshot, threshold: number, takenAt: string) -> DecompInput` — normalise; never throws; id-index (I-1) + edge fan-out (I-11) + `takenAt` precedence (F4) + NUL guard (S-6).
- `serialiseKey(k: CompositeKey) -> string` / `deserialiseKey(s: string) -> CompositeKey` — composite-key codec (`id + "\0" + title`, control-char-stripped).
- `classifyIcom(relation: Relation) -> IcomClass` — total, explicit, no drop.
- `CANONICAL_RELATIONS: ReadonlySet<Relation>` — the frozen canonical relation registry the drift guard checks against the live `forgeplan_link` enum (S-3).
- `buildDecompForest(input: DecompInput) -> DecompForest` — ≤1 parent per node; secondary demotions + cycle-breaks + collision fan-out extras as `derived` links.
- `buildTierStackForest(input: DecompInput) -> TierStackForest` — all `derived`.
- `assignNodeNumbers(forest: DecompForest) -> void` — mutates `.number`; order-invariant on `(id,title)`.
- `computeIdef0Diagram(forest: DecompForest, edges: ClassifiedEdge[], focus: CompositeKey | null, window?: { offset: number; limit: number }) -> Idef0Diagram` — `mode:"idef0"`; materialises ONE level (focus + ≤6 sorted children, or ≤6 sorted roots when focus is null) with a mega-node rollup for >6 members; **never null**; no x/y (F2).
- `computeTierStackDiagram(stack: TierStackForest, window?: { offset: number; limit: number }) -> Idef0Diagram` — `mode:"tier-stack"`; boxes = tier members (windowed + rolled-up ≤6/page), arrows = none / tier-derived-dashed, legend present, all `derived`; **never null** (F1).
- `densityGate(decomp: DecompForest, stack: TierStackForest, input: DecompInput, focus?: CompositeKey | null) -> { forest; verdict: DensityVerdict; diagram: Idef0Diagram }` — **`diagram` non-null in both modes** (F1).
- `structuralSignature(forest: DecompForest) -> string`.
- `flattenOutline(forest: DecompForest, window?: { offset: number; limit: number }) -> OutlineRow[]`.
- `icomToSide(icom: IcomClass) -> "left" | "top" | "right" | "bottom"`.

`shared/lib/tier/index.ts`: `typeTier(kind: string) -> number`, `compactTierMap(kinds: Iterable<string>) -> Map<string, number>`, `TYPE_ORDER: readonly string[]`.

Data shapes are frozen by SPEC-004 §Data Models (`CompositeKey`, `NodeIn`, `EdgeIn`, `DecompInput`, `ForestNode`, `DecompForest`, `TierStackForest`, `ClassifiedEdge`, `Idef0Diagram`, `IcomLegend`, `DensityVerdict`, `OutlineRow`) — this RFC does not re-open them. Note the frozen `Idef0Diagram.mode: "idef0" | "tier-stack"` is **non-null in both modes**; this revision brings the tier-stack path into conformance with that frozen shape (F1).

### classifyIcom — the ADR-007 local table (Q2 letters)

Implemented in `idef0-relation.ts` as an explicit switch, byte-independent of the shared table:

| relation | `IcomClass` | ICOM side | structural (tree) edge? |
|---|---|---|---|
| `refines` | `decomposition` | — (the spine) | yes — ≤1 parent per node |
| `informs` | `mechanism` | bottom (M↓) | **never** (INV-2) |
| `based_on` | `input` | left (I←) | never |
| `supersedes` | `control` | top (C↑) | never |
| `contradicts` | `control` | top (C↑) | never |
| non-canonical | defined `derived`, non-structural (E-UNKNOWN-RELATION) | — | never |

`classifyIcom("based_on")` is **not** null/dropped — the deliberate contrast against the shared `normaliseHierarchyEdge("from","to","based_on") === null` (regression guard, FR-002 / ADR-007 postcondition). `based_on ⇒ input`, `supersedes/contradicts ⇒ control` are ADR-007 P-4 (Q2 resolved); this RFC consumes that decision, does not re-open it.

**Canonical-relation registry + drift guard (resolves EVID-047 S-3).** The five canonical cases are also declared as a frozen `CANONICAL_RELATIONS` set. The totality test (I-6) catches a *canonical* relation lacking a case; it does **not** catch a **new** relation added upstream (forgeplan is actively churning — 0.33, forgeplan#397 — and a future `forgeplan_link` relation like `"blocks"` would silently fall to `E-UNKNOWN-RELATION`/derived, its structural intent invisible). A **relation-drift guard** (CI test) therefore asserts `CANONICAL_RELATIONS` is byte-equal to forgeplan's live `forgeplan_link` relation enum and **FAILS loudly** when upstream adds one — so drift is caught, not silently swallowed. (New relations are a deliberate table decision, not an accident.)

## pure-core + N-host-adapter contract

The core is host-agnostic; each host owns a thin adapter that lowers its native shape to the structural `RawSnapshot`. **The core imports no host type; hosts import the core.** (SPEC NFR-004, EPIC Outcome 5.)

**Outcome 5 rests on two hosts that both feed `ArtifactSummary + GraphEdge` — NOT on the T4 composed-map graft (resolves EVID-047 S-4):**

- **Standalone T2 `idef0` view (first host, shippable now).** Adapter `ArtifactSummary[] + GraphEdge[] → RawSnapshot` lives in the T2 view module (`widgets/`/`pages/`), NOT in the core. It maps `ArtifactSummary.{id,title,kind}` → `RawSnapshot.nodes` and `GraphEdge.{from,to,relation}` → `RawSnapshot.edges`. Registered as the 9th view (`GraphView` union + `GRAPH_VIEWS` + `GRAPH_VIEW_IDS` in `ui-prefs.ts`, plus a `{:else if view==='idef0'}` branch before the final `{:else} LanesView` in `DependencyGraph.svelte`) — it explicitly does NOT take the reserved `map`/composed slot. On real data it renders the tier-stack (§Current-data reality).
- **Builder surface — Mechanism Atlas / ASSAY (second reuse host).** Also consumes `ArtifactSummary + GraphEdge` through its own adapter and imports `classifyIcom` / the core output. This is the **second, independent proof of reuse-not-fork** — chosen precisely because it does NOT depend on the unresolved T4 §23 contract. The NFR-004 import-not-reimplement test targets these two hosts.

**T4 composed-map graft is a CANDIDATE host, explicitly NOT assumed for Outcome 5 (Open Question, see below).** `docs/PROJECT-MAP-SPEC.md §23` designs `ComposedMap` to **own** its `MapNode` (reads `/api/map` exclusively, "never shares"; node-superset **explicitly excluded** — "Edge superset is real & free; node superset is NOT"; "no adapter"), keyed by `sha1(kind+':'+path)[:12]`, pre-zoned and mega-collapsed (>8 children → collapsed mega-node), with raw `refines` already rebinned. Lowering that back to a raw `(id,title,kind)+relation` `RawSnapshot` with recoverable `refines` is a **semantic mismatch, not a thin adapter** — and T4 already ships its own pure layout core (`computeComposedLayout`). NFR-004's symbol-non-duplication test structurally cannot catch this representational fork. So this RFC **does not hinge Outcome 5 on T4**; T4 reuse is pending a §23 reconciliation (Open Question OQ-1).

Conformance test (NFR-004): a test asserts each of the **two load-bearing hosts** (T2, builder surface) *imports* `buildDecompForest`/`computeIdef0Diagram`/`classifyIcom` from `shared/lib/idef0` and does not re-declare them.

## API stability posture (resolves EVID-047 S-5)

The core is planned to feed ≥6 surfaces (T2, the builder surface, and later Mechanism Atlas / ASSAY / Throughline / Waterline; T4 pending). SPEC-004 freezes the *data shapes*; this RFC adds the *signature-evolution* discipline:

- **The `index.ts` barrel is the frozen public surface.** Its exported signatures (`deriveIdef0`, `port`, `classifyIcom`, `buildDecompForest`, `computeIdef0Diagram`, `computeTierStackDiagram`, `serialiseKey`, `structuralSignature`, `flattenOutline`, `icomToSide`, `CANONICAL_RELATIONS`) are semver-governed: a breaking change to any is a minor/major bump that must be propagated to every host importer in the same change (or behind a deprecation window).
- **Internal modules are `@internal`.** `port.ts`, `forest.ts`, `numbering.ts`, `density.ts`, `diagram.ts`, `signature.ts`, `outline.ts` may change freely as long as the barrel contract holds. Hosts MUST import from the barrel, never deep-import an internal module.
- Cheap now, expensive to retrofit after 3+ hosts attach — recorded so the discipline exists before the second host lands.

## Complexity + budget

Per-module Big-O (from the pseudocode phase; N = nodes, E = edges, W = page/outline window ≤ 6 for the diagram):

| Function | Time | Space | Note |
|---|---|---|---|
| `port` | O(N + E + C) | O(N + E) | **id-index avoids O(N×E) naive (I-1)**; `C` = extra fan-out EdgeIns under id-collision (0 in the non-collision common case; bounded by bucket sizes) |
| `buildDecompForest` | O(N + E log E) | O(N + E) | tie-break sort over in-degree; cycle-break O(N) on a functional graph (in-degree ≤ 1) |
| `buildTierStackForest` | O(N log N) | O(N) | group + sort within tier |
| `assignNodeNumbers` | O(N log N) | O(depth) | sort children at each node; DFS |
| `classifyIcom` | O(1) | O(1) | local switch |
| `densityGate` | O(N + E) | O(1) | real-edge count is O(1) from forest; classify O(E) |
| `structuralSignature` | O(N log N) | O(N) | sort tokens before FNV-1a |
| `flattenOutline` (full) | O(N) | O(N) | pre-order DFS |
| `flattenOutline` (windowed, lazy) | O(offset + W) | O(depth + W) | generator early-exit |
| `computeIdef0Diagram` (focused) | O(children_of_focus log + W) | **O(W)** | **materialises ONE level, ≤ W boxes + rollup (F2)** |
| `computeTierStackDiagram` (focused/tiered) | O(members log + W) | **O(W)** | **≤ W boxes/page + rollup (F2)** |

**Overall pipeline: O(N log N + E log E)** for the derivation steps, dominated by the sort steps; the diagram step is **O(W) = O(1)** in the materialised DOM set. For the sparse forgeplan workspaces this targets (E = O(N)) the derivation is O(N log N).

**NFR-002 budget (resolves SPEC Q4): the full derivation completes in ≤ 50 ms at N=1000 on commodity hardware** — defined as Node 20 LTS, V8, a 2.5 GHz x86_64 laptop, cold run (no JIT warmup). Derivation: the pseudocode phase estimated ~9 ms raw at N=1000/E=2000; 50 ms is a ~5× safety margin covering cold JIT, edge-dense workspaces (E up to 5N), and Map/GC churn. 50 ms is well inside the 10 s poll interval and does not block interactive navigation (the pipeline runs in a Svelte reactive effect, not per keystroke). This number is a **target-until-measured** figure: the actual value is recorded in the NFR-002 micro-benchmark EVIDENCE at implementation time (no invented benchmark here).

**O(1)-DOM proof — now enforced by the core (resolves EVID-046 F2).** The heavy `O(N + E)` derivation lives in the JS heap, never the DOM. DOM stays O(1) at all N because the diagram step **materialises exactly one bounded decomposition level**:

- (a) `computeIdef0Diagram(focus, window?)` and `computeTierStackDiagram(window?)` emit **at most `W`** boxes per page (W=6, the IDEF0 ≤6-box convention / INV-6). A focus node (or the top level) with `> W` children keeps the first `W−1` sorted members + **one synthetic mega-node rollup** box (`+N more`, `derived`), so `boxes.length ≤ W` **regardless of N and regardless of the 16-root top tier**. This is the enabling counterpart to `flattenOutline(window)`, so the bound is a **core contract**, not a host assumption.
- (b) the outline is windowed — the lazy `flattenOutline` generator materialises at most W+1 rows, so a virtual list holds O(W) rows regardless of N.

The host paints ≤ W boxes/rows per page and drills down by passing a new `focus`/`window`; total DOM is O(W) = O(1) at every N. Reviewer-verifiable at the core level via the F2 fixture (a >6-child focus and a 16-root top tier both yield ≤6 boxes with a rollup).

## Determinism (INV-8) + Q3 resolution

Every ordering in the core uses one canonical sort key: **`[typeTier(kind), serialiseKey(key)]`** — primary tier ascending (more-abstract kinds first), secondary lexicographic composite key. Applied identically to roots, children, tie-break candidates, tier-stack members, **and the edge fan-out enumeration under id-collision (INV-PORT-EDGE)**. No input array index and no Map insertion order is ever used as an ordering source, so the same input *set* yields the same output regardless of poll/array order (INV-7 / INV-8).

- **A-numbering:** DFS pre-order over sorted roots (`A1`, `A2`, …) and sorted children (`A1.1`, `A1.2`, …). Because forest shape is a function of `refines` content (not array order) and children are sorted before DFS, the same input set ⇒ identical A-numbers (INV-7).
- **`structuralSignature`:** the set of `ROOT:`/`EDGE:`/`NODE:` tokens is **sorted before** FNV-1a hashing; set membership is order-independent ⇒ equal inputs ⇒ equal signature (INV-8). FNV-1a chosen over SHA-256: synchronous, deterministic, non-cryptographic (equality-only, not a security primitive).
- **Edge fan-out (INV-PORT-EDGE):** the `B_from × B_to` product is enumerated in ascending `[serialiseKey(from), serialiseKey(to)]`, so a collided-id edge produces an identical `EdgeIn` list across reorderings (INV-8), with a deterministic real/lowest-pair vs derived/rest split (INV-5).

**Q3 tie-breaks (resolved — RFC-bound per SPEC Open Q3):**
- **E-MULTI-PARENT (a node with >1 `refines`-parent):** sort candidate parents by **`[typeTier(parent.kind) ascending, serialiseKey(parent.key) ascending]`** — **tier-then-key**. The most-abstract parent wins the structural slot (e.g. an `epic` parent over a `prd` parent); ties on tier break lexicographically. The winner is the sole `parent`; every demoted candidate becomes a `derived` secondary link (`reason: "E-MULTI-PARENT"`). Guarantees INV-4 (≤1 parent per node) with zero wall-clock dependence.
- **E-CYCLE (a `refines` cycle):** break at the **lexicographically-lowest composite key** in the cycle. The chosen node's parent pointer is nulled (it becomes a root of its former subtree), the broken back-edge is recorded as a `derived` link (`reason: "E-CYCLE"`), and the remaining forest is acyclic. Lowest-key break is chosen (over tier-based) because a cycle by definition spans one tier-band ambiguously; the lexicographic key is the total order that is always defined and reorder-invariant (INV-8).

## Options Considered

Three genuinely-weighed alternatives for the pipeline's internal structure. (The *data* shapes — `DecompForest.nodes` as a `ReadonlyMap<string, ForestNode>` keyed by serialised composite key — are frozen by SPEC-004, so the representation fork below is bounded by that contract.)

### Option 1 — Staged pipeline of independent pure passes over a flat keyed Map (CHOSEN)
Each stage (`port`, `buildDecompForest`, `assignNodeNumbers`, `classifyIcom`, `computeIdef0Diagram`/`computeTierStackDiagram`, `densityGate`, `structuralSignature`, `flattenOutline`) is a standalone pure function; `index.ts` composes them. Forest is a flat `Map<serialisedCompositeKey, ForestNode>` with `parent`/`children` stored as `CompositeKey` references.
- **Pros:** each stage maps 1:1 to a SPEC invariant and a `#### Scenario` test — the conformance harness can exercise stages in isolation (e.g. `classifyIcom` alone, `densityGate` alone). Matches the SPEC's frozen pipeline order exactly. The flat Map is the SPEC-frozen representation, gives O(1) node lookup by key (needed by numbering, signature, diagram, cycle-break), and serialises trivially. Debuggable: a failing invariant localises to one module. Lowest reuse-fork risk — hosts import named stages. The staged boundary is also what lets the diagram step be swapped between `computeIdef0Diagram` (dense) and `computeTierStackDiagram` (fallback) behind `densityGate` without entangling the two paths (the F1 fix lands cleanly).
- **Cons:** multiple passes over the node set (constant-factor overhead vs a fused walk); intermediate structures (`DecompInput`, both forests, `ClassifiedEdge[]`) are materialised in the heap. Both are acceptable at N≤1000 within the 50 ms budget (pseudocode-confirmed).

### Option 2 — Single fused traversal
One walk builds the forest, assigns numbers, classifies edges, and emits the diagram simultaneously, minimising intermediate allocations.
- **Pros:** fewer passes; less peak heap; marginally faster constant factor.
- **Cons:** determinism becomes fragile — numbering requires children *pre-sorted*, which requires the forest *fully built* first, so a true single pass cannot honour the `[typeTier, serialiseKey]` sort-before-DFS discipline that INV-7/INV-8 depend on. Density routing needs the *whole* forest (root count) before it can choose a mode, so the diagram cannot be emitted in the same pass that discovers roots — and the F1 tier-stack-vs-idef0 diagram selection needs that whole-forest root count too. Conformance tests can no longer target a stage in isolation, weakening the harness. Fusing also entangles the honest tier-stack fallback with the dense path — exactly the entanglement the F1 fix depends on keeping separate. Rejected: trades a negligible constant-factor win for determinism risk and a weaker conformance surface.

### Option 3 — Nested recursive tree structure (children embedded) instead of a flat keyed Map
Represent the forest as nested `ForestNode` objects (each holding its child `ForestNode[]` inline), no separate Map.
- **Pros:** ergonomic recursive DFS for numbering/outline; no key-serialisation indirection.
- **Cons:** **contradicts the SPEC-frozen `DecompForest.nodes: ReadonlyMap<string, ForestNode>` shape** (INV-10 / Data Models) — hosts expect a keyed map for O(1) box lookup by composite key when rendering `Idef0Diagram` and drilling into a `focus`. Cycle-breaking and multi-parent demotion are awkward on a nested tree (a node can be reached from multiple candidate parents before resolution — nesting forces premature commitment). id-collision surfacing + edge fan-out (INV-PORT-EDGE) need a flat index anyway. Order-independent signature needs a flat token set anyway. Rejected: fights the frozen contract and the E-MULTI-PARENT/E-CYCLE/collision algorithms.

## Proposed Direction

Adopt **Option 1 — a staged pipeline of independent pure passes over the SPEC-frozen flat `Map<serialisedCompositeKey, ForestNode>`**, wired by `index.ts#deriveIdef0`, with the `port()` id-index (I-1) and deterministic edge fan-out (I-11) as BLOCKER-class invariants. Ship the ADR-006 tier lift (with the `cluster.svelte.ts` `TYPE_ORDER` shim) as the prerequisite, and the ADR-007 local `idef0-relation.ts` table (Q2 letters) + the `CANONICAL_RELATIONS` registry as the classification path. Make the **non-null tier-stack `Idef0Diagram` the first-class honest default render for today's data**, with the dense `idef0` diagram synthetic-fixture-validated + T3-gated. Resolve the three RFC-bound open questions as: **Q1** threshold = 0.3 (metric + N≤2 gate frozen by INV-6; kept, per §Current-data reality); **Q3** tie-breaks = E-MULTI-PARENT tier-then-key, E-CYCLE lowest-key; **Q4** NFR-002 budget = ≤50 ms at N=1000 (Node 20 / V8 / 2.5 GHz, target-until-measured).

**Density threshold decision (Q1) — kept at 0.3, with eyes open.** The metric `density = (N − roots.length) / max(1, N − 1)` and the hard gate `N ≤ 2 ⇒ tier-stack` are frozen in-SPEC (INV-6). This RFC binds the numeric threshold at **0.3**: at least 30% of the maximum possible tree edges (`N−1`) must be authored `refines` structure for `mode: "idef0"`. Worked cases confirm it satisfies the frozen scenarios — single node: density 0 ⇒ tier-stack; two-node chain: N≤2 gate ⇒ tier-stack; three nodes in a `refines` line: 2/2 = 1.0 ≥ 0.3 ⇒ idef0; three isolated nodes: 0/2 = 0 < 0.3 ⇒ tier-stack; 10 nodes with 3 authored edges: 3/9 = 0.33 ≥ 0.3 ⇒ borderline idef0. **0.3 is kept deliberately — it favours honesty**: the real dogfood workspace (density ≈0.095) degrades to a labelled tier-stack rather than fabricating a spine, which is the correct behaviour, not a bug (§Current-data reality). It remains a *tunable data value*, not a structural one — but tuning it downward to trip on ≈0.095 would manufacture structure from noise (an INV-5 violation), and no value in [0,1) makes today's data render as idef0; only T3-authored structure does. A follow-up EVIDENCE may re-tune it against a denser future workspace without an ADR.

### ADI (forgeplan_reason RFC-028)

`forgeplan_reason RFC-028` was re-run for this revision (FPF ADI, gemini-3-flash-preview, 2026-07-01) and again returned three hypotheses recommending **H1 (staged pipeline) at High confidence** — confirming Option 1 survives the revision:

- **H1 = Option 1 (staged pipeline over the flat keyed Map)** — recommended, High. "The only approach that guarantees the deterministic numbering (INV-7) and density-based routing (INV-6) required by SPEC-004 while maintaining the host-agnostic 'reuse-not-fork' boundary (NFR-004). The 'Hard Mandate' for the `port()` id-index effectively mitigates the primary performance risk." The ADI again noted H1 "enables a 1:1 mapping between SPEC-004 scenarios and unit tests" — the exact rationale in Option 1's pros, and the property the F1/F2/F3 fixtures rely on.
- **H2 = Option 2 (single fused traversal)** — Low. "Contradicts the requirement for deterministic numbering (INV-7) which requires children to be pre-sorted before DFS"; density routing "needs a full root count before diagram emission." Matches this RFC's rejection of Option 2.
- **H3 = Web-Worker offloading of the whole pipeline** — Medium; surfaced by the ADI, rejected here. It protects the UI thread but "introduces async complexity that may conflict with the headless pure-library simplicity and SPEC NFR-001." Rejected for T1: the core stays a synchronous pure function (NFR-001); a Worker is a **host** concern the T2/builder renderer may adopt later (the ≤50 ms budget + O(1) DOM already keep it off the critical path). Recorded as a deferred host-layer option.

**No ADI override.** The S-1 reframe changes *framing* — which mode is the honest default render on real data (tier-stack today) — **not** the design option. Option 1 (staged pipeline) is unchanged; the F1 non-null tier-stack diagram, the F2 windowed diagram, and the F3 deterministic edge fan-out are refinements *within* Option 1, and each strengthens the exact invariants (INV-6/INV-8/INV-10) the ADI names as the reason to prefer H1. ADI-named evidence needs (the NFR-002 scaling micro-benchmark, the ADR-006 byte-identity acceptance, the determinism property test) are folded into Test Strategy Hooks + Risks and become guardian-required EVIDENCE. The ADI confirms Option 1 and the Q1/Q3/Q4 resolutions stand as written.

## Implementation Phases

- **Phase 0 — Tier lift (ADR-006 prerequisite, GATE-0) with a HARD sequencing precondition (resolves EVID-047 S-2).** Before any relocation OR any T3-A reindex runs, a **hard gate**: (i) **PROB-060 landed on a clean trunk** and the working tree is clean (no in-flight merge), and (ii) an **artifact-count captured before/after** any reindex. Rationale: the id-collision reindex-overwrite gotcha (parallel checkouts collide on `PRD-NNN`; a reindex on a merge-duplicated branch **silently overwrites** a collision artifact with **no anomaly emitted**) would undercut the very INV-7/E-ID-COLLISION machinery this core builds. Then: capture the pre-lift `typeTier`/`compactTierMap` golden snapshot; create `shared/lib/tier/`; convert `type-tier.ts` + `cluster.svelte.ts` to re-export shims (retain the `cluster.svelte.ts` `TYPE_ORDER` shim + its `rule-24-shim` marker comment). Land the four ADR-006 acceptance tests (byte-identity, Sankey resolution, import-graph, symbol-diff). Blocks all later phases (FSD + sequencing).
- **Phase 1 — `port.ts` + `idef0-relation.ts`.** Implement `port()` with the `byId` index (I-1), the deterministic edge fan-out under collision (I-11), the `serialiseKey`/`deserialiseKey` codec with the NUL guard (S-6), `takenAt` precedence (F4), drop/degraded/collision handling; implement the ADR-007 local table + `classifyIcom` + the `CANONICAL_RELATIONS` registry + the relation-drift guard (S-3). Covers: classifyIcom case-per-relation, E-MISSING-IDENTITY, E-UNKNOWN-RELATION, E-ID-COLLISION, the collided-id-edge fixture, the `\0`-key fixture, the relation-drift guard.
- **Phase 2 — `forest.ts`.** `buildDecompForest` (E-MULTI-PARENT tier-then-key, E-CYCLE lowest-key, one-parent-per-node, `derived` secondaries + collision-fan-out extras) + `buildTierStackForest`. Covers: one-parent-per-node + informs=Mechanism, E-CYCLE, honesty real-vs-derived (forest half).
- **Phase 3 — `numbering.ts` + `signature.ts` + `outline.ts`.** A-numbering, order-independent signature, windowed outline. Covers: (id,title) numbering stability, determinism (AC-5), E-EMPTY.
- **Phase 4 — `icom.ts` + `diagram.ts` + `density.ts`.** ICOM side + legend, `computeIdef0Diagram` (focus + window + mega-node rollup, no x/y — F2), `computeTierStackDiagram` (non-null tier-stack diagram — F1), density gate (Q1=0.3, non-null diagram in both modes). Covers: densityGate threshold + tier-stack fallback (now asserting a **non-null** tier-stack `Idef0Diagram`), INV-10 metadata sufficiency **in both modes**, FR-007 no coordinates, honesty (diagram half), the ≤6-box/rollup + 16-root fixture.
- **Phase 5 — `index.ts` orchestration + NFR-002 benchmark + real-data fixture.** Compose `deriveIdef0` (non-null diagram, `focus` passthrough); run the N=1000 micro-benchmark (records the actual Q4 figure as EVIDENCE); assert linear (not quadratic) `port()` scaling. Land the **authentic `graph --json` dogfood fixture asserting the `tier-stack` outcome on real data** (S-1 / T-1) as the primary real-data conformance contract. Covers: NFR-001 purity/determinism property test, NFR-004 reuse-not-fork import assertion (T2 + builder surface).
- **Phase 6 — EVIDENCE + gate.** Link the conformance-harness result + benchmark as EVIDENCE (with `## Structured Fields`), score R_eff, dispatch guardian. Only then may the orchestrator activate. (Not this agent's job — RFC ships `draft`.)

Every phase is gated by its mapped `#### Scenario` tests being green; no phase merges with a red conformance test.

## Invariants (must never be violated)

- **I-1 (INV-PORT-IDX, BLOCKER):** `port()` resolves every edge endpoint via the `byId` index; no linear node scan inside the edge loop (else O(N×E) — NFR-002 fail).
- **I-2 (purity, SPEC NFR-001/FR-007):** zero `Date`/`Math.random`/I/O/DOM/`spawn` inside `shared/lib/idef0/`; the pipeline is a pure function of `DecompInput` (incl. caller-supplied `takenAt` — no wall-clock).
- **I-3 (determinism, SPEC INV-7/INV-8):** every ordering uses `[typeTier(kind), serialiseKey(key)]`; never Map insertion order, never input array index. Same input set ⇒ identical `structuralSignature`, `Outline`, `Diagram`, A-numbers, and edge fan-out order.
- **I-4 (one parent, SPEC INV-4):** `buildDecompForest` assigns ≤1 structural parent per node; demotions/cycle-breaks/collision-fan-out extras are `derived` links, never dropped silently.
- **I-5 (informs never structural, SPEC INV-2):** `classifyIcom("informs") === "mechanism"`; an `informs` edge never creates a parent/child link.
- **I-6 (total classification, SPEC INV-3):** `classifyIcom` is total/explicit over the 5 canonical relations; `based_on`/`contradicts` are never `null`/dropped.
- **I-7 (no shared mutation, SPEC INV-9/ADR-006/ADR-007):** the exported `HIERARCHY_RELATIONS` value + `normaliseHierarchyEdge` function stay byte-identical at symbol granularity; the core ships its own `idef0-relation.ts`.
- **I-8 (FSD, rule 24/SPEC INV-1):** `shared/lib/{idef0,tier}/` import nothing from `widgets/`; the `cluster.svelte.ts` `TYPE_ORDER` re-export shim always exists so `SankeyView.svelte:35` resolves.
- **I-9 (no geometry, SPEC INV-10/FR-007):** `Idef0Diagram` carries no x/y; the only positional datum is each arrow's ICOM `side`.
- **I-10 (honesty edge-scoped, SPEC INV-5):** no `derived` edge is ever labelled `real`; authored nodes (roots included) are always `real`.
- **I-11 (INV-PORT-EDGE, BLOCKER — F3):** under id-collision, `port()` emits one EdgeIn per matching `(from,to)` composite-key pair in ascending `[serialiseKey(from), serialiseKey(to)]` order; the lowest pair keeps `real` provenance, fan-out extras are `derived`; never insertion-order-dependent (INV-8), never coalesced (E-ID-COLLISION).
- **I-12 (non-null diagram — F1):** `computeIdef0Diagram`, `computeTierStackDiagram`, `densityGate`, and `deriveIdef0` return a **non-null `Idef0Diagram`** in both `idef0` and `tier-stack` modes; the tier-stack diagram carries tier-member boxes + legend (all `derived`) so INV-10 + Scenario 3 hold uniformly. There is no `diagram: null` path.
- **I-13 (relation-drift guard — S-3):** `CANONICAL_RELATIONS` equals the live `forgeplan_link` canonical relation enum; the drift-guard CI test fails loudly when upstream adds a relation, so a new structural relation cannot silently fall to `E-UNKNOWN-RELATION`.
- **I-14 (bounded diagram materialisation — F2):** `computeIdef0Diagram`/`computeTierStackDiagram` materialise ≤ W boxes/page (W=6) via focus + mega-node rollup, regardless of N and regardless of the 16-root top tier — the core-level O(1)-DOM contract.

## Rollback Plan (if the decision fails)

- **Per-phase revert (pre-merge).** Each phase lands behind its mapped `#### Scenario` tests; a failing conformance test blocks the PR. Because the core is a pure library with no side effects, a `git revert` of a phase commit restores the exact prior state with zero behavioural residue.
- **Threshold re-bind (cheap, no ADR).** The Q1 threshold (0.3) is a tunable data value in `density.ts`. Re-tuning it against a denser future workspace is a one-line change + a `densityGate` test refresh — no forest/numbering/diagram change, no superseding artifact. (Note: it cannot be tuned to render today's ≈0.095 data as idef0 without fabricating structure — that is a T3 dependency, not a rollback lever.)
- **Q2 re-letter (cheap, ADR-007-owned).** The ICOM letters live in the local `idef0-relation.ts` table and are carried as data on every arrow (INV-10); re-lettering is a table edit + legend/test refresh, inherited from ADR-007's rollback plan.
- **Tier-lift rollback (ADR-006-owned, semi-irreversible).** If the byte-identity/Sankey-resolution tests fail, ADR-006's rollback governs: pre-merge revert, or a superseding ADR moving the vocabulary back. The byte-identical golden test makes behaviour equivalence trivial to prove in either direction.
- **Framing rollback (stickiest).** If the IDEF0-STYLE projection framing is judged wrong, ADR-007's superseding-ADR path removes the ICOM vocabulary from hosts while the pure core (forest + numbering + provenance + the tier-stack diagram) survives a metaphor change.
- **Data safety.** Nothing at risk to unwind: the core is pure, read-only, no `/api/*` mutation, no workspace writes (rule 22).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `port()` shipped with naive O(N×E) edge resolution (I-1 missed) | med | high | INV-PORT-IDX stated as BLOCKER; code review + N=100→1000→5000 scaling micro-benchmark in NFR-002 EVIDENCE (EVID-TBD) |
| edge binding under id-collision left non-deterministic (I-11 missed) | med | high | INV-PORT-EDGE stated as BLOCKER; deterministic fan-out ordered by composite key; collided-id-edge fixture asserts order + real/derived split (F3) |
| tier-stack path returns null / host can't render fallback from the diagram (F1 regression) | med | high | I-12: `computeTierStackDiagram` non-null; densityGate/deriveIdef0 non-null in both modes; INV-10-in-tier-stack-mode assertion in the harness |
| flagship idef0 mode claimed shippable on real data when it is unreachable (density ≈0.095) | high | high | S-1 reframe: tier-stack is the honest default; real-data fixture asserts tier-stack; T1 evidence must NOT claim EPIC Outcome 2 / idef0-half of Outcome 5; idef0 mode is synthetic-fixture-validated + T3-gated (§Current-data reality) |
| >6-child focus / 16-root top tier blows the O(1)-DOM bound (F2 gap) | med | med | I-14: focus + mega-node rollup caps boxes at ≤ W=6/page; F2 fixture asserts ≤6 boxes + rollup on both cases |
| Phase-0 tier-lift/reindex on a merge-dup tree silently overwrites a collision artifact (no anomaly) | med | high | S-2 hard GATE-0: PROB-060 landed on a clean trunk + clean tree + before/after artifact-count capture before any lift/reindex |
| a NEW upstream forgeplan relation silently falls to E-UNKNOWN-RELATION (structural intent invisible) | med | med | S-3 / I-13: `CANONICAL_RELATIONS` registry + drift-guard CI test failing on a new `forgeplan_link` relation |
| T4 composed-map cannot reuse the core (§23 owns MapNode, no adapter) ⇒ Outcome 5 over-claimed | med | high | S-4: Outcome 5 rests on T2 + a builder surface (both feed ArtifactSummary+GraphEdge); T4 reuse is Open Question OQ-1, flagged for the EPIC, not assumed |
| tier-lift silently shifts altitude of the 7 hierarchical views | med | high | ADR-006 byte-identical golden test (AC-1) captured in Phase 0 before relocation; symbol-diff on `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge` |
| `cluster.svelte.ts` `TYPE_ORDER` shim "cleaned up" ⇒ SankeyView breaks silently | med | high | committed test asserting `SankeyView` resolves `TYPE_ORDER` post-lift + the `rule-24-shim` marker comment (ADR-006 I-4) |
| `based_on` dropped via the shared inverting-default table | low | high | local `idef0-relation.ts` with explicit case per relation; regression guard asserting `normaliseHierarchyEdge(...,"based_on")===null` while `classifyIcom("based_on")!==null` |
| `serialiseKey` NUL-delimiter collapses two distinct keys (S-6) | low | med | `port()` strips control chars incl. `\0` before serialising; `\0`-title fixture asserts no collapse |
| core signature churn breaks N host importers (no stability posture, S-5) | low | med | §API stability posture: `index.ts` barrel = semver public surface; internal modules `@internal`; breaking change disciplined across importers |
| pathological `refines` chain (N=1000) blows the DFS stack | low | med | V8 default ~10k frames tolerates a 1000-deep chain; RFC notes an iterative-DFS fallback if a future workspace exceeds it |
| non-determinism leaks in (Date/Math.random/Map-iteration reliance) | low | high | NFR-001 static scan + ≥100-run signature-equality property test (AC-5); every ordering uses the canonical sort key, never Map insertion order |

Measured figures (NFR-002 budget, port() scaling) are **TBD** and recorded in EVIDENCE at implementation time — no benchmark is invented here.

## Open Questions

- **OQ-1 — T4 composed-map reuse vs PROJECT-MAP-SPEC §23 (flagged for the EPIC; resolves EVID-047 S-4).** §23 designs `ComposedMap` to own its `MapNode` (reads `/api/map` exclusively; node-superset excluded — "no adapter"; `sha1(kind+':'+path)[:12]` keys, pre-zoned + mega-collapsed, raw `refines` already rebinned) and already ships `computeComposedLayout`. Whether the composed-map can reuse this decomposition core requires a **render-proof that `map.json`/`MapNode` can lower to `RawSnapshot` with raw `refines` recoverable** — a `PRD-T4` ↔ `RFC-028` ↔ `§23` reconciliation. Until then, **Outcome 5 does not count T4 as a reuse host**; it rests on T2 + the builder surface. This is a program-level question for the EPIC owner, not a T1 blocker — do not assume T4 reuse. (Owner: EPIC-001 / a future PRD-T4.)
- Q1/Q3/Q4 are resolved above (0.3 / tier-then-key + lowest-key / ≤50 ms target-until-measured). Q2 is owned + resolved by ADR-007.

## Test Strategy Hooks — the conformance harness (SPEC-004's 12 scenarios → Vitest, + the review-driven additions)

The downstream `tester`/`coder` implements **one Vitest test per `#### Scenario`**, plus the review-driven fixtures below. Proposed file layout under `template/src/shared/lib/idef0/__tests__/` (+ the tier lift under `template/src/shared/lib/tier/__tests__/`):

| # | SPEC-004 `#### Scenario` | Vitest file / case | Targets |
|---|---|---|---|
| 1 | tier-vocab byte-identical behaviour | `tier/__tests__/tier-byte-identity.spec.ts` | INV-1, FR-001, AC-1 + static import-graph check (0 `widgets/` imports) |
| 2 | buildDecompForest one-parent-per-node + informs=Mechanism | `idef0/__tests__/forest-one-parent.spec.ts` | INV-2, INV-4, FR-003 |
| 3 | densityGate threshold + tier-stack fallback | `idef0/__tests__/density-gate.spec.ts` | INV-6, FR-004, Q1=0.3 (all worked cases) + **asserts a non-null `mode:"tier-stack"` `Idef0Diagram` (F1)** |
| 4 | honesty real-vs-derived marking | `idef0/__tests__/honesty-provenance.spec.ts` | INV-5, FR-005 (edge-scoped; roots stay real; collision-fan-out extras derived) |
| 5 | (id,title) numbering stability under poll/snapshot | `idef0/__tests__/numbering-stability.spec.ts` | INV-7, FR-006 + id-collision fixture (PRD-016 dup) |
| 6 | classifyIcom case-per-relation incl. based_on | `idef0/__tests__/classify-icom.spec.ts` | INV-3, FR-002 + `normaliseHierarchyEdge` null-contrast regression guard |
| 7 | INV-10 headless metadata sufficiency | `idef0/__tests__/metadata-sufficiency.spec.ts` | INV-10, AC-6 (render from diagram alone) **in BOTH idef0 and tier-stack modes (F1)** |
| 8 | FR-007 no coordinates in the diagram | `idef0/__tests__/no-coordinates.spec.ts` | FR-007 (static type + runtime key scan, both modes) |
| 9 | E-EMPTY empty / all-dropped input | `idef0/__tests__/empty-input.spec.ts` | E-EMPTY, stable empty signature, non-null empty diagram |
| 10 | E-CYCLE deterministic refines-cycle break | `idef0/__tests__/cycle-break.spec.ts` | E-CYCLE, Q3 lowest-key, INV-8 |
| 11 | E-UNKNOWN-RELATION non-canonical relation | `idef0/__tests__/unknown-relation.spec.ts` | E-UNKNOWN-RELATION |
| 12 | E-MISSING-IDENTITY degraded key | `idef0/__tests__/degraded-key.spec.ts` | E-MISSING-IDENTITY, degradedKey |

Review-driven fixtures (new this revision):
- **Real-data tier-stack fixture (PRIMARY real-data contract, S-1 / T-1)** (`idef0/__tests__/real-data-tier-stack.spec.ts`): a committed authentic `graph --json` dogfood snapshot (density ≈0.095) asserts `deriveIdef0(...).verdict.mode == "tier-stack"` and a non-null tier-stack `Idef0Diagram` — locks the honest real-data default as a tested contract, not an accident.
- **Collided-id edge fixture (F3)** (`idef0/__tests__/collided-id-edge.spec.ts`): an edge referencing a collided id fans out to one EdgeIn per `(from,to)` composite-key pair, in ascending `[serialiseKey(from), serialiseKey(to)]` order, with the lowest pair `real` and the rest `derived`; reorder-invariant (INV-8).
- **≤6-box / rollup + 16-root fixture (F2)** (`idef0/__tests__/diagram-focus-rollup.spec.ts`): a focus node with >6 children and a null-focus 16-root top tier both yield `boxes.length ≤ 6` with a `+N more` mega-node (`derived`).
- **`\0`-key fixture (S-6)** (`idef0/__tests__/nul-key.spec.ts`): a `\0`-bearing title does not collapse two distinct composite keys.
- **Relation-drift guard (S-3)** (`idef0/__tests__/relation-drift.spec.ts` / CI): `CANONICAL_RELATIONS` equals the live `forgeplan_link` canonical enum; fails loudly on a new relation.
- **Property test** (`idef0/__tests__/determinism.property.spec.ts`): ≥100 random input reorderings of a fixed set ⇒ 1 distinct `structuralSignature` + identical A-numbers + identical edge fan-out order (NFR-001 / AC-5).
- **Static purity scan**: no `Date`/`Math.random`/I/O/DOM in `shared/lib/idef0/` (NFR-001).
- **Micro-benchmark** (`idef0/__tests__/scale.bench.ts`): `port`+`buildDecompForest`+`assignNodeNumbers`+`flattenOutline` at N=1000 within the Q4 budget, and `port()` linear-scaling check at N=100/1000/5000 (NFR-002 / I-1).
- **Reuse-not-fork test**: the two load-bearing hosts (T2 + builder surface) import core symbols, do not re-declare them (NFR-004, S-4).
- **Fork-limit note (build-gotchas):** vitest hits macOS fork limits at 7+ files; run this suite with `pool: 'threads'` to avoid it.

Build the dense fixtures synthetically (the idef0-mode path is synthetic-only-validated until T3); build the real-data fixture from an actual `graph --json` snapshot of the dogfood ForgePlanWeb workspace (which asserts tier-stack).

## Related Artifacts

- **EPIC-001** — parent (T1 keystone track); this RFC `refines` it.
- **SPEC-004** — frozen conformance contract; `based_on` (this RFC is the implementation of INV-1..10 / FR-001..007; resolves Q1/Q3/Q4; HONORS the frozen non-null `Idef0Diagram.mode` + Scenario 3 + INV-10 in the tier-stack path — F1).
- **ADR-006** — behaviour-preserving tier-vocabulary lift to `shared/lib/tier/`; `based_on` (Phase 0 prerequisite; the `cluster.svelte.ts` shim).
- **ADR-007** — idef0 = IDEF0-STYLE projection; `informs` = Mechanism; local relation→ICOM table (Q2 letters); `based_on` (the `idef0-relation.ts` contract).
- **EVID-046** — architect-reviewer of RFC-028 (CONCERNS, F1–F4); `informs` (this revision resolves it).
- **EVID-047** — system-dev staff audit of RFC-028 (CONCERNS, S-1 HIGH + S-2..S-6); `informs` (this revision resolves it).
- **EVID-048** — guardian gate of the T1 keystone set (CONCERNS); `informs` (this revision re-enters the gate).
- **PROB-060 / forgeplan#397** — identity-omission basis for the composite `(id,title)` key (INV-7) + the reindex-overwrite gotcha behind the S-2 Phase-0 gate.
- **PROJECT-MAP-SPEC §23** — the composed-map `MapNode` ownership contract behind Open Question OQ-1 (S-4).
- **(future) EVID-TBD** — conformance-harness result + real-data tier-stack fixture + NFR-002 micro-benchmark; guardian-required before activation (`informs`).
- **(future) PRD/RFC T2** — standalone `idef0` view; first host consuming this core.
- **(future) builder surface (Mechanism Atlas / ASSAY)** — second reuse host (ArtifactSummary + GraphEdge).
- **(future) PRD T4** — composed-map graft; candidate (not load-bearing) host — pending OQ-1 §23 reconciliation.

## References

- Algorithm design (per-function Big-O, id-index mandate, density metric, NFR-002 derivation): SPARC pseudocode working notes (`idef0-pseudocode-working-notes.md`, scratchpad).
- Lift sources (bytes frozen by SPEC INV-9): `template/src/widgets/dependency-graph/lib/cluster.svelte.ts:8-18` (`TYPE_ORDER`), `type-tier.ts:13-38` (`typeTier`/`compactTierMap`).
- Shim-critical consumer: `template/src/widgets/dependency-graph/ui/SankeyView.svelte:35` (direct `TYPE_ORDER` import).
- 9th-view registration seams: `ui-prefs.ts` (`GraphView` union + `GRAPH_VIEWS` + `GRAPH_VIEW_IDS`), `DependencyGraph.svelte` (`{:else if view==='idef0'}` branch).
- Composed-map host contract (OQ-1): `docs/PROJECT-MAP-SPEC.md §23`.
- Live workspace signal (S-1 basis): `forgeplan graph --json` this session → 117 nodes / refines 11 · based_on 20 · informs 100 → decomposition density ≈ 0.095.
- SPEC-004 §Data Models (frozen shapes, incl. non-null `Idef0Diagram.mode`), §Behavioural Scenarios (the 12 freezes, incl. Scenario 3 tier-stack), §Open Questions Q1/Q3/Q4.
- Review chain resolved by this revision: EVID-046 (architect-reviewer), EVID-047 (system-dev), EVID-048 (guardian).
- FPF ADI: `forgeplan_reason RFC-028` (gemini-3-flash-preview, 2026-07-01) — recommendation H1 (staged pipeline), High confidence; re-confirmed for this revision, no override.









