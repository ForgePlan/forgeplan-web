---
depth: standard
id: ADR-006
kind: adr
last_modified_at: 2026-07-01T09:59:40.952234+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EPIC-001
  relation: based_on
- target: SPEC-004
  relation: based_on
status: active
title: Behaviour-preserving tier-vocabulary lift to shared/lib/tier
---

## Status

draft — pending guardian activation gate (EVIDENCE not yet linked; R_eff == 0 by design at draft).

Parent: EPIC-001 (T1 track). Conformance contract: SPEC-004 (INV-1, INV-9, FR-001, NFR-003, AC-1).

## Context

EPIC-001 builds ≥2 host renderers on one pure decomposition core (`template/src/shared/lib/idef0/`, the T1 keystone). SPEC-004 freezes that core's conformance contract. Before the core can exist, it needs the artifact-tier vocabulary — `TYPE_ORDER`, `typeTier`, `compactTierMap` — which today lives **inside a widget**:

- `TYPE_ORDER` is declared `as const` at `template/src/widgets/dependency-graph/lib/cluster.svelte.ts:8-18` = `[epic, prd, spec, rfc, adr, evidence, note, problem, solution]` (verified on `develop`; plain array literal, lift-safe).
- `typeTier` / `compactTierMap` are at `template/src/widgets/dependency-graph/lib/type-tier.ts:13-38`.

FSD rule 24 forbids `shared/` importing from `widgets/`. The T1 core lives in `shared/lib/idef0/` and needs this vocabulary, so `shared/` cannot legally reach up into `widgets/dependency-graph/lib/`. SPEC-004 INV-1 makes the lift a frozen invariant: the vocabulary must live in `shared/lib/tier/`, widgets re-export from there, and behaviour must be **byte-identical** to the pre-lift widget version.

Two hard facts shape the safe path, both verified against `develop`:

1. **Direct-import blast radius.** The tier vocabulary has multiple consumers: `type-tier.ts`, `tree-layout.ts`, `sankey-layout.ts`, `sunburst-layout.ts`, and `TreeView.svelte` (via `kindTierLayer`). Critically, `SankeyView.svelte:35` imports `TYPE_ORDER` **directly from `../lib/cluster.svelte`**, not via `type-tier.ts`. Any lift that moves the `TYPE_ORDER` declaration out of `cluster.svelte.ts` without leaving a re-export shim **breaks `SankeyView` silently**.

2. **What must NOT move.** `HIERARCHY_RELATIONS` and `normaliseHierarchyEdge` (also in the `dependency-graph/lib` surface) are depended on by the 7 existing hierarchical views and carry the well-known inverting/dropping semantics (SPEC-004 hazard 2: `normaliseHierarchyEdge` inverts `refines`/`informs` and drops `based_on`/`contradicts`). The idef0 core deliberately ships its own local `idef0-relation.ts` instead (owned by the sibling projection/relation-table ADR). Those two symbols stay byte-identical at symbol granularity (SPEC-004 INV-9 / NFR-003) — explicitly **out of scope** for this lift.

The risk this ADR must contain: a silent "altitude" shift across all 7 hierarchical views if `typeTier`/`compactTierMap` behaviour drifts by even one index during relocation (EPIC-001 High risk row: "tier-lift молча сдвигает altitude всех hierarchical-видов").

C4 note: no system-context/container diagram is dispatched — the change is a pure-TS module relocation inside a single package (no deployed container topology to draw); the module boundaries are already enumerated by SPEC-004 INV-1/INV-9 and the verified `develop` ground truth above.

## Decision Drivers

- **DR-1 (FSD legality, hard):** `shared/lib/idef0/` MUST NOT import from `widgets/` (rule 24). The core is blocked until the vocabulary is reachable from `shared/`.
- **DR-2 (behaviour preservation, hard):** `typeTier`/`compactTierMap` outputs must be byte-identical pre/post-lift over all 9 `TYPE_ORDER` kinds + ≥2 unknown kinds (SPEC-004 AC-1, golden-snapshot diff = 0).
- **DR-3 (no silent consumer breakage):** every existing consumer — including the **direct** `SankeyView.svelte:35 → cluster.svelte` import — must keep resolving `TYPE_ORDER` after the lift.
- **DR-4 (single source of truth):** the vocabulary must have exactly one authoritative definition; forks drift.
- **DR-5 (scope containment):** `HIERARCHY_RELATIONS` + `normaliseHierarchyEdge` must NOT be moved or altered (SPEC-004 INV-9 / NFR-003, symbol-granular byte-identity); their inverting/dropping semantics are the 7 views' contract and are handled separately by the sibling ADR's local table.
- **DR-6 (reversibility posture):** this is a module relocation (semi-irreversible); the chosen option should make rollback and behaviour-equivalence cheap to prove.

