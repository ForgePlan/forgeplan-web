---
depth: standard
id: EVID-048
kind: evidence
last_modified_at: 2026-07-01T10:48:15.542103+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EVID-051
  relation: supersedes
status: superseded
title: 'Guardian gate review of EPIC-001 T1 keystone set (RFC-028 + SPEC-004 + ADR-006 + ADR-007): CONCERNS'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit
review_verdict: CONCERNS

(`weakens` = this gate withholds activation and surfaces unresolved fitness gaps that must be reconciled before the T1 keystone set can activate. CL3 = gate performed directly on the real stored artifacts + the real `feat/idef0-decomposition-surfaces` tree @ `54a905c` = same context. `audit` = pre-activation gate synthesis over the full linked EVIDENCE chain; no code executed, no artifact body edited.)

## Verdict

**CONCERNS**

- **PASS** — orchestrator may activate the set. NOT the case: RFC-028 carries unresolved HIGH + MEDIUM CONCERNS; no `verdict=PASS` evidence exists in the chain; R_eff == 0 on all four (activation prerequisite unmet).
- **CONCERNS** — orchestrator must dispatch a fixer and re-run the two RFC reviewers before another guardian pass; do NOT activate. ← **this gate.**
- **BLOCKER** — halt/reject/redesign. NOT the case: zero CRITICAL/BLOCKER findings anywhere in the chain; all four artifacts validate clean (0 MUST errors); no broken parent links; no rule violation; both expert reviewers explicitly classify every finding as *salvageable by a focused RFC edit, not an `architect` redesign*.

