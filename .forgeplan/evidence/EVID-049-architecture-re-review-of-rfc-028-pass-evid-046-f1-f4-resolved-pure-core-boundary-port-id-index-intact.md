---
depth: standard
id: EVID-049
kind: evidence
last_modified_at: 2026-07-01T11:11:05.508404+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-028
  relation: informs
status: active
title: 'Architecture re-review of RFC-028: PASS — EVID-046 F1–F4 resolved; pure-core boundary + port() id-index intact'
---

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit
review_verdict: PASS

(`supports` = this re-review verifies every prior fitness gap against the frozen SPEC-004 contract is genuinely closed in the CURRENT RFC-028 body and the design is architecturally sound and safe to gate; this is the first `supports` EVID on the RFC and the one that can lift R_eff off the all-`weakens` prior audits. CL3 = review performed directly on the real stored artifacts — RFC-028 body via `forgeplan_get` + the on-disk git-tracked markdown + the frozen SPEC-004 — same context. `audit` = architecture-fitness audit, no code executed; the core is still un-built by design.)

## Verdict

**PASS**

- **PASS** — no findings at or above LOW survive the gate; all four EVID-046 findings (F1–F4) are genuinely resolved in the current RFC-028 body (verified in the actual sections + invariants + fixtures, not merely asserted in the reconciliation table), the resolutions honor the frozen SPEC-004 contract, and no new architectural-fitness regression was introduced. ← this review.
- **CONCERNS** — would apply if any F1–F4 were only claimed-resolved in the table but not realized in the body, or a new MEDIUM+ gap appeared. Not the case.
- **BLOCKER** — would apply on a CRITICAL gap or a claim-vs-reality gap (revision not actually landed). Not the case: the revision is present in the artifact and every resolution is load-bearing.

One-line justification: RFC-028 r2 closes F1 (non-null tier-stack `Idef0Diagram`, I-12), F2 (core-enforced ≤6-box via `focus`+`window`+mega-node rollup, I-14), F3 (deterministic id-collision edge fan-out ordered by composite key, I-11/INV-PORT-EDGE), and F4 (`takenAt` precedence, no wall-clock) — each verified against the frozen SPEC-004 Scenario 3 + INV-10 + the frozen `Idef0Diagram` shape — while preserving the pure-core/host-adapter port boundary and the BLOCKER-class `port()` id-index (I-1) my prior review named the best part of the design.

## Ground-truth verification

This is a **forgeplan artifact re-review** (a design RFC revision), not a landed-code claim. The dispatch claim is: "RFC-028 was REVISED to carry a `## Review reconciliation` index, a `## Current-data reality` subsection, `## Open Questions` (OQ-1), invariants I-11..I-14, and to resolve EVID-046 F1–F4." The correct ground truth is the frozen artifact body (read myself, not relayed) cross-checked against the on-disk git-tracked markdown projection — I did not trust the reconciliation table's self-report; I read each resolution section and grepped the on-disk file for the load-bearing tokens.

- Base..head: **n/a — RFC design-revision review; no `base..head` code diff claimed.** The on-disk RFC-028 markdown is untracked (`?? .forgeplan/rfcs/RFC-028-…md`) — a draft projection, consistent with a not-yet-committed draft RFC. Expected-delta token source: the reconciliation table's own resolution claims (must appear in BODY sections + invariants + fixtures, not only the table).
- Diff/artifact probe: `forgeplan_get RFC-028` (77 KB body, read 100% in 4 chunks) + `jq -r '.body'` to a readable file + `grep -F` the on-disk `.md`.
- Delta state: **DELTA=PRESENT** (revision r2 landed; body carries all claimed new sections/invariants).
- Expected-delta tokens (grep on the on-disk artifact — proof a guardian re-checks):
  - `computeTierStackDiagram` → **17 hits** (F1 non-null tier-stack assembler, present across Module Breakdown / Signatures / Data Flow / Phases / I-12)
  - `I-12 (non-null diagram` → **1 hit** (F1 invariant) · `INV-PORT-EDGE` → **12 hits** (F3) · `one EdgeIn per matching` → **6 hits** (F3 fan-out rule)
  - ``takenAt` precedence` → **4 hits** (F4) · `I-14 (bounded diagram` → **1 hit** (F2 invariant) · `mega-node rollup` → **8 hits** + `focus + mega-node rollup` → **2 hits** (F2) · `byId` → **10 hits** (I-1 id-index preserved)