## Considered Options

### Option 1 — Lift to `shared/lib/tier/`, widgets re-export (with a `cluster.svelte.ts` shim)
Move `TYPE_ORDER`, `typeTier`, `compactTierMap` to a new `template/src/shared/lib/tier/` module. Every prior home becomes a thin re-export: `type-tier.ts` re-exports from `@/shared/lib/tier`, and `cluster.svelte.ts` re-exports `TYPE_ORDER` from `@/shared/lib/tier` so the direct `SankeyView.svelte:35` import keeps resolving. `HIERARCHY_RELATIONS` / `normaliseHierarchyEdge` stay put, untouched.
- **Pros:** satisfies DR-1 (core imports from `shared/`); one source of truth (DR-4); re-export shims preserve every consumer incl. the direct Sankey import (DR-3); byte-identity is directly testable (DR-2); scope stays off the relation table (DR-5).
- **Cons:** touches several files (new module + 2 re-export shims); a shim later "cleaned up" by a well-meaning contributor re-breaks Sankey (→ guarded by a regression test); module relocation is semi-irreversible (DR-6).

### Option 2 — Leave vocabulary in the widget, relax/exempt FSD rule 24 for the core
Keep the vocabulary in `widgets/dependency-graph/lib/` and grant `shared/lib/idef0/` a rule-24 exemption to import upward from `widgets/`.
- **Pros:** zero code movement; no consumer churn; trivially reversible.
- **Cons:** inverts the dependency direction FSD exists to protect — `shared` (lowest layer) would depend on `widgets` (upper layer), making `widgets` un-removable and poisoning every future `shared` consumer; dissolves rule 24 by precedent; violates SPEC-004 INV-1 (which freezes the lift, not an exemption). Rejected on architecture grounds.

### Option 3 — Duplicate the vocabulary in `shared/lib/tier/` (fork), leave widget copy as-is
Copy `TYPE_ORDER`/`typeTier`/`compactTierMap` into `shared/lib/tier/` for the core; the widget keeps its own copy.
- **Pros:** core gets a legal `shared/` source immediately; zero risk to existing consumers (they never change); no shim needed.
- **Cons:** two definitions of the same "altitude" ladder → guaranteed drift (DR-4 fail); the EPIC's own High risk ("tier-lift silently shifts altitude") is not mitigated but doubled; SPEC-004 INV-1 wants one lifted source with widgets re-exporting, not a fork; violates NFR-004 (reuse-not-fork) in spirit.

### Option 4 — Do nothing (status quo): keep the vocabulary in the widget, build no lift
Leave everything where it is. The T1 core either cannot be built (FSD blocks it) or must reach into `widgets/` ad-hoc.
- **Pros:** no work, no risk to the 7 current views today.
- **Cons:** blocks the EPIC-001 T1 keystone entirely (DR-1 unsatisfiable); pushes the FSD violation or a fork into the core-RFC where it is harder to review; SPEC-004 INV-1 remains unsatisfiable. The null baseline the ADI must beat.

## Decision

Adopt **Option 1 — lift `TYPE_ORDER`, `typeTier`, and `compactTierMap` to a new `template/src/shared/lib/tier/` module, and make every prior home a thin re-export shim**, specifically including a `TYPE_ORDER` re-export from `cluster.svelte.ts` so the direct `SankeyView.svelte:35` import keeps resolving. `HIERARCHY_RELATIONS` and `normaliseHierarchyEdge` are **excluded** from the lift and stay byte-identical at symbol granularity.

This lift is gated by a **hard acceptance criterion** (SPEC-004 FR-001 / AC-1):

1. A byte-identical regression test of `typeTier` + `compactTierMap` over all 9 `TYPE_ORDER` kinds **plus ≥2 unknown kinds** (golden-snapshot diff = 0).
2. Because `SankeyView.svelte:35` imports `TYPE_ORDER` directly from `cluster.svelte`, the lift MUST keep a re-export shim in `cluster.svelte.ts` (`export { TYPE_ORDER } from "@/shared/lib/tier"`), and a test MUST assert `SankeyView` still resolves `TYPE_ORDER` post-lift — otherwise Sankey breaks silently.
3. A static import-graph check confirms `shared/lib/tier/` imports **nothing** from `widgets/` (rule 24).
4. A symbol-granular snapshot/AST test confirms the exported `HIERARCHY_RELATIONS` value and the `normaliseHierarchyEdge` function are **0-byte-diff** vs their pre-T1 form (SPEC-004 INV-9 / NFR-003) — not a whole-file diff, since the enclosing files legitimately change for the re-export.

