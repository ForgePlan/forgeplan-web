---
depth: standard
id: SPEC-004
kind: spec
last_modified_at: 2026-06-30T22:56:09.937454+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EPIC-001
  relation: refines
status: active
title: TADD derivation and ICOM-grammar conformance for the IDEF0 decomposition core
---

# SPEC-004: TADD derivation + ICOM-grammar conformance (idef0 core)

## Summary

SPEC-004 is the frozen conformance contract for the T1 keystone of EPIC-001 — the pure deterministic decomposition core (`shared/lib/idef0/`) together with its prerequisite tier-vocabulary lift to `shared/lib/tier/`. It defines "correct" as 10 immutable invariants (INV-1–INV-10), 7 must-priority functional requirements (FR-001–FR-007), and 12 executable `#### Scenario` blocks covering tier byte-identity, `informs`=Mechanism, one-structural-parent-per-node, honest density-gate fallback, stable `(id,title)` A-numbering, determinism, no shared-table mutation, headless metadata sufficiency, the no-coordinates guarantee, and the never-throw error modes (empty input, refines-cycle break, unknown relation, degraded key). Scope is the headless core only — no geometry, no UI, no graph mutation — all algorithm and layout decisions are deferred to the T1 core-RFC and its ADRs; T2–T5 surfaces are separate EPIC-001 children. This SPEC gates all downstream host renderers by providing a conformance harness (Vitest `#### Scenario` blocks) rather than a wish list.

Conformance contract for the **T1 keystone** of EPIC-001 — the ONE pure deterministic
decomposition core (`template/src/shared/lib/idef0/`) plus its prerequisite tier-vocabulary
lift (`template/src/shared/lib/tier/`). This SPEC does **not** design the algorithms; it
freezes what "correct" means as executable behaviour, so the core-RFC and its two ADRs are
built against a conformance harness rather than a wish list. TADD = **T**ree-**A**nd-**D**iagram
**D**erivation.

## Problem

EPIC-001 ("IDEF0 decomposition surfaces", critical) builds ≥2 host renderers on one pure
core that derives an **IDEF0-STYLE projection** (boxes are *documents*, not functions — not a
conformant IDEF0 model) and classifies forgeplan relations into an ICOM grammar. Two hazards
make the core unsafe to build without a frozen behavioural contract, both confirmed against the
real `develop` tree:

1. **Tier-vocabulary leakage.** The vocabulary the core needs
   (`TYPE_ORDER` / `typeTier` / `compactTierMap`) currently lives **inside a widget**:
   `template/src/widgets/dependency-graph/lib/type-tier.ts` imports
   `TYPE_ORDER = [epic, prd, spec, rfc, adr, evidence, note, problem, solution]` from
   `cluster.svelte.ts`. FSD (rule 24) forbids `shared/` importing `widgets/`, so the vocabulary
   must be **lifted** to `shared/lib/tier/` and the widget must re-export from there. Any drift
   during the lift silently shifts the "altitude" of all 7 existing hierarchical views.

2. **Relation-table inversion + drop.** The same widget file's `normaliseHierarchyEdge`
   **inverts** `refines`/`informs` direction, and its `HIERARCHY_RELATIONS` set
   `{contains, belongs-to, refines, informs, supersedes}` **omits `based_on` and `contradicts`**
   (they fall through to `return null`). If the core reuses that table, the structural spine
   (EPIC baseline `based_on`+`refines` = 8/22) loses every `based_on` edge and the ICOM grammar
   mis-frames `informs`. The core therefore needs its **own local `idef0-relation.ts`** with an
   explicit case per relation, and must **not mutate** the shared table the 7 views depend on.

