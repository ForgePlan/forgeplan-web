---
depth: standard
id: ADR-007
kind: adr
last_modified_at: 2026-07-01T10:03:52.323061+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EPIC-001
  relation: based_on
- target: SPEC-004
  relation: based_on
status: active
title: idef0 = IDEF0-STYLE projection; informs = Mechanism; local relation-to-ICOM table
---

## Status

draft — pending guardian activation gate (EVIDENCE not yet linked; R_eff == 0 by design at draft).

Parent: EPIC-001 (T1/T2 track). Conformance contract: SPEC-004 (INV-2, INV-3, INV-5, INV-7, INV-10; FR-002, FR-003, FR-005, FR-006; Open Q2 owner).

## Context

EPIC-001's core (`template/src/shared/lib/idef0/`) derives a decomposition surface from the forgeplan artifact/decision graph and classifies forgeplan link relations into an ICOM (Input / Control / Output / Mechanism) grammar. SPEC-004 froze the *behaviour* (INV-2/3/5/7/10, the 12 scenarios) but deliberately left the **framing** and one classification detail to this ADR:

- **The framing fork.** IDEF0 (SADT) is a *process* modelling language: boxes are **functions/activities** that transform Inputs into Outputs under Controls, using Mechanisms. forgeplan artifacts are **documents/decisions**, not activities. So we must decide *what kind of thing* this surface is before we fix its grammar.
- **`informs` semantics.** SPEC-004 INV-2 froze `classifyIcom("informs") = mechanism` and that an `informs` edge never contributes a decomposition parent/child link — but the ADR must record *why* (informs = supporting means/resource, not a structural altitude edge) so downstream hosts don't quietly re-promote it to a tree edge.
- **The relation table.** The shared `normaliseHierarchyEdge` (in the dependency-graph widget) **inverts** `refines`/`informs` direction and its `HIERARCHY_RELATIONS` set **drops `based_on` and `contradicts`** (they fall through to `null`). If the core reuses that table, the structural spine loses every `based_on` edge and `informs` is mis-framed. ADR-006 already excluded that table from the tier-lift; this ADR decides the core ships its **own local `idef0-relation.ts`** with an explicit case per relation, never mutating the shared table.
- **Open Q2 (this ADR owns it).** SPEC-004 freezes only that `based_on`/`supersedes`/`contradicts` are each a *defined, deterministic, non-Mechanism* class; the exact ICOM **letter** (Input vs Control vs Output) is this ADR's call. The T1 pseudocode proposes `based_on ⇒ input`, `supersedes ⇒ control`, `contradicts ⇒ control` — **informing input, non-binding**.
- **Honesty + framing + identity** (SPEC INV-5 / INV-7 / IcomLegend): the surface must not render inferred structure as authored; A-numbering must survive poll/snapshot churn on the only stable key available (composite `(id,title)`, per forgeplan#397); and a persistent ICOM legend is the framing device that keeps the projection honest and readable.

C4 note: the core is a headless pure-TS library (no deployed containers, no geometry — SPEC INV-10/FR-007); no system-context/container diagram is dispatched. The relevant boundaries are the module boundary (local `idef0-relation.ts` vs shared `normaliseHierarchyEdge`) and the ICOM role vocabulary, both enumerated in this ADR and frozen by SPEC-004.

## Decision Drivers

- **DR-1 (honesty, EPIC Outcome 6 / SPEC INV-5):** never render synthetic/derived structure as real; the framing must be truthful about what the boxes are.
- **DR-2 (totality + no-drop, SPEC INV-3 / FR-002):** every canonical relation `{informs, based_on, supersedes, contradicts, refines}` maps via an explicit case; `based_on` must never silently drop; the default branch is unreachable for canonical relations.
- **DR-3 (no shared mutation, SPEC INV-9 / NFR-003):** the core must not mutate or re-point `HIERARCHY_RELATIONS` / `normaliseHierarchyEdge` (the 7 views' contract); it ships its own table.
- **DR-4 (informs is not structure, SPEC INV-2):** `informs` must classify as Mechanism and never create a tree parent/child edge.
- **DR-5 (comprehension, EPIC Vision/Outcome 3):** the grammar must give users a shared reading key (ICOM legend, altitude ladder) for very large projects.
- **DR-6 (deterministic identity, SPEC INV-7 / forgeplan#397):** A-numbering keys on composite `(id,title)`, order-invariant, id-collisions surfaced.
- **DR-7 (Q2 semantic fidelity):** the ICOM letter chosen for each of `based_on`/`supersedes`/`contradicts` must match its real relational meaning, not just fill a slot.

## Considered Options

### The framing fork

#### Option A — Full-conformant IDEF0 / SADT model (boxes are functions)
Model artifacts as IDEF0 activities with strict ICOM transformation semantics; aim for SADT conformance.
- **Pros:** rigorous, standard-conformant; reuses the full IDEF0 toolset/vocabulary verbatim.
- **Cons:** forgeplan boxes are documents/decisions, **not** functions that transform inputs into outputs — conformance would require inventing activity/transformation semantics that don't exist, i.e. fabricating structure. Directly violates DR-1 (honesty) and EPIC Outcome 6; huge modelling burden for a false model. Rejected.

#### Option B — IDEF0-STYLE projection (boxes are documents; borrow the grammar, not the ontology)
Treat the surface as a *projection* of the document/decision graph that **borrows** IDEF0's useful devices — ICOM arrow grammar as a relation→role mapping, ≤6-box decomposition pages, A-numbering, the altitude ladder — while being explicit (persistent legend + disclaimer) that it is **not** a conformant IDEF0/SADT process model.
- **Pros:** honest (DR-1) — never claims the boxes are functions; keeps the comprehension wins (DR-5: legend + altitude); matches the frozen SPEC language ("IDEF0-STYLE projection … not a conformant IDEF0 model") and every prior design note; `classifyIcom` becomes a reusable projection (candidate cartographer input).
- **Cons:** users who know IDEF0 may expect strict semantics — mitigated by the persistent legend/disclaimer framing (MVP-blocking); the ICOM letter for non-structural relations is a judgement call (Q2), not derivable from a process semantics.

#### Option C — Drop the IDEF0 metaphor (generic tiered decomposition, no ICOM)
Render a plain tiered decomposition tree with typed edges; no ICOM vocabulary, no legend.
- **Pros:** simplest, no metaphor-mismatch risk; trivially honest.
- **Cons:** loses the ICOM reading key and the altitude framing that is the EPIC's whole comprehension thesis (DR-5); loses reuse of `classifyIcom` as a cartographer input; the surface becomes yet-another-tree, weakening the "9th distinct view" rationale. Genuinely considered as the minimal-honest fallback; rejected for under-delivering the EPIC vision.

### Sub-decision: Q2 ICOM letters for the non-structural relations (all Option-B-dependent)

ICOM role semantics applied to a document-projection box (the box "produces" the artifact/decision):
- **`based_on`** — the target is a *foundation the artifact consumes and builds from*. That is **Input** (I, left): consumed/transformed material. (pseudocode: input)
- **`supersedes`** — the artifact exerts *authority over the lifecycle/validity* of the target (target becomes terminal). A governing constraint → **Control** (C, top): governs, not consumed. (pseudocode: control)
- **`contradicts`** — a conflict/caveat edge that *constrains how the target should be trusted*. A governing caveat → **Control** (C, top). (pseudocode: control)
- (frozen by SPEC, listed for the full table) **`refines` ⇒ decomposition** (the structural spine, the only tree edge); **`informs` ⇒ mechanism** (M, bottom, never a tree edge).

Alternative letters considered: `supersedes ⇒ output` (rejected — supersession does not *produce* the target, it governs its status); `contradicts ⇒ input` (rejected — a contradiction is not consumed foundation); a bespoke class for `contradicts` (impossible — `IcomClass` is fixed to `input|control|output|mechanism|decomposition`, and non-structural rules out decomposition, non-consumed rules out input, non-produced rules out output → Control is the residual honest fit).

## Decision

Adopt **Option B — an IDEF0-STYLE projection served by a local `idef0-relation.ts` table**, resolving Q2 as `based_on ⇒ Input`, `supersedes ⇒ Control`, `contradicts ⇒ Control`. Seven decisions are pinned:

1. **P-1 — idef0 is an IDEF0-STYLE PROJECTION, not a conformant SADT model.** Boxes are **documents/decisions**, not functions/activities. The surface borrows IDEF0's grammar (ICOM arrows, ≤6-box pages, A-numbering, altitude ladder) as a *reading projection* of the artifact graph; it makes no process-modelling conformance claim.
2. **P-2 — `informs` = ICOM Mechanism, NEVER a tree edge.** `classifyIcom("informs") = mechanism` (M, bottom); an `informs` edge never contributes a `buildDecompForest` parent/child link (SPEC INV-2). Rationale: `informs` is a *supporting means/resource* an artifact draws on, not a change in altitude.
3. **P-3 — a LOCAL `idef0-relation.ts` with an explicit case per canonical relation.** The core ships its own table with a defined case for each of `{informs, based_on, supersedes, contradicts, refines}`. It **never** falls through `normaliseHierarchyEdge`'s inverting default and **never** mutates the shared `HIERARCHY_RELATIONS` (SPEC INV-3 / INV-9). Non-canonical relations hit a defined `derived`, non-structural fallback (E-UNKNOWN-RELATION), never `null`, never a tree edge; the canonical five never reach it.
4. **P-4 — Q2 resolved (adopting the pseudocode proposal, on ICOM-semantic grounds):** `based_on ⇒ Input` (I, left; consumed foundation), `supersedes ⇒ Control` (C, top; governs the target's validity), `contradicts ⇒ Control` (C, top; governing caveat on trust). This is not a blind adoption — each letter is justified by its ICOM role meaning against a document-projection box (see the sub-decision above), and the residual-fit nature of `contradicts ⇒ Control` is recorded as a negative consequence.
5. **P-5 — honesty is edge-scoped.** `provenance` is per element kind: an **edge** is `real` only when it is an authored source edge (host renders **solid**); an **inferred** edge (multi-parent demotion, cycle-break back-edge, tier-stack edge) is `derived` (host renders **dashed `≈`**). A **node** — **roots included** — is `real` because it is an authored snapshot artifact, regardless of incoming-edge count (SPEC INV-5). No `derived` edge is ever mislabelled `real`.
6. **P-6 — a persistent ICOM legend is MVP-blocking framing.** The `IcomLegend` (roles present + `honestyKey {real: solid, derived: dashed ≈}`) is a *data descriptor* the core always emits and hosts must always render (including exports); it is the device that keeps the projection honest and legible (I← C↑ O→ M↓). Shipping the surface without the persistent legend is not MVP-complete.
7. **P-7 — A-numbering keys on composite `(id,title)`.** Because forgeplan 0.33 `get --json` omits `slug`/`id_display`/`id_canonical` and `graph --json` lacks `nodes` (forgeplan#397), the only stable identity is composite `(id,title)`. `assignNodeNumbers` is order-invariant on that key; id-collisions (same `id`, distinct title — the PROB-060 merge-dup case) are retained, distinguished, and flagged `idCollision`, never coalesced (SPEC INV-7 / FR-006).

### The frozen local table

| relation | IcomClass | ICOM side | structural (tree) edge? | authored-edge provenance |
|---|---|---|---|---|
| `refines` | `decomposition` | — (the spine) | yes — ≤1 parent per node | real |
| `informs` | `mechanism` | bottom (M↓) | **never** | real |
| `based_on` | `input` | left (I←) | never | real |
| `supersedes` | `control` | top (C↑) | never | real |
| `contradicts` | `control` | top (C↑) | never | real |
| non-canonical | defined `derived`, non-structural (E-UNKNOWN-RELATION) | — | never | derived |

## Invariants (must never be violated)

- **I-1 (P-2):** `classifyIcom("informs") == "mechanism"` and an `informs` edge produces no parent/child link — always.
- **I-2 (P-3/DR-3):** the exported `HIERARCHY_RELATIONS` value and `normaliseHierarchyEdge` function are byte-unchanged (symbol-granular); the core mutates neither and imports the local table instead.
- **I-3 (P-3/DR-2):** `classifyIcom` is total over the five canonical relations with an explicit case each; `based_on`/`contradicts` are never `null`/dropped; the default branch is unreachable for canonical relations.
- **I-4 (P-4):** the ICOM letters are fixed: `based_on→input`, `supersedes→control`, `contradicts→control`, `informs→mechanism`, `refines→decomposition`.
- **I-5 (P-5):** no `derived` edge is ever labelled `real`; authored nodes (roots included) are always `real`.
- **I-6 (P-6):** every emitted `Idef0Diagram` carries an `IcomLegend` enumerating the roles present + the `honestyKey`.
- **I-7 (P-7):** A-numbering is order-invariant on `(id,title)`; id-collisions are surfaced (`idCollision == true`), never coalesced.

## Preconditions (true before implementing)

- ADR-006's tier-lift target (`shared/lib/tier/`) exists so the core can compute tiers without importing widgets (FSD).
- SPEC-004 is the frozen contract (it is); the 12 `#### Scenario` blocks are the conformance oracle.
- The core is being built in `shared/lib/idef0/` as pure TS (no geometry, no DOM, no spawn) per rule 22 / SPEC FR-007.

## Postconditions (true after implementing)

- `shared/lib/idef0/idef0-relation.ts` exports the frozen table above; `classifyIcom` is total and explicit.
- The `Idef0Diagram` carries per-arrow `side` + `edge.provenance` and per-box `number` (INV-10 metadata sufficiency), plus a persistent `IcomLegend`.
- The SPEC-004 scenarios `classifyIcom case-per-relation incl. based_on`, `informs=Mechanism`, `honesty real-vs-derived`, `(id,title) numbering stability`, `E-UNKNOWN-RELATION`, and `INV-10 headless metadata sufficiency` are covered by committed tests — the EVIDENCE the guardian requires.
- A regression guard asserts `normaliseHierarchyEdge("from","to","based_on") === null` while `classifyIcom("based_on") !== null` (the no-drop contrast) and `HIERARCHY_RELATIONS` is byte-unchanged.

## Affected Files / modules

- **New:** `template/src/shared/lib/idef0/idef0-relation.ts` (the local table + `classifyIcom`); consumed by `buildDecompForest`, `computeIdef0Diagram`, and the `IcomLegend` emitter within `shared/lib/idef0/`.
- **Explicitly untouched (symbol-frozen, SPEC INV-9):** `normaliseHierarchyEdge` + `HIERARCHY_RELATIONS` in `template/src/widgets/dependency-graph/lib/`.
- **Downstream hosts (consume the projection, do not re-classify):** the T2 `idef0` view and any T4 composed-map / builder surfaces — they render from `Idef0Diagram` + `IcomLegend` (INV-10), never re-deriving classification or numbering.

## Decision Outcome

Chosen option: **Option B (IDEF0-STYLE projection) with a local `idef0-relation.ts`**, and Q2 resolved as **`based_on ⇒ Input`, `supersedes ⇒ Control`, `contradicts ⇒ Control`** — because it is the only framing that satisfies the honesty driver (DR-1) without discarding the comprehension grammar (DR-5), and the Q2 letters are the most faithful ICOM roles available in the fixed vocabulary (DR-7).

`forgeplan_reason` (FPF ADI, gemini-3-flash-preview, 2026-07-01) returned three hypotheses and recommended exactly this at **High** confidence:

- **H1 = Option B (the "Projectionist" approach)** — recommended: "avoids fabricating transformation logic … while retaining IDEF0's cognitive benefits (A-numbering, 6-box limit)"; "aligns with SPEC-004 terminology and the headless pure-TS constraint."
- **H2 = local isolation (`idef0-relation.ts`)** — High confidence: "directly addresses ADR-006 exclusions and SPEC INV-9"; the core "becomes a pure consumer of the graph, immune to changes in the dependency-graph widget's hierarchy logic." The ADI flagged the residual risk of *logic drift* if a future relation is added to only one of the two tables → mitigated by the totality test (I-3) and a "new relation ⇒ update the local table" checklist item.
- **H3 = the Q2 semantic mapping (`based_on→Input`, `supersedes`/`contradicts`→Control)** — Medium-High confidence: "logically sound within the constraints of the ICOM grammar, though `contradicts` as Control is a residual fit." The ADI raised a concrete evidence need — validate that `contradicts` Control (top-entry) arrows do not create visual cycles that break the altitude ladder — recorded below as a negative consequence + a scenario the host layer must cover.

The ADI's recommended evidence (persistent legend rendered in all states incl. exports; contradicts-loop safety) is folded into the postconditions and the T2-host test surface, and becomes part of the EVIDENCE the guardian will require.

## Consequences

### Positive
- **Honest by construction (DR-1):** the surface never claims documents are functions; edge-scoped provenance + the persistent legend make real-vs-derived unmistakable (solid vs dashed `≈`).
- **`based_on` is recovered (DR-2):** the local table gives `based_on` a defined ICOM role (Input) instead of the shared table's silent `null` drop — directly restoring structural-spine visibility the EPIC's index-fidelity outcome depends on.
- **Zero blast radius on the 7 views (DR-3):** shipping a local table means `HIERARCHY_RELATIONS` / `normaliseHierarchyEdge` are untouched; the existing views keep their exact semantics.
- **Comprehension grammar retained (DR-5):** ICOM legend + altitude ladder + A-numbering give large-project navigation a shared reading key; `classifyIcom` is reusable as a future cartographer input.
- **Stable identity under churn (DR-6):** composite `(id,title)` numbering survives poll reordering/snapshot and surfaces id-collisions rather than hiding them.

### Negative
- **`contradicts ⇒ Control` is a residual fit (named by the ADI).** `contradicts` is more symmetric/mutual than a directed Control arrow implies, and mapping it to a top-entry Control arrow "might imply a hierarchy of authority that isn't always present." Accepted because `IcomClass` is a closed vocabulary (no room for a bespoke class) and Control is the least-wrong of {input, control, output}; the relation label + `provenance` still disambiguate it from `supersedes` in the data. Revisit if user testing shows the Control framing misleads.
- **Contradicts-loop / altitude risk (ADI evidence need).** A `contradicts` cycle rendered as Control arrows could create visual cycles that fight the altitude ladder. Mitigation: `contradicts` is non-structural (never a tree edge, I-1/I-3), so it cannot break the `refines` spine's acyclicity; the host must still route Control arrows so a contradicts-loop reads as a caveat, not a hierarchy — a T2-host test asserts this.
- **Metaphor-mismatch for IDEF0 experts.** A strict-SADT reader may expect transformation semantics. Mitigation is the MVP-blocking persistent legend + disclaimer (P-6); this is a framing cost, not a data cost.
- **Two relation tables to keep in sync.** Adding a new forgeplan relation means updating both the shared widget logic and the local `idef0-relation.ts`. Mitigation: the totality test (I-3) fails loudly if a canonical relation lacks an explicit case.

### Neutral
- The Q2 letters are a **data** decision, not a structural one: because `Idef0Diagram` carries the role per arrow (INV-10), re-lettering a relation later is a table edit + legend update + test refresh, not a change to forest shape or numbering — this bounds the reversibility cost (see Rollback).
- `refines ⇒ decomposition` and `informs ⇒ mechanism` are inherited frozen from SPEC-004 INV-2, restated here for a complete table; this ADR does not re-open them.
- Trust posture at draft: F (frozen SPEC invariants) and G (ICOM grammar + forgeplan#397 identity facts) are strong; R (reliability) is pending the conformance-scenario EVIDENCE — hence `draft` / R_eff == 0, guardian-gated.

## Rollback Plan (if the decision fails)

- **Trigger:** user testing shows the IDEF0-STYLE framing misleads (P-1), or a Q2 letter is judged semantically wrong (e.g. `contradicts` Control confuses readers), or the totality/no-mutation tests fail.
- **Q2 re-letter (cheap):** because roles live in one `idef0-relation.ts` table and the diagram carries the role as data (INV-10), changing a letter is a single-table edit + `IcomLegend`/host-legend update + re-run of the `classifyIcom case-per-relation` scenario. No forest/numbering change. Reversible in-code, no data migration.
- **Framing rollback (stickier):** dropping the IDEF0 metaphor (→ Option C) is a superseding ADR that removes the ICOM legend/vocabulary from the host while the pure core (forest + numbering + provenance) stays intact — the honesty and identity machinery survive a metaphor change. `supersede`, never delete.
- **No-mutation guarantee means safety:** since the core never touched `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge`, any rollback here cannot regress the 7 existing views. No `/api/*` mutation, no workspace writes — nothing to unwind outside the core module.

## Related Decisions

- **EPIC-001** — parent; `based_on`.
- **SPEC-004** — frozen conformance contract; `based_on` (owns Q2 per SPEC Open Questions; this ADR resolves it).
- **ADR-006 (tier-vocabulary lift)** — sibling; excluded the relation table from the lift, which this ADR complements by shipping the local `idef0-relation.ts`. Together they keep the shared widget table byte-frozen while giving the core a legal, honest, total classification path.

## References

- SPEC-004 §Frozen invariants INV-2/INV-3/INV-5/INV-7/INV-10; §FR-002/003/005/006; §Errors E-UNKNOWN-RELATION; §Open Questions Q2.
- Shared table (must not mutate): `normaliseHierarchyEdge` / `HIERARCHY_RELATIONS` in `template/src/widgets/dependency-graph/lib/`.
- Design provenance (memory bank): idef0 = IDEF0-STYLE projection; persistent ICOM legend I← C↑ O→ M↓; local `idef0-relation.ts`; density-gate honest tier-stack fallback; A3 two-pane outline + ICOM diagram.
- FPF ADI: `forgeplan_reason ADR-007` (gemini-3-flash-preview, 2026-07-01) — recommendation Option B + local table + Q2 (based_on→Input, supersedes/contradicts→Control), High confidence.