## Invariants (must never be violated)

- **I-1:** `shared/lib/tier/` has **zero** imports from `widgets/` (FSD rule 24 / SPEC-004 INV-1).
- **I-2:** `typeTier` and `compactTierMap` are byte-identical in output to their pre-lift widget behaviour for every kind (SPEC-004 AC-1); the altitude ladder never shifts by relocation.
- **I-3:** Exactly **one** authoritative definition of `TYPE_ORDER`/`typeTier`/`compactTierMap` exists (in `shared/lib/tier/`); all other appearances are re-exports, never copies (no fork).
- **I-4:** A `cluster.svelte.ts` re-export of `TYPE_ORDER` always exists so `SankeyView.svelte:35` resolves it; removing the shim without repointing Sankey is forbidden.
- **I-5:** The exported `HIERARCHY_RELATIONS` value and `normaliseHierarchyEdge` function are unchanged at symbol granularity (SPEC-004 INV-9 / NFR-003); this lift never touches relation semantics.

## Preconditions (true before implementing)

- PROB-060 has landed / the working tree is clean enough that the lift is not entangled with an in-flight merge (EPIC-001 reindex sequencing note).
- The pre-lift `typeTier`/`compactTierMap` golden snapshot is captured first, so the byte-identity diff has a baseline (AC-1 baseline before GATE-0).
- A `shared/lib/` layer exists to receive `tier/` (FSD layout).

## Postconditions (true after implementing)

- `template/src/shared/lib/tier/` exports `TYPE_ORDER`, `typeTier`, `compactTierMap`.
- `type-tier.ts` and `cluster.svelte.ts` re-export those symbols; all 5 tier-vocab consumers + `SankeyView` still resolve them.
- The four acceptance tests (byte-identity, Sankey resolution, import-graph, symbol-diff) are committed and green — this is the EVIDENCE the guardian requires for activation.
- `HIERARCHY_RELATIONS` / `normaliseHierarchyEdge` symbol-diff = 0.

## Affected Files / modules

- **New:** `template/src/shared/lib/tier/` (module + barrel) — authoritative home of the vocabulary.
- **Edited (→ re-export shim):** `template/src/widgets/dependency-graph/lib/type-tier.ts`; `template/src/widgets/dependency-graph/lib/cluster.svelte.ts` (must retain a `TYPE_ORDER` re-export).
- **Unchanged but consuming (verify still resolve):** `tree-layout.ts`, `sankey-layout.ts`, `sunburst-layout.ts`, `TreeView.svelte` (`kindTierLayer`), and `SankeyView.svelte:35` (direct `TYPE_ORDER` import).
- **Explicitly untouched (symbol-frozen):** `HIERARCHY_RELATIONS` + `normaliseHierarchyEdge` wherever they live in `dependency-graph/lib`.
- **Downstream consumer (why this exists):** `template/src/shared/lib/idef0/` (the T1 core) imports the vocabulary from `shared/lib/tier/`.

## Decision Outcome

Chosen option: **Option 1 (lift with re-export shims)**, because it is the only option that satisfies both *hard* drivers simultaneously — FSD legality (DR-1) and no silent consumer breakage (DR-3) — while keeping the relation table isolated (DR-5).

`forgeplan_reason` (FPF ADI, gemini-3-flash-preview, 2026-07-01) returned three hypotheses and recommended Option 1 at **High** confidence:

- **H1 = Option 1 (lift + re-export shims)** — recommended. "The only approach that satisfies the hard drivers of FSD legality (DR-1) and consumer preservation (DR-3) simultaneously… specifically addresses the SankeyView.svelte:35 hazard while keeping the relation-table (HIERARCHY_RELATIONS) isolated as per SPEC-004 INV-9." The ADI explicitly named the residual risk: "future 'cleanup' of shims might re-introduce the SankeyView breakage if not guarded by tests" — mitigated here by acceptance criterion (2).
- **H2 = atomic import migration (move + rewrite all consumer imports, delete old files)** — Medium confidence. Cleaner end-state (no shims) but "high risk of breaking the 7 hierarchical views if a single import is missed," and the direct `SankeyView` import is exactly the kind of non-standard path a global rewrite misses. Deferred as an optional future cleanup, gated on the same regression suite, never as the initial move.
- **H3 = build-time path aliasing (Vite/tsconfig alias old widget paths → new shared paths)** — Low confidence. Pushes "magic" into the build layer, contradicts the reversibility posture (DR-6), and complicates SPEC-004 conformance verification. Rejected.

The ADI's recommended evidence maps directly onto this ADR's acceptance criteria: a Vitest strict-equality suite importing `TYPE_ORDER` from both the new `shared/` path and the old widget shim, plus a guard that `normaliseHierarchyEdge` stays in `widgets/` and does not import from `shared/tier` (no scope creep). Those become the EVIDENCE the guardian will require before activation.