Compounding both: forgeplan 0.33's `get --json` returns `slug=null` and omits
`id_display`/`id_canonical`/`predicted_number`/`assigned_number`, and `graph --json` lacks
`nodes` (forgeplan#397, empirically verified — memory bank + PROB-060 research). So the only
stable identity the dual-poller can hand the core is the composite `(id, title)`; A-numbering
must survive poll/snapshot churn and id collisions on that key alone.

ADI on the parent EPIC (run 2026-06-30, gemini) reinforced the load-bearing constraints
this SPEC freezes: the core "must be strictly headless — any SVG coordinates / DOM virtualization
leaked into T1 breaks Outcome 5"; "reuse-not-fork fails when renderers require metadata not
present in the core"; and "the honesty requirement might result in a visually broken UI if the
graph is sparse" (→ the density-gate honest tier-stack fallback is the safety valve).

## Goals

- Goal 1: The lifted tier vocabulary in `shared/lib/tier/` is observably **byte-identical** to
  pre-lift widget behaviour for `typeTier`/`compactTierMap` over every artifact kind.
- Goal 2: `classifyIcom` is **total** over the five canonical forgeplan relations with an
  explicit case each; `informs` is always Mechanism; `based_on` is never silently dropped.
- Goal 3: `buildDecompForest` yields a forest where every node has **≤1 structural parent**;
  `informs` never creates a parent/child edge.
- Goal 4: `densityGate` deterministically routes a too-thin decomposition to an **honest
  tier-stack fallback**; no surface ever renders derived structure as real.
- Goal 5: A-numbering is **stable** under poll reordering and snapshot, keyed by composite
  `(id,title)`; id collisions are **surfaced**, not hidden.
- Goal 6: The core is **pure and deterministic** (same `DecompInput` → identical
  `structuralSignature`) and never mutates the shared `HIERARCHY_RELATIONS` /
  `normaliseHierarchyEdge`.

## Non-Goals / Out of scope

- Out of scope: **geometry**. `computeIdef0Diagram` emits topology + ICOM roles with **no x/y**;
  host renderers own layout (the IDEF0-STYLE projection is headless).
- Out of scope: the exact ICOM letter (Input vs Control vs Output) for
  `based_on`/`supersedes`/`contradicts` — that is the projection/relation-table ADR's decision
  (Open Q2). This SPEC freezes only that each is a **defined, deterministic, non-Mechanism**
  class.
- Out of scope: the numeric `densityGate` **threshold value** only — bound by the core-RFC
  (Open Q1). The density-metric **definition + direction + the N≤2 gate are frozen in-SPEC**
  (INV-6 / FR-004); this SPEC freezes the routing *behaviour* and the metric, leaving only the
  threshold number to the RFC.
- Out of scope: any forgeplan **mutation**. The core is pure; `/api/*` stays a read-only proxy
  (rule 22). No endpoint, no `spawn`, no write surface is introduced.
- Out of scope: the 9th `idef0` view UI (T2), graph-spine recovery/reindex (T3), composed-map
  graft (T4), compare-and-keep harness (T5), and the additional builder surfaces — each a
  separate child of EPIC-001.
- Out of scope: changing or regressing the 7 existing views, or altering the shared
  `normaliseHierarchyEdge` semantics they depend on.

## Target users / actors

- **Core authors** (T1 RFC/ADR implementers) — consume this SPEC as the conformance contract.
- **Host renderers** (T2 `idef0` view; T4 composed-map; Mechanism Atlas / ASSAY / Throughline /
  Waterline builders) — depend on the core's pure output shape and the metadata it carries.
- **The dual-poller** (existing `/api/*` read path; system actor, read-only) — feeds raw
  forgeplan `get`/`graph` JSON snapshots into `port()`.
- **The conformance harness** (Vitest) — executes the frozen `#### Scenario` blocks below; CI gate.
- **Reviewers** (artifact-reviewer, architect-reviewer, guardian) — verify each scenario maps to
  a committed test.

## Contract

The core is a single pure, deterministic, side-effect-free pipeline in
`template/src/shared/lib/idef0/`, plus the lifted vocabulary in `template/src/shared/lib/tier/`.
No I/O, no wall-clock, no randomness, no DOM, no `widgets/` import (FSD rule 24). The shared
widget tables (`HIERARCHY_RELATIONS`, `normaliseHierarchyEdge`) are **read-only** to the core;
the core ships its own `idef0-relation.ts`.

### Pipeline (frozen order)

```
port(RawSnapshot)             -> DecompInput          # normalise; tolerate #397 omissions
DecompInput                   -> buildDecompForest    # dense IDEF0 path (refines spine)
DecompInput                   -> buildTierStackForest # honest fallback path (compactTierMap)
Forest                        -> assignNodeNumbers    # A-numbering, composite (id,title) key
edges                         -> classifyIcom         # relation -> ICOM, LOCAL table
(Numbered, Classified)        -> computeIdef0Diagram  # topology + ICOM roles, NO x/y
Forest|Diagram                -> densityGate          # choose idef0 vs tier-stack mode
Forest                        -> structuralSignature  # order-independent shape hash
Forest                        -> flattenOutline       # deterministic ordered outline rows
```

### Frozen invariants

- **INV-1 (tier purity)**: `TYPE_ORDER`/`typeTier`/`compactTierMap` live in `shared/lib/tier/`;
  widgets re-export from there; behaviour is byte-identical to the pre-lift widget version.
  `TYPE_ORDER = ["epic","prd","spec","rfc","adr","evidence","note","problem","solution"]`.
- **INV-2 (informs = Mechanism)**: `classifyIcom("informs") = mechanism` **always**; an `informs`
  edge **never** contributes a `buildDecompForest` parent/child link.
- **INV-3 (total, explicit, no-drop)**: `classifyIcom` has an explicit case for each of
  `{informs, based_on, supersedes, contradicts, refines}`; `based_on` and `contradicts` return a
  **defined** ICOM class (never `null`/dropped, unlike the shared table). The default branch is
  unreachable for canonical relations.
- **INV-4 (one structural parent)**: in `buildDecompForest` every node has **≤1 parent**. The
  decomposition spine is `refines` (child refines parent ⇒ parent is the more-abstract box).
  Multiple `refines`-parents ⇒ exactly one chosen by a deterministic stable order; the rest are
  demoted to `derived` secondary links.
- **INV-5 (honesty, edge-scoped)**: every node and edge carries `provenance ∈ {real, derived}`,
  but the predicate is **scoped per element kind**. A forest **node** is `real` because it is an
  authored forgeplan artifact present in the snapshot — **roots included** (a root has no incoming
  edge yet is plainly `real`). An **edge/link** is `real` only when it is an authored source edge
  (host renders solid); an **inferred** link is `derived` (host renders dashed, marked `≈`). The
  only `derived` links are inferred ones: multi-parent demotions (E-MULTI-PARENT), cycle-break
  back-edges (E-CYCLE), and tier-stack edges. **No `derived` edge is ever mislabelled `real`.**
  Tier-stack output is entirely `derived`.
- **INV-6 (density routing)**: the density metric is **frozen in-SPEC** as
  `density = (N − roots.length) / max(1, N − 1)` (range `[0, 1)`, **higher = denser**), with the
  hard gate **`N ≤ 2 ⇒ tier-stack` regardless of density**. When `density` is **below** the
  RFC-configured threshold (or the N≤2 gate fires), the core returns the tier-stack forest
  (`mode = "tier-stack"`), not an IDEF0 diagram; at/above threshold it returns the IDEF0 diagram
  (`mode = "idef0"`). Only the numeric **threshold value** remains RFC-bound (Q1). IDEF0's
  ≤6-box-per-page convention is the diagram's upper bound.
- **INV-7 (stable numbering)**: `assignNodeNumbers` keys on composite `(id, title)` and is
  **invariant to input array order**; an identical input set ⇒ identical A-numbers across
  polls/snapshots. An id collision (same `id`, distinct `(id,title)`) ⇒ both retained,
  distinguished, and flagged `idCollision = true`.
- **INV-8 (determinism)**: same `DecompInput` ⇒ identical `structuralSignature`, `Outline`, and
  `Diagram`. No nondeterministic source inside the core.
- **INV-9 (no shared mutation)**: the core imports `HIERARCHY_RELATIONS` / `normaliseHierarchyEdge`
  read-only (or not at all); the **exported `HIERARCHY_RELATIONS` value and the
  `normaliseHierarchyEdge` function are byte-identical** to their pre-T1 form. The enclosing files
  (`type-tier.ts` / `cluster.svelte.ts`) legitimately change during the tier-lift (TYPE_ORDER
  re-export), so identity is asserted at **symbol granularity**, not whole-file.
- **INV-10 (headless metadata sufficiency)**: the `Idef0Diagram` carries enough role +
  provenance + number metadata for any host to render without recomputing classification or
  numbering (resolves the ADI "reuse-not-fork needs metadata" risk).

## Data Models

Shapes are the **data** contract (not a library choice); geometry is absent by design.

| Type | Shape | Notes |
|---|---|---|
| `Relation` | `"informs" \| "based_on" \| "supersedes" \| "contradicts" \| "refines"` | the five canonical forgeplan link relations |
| `IcomClass` | `"input" \| "control" \| "output" \| "mechanism" \| "decomposition"` | `decomposition` = structural (tree) role for `refines`; `informs` ⇒ `mechanism` |
| `Provenance` | `"real" \| "derived"` | INV-5 |
| `CompositeKey` | `{ id: string; title: string }` | the stable identity per forgeplan#397; equality structural on both fields |
| `RawSnapshot` | `{ nodes?: Array<{ id?: string; title?: string; kind?: string }>; edges?: Array<{ from?: string; to?: string; relation?: string }>; takenAt?: string }` | untrusted poller payload; tolerant of #397 omissions |
| `NodeIn` | `{ key: CompositeKey; id: string; title: string; kind: string }` | post-`port()` |
| `EdgeIn` | `{ from: CompositeKey; to: CompositeKey; relation: Relation }` | post-`port()` |
| `DecompInput` | `{ nodes: NodeIn[]; edges: EdgeIn[]; threshold: number; takenAt: string; dropped: number }` | normalised; `threshold` injected (purity — no internal default lookup) |
| `ForestNode` | `{ key: CompositeKey; kind: string; tier: number; parent: CompositeKey \| null; children: CompositeKey[]; provenance: Provenance; number: string \| null; idCollision: boolean; degradedKey: boolean }` | |
| `DecompForest` | `{ roots: CompositeKey[]; nodes: ReadonlyMap<string, ForestNode>; mode: "idef0"; provenance: Provenance }` | map keyed by serialised CompositeKey |
| `TierStackForest` | `{ tiers: Array<{ tier: number; kind: string; members: CompositeKey[] }>; mode: "tier-stack"; provenance: "derived" }` | built from `compactTierMap` |
| `ClassifiedEdge` | `{ from: CompositeKey; to: CompositeKey; relation: Relation; icom: IcomClass; provenance: Provenance }` | |
| `Idef0Diagram` | `{ boxes: Array<{ key: CompositeKey; number: string }>; arrows: Array<{ edge: ClassifiedEdge; side: "left" \| "top" \| "right" \| "bottom" }>; legend: IcomLegend; mode: "idef0" \| "tier-stack" }` | **no x/y**; `side` is the ICOM convention (I=left, C=top, O=right, M=bottom), not pixels |
| `IcomLegend` | `{ roles: IcomClass[]; honestyKey: { real: "solid"; derived: "dashed ≈" } }` | persistent ICOM legend descriptor (MVP-blocking framing) |
| `DensityVerdict` | `{ metric: number; threshold: number; mode: "idef0" \| "tier-stack"; reason: string }` | |
| `StructuralSignature` | `string` | order-independent hash of forest shape; equal inputs ⇒ equal signature |
| `OutlineRow` | `{ number: string; key: CompositeKey; depth: number; kind: string; provenance: Provenance }` | |
| `Outline` | `OutlineRow[]` | pre-order, deterministic |

## Errors

The core **never throws** on adversarial poller data; failure modes are surfaced as typed,
deterministic states (the poller is untrusted; forgeplan#397 means fields are routinely missing).

| Code | Trigger | Handling (deterministic, no throw) |
|---|---|---|
| `E-MISSING-IDENTITY` | node lacks both `id` and `title` after `port()` | dropped from `DecompInput`, counted in `dropped` tally. `id` present + `title` missing ⇒ degraded key `(id, "")`, `degradedKey = true` |
| `E-ID-COLLISION` | two distinct `(id,title)` share an `id` | both retained, each `idCollision = true`, surfaced (forgeplan#397 / PROB-060 merge-dup). Never coalesced |
| `E-MULTI-PARENT` | a node has >1 `refines`-parent | resolved to one deterministic structural parent (INV-4); extras recorded as `derived` secondary links. Honesty downgrade, not an error |
| `E-CYCLE` | a `refines` cycle | broken at the deterministically-lowest composite key; broken back-edge marked `derived`; remaining tree acyclic |
| `E-DENSITY-BELOW` | density `< threshold` | NOT an error; routes to `tier-stack` mode (INV-6) with `reason` |
| `E-UNKNOWN-RELATION` | non-canonical relation string | classified to a defined `derived`, non-structural role (never `null`, never a tree edge), surfaced; canonical relations never reach this path |
| `E-EMPTY` | empty / all-dropped input | empty forest, diagram, outline; stable empty `structuralSignature`; no crash |

## Functional Requirements

### FR-001 — Behaviour-preserving tier-vocabulary lift
- **Description**: System shall consume `TYPE_ORDER`/`typeTier`/`compactTierMap` from
  `shared/lib/tier/`; widgets re-export the same symbols; observable behaviour is unchanged.
- **Priority**: must
- **Acceptance criteria**:
  - Given every kind in `TYPE_ORDER` plus ≥2 unknown kinds, when `typeTier` and `compactTierMap`
    run pre-lift and post-lift, then outputs are byte-identical (golden snapshot diff = 0).
  - Given the lifted module, when its import graph is inspected, then `shared/lib/tier/` imports
    nothing from `widgets/` (FSD rule 24).

### FR-002 — Total, explicit relation→ICOM classification
- **Description**: `classifyIcom` shall map each canonical relation via an explicit local case in
  `idef0-relation.ts`; `informs`⇒mechanism; `refines`⇒decomposition; `based_on`/`contradicts` are
  defined (non-null) and never dropped; the shared table is not mutated.
- **Priority**: must
- **Acceptance criteria**:
  - Given each of the 5 canonical relations, when `classifyIcom` runs, then it returns a defined
    `IcomClass`; `informs`⇒`mechanism`; `refines`⇒`decomposition`;
    `based_on`/`supersedes`/`contradicts` each ⇒ a non-null, non-`mechanism` role.
  - Given a focused symbol snapshot (AST/value) of the exported `HIERARCHY_RELATIONS` value and
    the `normaliseHierarchyEdge` function after T1, then both are byte-identical to their pre-T1
    form — independent of other edits to `type-tier.ts`/`cluster.svelte.ts` (which legitimately
    change for the TYPE_ORDER re-export).

### FR-003 — One-parent-per-node forest with informs as Mechanism
- **Description**: `buildDecompForest` shall build the tree from `refines` only, guaranteeing
  ≤1 structural parent per node; `informs` edges create no parent/child link.
- **Priority**: must
- **Acceptance criteria**:
  - Given a node with a single `refines` edge, then it appears as the child of that parent.
  - Given a node reachable only by `informs` edges, then it gains no parent (root/leaf) and its
    `informs` edge classifies as `mechanism`.
  - Given a node with two `refines`-parents, then exactly one structural parent is chosen
    deterministically and the others are `derived` secondaries; `count(nodes with >1 parent) = 0`.

### FR-004 — Density gate with honest tier-stack fallback
- **Description**: `densityGate` shall compute `density = (N − roots.length) / max(1, N − 1)`
  (higher = denser), apply the hard gate `N ≤ 2 ⇒ tier-stack`, route below-threshold (or N≤2)
  inputs to `buildTierStackForest` (mode `tier-stack`, all `derived`) and at/above-threshold
  inputs to the IDEF0 diagram (mode `idef0`), deterministically for a given `DecompInput`. Only
  the numeric threshold value is RFC-bound (Q1).
- **Priority**: must
- **Acceptance criteria**:
  - Given `N ≤ 2`, or `density < threshold`, then `mode == "tier-stack"`, all elements `derived`,
    `DensityVerdict.reason` names the below-threshold (or N≤2) cause.
  - Given `N ≥ 3` and `density ≥ threshold`, then `mode == "idef0"` with the ≤6-box-per-page bound
    respected.
  - Given the same `DecompInput`, then `density`, `mode`, and `DensityVerdict` are identical across runs.

### FR-005 — Honesty provenance marking
- **Description**: every node/edge shall carry `provenance`, scoped per element kind: a node is
  `real` when it is an authored snapshot artifact (roots included); an edge is `real` only when it
  is an authored source edge, and `derived` when inferred (multi-parent demotion, cycle-break
  back-edge, tier-stack edge).
- **Priority**: must
- **Acceptance criteria**:
  - Given an authored `refines` edge, then its link `provenance == "real"`.
  - Given a multi-parent demotion or a tier-stack fallback region, then those inferred
    links/elements are `provenance == "derived"`; the `IcomLegend.honestyKey` is present.
  - Given any output, then no `derived` edge is mislabelled `real`:
    `count(edges with provenance=="real" that are not authored source edges) == 0`; authored nodes
    (roots included) remain `real` regardless of incoming-edge count.

### FR-006 — Stable (id,title) A-numbering
- **Description**: `assignNodeNumbers` shall key on composite `(id,title)`, be order-invariant,
  and surface id collisions.
- **Priority**: must
- **Acceptance criteria**:
  - Given two poll payloads with the same nodes/edges in different array order, then each
    `(id,title)` receives an identical A-number (numbering diff = 0).
  - Given a payload with two nodes sharing an `id` but distinct titles, then both are retained,
    each `idCollision == true`, with deterministic distinct A-numbers.

### FR-007 — Pure deterministic pipeline, no x/y
- **Description**: the pipeline shall be a pure function of `DecompInput`; the diagram carries no
  coordinates; no wall-clock/randomness inside the core.
- **Priority**: must
- **Acceptance criteria**:
  - Given the same `DecompInput` across ≥100 runs, then `structuralSignature`, `Outline`, and
    `Diagram` are identical.
  - Given the `Idef0Diagram`, then it contains no x/y/pixel fields (only ICOM `side`).

## Behavioural Scenarios (frozen)

The conformance harness MUST implement **one test per `#### Scenario`**. Each is Given/When/Then
and order-stable. These are the freeze; downstream code that fails any is non-conformant.

#### Scenario: tier-vocab byte-identical behaviour
- **Given** the kind list `[epic, prd, spec, rfc, adr, evidence, note, problem, solution, "ZZZ-unknown", "MiXeDcAsE"]`, and a golden snapshot of the **pre-lift** widget `typeTier`/`compactTierMap` outputs.
- **When** the **lifted** `shared/lib/tier/` functions run on each kind, and `compactTierMap` runs on the full list and on the gap subset `[prd, rfc, evidence]`.
- **Then** every value equals the golden snapshot byte-for-byte: `typeTier(kind)` returns the `TYPE_ORDER` index (case-insensitive) or `9` (`TYPE_ORDER.length`) for unknowns; `compactTierMap([prd, rfc, evidence]) == {prd:0, rfc:1, evidence:2}` (no empty `spec` row); unknown present kinds are appended after known tiers in iteration order.
- **And** a static import check confirms `shared/lib/tier/` has **zero** imports from `widgets/`.

#### Scenario: buildDecompForest one-parent-per-node + informs=Mechanism
- **Given** nodes A,B,C,D with `refines` edges `B→A`, `C→A`, a second `refines` edge `B→C`, and an `informs` edge `D→A`.
- **When** `buildDecompForest` and `classifyIcom` run.
- **Then** A is a root; B has exactly one `parent` (deterministically chosen between A and C by the stable order) with the other `refines`-link recorded as a `derived` secondary; C's parent is A; D is **not** a child of A (it is a root/leaf) and `classifyIcom(D→A) == "mechanism"`.
- **And** `count(nodes with >1 parent) == 0` over the whole forest.

#### Scenario: densityGate threshold + tier-stack fallback
- **Given** the frozen metric `density = (N − roots.length) / max(1, N − 1)` with the hard gate `N ≤ 2 ⇒ tier-stack`: a thin input of a single `refines` chain of depth 1 (N=2, density=1.0 but caught by the N≤2 gate).
- **When** the pipeline runs `densityGate`.
- **Then** the returned diagram `mode == "tier-stack"`, it is built from `buildTierStackForest`/`compactTierMap`, every element `provenance == "derived"`, and `DensityVerdict.reason` names the N≤2 (below-threshold) cause.
- **And** given a dense input of three nodes in a `refines` line (N=3, one root ⇒ density = 2/2 = 1.0 ≥ any threshold in `[0,1)`), `densityGate` returns `mode == "idef0"` with the ≤6-box-per-page bound respected; given three isolated nodes (N=3, 3 roots ⇒ density = 0/2 = 0) it returns `mode == "tier-stack"`; and the same `DecompInput` always routes to the same `density`/`mode`.

#### Scenario: honesty real-vs-derived marking
- **Given** an input mixing an authored `refines` edge `B→A` (real), an `E-MULTI-PARENT` demotion, a `tier-stack` fallback region, and an authored **root** node R (no incoming edge).
- **When** the forest and diagram are computed.
- **Then** the authored `B→A` link has `provenance == "real"` (host renders solid); the demoted secondary-parent link and every tier-stack edge have `provenance == "derived"` (host renders dashed with `≈`); the root node R is `provenance == "real"` despite having no incoming edge; and `IcomLegend.honestyKey` is present.
- **And** the edge-scoped invariant holds: `count(edges with provenance=="real" that are not authored source edges) == 0` (no derived edge is mislabelled real); authored nodes including roots stay `real`.

#### Scenario: (id,title) numbering stability under poll/snapshot
- **Given** a node set S with edges, and two poll payloads P1 and P2 containing the **same** nodes/edges in **different array orders** (P2 also omits `slug`/identity fields per forgeplan#397).
- **When** `port()` + `assignNodeNumbers` run on P1 and P2 independently, with a `structuralSignature` snapshot taken between them.
- **Then** the A-number assigned to each `(id,title)` is **identical** across P1, P2, and the snapshot (numbering diff == 0).
- **And** given P3 with two nodes sharing `id == "PRD-016"` but distinct titles (the PROB-060 merge-dup case), both are retained with distinct composite keys, each `idCollision == true`, and both receive deterministic distinct A-numbers (collision **surfaced**, not coalesced).

#### Scenario: classifyIcom case-per-relation incl. based_on
- **Given** one edge of each canonical relation `{informs, based_on, supersedes, contradicts, refines}`.
- **When** `classifyIcom` runs via the local `idef0-relation.ts` table.
- **Then** each returns a defined `IcomClass` from an **explicit** case (no default fallthrough for canonical relations): `informs ⇒ mechanism`, `refines ⇒ decomposition`, and `based_on`/`supersedes`/`contradicts` each ⇒ a non-null, non-`mechanism` directed role (exact letter bound by the projection ADR — Q2).
- **And** specifically `classifyIcom("based_on")` is **not** `null`/dropped — contrasted in the same test against the shared `normaliseHierarchyEdge("from","to","based_on") === null` (regression guard); and the shared `HIERARCHY_RELATIONS` set is byte-unchanged.

#### Scenario: INV-10 headless metadata sufficiency
- **Given** a computed `Idef0Diagram` for a dense (`mode == "idef0"`) input.
- **When** a host consumes **only** the `Idef0Diagram` (its `boxes`, `arrows`, `legend`) with no access to the forest, the raw edges, or `classifyIcom`.
- **Then** every box carries its `number` and every arrow carries both its `side` (the ICOM I/C/O/M convention) and its `edge.provenance` — so the host can render every box and arrow recomputing **neither** classification **nor** numbering.
- **And** `count(arrows lacking a side or a provenance) == 0`, `count(boxes lacking a number) == 0`, and the `IcomLegend` enumerates every `IcomClass` role present in the diagram.

#### Scenario: FR-007 no coordinates in the diagram
- **Given** a computed `Idef0Diagram` (either `mode`).
- **When** its shape is inspected (static type assertion + runtime key scan of `boxes`/`arrows`/`legend`).
- **Then** it contains **zero** coordinate/pixel fields — no `x`, `y`, `width`, `height`, `px`, or layout geometry anywhere; the only positional datum is each arrow's ICOM `side ∈ {left, top, right, bottom}` (a role convention, not pixels).

#### Scenario: E-EMPTY empty / all-dropped input
- **Given** an empty `RawSnapshot` (no nodes), and separately a snapshot whose every node is dropped by `port()` (each lacks both `id` and `title`).
- **When** the full pipeline runs on each.
- **Then** the core returns an empty forest, an empty `Idef0Diagram`, and an empty `Outline` with **no throw**; `structuralSignature` is a stable, deterministic empty-forest signature (identical across runs and across the two empty inputs); and the `dropped` tally equals the count of all-dropped nodes.

#### Scenario: E-CYCLE deterministic refines-cycle break
- **Given** a `refines` cycle (e.g. `A→B`, `B→C`, `C→A`).
- **When** `buildDecompForest` runs.
- **Then** the cycle is broken deterministically at the **lexicographically-lowest composite key** in the cycle, the broken back-edge is marked `provenance == "derived"`, and the remaining forest is acyclic.
- **And** the break point and resulting forest are identical across input array reorderings (determinism, INV-8).

#### Scenario: E-UNKNOWN-RELATION non-canonical relation
- **Given** an edge whose `relation` string is not one of the five canonical relations (e.g. `"mentions"`).
- **When** `port()` / `classifyIcom` process it.
- **Then** it is classified to a **defined**, `derived`, **non-structural** role — never `null`, never a tree (parent/child) edge — and is surfaced; the canonical five never reach this path.

#### Scenario: E-MISSING-IDENTITY degraded key
- **Given** a node with `id` present but `title` missing, and (as a contrast) a node lacking both `id` and `title`.
- **When** `port()` normalises the snapshot.
- **Then** the `id`-only node is **retained** with composite key `(id, "")` and `degradedKey == true` (it is **not** dropped); the node lacking both is dropped and counted in `dropped` (E-MISSING-IDENTITY).

## Non-Functional Requirements

### NFR-001 — Purity & determinism
- **Category**: reliability
- **Threshold**: 0 nondeterministic sources inside the core; ≥100 repeated runs of a fixed
  `DecompInput` yield 1 distinct `structuralSignature`.
- **Measurement**: property test (repeat-run signature equality) + static scan for `Date`/`Math.random`/I/O in `shared/lib/idef0/`.

### NFR-002 — Scale
- **Category**: performance
- **Threshold**: deterministic pipeline completes within the interactive frame budget at
  **N ≥ 1000** artifacts; exact budget = TBD (bound by the T1 pseudocode/Big-O step, Q4).
- **Measurement**: micro-benchmark of `buildDecompForest`+`assignNodeNumbers`+`flattenOutline` at N=1000.

### NFR-003 — FSD boundary & no shared mutation
- **Category**: maintainability
- **Threshold**: 0 imports from `widgets/` in `shared/lib/{idef0,tier}/`; 0-byte diff on the
  exported `HIERARCHY_RELATIONS` value and the `normaliseHierarchyEdge` function (symbol-granular),
  independent of other edits to their enclosing files.
- **Measurement**: static import-graph check + a focused snapshot/AST test that extracts and
  compares just the `HIERARCHY_RELATIONS` literal and the `normaliseHierarchyEdge` function body
  (not a whole-file `git diff`, which the tier-lift legitimately changes).

### NFR-004 — Reuse-not-fork
- **Category**: maintainability
- **Threshold**: ≥2 surfaces render from the single core; `buildDecompForest`/`computeIdef0Diagram`/`classifyIcom` exist in exactly one module (0 duplicates in hosts).
- **Measurement**: test asserting the core symbols are imported, not re-implemented, by each host (EPIC Outcome 5).

## Constraints

### Technical
- Svelte 5 runes are a host concern; the core is framework-free pure TS.
- Token-only dual-theme is a host concern; the legend is a **data** descriptor, unstyled in core.
- forgeplan#397: identity fields/`nodes` absent in 0.33 JSON → composite `(id,title)` is the only
  stable key (INV-7).
- Pure core (rule 22): no `spawn`, no mutation, no new `/api/*` endpoint.

### Business
- This SPEC is the **keystone** for EPIC-001 Phase 1; it gates T2 / T4 / T5.

### Regulatory (project rules)
- rule 24 / FSD: `shared/` cannot import `widgets/` (lift target `shared/lib/tier/`).
- rule 11: all MUST sections filled; the downstream EvidencePack MUST carry
  `## Structured Fields` (verdict / congruence_level / evidence_type) or R_eff collapses to 0.1.
- rule 12: forgeplan writes happen one artifact at a time (PROB-060 lance race).

## SMART Acceptance Criteria

1. **AC-1 (tier byte-identity)**: a committed regression test compares pre/post-lift
   `typeTier` + `compactTierMap` over all 9 `TYPE_ORDER` kinds + ≥2 unknowns; **metric** = byte-diff,
   **threshold** = 0, **horizon** = before T1 core merge (GATE-0, Phase 1).
2. **AC-2 (ICOM totality + no-drop + no-mutation)**: a property test over the 5 canonical relations
   asserts a defined `IcomClass`, `informs⇒mechanism`, `based_on` non-null; **metric** = relations
   hitting the default branch **plus** symbol-granular byte-diff of the exported `HIERARCHY_RELATIONS`
   value + `normaliseHierarchyEdge` function (not whole-file), **threshold** = 0 + 0,
   **horizon** = T1 core merge.
3. **AC-3 (one-parent + honesty)**: on the dogfood ForgePlanWeb snapshot,
   `count(nodes with >1 structural parent) == 0` **and**
   `count(edges marked real that are not authored source edges) == 0`; **horizon** = GATE-A (Phase 2 entry).
4. **AC-4 (numbering stability)**: ≥100 random input reorderings of a fixed node set yield identical
   A-number assignment; **metric** = numbering diffs, **threshold** = 0; an id-collision fixture
   surfaces both nodes; **horizon** = T1 core merge.
5. **AC-5 (determinism)**: the same `DecompInput` hashed across ≥100 runs yields identical
   `structuralSignature`; **metric** = distinct signatures, **threshold** = 1; **horizon** = T1 core merge.
6. **AC-6 (metadata sufficiency)**: a test renders boxes + arrows from an `Idef0Diagram` alone (no
   forest / raw-edge / `classifyIcom` access) and asserts every box has a `number` and every arrow
   has a `side` + `provenance`; **metric** = boxes lacking number + arrows lacking side/provenance,
   **threshold** = 0; **horizon** = T1 core merge.

## Open Questions

- Q1: the `densityGate` numeric **threshold value** only (the density-metric definition + direction
  + the `N ≤ 2 ⇒ tier-stack` gate are now frozen in-SPEC under INV-6 / FR-004; the T1
  pseudocode/Big-O step proposes 0.3) — owner: T1 core-RFC.
- Q2: exact ICOM letter for `based_on` / `supersedes` / `contradicts` (Input vs Control vs Output)
  — owner: projection/relation-table ADR. (Informing input, non-binding: the T1 pseudocode proposes
  `based_on ⇒ input`, `supersedes`/`contradicts ⇒ control`; the final letters remain the ADR's call.)
- Q3: deterministic tie-break order for `E-MULTI-PARENT` (tier-then-key vs key-only) — owner: T1 core-RFC.
- Q4: the N≥1000 interactive frame-budget number for NFR-002 — owner: T1 pseudocode/Big-O step.

## Related Artifacts

- **EPIC-001** — parent; this SPEC `refines` it. Listed as the T1 "SPEC TADD+ICOM" keystone child.
- (planned) **RFC T1** — shared TADD decomposition core (`shared/lib/idef0`); consumes these scenarios.
- (planned) **ADR — tier-vocabulary lift** → `shared/lib/tier/` (behaviour-preserving); satisfies FR-001 / AC-1.
- (planned) **ADR — projection / relation-table**: `idef0` = IDEF0-STYLE projection; `informs` = Mechanism; local relation→ICOM table; owns Q2.
- **PROB-060 / forgeplan#397** — identity-field-omission basis for the composite-key INV-7.
- Lift source (bytes frozen by INV-9): `template/src/widgets/dependency-graph/lib/type-tier.ts` + `cluster.svelte.ts`.