One-line justification: the SPEC-004 sub-chain is healed (EVID-045's 6 CONCERNS are all resolved in the current SPEC body), but RFC-028 — the keystone the whole set feeds — still carries **EVID-046's 3 unreconciled MEDIUM** (tier-stack `diagram:null` drift from the frozen `Idef0Diagram.mode`, unrealized O(1)-DOM ≤6-box proof, undefined edge-endpoint resolution under id-collision) and **EVID-047's 1 unacknowledged HIGH** (flagship idef0-diagram mode empirically unreachable on the real dogfood workspace, density ≈0.095 < the 0.3 gate); both reviewers explicitly recommend "hold activation."

## Artifact(s) under review (the set)

| ID | Kind | Status | R_eff | Title | Role in set |
|---|---|---|---|---|---|
| `RFC-028` | rfc | draft | 0.0 | Pure staged idef0 decomposition core (`shared/lib/idef0`) + id-indexed port + tier lift | **keystone design under review** (claimed) |
| `SPEC-004` | spec | draft | 0.0 | TADD derivation + ICOM-grammar conformance | frozen contract; RFC `based_on` |
| `ADR-006` | adr | draft | 0.0 | Behaviour-preserving tier-vocabulary lift → `shared/lib/tier` | RFC `based_on` (Phase-0 prerequisite) |
| `ADR-007` | adr | draft | 0.0 | idef0 = IDEF0-STYLE projection; informs=Mechanism; local relation→ICOM table | RFC `based_on` (Q2 letters) |
| Parent | epic | draft | 0.0 | EPIC-001 IDEF0 decomposition surfaces (critical) | **evidence-less → weakest link** |

Ground-truth: branch `feat/idef0-decomposition-surfaces` @ `54a905c`; `template/src/shared/lib/` holds only `index.ts`+`theme.svelte.ts` — **core un-built** (`idef0/`+`tier/` absent), matching EVID-046/047's DELTA=EMPTY. No landed-code claim → HARD RULE 9 empty-diff-BLOCKER does not fire; this is a design-RFC gate.

## EVIDENCE chain inspected (chronological)

| EVID | Verdict | Source agent | Critical findings (one-line) |
|---|---|---|---|
| `EVID-045` | CONCERNS (weakens, CL3) | artifact/C4-reviewer → **SPEC-004** | 6 MEDIUM (F1 honesty edge-scope · F2 symbol-granular no-mutation · F3 INV-10 scenario · F4 error-mode scenarios · F5 Q5 · F6 density-metric) + F7 LOW no-coords — **ALL verified RESOLVED in current SPEC-004 body** |
| `EVID-046` | CONCERNS (weakens, CL3) | architect-reviewer → **RFC-028** | 3 MEDIUM (F1 tier-stack `diagram:null` vs frozen `Idef0Diagram.mode` + Scenario 3 + INV-10 · F2 O(1)-DOM ≤6-box unrealized/unenforced + 16-root top tier · F3 id-collision edge-endpoint undefined vs INV-8) + F4 LOW `takenAt` precedence — **UNRESOLVED in RFC body** |
| `EVID-047` | CONCERNS (weakens, CL3) | system-dev staff audit → **RFC-028** | **1 HIGH (S-1: idef0 mode unreachable on real data, density ≈0.095 < 0.3 gate)** + 4 MEDIUM (S-2 Phase-0 PROB-060 sequencing · S-3 relation two-table drift · S-4 T4 composed-map reuse contradicted by §23 · T-1 no real-data test) + LOWs (O-1, S-5 API stability, S-6 `\0` key ambiguity) — **UNRESOLVED in RFC body** |

Chain integrity: no superseding EVID resolves any of EVID-046/047's findings — the RFC body was **not** revised after those reviews (verified: signatures still read `diagram: Idef0Diagram | null`; O(1)-DOM ≤6-box proof unchanged with no paging/rollup primitive; no edge-collision tie-break; no S-1 real-data acknowledgement). EVID-045's findings, by contrast, WERE consumed — SPEC-004 `updated_at` (22:56) post-dates EVID-045 (22:46), and the current SPEC body carries every fix (see task-item (a) below). Both RFC reviewers independently re-confirm "EVID-045 F1–F6 verified addressed."

## Task-directed verification

### (a) EVID-045's 6 CONCERNS — RESOLVED in current SPEC-004 body ✅

| EVID-045 finding | Fix required | Present in current SPEC-004? |
|---|---|---|
| F1 honesty edge-scope over-reach | scope `real` per element kind; roots stay real | ✅ INV-5 "scoped per element kind … roots included"; FR-005 AC-3 `count(edges real that are not authored source edges)==0` |
| F2 no-mutation measured whole-file | re-specify at symbol granularity | ✅ INV-9 "symbol granularity, not whole-file"; NFR-003 + AC-2 "extract/compare just the `HIERARCHY_RELATIONS` literal + `normaliseHierarchyEdge` body" |
| F3 INV-10 no scenario/AC | add metadata-sufficiency scenario | ✅ `#### Scenario: INV-10 headless metadata sufficiency` + AC-6 |
| F4 error-modes no scenarios | add E-EMPTY/E-CYCLE/E-UNKNOWN/degraded-key | ✅ 4 new frozen scenarios present (E-EMPTY, E-CYCLE, E-UNKNOWN-RELATION, E-MISSING-IDENTITY degraded key) |
| F5 Q5 half-frozen contradiction | resolve in-SPEC or stop freezing | ✅ **Q5 removed from Open Questions**; degraded-key kept + frozen in Errors table + scenario (decision made in-SPEC) |
| F6 density metric deferred, S3 non-executable | freeze metric + direction in-SPEC | ✅ INV-6/FR-004 freeze `density=(N−roots)/max(1,N−1)`, "higher=denser", `N≤2⇒tier-stack`; Open Q1 now = threshold value ONLY |
| F7 (LOW) no-coords not in freeze | optional scenario | ✅ `#### Scenario: FR-007 no coordinates in the diagram` |

**All six MEDIUM + the LOW are resolved.** The SPEC-004 sub-gate is clean.

### (b) No unresolved BLOCKER across the RFC EVIDs ✅ (but unresolved HIGH + MEDIUM CONCERNS remain)

Zero CRITICAL/BLOCKER-verdict findings in EVID-045/046/047. Both RFC reviewers state verbatim they are **not** BLOCKER ("the core is architecturally sound and salvageable … none needs an `architect` redesign" — EVID-046; "the design needs RFC edits + explicit roadmap acknowledgement, not an `architect` redesign … it under-delivers the marquee visual on real data until T3, it never *lies*" — EVID-047). What remains unresolved is **CONCERNS-class**: EVID-046 F1/F2/F3 (MEDIUM) + EVID-047 S-1 (HIGH) + S-2/S-3/S-4/T-1 (MEDIUM).

### (c) Internal consistency: RFC honors SPEC + ADRs — with 3 drifts ⚠️

RFC-028 consumes the ADRs faithfully — classifyIcom table matches ADR-007 Q2 (`based_on⇒input`, `supersedes/contradicts⇒control`) exactly; the tier-lift + `cluster.svelte.ts` TYPE_ORDER shim targets the verified fragile `SankeyView.svelte:35`; INV-9 symbol-granularity is honored; the 12-scenario→12-Vitest harness is 1:1. **But three items drift from the *frozen* SPEC contract** (EVID-046 F1–F3), and the RFC's own text says it "does not re-open the frozen shapes" — so F1 (tier-stack `diagram:null` vs frozen `Idef0Diagram.mode:"idef0"|"tier-stack"` + Scenario 3 which dereferences `diagram.mode=="tier-stack"`) is an internal self-contradiction, not merely a gap. F3 leaves a determinism hole (edge binding under id-collision) at the exact PROB-060 case the core claims to handle.

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact-body MUST validation (all 4) | ✅ | `forgeplan_validate` RFC-028/SPEC-004/ADR-006/ADR-007 → passed, 0 errors, 0 warnings each |
| 2 | Required EVIDENCE linked | ✅ | RFC-028 ← EVID-046+EVID-047 (informs); SPEC-004 ← EVID-045 (informs); all confirmed via `forgeplan_score` |
| 3 | No BLOCKER in chain | ✅ | 0 CRITICAL/BLOCKER across EVID-045/046/047 |
| 4 | Unresolved CONCERNS count | ❌ | **1 HIGH (EVID-047 S-1) + 6 MEDIUM (EVID-046 F1/F2/F3 · EVID-047 S-2/S-3/S-4/T-1)** unresolved in RFC body; both reviewers recommend "hold activation" |
| 5 | Activation policy satisfied | ❌ | RFC-028 is `based_on` SPEC-004/ADR-006/ADR-007, all **draft** (skipped as evidence); parent EPIC-001 evidence-less; activating RFC against a draft foundation violates sequencing |
| 6 | Project-specific ship gates | N/A | core un-built by design; conformance-harness + NFR-002 benchmark are guardian-required *future* EVIDENCE (RFC Phase 5/6). Recorded as N/A (no code delta), not a silent skip |
| 7 | Blast radius within stated threshold | ✅ | broad (7 existing views via tier-lift + 1 new) but explicitly enumerated + guarded by ADR-006 byte-identity/Sankey-resolution tests — within what the artifacts acknowledge |

### Project-config gates (`.forgeplan/project-config.yaml` → `quality_gates`)

**Config source:** `not found — HARD RULE 7 conservative defaults applied` (the present `.forgeplan/config.yaml` is the forgeplan *engine* config; it carries no `quality_gates:` section).

| Criterion | Threshold (default) | Observed | Result |
|---|---|---|---|
| Test coverage | ≥80% (`min_test_coverage`) | no tester EVID (core un-built; conformance harness pending) | N/A — recorded, not scored |
| Critical findings | 0 (`max_findings_critical`) | 0 across chain | ✅ |
| High findings | ≤3 (`max_findings_high`) | 1 (EVID-047 S-1) — within cap, but **unresolved + unacknowledged in RFC body** | ⚠️ CONCERNS |
| Medium findings | ≤10 (`max_findings_medium`) | 6 unresolved on RFC (3 EVID-046 + 4 EVID-047, minus 1 LOW dup) | ⚠️ CONCERNS (unresolved) |
| Validate pass | required (`require_validate_pass`) | all 4 PASS | ✅ |
| Audit pass | required (`require_audit_pass`) — ≥1 Profile B EVID with verdict=PASS | **none — all 3 EVIDs are `weakens`/CONCERNS** | ⚠️ CONCERNS |
| Evidence chain | required for rfc/spec/adr (`require_evidence_chain`) | RFC ←2 EVID, SPEC ←1 EVID; ADRs 0 direct EVID | ✅ (RFC/SPEC) / ⚠️ (ADRs un-audited) |

**Gates summary: 3/7** clean; the four non-clean rows are CONCERNS-class (no BLOCKER-forcing signal).

Note on the zero-`PASS`-EVID condition: this is the primary reason the set cannot PASS. It routes to **CONCERNS, not BLOCKER**, because two genuine, thorough adversarial audits (EVID-046 architect-reviewer, EVID-047 system-dev) DID run and returned actionable, fixable findings — this is "audited, gaps found, fix-and-re-review," not "un-audited." The correct routing is dispatch-fixer → re-run reviewers to PASS → re-gate.

## Revisit Trigger check (Step 4b — decay-watch)

- Linked active ADRs the artifact depends on: **none external.** ADR-006 and ADR-007 are `draft` members of the set being co-gated, not pre-existing *active* decisions RFC-028 builds on. No `## Revisit Trigger`/`## Compliance` sections; both are new (created 2026-07-01).
- FIRED / DATE-FIRED triggers: **none** (no active dependency ADRs to check; no dates in the past; no >30-day evidence decay).
- F+G+R aggregate decay: N/A (draft ADRs, no per-source evidence scores yet).
- Verdict contribution: **clean / PASS** — the decay layer adds nothing to the gate decision. (Prose-only Compliance format on the draft ADRs is not a CONCERNS here because they are co-activated members, not aging active dependencies.)

## Blast radius

- **Affected scope on activation:** client-side render only. (a) **7 existing hierarchical views** (Force/Radial/Tree/Sunburst/Matrix/Lanes/Sankey) via the **ADR-006 tier-lift** — the single highest-impact path; a one-index drift in `typeTier`/`compactTierMap` silently shifts the "altitude" of all 7 (verified consumers `tree-layout.ts`, `sankey-layout.ts`, `sunburst-layout.ts`, `cluster.svelte.ts`, direct `SankeyView.svelte:35`). (b) **1 new `idef0` view** (T2). **Zero server surface, zero data mutation, zero user-data risk** (rule 22 read-only proxy; pure lib, no `/api/*` mutation, no `spawn`, no workspace write).
- **Reversibility:** reversible pre-merge (pure lib ⇒ `git revert` = zero behavioural residue; per-phase conformance-gated PRs). Tier relocation is semi-irreversible (ADR-006-owned) but the byte-identity golden makes equivalence cheap to prove either direction. Q1 threshold re-bind = 1-line + test refresh; Q2 re-letter = local-table edit. De-facto kill-switch: the idef0 view is invisible until the `{:else if view==='idef0'}` branch + `ui-prefs` entry land — not registering it is the off switch.
- **Downstream artifacts:** RFC-028 is THE T1 keystone — the entire EPIC-001 track hangs off it: T2 (idef0 view PRD), T3 (graph spine recovery), T4 (composed-map graft), T5 (compare-and-keep). SPEC-004/ADR-006/ADR-007 are its `based_on` foundation. A wrong keystone propagates to every surface above.
- **Detection time if wrong:** immediate at CI — 12-scenario conformance harness + ADR-006 byte-identity golden (captured pre-lift at GATE-0) + NFR-002 micro-benchmark gate each phase PR. **BLIND SPOT (EVID-047 S-1/T-1):** the dense idef0-mode fixtures are *synthetic* — the real dogfood workspace (density ≈0.095) always routes to `tier-stack`, so the flagship diagram path gets **zero real-data exercise** until T3 authoring lands; a real-data regression in that path would be undetected.
- **Threshold check:** the blast radius (7 active views + 1 new via tier-lift) is broader than a naive "just a new pure lib" read, but it is **explicitly enumerated and guarded** by RFC-028 + ADR-006 (byte-identity + Sankey-resolution + import-graph + symbol-diff tests). Actual scope does **not** exceed the artifacts' stated threshold → no additional HARD RULE 5 downgrade beyond the CONCERNS already reached.

## R_eff / activation-prerequisite guidance (concrete)

The set scores **R_eff = 0 on all four artifacts** — an *activation prerequisite*, not a design defect. Two independent causes, both fixable by the orchestrator without touching the design:

1. **EPIC-001 is the weakest link (evidence-less, L0, R_eff 0).** Weakest-link (`R_eff = min`) means every descendant collapses to 0 while the parent is evidence-less. EPIC-001 needs **≥1 supporting EvidencePack** with a proper `## Structured Fields` block (`verdict: supports`, `congruence_level: 3`, `evidence_type: audit` or `measurement`). The natural candidate already exists as data: the Step-1 baseline recon (49/113 edges = 43% index fidelity; structural spine 8/22; live density ≈0.095) — capture it as a `supports` EVID informing EPIC-001. (EPIC-001's own risk row demands exactly this: "≥1 evidence на Epic перед активацией; rule 11 не мержит без R_eff>0".)
2. **Every currently-linked EVID is `verdict: weakens`.** EVID-045/046/047 are *critical audits* — they cannot lift R_eff even once the artifacts activate (you do not activate an artifact on the strength of evidence that weakens it). Each design artifact needs at least one `verdict: supports` EvidencePack:
   - **SPEC-004** → a "CONCERNS resolved / re-review PASS" supporting EVID (its EVID-045 findings are already fixed; a confirming PASS re-review converts that into `supports`).
   - **ADR-006** → the byte-identity + Sankey-resolution + import-graph + symbol-diff test-pass EVID (ADR-006 Postconditions name exactly these four).
   - **ADR-007** → the classifyIcom-totality + no-mutation + `based_on`-not-null regression-pass EVID (ADR-007 Postconditions name exactly this).
   - **RFC-028** → the 12-scenario conformance-harness PASS + NFR-002 micro-benchmark (`verdict: supports`, `evidence_type: test`/`measurement`), producible only after BUILD (Phase 5/6).

**Correct activation order** (dependency + weakest-link aware — activating a child before its foundation has R_eff>0 leaves the child at 0):

```
EPIC-001  (+≥1 supports EVID)                          ← unblocks the whole chain
   → SPEC-004  (+ re-review PASS supports EVID)         ← frozen contract, findings resolved
   → ADR-006 + ADR-007  (+ their acceptance-test PASS EVIDs)   ← foundation decisions
   → RFC-028  (only AFTER: CONCERNS reconciled + re-review PASS + conformance/NFR-002 EVID)
```

Activating SPEC-004 + the two ADRs first also directly lifts RFC-028's own score — `forgeplan_score` currently *skips them as evidence because they are draft*; once active they count toward the RFC's chain.

## Orchestrator instructions (load-bearing — read verbatim)

**CONCERNS → do NOT activate RFC-028 (nor the set as a bundle). Dispatch a fixer, then re-run the two RFC reviewers, then re-gate.**

- **Dispatch `architect` (or the RFC author in authoring mode) to reconcile, in RFC-028's body:**
  - **EVID-046 F1 (MEDIUM):** reconcile the tier-stack representation with the frozen `Idef0Diagram.mode:"idef0"|"tier-stack"` + Scenario 3 + INV-10 — either emit a non-null `mode:"tier-stack"` `Idef0Diagram` (derived boxes/legend, no arrows) so the host renders uniformly from the diagram, OR obtain a SPEC-owner-blessed edit to Scenario 3 + the `Idef0Diagram.mode` field (then also dispatch `spec-author` for the SPEC-004 side).
  - **EVID-046 F2 (MEDIUM):** close the O(1)-DOM proof — add a diagram paging/focus or mega-node-rollup primitive to the core contract (counterpart to `flattenOutline(window)`), OR relocate the ≤6-box realization to the T2 host + downgrade the core-level claim to "host-paged," and state how the 16-root top tier is handled.
  - **EVID-046 F3 (MEDIUM):** pin a deterministic edge-endpoint tie-break for collided ids (e.g. bind to the lexicographically-lowest composite key; mark the other binding `derived`) + add a fixture "edge references a collided id" (keeps INV-8 intact).
  - **EVID-046 F4 (LOW):** state `takenAt` precedence (explicit arg authoritative vs `RawSnapshot.takenAt`).
  - **EVID-047 S-1 (HIGH):** add an **explicit acknowledgement** that the idef0-diagram mode is synthetic-fixture-validated and T3-gated (real density ≈0.095 < 0.3; no threshold in [0,1) makes today's data render idef0 — only authored structure fixes it); T1 evidence must NOT be used to claim EPIC Outcome 2 ("real depth ≥3 / idef0 renders") or the idef0 half of Outcome 5. Require the harness to include an authentic `graph --json` fixture asserting the **tier-stack** outcome on real data (T-1).
  - **EVID-047 S-2/S-3/S-4 (MEDIUM):** track PROB-060-landed-on-clean-tree as a hard Phase-0 precondition + before/after artifact count (S-2); add a relation-set drift guard asserting the local table equals forgeplan's live `forgeplan_link` enum (S-3); require a render-proof that `map.json`/`MapNode` can lower to `RawSnapshot` with raw `refines` recoverable, OR downgrade the "two hosts" reuse claim to "one host now (T2); T4 pending §23 reconciliation" (S-4).
  - **EVID-047 S-5/S-6 (LOW):** one-line API-stability note (`index.ts` barrel = frozen public surface) + a `\0`-in-title fixture (or a documented control-char strip in `port()`).
- **Then re-run `architect-reviewer` (EVID-046 successor) AND `system-dev` (EVID-047 successor)** on the revised RFC-028 to obtain `verdict: PASS`/`supports` EVIDENCE.
- **Then re-dispatch `guardian`** for a second gate pass.
- **Independently, resolve the R_eff=0 prerequisite** per the guidance above (EPIC-001 needs ≥1 `supports` EVID; activate in the order EPIC-001 → SPEC-004 → ADR-006 + ADR-007 → RFC-028). SPEC-004 + ADR-006 + ADR-007 are themselves gate-clean today (SPEC's EVID-045 CONCERNS resolved; the two ADRs carry no adverse findings) and MAY be activated first once each has its own `supports` EvidencePack and EPIC-001 has evidence — this unblocks RFC-028's chain.
- **Guardian does NOT call `forgeplan_activate`** (HARD RULE 1). Activation remains the orchestrator's call on a future PASS.

## Notes

- `mm-gate-failures` mental model is **absent from this bank (HTTP 404); `mental_model_list` context confirms it's not present.** Recorded honestly (not fabricated); prior-gate synthesis was substituted with a direct read of the full EVID-045/046/047 chain + EPIC-001 risk table + Hindsight recall (which surfaced the load-bearing facts: local `idef0-relation.ts` avoids mutating shared `HIERARCHY_RELATIONS`; `normaliseHierarchyEdge` returns null for `based_on`; idef0 is the 9th view; the id-collision reindex-overwrite gotcha).
- No `docs/c4/` directory exists; RFC-028 carries **prose** C4 (L1 System Context + L2 Container/Component), and ADR-006/ADR-007 justify no container diagram (pure-TS module relocation / headless library). The ≥3-module C4-diagram heuristic would nudge CONCERNS, but it is subsumed by the dominant EVID-046/047 findings and is not a standalone driver.
- Residual risk the orchestrator should track even after a future PASS: the NFR-002 ≤50 ms budget is *target-until-measured* (real figure is Phase-5 EVIDENCE); the flagship idef0 path stays synthetic-only-validated until T3 supplies authored `refines` density.

## References

- Artifact(s) under review: `RFC-028` (claimed), `SPEC-004`, `ADR-006`, `ADR-007`; parent `EPIC-001`
- EVIDENCE chain: `EVID-045` (SPEC-004, CONCERNS→resolved), `EVID-046` (RFC-028, CONCERNS), `EVID-047` (RFC-028, CONCERNS)
- Ground truth: `feat/idef0-decomposition-surfaces` @ `54a905c`; core un-built (`template/src/shared/lib/{idef0,tier}/` absent); `forgeplan_validate` all-pass; `forgeplan_score` RFC-028/SPEC-004/EPIC-001 → R_eff 0, weakest_link EPIC-001
- Project-config: `.forgeplan/project-config.yaml` absent → HARD RULE 7 conservative defaults
- Mental models consulted: `mm-gate-failures` (absent — HTTP 404)