## Consequences

### Positive
- `shared/lib/idef0/` (the T1 keystone) gains a legal, single-source tier vocabulary; EPIC-001 T1 is unblocked without an FSD exemption.
- One authoritative definition of the altitude ladder (DR-4); the EPIC's High "silent altitude shift" risk is contained by the byte-identical golden test rather than merely hoped away.
- Every existing consumer — including the fragile direct `SankeyView.svelte:35` import — keeps working via re-export shims; the 7 hierarchical views are behaviourally untouched.
- The relation table (`HIERARCHY_RELATIONS` / `normaliseHierarchyEdge`) stays exactly where the 7 views expect it, byte-identical (INV-9), cleanly separating this lift from the sibling ADR's local-table decision.

### Negative
- **Shim fragility (named by the ADI):** the `cluster.svelte.ts` `TYPE_ORDER` re-export looks like dead code to a future contributor; deleting it silently breaks `SankeyView`. Mitigation is load-bearing: a committed test asserting `SankeyView` resolves `TYPE_ORDER` post-lift, plus a `rule-24-shim` marker comment at the shim (per the comments policy) explaining why it must stay.
- **Semi-irreversible relocation (DR-6):** rolling the module back to the widget requires a superseding ADR that moves the files and re-points imports. The byte-identical test makes the *behaviour* equivalence trivial to prove in either direction, so the cost is mechanical, not semantic — but it is not a one-command revert.
- **Wider surface than a fork or a no-op:** the change edits a new module + ≥2 shims + adds tests; more review surface than Option 3/4 (accepted, because Option 3 doubles drift risk and Option 4 blocks the EPIC).

### Neutral
- Import paths for the vocabulary change from `widgets/dependency-graph/lib/*` to `@/shared/lib/tier` for new code; old paths keep working through shims, so migration of consumers is optional and incremental (this is the ADI's H2, deferred).
- Trust posture at draft: F (frozen SPEC-004 invariants + verified `develop` ground truth) and G (FSD rule 24, direct-import fact) are strong; R (reliability) is pending the regression EVIDENCE. This is why the ADR ships `draft` with R_eff == 0 and the guardian gates activation once the byte-identical + Sankey-resolution + import-graph + symbol-diff tests are linked as EVIDENCE.

## Rollback Plan (if the decision fails)

- **Trigger:** the byte-identity golden test fails (altitude drift), or a consumer (esp. Sankey) fails to resolve `TYPE_ORDER`, or the symbol-diff on `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge` is non-zero.
- **Immediate (pre-merge):** the failing acceptance test blocks the PR; revert the branch — because behaviour equivalence is proven by test, a `git revert` of the lift commit restores the exact prior state with no behavioural residue.
- **Post-merge:** author a **superseding ADR** that moves the vocabulary back into `widgets/dependency-graph/lib/` (or to whatever new home is chosen) and re-points imports; keep the byte-identical golden test as the equivalence proof across the move. This is the DR-6 semi-irreversibility cost, made cheap by the test. `supersede`, never delete.
- **Data safety:** none at risk — the core is pure, read-only, no `/api/*` mutation, no workspace writes.

## Related Decisions

- **EPIC-001** — parent (T1 track); this ADR is `based_on` it.
- **SPEC-004** — frozen conformance contract; this ADR is `based_on` it (satisfies INV-1, INV-9, FR-001, NFR-003, AC-1).
- **Sibling ADR (idef0 = IDEF0-STYLE projection; informs = Mechanism; local relation→ICOM table)** — owns the local `idef0-relation.ts` and the explicit reason `HIERARCHY_RELATIONS` / `normaliseHierarchyEdge` are NOT part of this lift.

## References

- `template/src/widgets/dependency-graph/lib/cluster.svelte.ts:8-18` — `TYPE_ORDER` declaration (lift source).
- `template/src/widgets/dependency-graph/lib/type-tier.ts:13-38` — `typeTier` / `compactTierMap` (lift source).
- `template/src/widgets/dependency-graph/ui/SankeyView.svelte:35` — direct `TYPE_ORDER` import (shim-critical consumer).
- Additional tier-vocab consumers: `tree-layout.ts`, `sankey-layout.ts`, `sunburst-layout.ts`, `TreeView.svelte` (`kindTierLayer`).
- SPEC-004 §Frozen invariants INV-1 / INV-9, §FR-001, §NFR-003, §SMART AC-1.
- FPF ADI: `forgeplan_reason ADR-006` (gemini-3-flash-preview, 2026-07-01) — recommendation Option 1, High confidence.