- Token probe verdict: **FOUND** for every F1–F4 resolution token → the revision is real, not a table-only self-report.
- Verdict floor from ground-truth gate: **PASS-eligible** (DELTA=PRESENT + expected tokens FOUND ⇒ precondition satisfied). The PASS below is a substantiated fitness judgement, not a claim-vs-reality gap.

Literal probe output (excerpts):
```
[17] computeTierStackDiagram
[1]  I-12 (non-null diagram
[12] INV-PORT-EDGE
[6]  one EdgeIn per matching
[4]  takenAt` precedence
[1]  I-14 (bounded diagram
[8]  mega-node rollup
[10] byId
```
Frozen-contract cross-check (SPEC-004 on-disk, the shape F1/F2 must honor):
```
SPEC-004:195  Idef0Diagram = { boxes; arrows; legend; mode: "idef0" | "tier-stack" }   # non-nullable, mode required
SPEC-004:321  Scenario 3 → the returned diagram `mode == "tier-stack"` … every element derived
SPEC-004:322  Scenario 3 → dense ⇒ `mode == "idef0"` **with the ≤6-box-per-page bound respected**
SPEC-004:173  INV-10 headless metadata sufficiency (host renders from the Idef0Diagram)
```

## Scope

### RFC under re-review
- ID: `RFC-028` — "Pure staged idef0 decomposition core (`shared/lib/idef0`) with id-indexed port and tier lift", revision **r2 (2026-07-01)**.
- Sections inspected (100% body read): Status, Review reconciliation, Summary, Current-data reality, Motivation, Module Breakdown, C4 L1/L2, Data Flow, DecompInput port contract, HARD MANDATE (I-1 + I-11), Function Signatures, classifyIcom table, pure-core+N-host-adapter contract, API stability posture, Complexity+budget (O(1)-DOM proof), Determinism+Q3, Options Considered, Proposed Direction, ADI, Implementation Phases (GATE-0), Invariants I-1..I-14, Rollback, Risks, Open Questions (OQ-1), Test Strategy Hooks, Related Artifacts, References.

### Prior review being closed (source of the findings)
- `EVID-046` (this agent's prior architect-review, CONCERNS): **F1** MED 🔄 tier-stack `diagram:null` vs frozen `Idef0Diagram.mode` + Scenario 3 + INV-10; **F2** MED 📈 O(1)-DOM ≤6-box bound unenforced by the core (whole-forest diagram, 16-root top tier); **F3** MED 🔄 edge-endpoint binding undefined under id-collision (`byId[id].length>1`); **F4** LOW 🏗 `takenAt` two sources, precedence unstated.

### Parent contract (source of truth for acceptance — frozen, honored, not re-opened)
- `SPEC-004` — INV-1..10, FR-001..007, NFR-001..004, 12 `#### Scenario` blocks; specifically the frozen `Idef0Diagram` shape (§Data Models), Scenario 3 (density gate + ≤6-box bound), INV-10.
- Governing ADRs: `ADR-006` (tier-lift + SankeyView `TYPE_ORDER` shim), `ADR-007` (IDEF0-STYLE projection, Q2 letters, local relation table).
- Grand-parent: `EPIC-001` (draft, evidence-less — the R_eff weakest link).
- Sibling audits also closed by r2 (verified present, not re-adjudicated here — system-dev/guardian territory): `EVID-047` (S-1..S-6), `EVID-048` (guardian CONCERNS).

### Not reviewed (out of scope)
- SPEC-004 internal correctness — frozen; already audited (EVID-045). This review checks only that r2 honors it.
- The system-dev findings S-1..S-6 as primary subjects — owned by EVID-047; I confirmed their reconciliation is coherent with the architecture (S-4/S-1 touch fitness) but did not re-run that audit.
- Runtime NFR-002 measurement — the ≤50 ms figure is target-until-measured; the real number is guardian-required EVIDENCE at Phase 5.
- The un-built core source — `template/src/shared/lib/{idef0,tier}/` still absent by design (no vacuous "already implemented" claim).

## Methodology

| Step | Detail |
|---|---|
| Fitness categories applied | 🏗 Modular boundary · 🔗 Coupling · 🔄 Data flow · 💥 Blast radius · ⚙️ Operability · 📈 Scalability · 🧪 Testability |
| Prior-finding verification | each F1–F4 read in the ACTUAL body section + its invariant (I-11..I-14) + its named fixture, then cross-checked against the frozen SPEC clause it must satisfy — NOT accepted from the reconciliation table |
| Regression sweep | every r2 delta (S-1 reframe, S-4 host swap, `CANONICAL_RELATIONS`/drift guard, NUL guard, edge fan-out, densityGate signature growth) assessed for a NEW fitness gap |
| Boundary/id-index re-confirm | pure-core/host-adapter port boundary + I-1 (INV-PORT-IDX) re-verified intact post-revision |
| Recalled priors | `memory_recall` (IDEF0 core `buildDecompForest`/`computeIdef0Diagram`/`classifyIcom`, local non-mutating `idef0-relation.ts`, density-gate honest tier-stack fallback, 16-box top-tier open question, `normaliseHierarchyEdge("based_on")===null` regression); `mm-gate-failures` mental model **absent from this bank (HTTP 404)** + `mental_model_list` empty — recorded honestly, not fabricated |
| Static analysers | see table |

### Static analysers

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| forgeplan_get | `forgeplan_get RFC-028` (100% body read, 4 chunks) | executed | ok | 77 KB body; all r2 sections present |
| grep (token probe) | `grep -F` F1–F4 resolution tokens on the on-disk `RFC-028-…md` | executed | 0 | all tokens FOUND (counts above) |
| grep (frozen contract) | `grep -niE` Scenario 3 / INV-10 / `Idef0Diagram` on `SPEC-004-…md` | executed | 0 | frozen shape non-nullable; Scenario 3 asserts both tier-stack non-null + ≤6-box |
| cloc | module LOC distribution | **N/A** | — | `shared/lib/idef0` still un-built (greenfield RFC) — nothing to measure |
| madge / cargo tree / pydeps | circular-dep / crate / import graph | **skipped** | — | not installed / no TS module graph pre-implementation; honest negative coverage |

Honest negative coverage: code-graph analysers cannot run on a not-yet-written module; the load-bearing verification is the per-finding body read + frozen-contract cross-check + on-disk grep proof above.

## Parent-contract fit (the ⚠️-partial rows from EVID-046, re-adjudicated)

| Contract item | EVID-046 status | RFC-028 r2 section | Now |
|---|---|---|---|
| INV-6 density routing + ≤6-box-per-page | ⚠️ partial (F2) | `computeIdef0Diagram(focus,window?)` + `computeTierStackDiagram(window?)`, mega-node rollup, I-14, §O(1)-DOM proof, F2 fixture | ✅ covered — ≤W boxes/page is now a **core contract**, 16-root case handled |
| INV-7 stable (id,title) numbering — **edge** binding under collision | ⚠️ partial (F3) | I-11/INV-PORT-EDGE, §Determinism, `port.ts`, collided-id-edge fixture | ✅ covered — one EdgeIn per composite-key pair, ascending `[serialiseKey(from),serialiseKey(to)]` |
| INV-8 determinism — collision-bucket resolution pinned to the key | ⚠️ partial (F3) | §Determinism edge fan-out bullet; canonical sort, never bucket/array order | ✅ covered |
| INV-10 headless metadata sufficiency — tier-stack mode | ⚠️ partial (F1) | I-12 non-null diagram in both modes; §Data Flow "render tier-stack from the diagram alone"; Scenario 7 "in BOTH modes" | ✅ covered — no `diagram:null` path remains |
| `takenAt` precedence | LOW (F4) | §DecompInput port contract; explicit arg wins → `RawSnapshot.takenAt` → `""`; I-2 no wall-clock | ✅ covered |
| EPIC Outcome 5 reuse-not-fork | ✅ (via T2+T4) | now T2 + builder surface; T4 demoted to OQ-1 (S-4) | ✅ covered — **more sound** (broken T4 leg removed), see residual risk |
| Idef0Diagram frozen shape "not re-opened" | internal contradiction (F1) | tier-stack path brought INTO the frozen non-null shape; SPEC not edited | ✅ consistent — resolves the self-contradiction the right way (edit the RFC, not the frozen SPEC) |

Every ⚠️-partial row from EVID-046 is now ✅ against the frozen contract. No previously-✅ row regressed.

## Findings

Per-finding verification of the four EVID-046 findings against the CURRENT body. **All resolved — none survives the gate.**

| # (was) | Sev | Category | Was the gap | Verified resolution in RFC-028 r2 (body location) | Honors frozen clause | Outcome |
|---|---|---|---|---|---|---|
| F1 | MED | 🔄 Data flow | tier-stack returned `diagram:null`; host forced into `TierStackForest`; INV-10 + Scenario 3 fail; internal "shapes not re-opened" contradiction | `diagram.ts` owns `computeTierStackDiagram → Idef0Diagram` (mode `"tier-stack"`, boxes = tier members, arrows none/tier-derived-dashed, legend present, all `derived`), **never null**; `densityGate`/`deriveIdef0` non-null in both modes; §Signatures dropped the `\| null`; **I-12** invariant ("no `diagram: null` path"); Scenario 3 + Scenario 7 fixtures assert non-null tier-stack diagram + INV-10 in both modes | frozen `Idef0Diagram.mode` (SPEC:195), Scenario 3 (SPEC:321), INV-10 (SPEC:173) — SPEC unedited | **RESOLVED** |
| F2 | MED | 📈 Scalability | core neither enforced nor realized ≤6-box/page; `computeIdef0Diagram(forest,edges)` took whole forest; no focus/paging; 16-root top tier unhandled | `computeIdef0Diagram(forest,edges,focus,window?)` + `computeTierStackDiagram(stack,window?)` materialise **ONE** level (focus + ≤6 sorted children, or ≤6 sorted roots) with a `+N more` mega-node rollup for >6 members; §Data Flow "16-root top-tier handling (F2)" keeps first W−1 + one mega-node ⇒ `boxes.length ≤ W`; §Complexity "O(1)-DOM proof — now enforced by the core"; **I-14** invariant; F2 fixture (>6-child focus + null-focus 16-root ⇒ ≤6 boxes + rollup) | Scenario 3 "≤6-box-per-page bound respected" (SPEC:322) | **RESOLVED** |
| F3 | MED | 🔄 Data flow | edge endpoint binding undefined when `byId[id].length>1`; insertion-order fallback would break INV-8; determinism hole at the motivating PROB-060 merge-dup case | **I-11/INV-PORT-EDGE (BLOCKER):** `port()` emits **one EdgeIn per matching `(from,to)` composite-key pair** (`B_from × B_to`), enumerated ascending `[serialiseKey(from),serialiseKey(to)]`; lowest pair keeps authored `real`, extras `derived`; non-collision common case ⇒ exactly one EdgeIn (unchanged); §Determinism edge-fan-out bullet; collided-id-edge fixture asserts set + order + real/derived split, reorder-invariant | INV-7/INV-8 (never Map/array order); E-ID-COLLISION "surface not coalesce" | **RESOLVED** — deeper than the suggested lowest-key-only bind: fans out & marks, so no candidate binding is silently dropped |
| F4 | LOW | 🏗 Modular boundary | `takenAt` two sources (`RawSnapshot.takenAt` vs explicit arg), precedence unstated | §DecompInput port contract pins it: explicit `takenAt` arg **wins** when non-empty → else `RawSnapshot.takenAt` → else `""`; core **never reads a wall-clock** (`Date.now()` forbidden by NFR-001 / **I-2**) | NFR-001 purity (pure fn of inputs) | **RESOLVED** |

No new finding at or above LOW. Regression sweep of the r2 deltas found no new architectural-fitness gap (see Positive observations + Residual risks for why each delta is a net improvement, honestly scoped).

## Blast radius

Re-assessed for r2; unchanged in shape from EVID-046, and the r2 deltas do not widen it.

- **If implemented and wrong, what fails?** The core is a **pure, read-only** library (rule 22 — no `/api/*` mutation, no `spawn`, no workspace write). A wrong core yields a wrong/absent **9th `idef0` view**, not corrupted data or a downed write path. The only change touching existing production surface remains the **tier-lift** (ADR-006): a one-index drift in `typeTier`/`compactTierMap` would silently shift the "altitude" of the **7 existing hierarchical views** — the single highest-impact failure mode.
- **r2's net effect on blast radius:** *narrower*, not wider. F1's non-null tier-stack diagram removes a null-deref path in the host; F2's core-enforced ≤6-box cap removes an unbounded-DOM path at N≥1000 and the 16-root shape; F3's deterministic fan-out removes a non-determinism path at the merge-dup case; S-2's GATE-0 (PROB-060 clean-trunk + before/after artifact-count) directly guards the reindex-overwrite gotcha that could corrupt the very INV-7/E-ID-COLLISION machinery this core rests on.
- **Production scope:** client-side render only — 7 existing views (tier-lift) + 1 new view (idef0). Zero server surface, zero data mutation, zero user-data risk.
- **Recovery path:** per-phase `git revert` (pure lib ⇒ zero behavioural residue); tier-lift rollback governed by ADR-006 with a byte-identity golden proving equivalence either direction; Q1 threshold re-bind = one-line + test refresh (no ADR); Q2 re-letter = local-table edit (ADR-007-owned). De-facto kill-switch: the view is invisible until the `{:else if view==='idef0'}` branch + `ui-prefs` entry land — not registering it is the off switch.
- **Detection time:** immediate at CI — the 12-scenario harness + the new F1/F2/F3 + real-data tier-stack fixtures + the ADR-006 byte-identity golden + the S-3 relation-drift guard all gate the phase PR; a red conformance test blocks merge. Altitude drift is caught by the golden snapshot before any relocation lands (GATE-0).

## Operability concerns

- **Observability:** N/A in the meaningful sense — synchronous pure compute inside a Svelte reactive effect; NFR-001 forbids I/O, so no logs/metrics/traces are warranted. Correct for a pure lib. (Host concern, correctly flagged: T2 must surface `DensityVerdict.reason` so the tier-stack reads as *honest*, not *broken* — §Current-data reality.)
- **Deploy / rollback:** fully reversible except the semi-irreversible tier relocation (ADR-006-owned, made cheap by byte-identity). No schema, no migration, no backfill.
- **Sequencing (improved in r2):** Phase 0 now carries a **HARD GATE-0** (S-2) — PROB-060 landed on a clean trunk + clean working tree + before/after artifact-count capture before any tier-lift or T3-A reindex. This closes an operability hazard EVID-046 did not raise but that the sibling system-dev audit surfaced; it is architecturally the right place for it.
- **Capacity:** the NFR-002 ≤50 ms @ N=1000 budget is **target-until-measured** (honestly flagged; the real figure is guardian-required EVIDENCE at Phase 5). F2's O(1)-DOM half of the scalability claim is now closed at the core regardless of the ms figure — the r2 improvement over EVID-046 where this was ⚠️ partial.

## Positive observations

- **Strong — the F1/F2/F3 fixes land *within* the chosen design, not by redesign.** The staged-pipeline boundary (Option 1) is exactly what lets `densityGate` swap `computeIdef0Diagram` ↔ `computeTierStackDiagram` cleanly and lets `focus`/`window` mirror the outline's windowing — each fix strengthens the very invariants (INV-6/INV-8/INV-10) the ADI names as the reason to prefer H1. The revision is disciplined: no scope creep, no architecture churn.
- **Strong — the honesty reframe (S-1) is the right architectural call.** Making the **non-null tier-stack the first-class default render on real data** (density ≈0.095 « 0.3), refusing to lower the 0.3 threshold ("no value in [0,1) fixes sparsity — tuning would fabricate a spine"), and adding an authentic `graph --json` dogfood fixture as the PRIMARY real-data contract, is precisely the INV-5/EPIC-Outcome-6 honesty posture. It under-delivers the marquee visual honestly rather than fabricating structure — a rare and welcome discipline.
- **Strong — the pure-core/host-adapter port boundary + I-1 id-index survive intact.** `RawSnapshot`/`DecompInput` remain strictly structural + serialisable (no host classes/functions/SDK types); both adapters live in the hosts; the core imports only `shared/lib/tier/`. I-1 (INV-PORT-IDX, BLOCKER) — O(N+E) via `byId`, doubling as the id-collision detector — is preserved verbatim (10 `byId` hits) and now feeds I-11's deterministic fan-out. This is still the best part of the design.
- **Strong — robustness adds that were not even asked for.** The `CANONICAL_RELATIONS` registry + relation-drift CI guard (I-13/S-3) catches a *new upstream relation* falling silently to `E-UNKNOWN-RELATION` — a real forgeplan-churn risk (0.33 / #397); the `serialiseKey` NUL guard (S-6) closes a composite-key-collapse path. Both are defensive-depth, honestly scoped as data not chrome.

## Residual risks

- **Second reuse host (Outcome 5) is deferred, not shipped.** r2 correctly removes the unsound T4 leg (S-4: PROJECT-MAP-SPEC §23 makes `ComposedMap` own `MapNode`, no adapter — a representational fork, not a thin adapter) and rests reuse-not-fork on **T2 + a builder surface (Mechanism Atlas / ASSAY)**. But the builder surface is an EPIC-001 "(deferred) after-core" child, so at T1-core ship only **one** concrete host (T2) exists; the NFR-004 import-not-reimplement proof is a *contract to be met when the second host lands*, not a shipped fact. This is a **program-sequencing observation, not an RFC-body defect** — the RFC is scrupulously honest about it (T1 evidence "MUST NOT be used to claim the idef0 half of Outcome 5"; T4 recorded as OQ-1). Flagged for the EPIC owner so the second-host proof is not lost; it is a net improvement over EVID-046's state (where the T4 reuse leg was latent-broken and unflagged).
- **Chain trust (R_eff):** grand-parent `EPIC-001` is draft / R_eff=0 (evidence-less) — RFC-028's activation R_eff is chain-gated by the parent. This EVID (verdict `supports`) is the local lift; the orchestrator must still walk the activation chain (EPIC-001 needs ≥1 `supports` EVID → activate EPIC → SPEC-004 → ADR-006 + ADR-007 → RFC-028). A chain-level observation, not an RFC-028 body defect.
- **Edge fan-out cardinality:** under a pathological id-collision the fan-out is `B_from × B_to`; bounded by bucket sizes (`C` in the complexity table, 0 in the common case) and typically 2×1 for the PROB-060 merge-dup case. Honest and deterministic; no realistic explosion for `^[A-Z]+-[0-9]+$` ids. Not a finding.
- **NFR-002 ms budget unmeasured** until Phase 5 (target-until-measured; guardian-required EVIDENCE). Correct posture; F2 closes the O(1)-DOM half regardless.

## Recommended next steps

- [→ orchestrator] **PASS — F1–F4 resolved; re-review clears the architecture-fitness gate.** This EVID (`verdict: supports`) is eligible to lift R_eff off the all-`weakens` prior audits. Activation remains additionally gated by (a) the guardian-required conformance-harness + NFR-002 benchmark EVIDENCE (not producible at RFC time — Phase 5) and (b) the grand-parent chain: activate `EPIC-001` (needs ≥1 `supports` EVID) → `SPEC-004` → `ADR-006` + `ADR-007` → `RFC-028`. Do NOT skip the chain even though this leg passes.
- [→ orchestrator] No `architect` redesign warranted — r2 closed every finding by focused RFC edit within the chosen design; no BLOCKER, no alternative-design need.
- [→ tester / coder] At build time, ensure the four review-driven fixtures are wired as gate tests: real-data tier-stack (S-1/PRIMARY), collided-id edge (F3), ≤6-box/rollup + 16-root (F2), `\0`-key (S-6), plus the relation-drift guard (S-3) and the INV-10-in-both-modes assertion (F1). Run the suite with `pool: 'threads'` (macOS fork-limit at 7+ files, per build-gotchas).
- [→ guardian] EVID-046/EVID-047/EVID-048 are all `informs` on RFC-028 and reconciled by r2; this EVID-049 is the closing `supports` re-review for the architecture-fitness leg.

## References

- RFC under re-review: `RFC-028` (r2, 2026-07-01) — on-disk `/.forgeplan/rfcs/RFC-028-…-with-id-indexed-port-and-tier-lift.md` (untracked draft projection)
- Prior review closed: `EVID-046` (this agent, CONCERNS, F1–F4)
- Frozen contract: `SPEC-004` (INV-1..10, FR-001..007, Scenario 3 + INV-10 + non-null `Idef0Diagram` shape) — honored, not re-opened
- Governing ADRs: `ADR-006` (tier-lift + SankeyView `TYPE_ORDER` shim), `ADR-007` (IDEF0-STYLE projection, Q2 letters, local relation table)
- Grand-parent: `EPIC-001` (draft, R_eff=0 — chain weakest link)
- Sibling audits reconciled by r2 (not re-adjudicated here): `EVID-047` (system-dev S-1..S-6), `EVID-048` (guardian)
- Ground-truth artifacts read this session: RFC-028 body (100%, via `forgeplan_get` + `jq`), on-disk RFC-028 `.md` (token grep), SPEC-004 `.md` (Scenario 3 / INV-10 / frozen shape grep)
- Mental models consulted: `mm-gate-failures` — **absent from this bank (HTTP 404)**; `mental_model_list` empty. Verified phase/contract coherence directly instead.




