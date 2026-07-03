---
depth: standard
id: EVID-051
kind: evidence
last_modified_at: 2026-07-01T11:26:49.469461+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-028
  relation: informs
status: active
title: 'Guardian RE-GATE of EPIC-001 T1 keystone set (RFC-028 r2 + SPEC-004 + ADR-006 + ADR-007): PASS'
---

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit
review_verdict: PASS

(`supports` = this RE-GATE verifies every prior C4-chain concern is genuinely resolved in the CURRENT RFC-028 r2 body and the keystone set is internally consistent + safe to activate; this is the first guardian `supports` on the set — it, together with EVID-049/EVID-050, lifts the RFC leg off the all-`weakens` prior audits. CL3 = gate performed directly on the real stored artifacts — RFC-028 r2 body read 100%, the full EVIDENCE chain EVID-045..050, EPIC-001, live `forgeplan_validate`/`forgeplan graph --json`, the real `feat/idef0-decomposition-surfaces` @ `54a905c` tree = same context. `audit` = pre-activation gate synthesis over the linked EVIDENCE chain; no code executed, no artifact body edited.)

## Verdict

**PASS**

- **PASS** — orchestrator MAY activate the set. ← **this gate.** RFC-028 r2 resolves every EVID-046 (F1–F4) + EVID-047 (S-1 HIGH + S-2..S-6) finding; the two successor re-reviews (EVID-049 architect-reviewer, EVID-050 system-dev) are both `verdict=PASS` / `verdict: supports` and both carry ground-truth-verified `## Ground-truth verification`; MUST-validation is green; the set is internally consistent against the frozen SPEC-004 + ADR-006 + ADR-007; zero unresolved BLOCKER/HIGH/MEDIUM remain.
- **CONCERNS** — would apply if any finding were only table-claimed but not realized in the body, or an audit still read `weakens`. NOT the case.
- **BLOCKER** — would apply on a CRITICAL/redesign-requiring gap or an empty-diff-on-claimed-change. NOT the case: no code change is claimed (design-RFC gate; core un-built by design), so the HARD-RULE-9 empty-diff-BLOCKER correctly does not fire.

One-line justification: the exact CONCERNS the prior guardian gate (EVID-048) held activation on are now closed in RFC-028 r2 — F1 (non-null tier-stack `Idef0Diagram`, I-12), F2 (core-enforced ≤6-box via `focus`+`window`+mega-node rollup, I-14), F3 (deterministic id-collision edge fan-out, I-11/INV-PORT-EDGE), F4 (`takenAt` precedence), S-1 (HIGH → honest tier-stack-as-default reframe, 0.3 kept, real-data fixture), S-2..S-6 — each verified by me in the body AND independently PASS-confirmed by two ground-truth-verifying successor reviewers.

**PASS clears the design-fitness gate. It does NOT bypass the R_eff activation prerequisite** — see Orchestrator instructions: EPIC-001 (evidence-less, R_eff=0, weakest link) must first receive ≥1 `supports` EVID, then the set activates in dependency order. That is orchestrator sequencing work, not an RFC-body defect.

## Artifact(s) under review (the set)

| ID | Kind | Status | R_eff | Title | Role in set |
|---|---|---|---|---|---|
| `RFC-028` | rfc (standard) | draft | 0.0 | Pure staged idef0 decomposition core (`shared/lib/idef0`) + id-indexed port + tier lift — **revision r2 (2026-07-01)** | **keystone under RE-review** (claimed) |
| `SPEC-004` | spec | draft | 0.0 | TADD derivation + ICOM-grammar conformance | frozen contract; RFC `based_on` — honored, not re-opened |
| `ADR-006` | adr | draft | 0.0 | Behaviour-preserving tier-vocabulary lift → `shared/lib/tier` | RFC `based_on` (Phase-0 prerequisite) |
| `ADR-007` | adr | draft | 0.0 | idef0 = IDEF0-STYLE projection; informs=Mechanism; local relation→ICOM table | RFC `based_on` (Q2 letters) |
| Parent | epic | draft | 0.0 | EPIC-001 IDEF0 decomposition surfaces (critical) | **evidence-less → R_eff weakest link** |

Ground truth: branch `feat/idef0-decomposition-surfaces` @ `54a905c`; `template/src/shared/lib/` holds only `index.ts` + `theme.svelte.ts` — **core un-built (`idef0/`+`tier/` absent), as designed** (RFC ships `draft`; core is BUILD Phase 1–5). No landed-code claim ⇒ HARD RULE 9 empty-diff-BLOCKER does not fire.

## Ground-truth verification

This is a **pre-activation RE-GATE over forgeplan artifacts** (a design-RFC revision + its EVIDENCE chain), not a landed-code claim. Ground truth = (a) the RFC r2 body actually contains the claimed resolutions (read 100%, not relayed from the reconciliation table), (b) the two successor re-reviews are genuinely `PASS`/`supports` with their own ground-truth sections, (c) linkage + validation state via live tools.

- Base..head: **n/a — design-RFC re-gate; no `base..head` code diff claimed.** The keystone core is un-built by design (`shared/lib/{idef0,tier}/` absent @ `54a905c`), consistent with a draft RFC.
- Artifact/tool probes (executed this session): `forgeplan_get RFC-028` (77 KB body, read 100% in 2 chunks via `jq -r .body` → readable file), `forgeplan_get EVID-045..050` + EPIC-001, `forgeplan_validate RFC-028` (PASS 0/0), `forgeplan graph --json` edge probe.
- Delta state: **DELTA=PRESENT** — RFC-028 `updated_at` 2026-07-01T11:18 (r2); body carries `## Review reconciliation` index, `## Current-data reality`, `## Open Questions` (OQ-1), invariants **I-11 (INV-PORT-EDGE)**, **I-12 (non-null diagram)**, **I-13 (relation-drift guard)**, **I-14 (bounded materialisation)**, `CANONICAL_RELATIONS`, `## API stability posture`, `serialiseKey` NUL guard, Phase-0 **GATE-0**. All present in the actual body sections + invariants + `## Test Strategy Hooks` fixtures — not table-only.
- Link probe (`forgeplan graph --json`): `EVID-046,047,048,049,050 -[informs]-> RFC-028`; `RFC-028 -[based_on]-> {SPEC-004, ADR-006, ADR-007}`; `RFC-028 -[refines]-> EPIC-001`. ⇒ the two `PASS`/`supports` successor EVIDs (049, 050) ARE `informs`-linked (audit-pass + evidence-chain gates satisfied on real edges).
- Successor-EVID ground-truth check (the ML-13 gate row): EVID-049 + EVID-050 **each carry a `## Ground-truth verification` section**, both with token-grep probes against the on-disk RFC-028 `.md` (F1–F4 / S-1..S-6 resolution tokens FOUND) and, for EVID-050, a live `forgeplan graph --json` re-confirming `refines=11`, density ≈0.095 « 0.3. Neither shows `DELTA=EMPTY`; neither claims a code change ⇒ the reviewers verified the artifact revision against git ground truth, not the worker's word. **ML-13 gate row does not fire.**
- Verdict floor from ground-truth gate: **PASS-eligible** (DELTA=PRESENT + expected tokens FOUND + successor reviews ground-truth-verified). The PASS below is a substantiated gate decision, not a claim-vs-reality gap.

Literal edge-probe output:
```
EVID-046 -[informs]-> RFC-028      RFC-028 -[based_on]-> SPEC-004
EVID-047 -[informs]-> RFC-028      RFC-028 -[based_on]-> ADR-006
EVID-048 -[informs]-> RFC-028      RFC-028 -[based_on]-> ADR-007
EVID-049 -[informs]-> RFC-028      RFC-028 -[refines]-> EPIC-001
EVID-050 -[informs]-> RFC-028
```

## EVIDENCE chain inspected (chronological — full chain, HARD RULE 2)

| EVID | Verdict | Structured `verdict:` | Source agent → target | Critical findings (one-line) | Status now |
|---|---|---|---|---|---|
| `EVID-045` | CONCERNS | weakens (CL3) | C4-reviewer → **SPEC-004** | 6 MED (honesty edge-scope · symbol-granular no-mutation · INV-10 scenario · error-mode scenarios · Q5 · density-metric) + 1 LOW | **RESOLVED in SPEC-004 body** (verified via EVID-048 table; SPEC frozen, honored) |
| `EVID-046` | CONCERNS | weakens (CL3) | architect-reviewer → **RFC-028** | F1 tier-stack `diagram:null` · F2 O(1)-DOM ≤6-box · F3 id-collision edge · F4 `takenAt` | **RESOLVED in RFC r2** (I-12/I-14/I-11 + F4; re-verified by EVID-049) |
| `EVID-047` | CONCERNS | weakens (CL3) | system-dev → **RFC-028** | **S-1 HIGH** idef0 unreachable (density≈0.095) + S-2..S-6 MED/LOW | **RESOLVED in RFC r2** (reframe + GATE-0 + drift-guard + T4→OQ-1 + API posture + NUL guard; re-verified by EVID-050) |
| `EVID-048` | CONCERNS | weakens (CL3) | **guardian** → set | held activation on EVID-046 F1–F3 + EVID-047 S-1; issued the fixer + re-review instructions | **superseded-in-signal by this re-gate**; its instructions were executed (r2 fix-loop + re-run reviewers) |
| `EVID-049` | **PASS** | **supports** (CL3) | architect-reviewer → **RFC-028** | F1–F4 all RESOLVED in body; pure-core boundary + `port()` id-index (I-1) intact; `## Findings` per-finding table populated | **NEW — the architecture-fitness lift** |
| `EVID-050` | **PASS** | **supports** (CL3) | system-dev → **RFC-028** | S-1..S-6 all RESOLVED; premises re-verified live (`refines`=11, §23 verbatim); no new long-horizon risk > LOW | **NEW — the system-fitness lift** |

Chain integrity: EVID-049 supersedes-in-signal EVID-046; EVID-050 supersedes-in-signal EVID-047; both are richly detailed (populated `## Findings`/`## Staff-level findings` — NOT thin zero-finding PASSes, so the adversarial-review-thin CONCERNS row does not fire). No unresolved BLOCKER exists anywhere in the chain. Zero `weakens` EVID now carries an unresolved finding.

## Per-finding resolution verification (verified by me in the CURRENT RFC-028 r2 body)

| Prior finding | Sev | Resolved in RFC-028 r2 (body location I confirmed) | Verdict |
|---|---|---|---|
| EVID-046 **F1** tier-stack `diagram:null` | MED | `computeTierStackDiagram → Idef0Diagram` (non-null, `mode:"tier-stack"`, all `derived`) §Module Breakdown/§Signatures L83/190; **I-12** L339; §Data Flow L125 "render tier-stack from the diagram alone"; Scenario 3 + 7 fixtures assert non-null + INV-10 in BOTH modes | ✅ RESOLVED |
| EVID-046 **F2** O(1)-DOM ≤6-box | MED | `computeIdef0Diagram(forest,edges,focus,window?)` + mega-node rollup L189; §Complexity "O(1)-DOM proof — now enforced by the core" L260–265; 16-root handling L129; **I-14** L341; F2 fixture | ✅ RESOLVED |
| EVID-046 **F3** id-collision edge binding | MED | **I-11/INV-PORT-EDGE (BLOCKER)** L167–176/338 — one EdgeIn per `(from,to)` composite-key pair, ascending `[serialiseKey(from),serialiseKey(to)]`, lowest=real/rest=derived; §Determinism L273; collided-id fixture | ✅ RESOLVED |
| EVID-046 **F4** `takenAt` precedence | LOW | §DecompInput port contract L153 — explicit arg wins → `RawSnapshot.takenAt` → `""`; no wall-clock (I-2) | ✅ RESOLVED |
| EVID-047 **S-1** idef0 unreachable on real data | **HIGH** | §Current-data reality L37–54 (reframe: tier-stack = first-class honest default; 0.3 KEPT — lowering fabricates a spine = INV-5 violation); real-data tier-stack fixture (PRIMARY contract); T1 must NOT claim EPIC Outcome 2 / idef0-half of Outcome 5 | ✅ RESOLVED |
| EVID-047 **S-2** Phase-0 reindex-overwrite | MED | **GATE-0** L316 — PROB-060 on clean trunk + clean tree + before/after artifact-count before any lift/reindex | ✅ RESOLVED |
| EVID-047 **S-3** relation-drift | MED | `CANONICAL_RELATIONS` registry + drift-guard CI test; **I-13** L340 | ✅ RESOLVED |
| EVID-047 **S-4** T4 reuse vs §23 | MED | Outcome 5 re-based onto T2 + builder surface (both `ArtifactSummary+GraphEdge`); T4 → **OQ-1** L376; NFR-004 test targets the two non-§23 hosts | ✅ RESOLVED |
| EVID-047 **S-5** API stability | LOW | §API stability posture L230–236 — `index.ts` barrel = semver public surface; internals `@internal` | ✅ RESOLVED |
| EVID-047 **S-6** `serialiseKey` NUL | LOW | §DecompInput port contract L155 — strip ASCII control chars incl `\0` before serialise; `\0`-key fixture | ✅ RESOLVED |

Internal consistency (RFC honors frozen SPEC + ADRs): F1 brings the tier-stack path INTO the frozen non-null `Idef0Diagram.mode` shape **without editing SPEC-004** (resolves the prior self-contradiction the right way — edit the RFC, not the frozen contract); classifyIcom table matches ADR-007 Q2 (`based_on⇒input`, `supersedes/contradicts⇒control`); ADR-006 tier-lift + `cluster.svelte.ts` `TYPE_ORDER` shim targets the fragile `SankeyView.svelte:35`; INV-9 symbol-granular no-mutation honored (I-7). The ADI (`forgeplan_reason`, re-run for r2) confirms Option 1 (staged pipeline, H1 High) survives — no override.

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact-body MUST validation | ✅ | `forgeplan_validate RFC-028` → passed, 0 errors, 0 warnings (this session) |
| 2 | Required EVIDENCE linked | ✅ | RFC-028 ← 5 `informs` EVIDs (046/047/048/049/050) on real graph edges |
| 3 | No BLOCKER in chain | ✅ | 0 CRITICAL/BLOCKER anywhere in EVID-045..050 |
| 4 | Unresolved CONCERNS count | ✅ **0** | all EVID-046 F1–F4 + EVID-047 S-1..S-6 resolved in RFC r2; both successor re-reviews PASS |
| 5 | ≥1 Profile B EVID with verdict=PASS | ✅ | EVID-049 (architect-reviewer) + EVID-050 (system-dev), both `verdict=PASS`/`supports`, both linked |
| 6 | Activation policy (design-fitness) | ✅ | RFC honors frozen SPEC-004 + ADR-006 + ADR-007; ADI present (3 hypotheses); no rule violation |
| 7 | R_eff activation prerequisite | ⏳ orchestrator | R_eff=0 across the set until EPIC-001 gets ≥1 `supports` EVID — an activation SEQUENCING step, not a design defect (see Orchestrator instructions) |
| 8 | Blast radius within stated threshold | ✅ | broad (7 existing views via tier-lift + 1 new) but explicitly enumerated + guarded (ADR-006 byte-identity/Sankey/import-graph/symbol-diff) |

### Project-config gates (`.forgeplan/project-config.yaml` → `quality_gates`)

**Config source:** `not found — HARD RULE 7 conservative defaults applied`. Verified this session: `.forgeplan/project-config.yaml` absent; the present `.forgeplan/config.yaml` is the forgeplan *engine* config and carries **no** `quality_gates:` section.

| Criterion | Threshold (default) | Observed | Result |
|---|---|---|---|
| Test coverage | ≥80% (`min_test_coverage`) | no tester EVID — core un-built by design; conformance harness is BUILD Phase 5 EVIDENCE | **N/A** — recorded, not scored (inapplicable to a not-yet-built pure lib) |
| Critical findings | 0 (`max_findings_critical`) | 0 across chain | ✅ |
| High findings | ≤3 (`max_findings_high`) | **0 unresolved** (EVID-047 S-1 resolved + re-verified by EVID-050) | ✅ |
| Medium findings | ≤10 (`max_findings_medium`) | **0 unresolved** (all resolved in r2) | ✅ |
| Validate pass | required (`require_validate_pass`) | RFC-028 PASS 0/0 | ✅ |
| Audit pass | required (`require_audit_pass`) — ≥1 Profile B EVID `verdict=PASS` | EVID-049 + EVID-050 linked | ✅ |
| Evidence chain | required for `rfc` (`require_evidence_chain`) | RFC ← 5 `informs` EVIDs | ✅ |

**Gates summary: 6/6 applicable green (1 N/A — coverage).** Every prior CONCERNS-forcing project-config signal from EVID-048 (audit-pass had zero PASS EVID; HIGH/MEDIUM unresolved) is now cleared.

## Revisit Trigger check (Step 4b — decay-watch)

- Linked active ADRs the artifact depends on: **none external.** ADR-006 + ADR-007 are `draft` co-gated members of this set, not pre-existing *active* decisions RFC-028 builds on. No fired/DATE-fired triggers; no >30-day evidence-decay; no F+G+R aggregate below threshold (draft ADRs, no per-source scores yet).
- Verdict contribution: **clean / PASS** — the decay layer adds nothing adverse. (Prose-only Compliance on the draft ADRs is not a CONCERNS here — they are co-activated members, not aging active dependencies.)

## Blast radius

- **Affected scope on activation:** client-side render only — *narrowed*, not widened, by r2. (a) **7 existing hierarchical views** (Force/Radial/Tree/Sunburst/Matrix/Lanes/Sankey) via the **ADR-006 tier-lift** — the single highest-impact path; a one-index drift in `typeTier`/`compactTierMap` would silently shift the "altitude" of all 7 (guarded by the ADR-006 byte-identity golden + `SankeyView.svelte:35` resolution test + import-graph + symbol-diff). (b) **1 new `idef0` view** (T2, future). r2 removes a host null-deref path (F1), an unbounded-DOM path (F2), a non-determinism path (F3), and the §23 representational-fork trap (S-4). **Zero server surface, zero data mutation, zero user-data risk** (rule 22 read-only proxy; pure lib).
- **Reversibility:** reversible pre-merge (pure lib ⇒ `git revert` = zero behavioural residue; per-phase conformance-gated PRs). Tier relocation semi-irreversible (ADR-006-owned) but byte-identity golden makes equivalence cheap. Q1 threshold re-bind = 1-line + test; Q2 re-letter = local-table edit. De-facto kill-switch: the idef0 view is invisible until the `{:else if view==='idef0'}` branch + `ui-prefs` entry land.
- **Downstream artifacts:** RFC-028 is THE T1 keystone — the whole EPIC-001 track hangs off it (T2 view, T3 spine recovery, T4 graft, T5 compare-keep); SPEC-004/ADR-006/ADR-007 are its `based_on` foundation.
- **Detection time if wrong:** immediate at CI — the 12-scenario harness + ADR-006 byte-identity golden + NFR-002 micro-benchmark + the new F1/F2/F3 + real-data tier-stack + relation-drift + `\0`-key fixtures gate each phase PR. r2's real-data tier-stack fixture closes the prior blind spot (real-data render was previously untested).
- **Threshold check:** actual scope (7 active views + 1 new via tier-lift) matches the artifacts' stated + guarded threshold ⇒ no HARD RULE 5 downgrade. **Honest scope caveats carried, not hidden:** the dense idef0 path is synthetic-fixture-validated + T3-gated (real data always routes to tier-stack today); T1 evidence MUST NOT be used to claim EPIC Outcome 2 or the idef0 half of Outcome 5; the second reuse host (Outcome 5) is deferred. All three are explicitly disclosed in the RFC and are program-sequencing facts, not defects.

## R_eff / activation-prerequisite guidance (concrete)

PASS clears design fitness; the set still scores **R_eff=0** — an *activation prerequisite* the orchestrator resolves without touching the design:

1. **EPIC-001 is the weakest link (evidence-less, R_eff=0).** Weakest-link (`R_eff = min`) collapses every descendant to 0 while the parent is evidence-less. Mint the develop-baseline recon (**≈120 edges, structural spine 22, decomposition density ≈0.095**) as a **`supports`** EvidencePack with a `## Structured Fields` block (`verdict: supports`, `congruence_level: 3`, `evidence_type: measurement`) informing EPIC-001. (EPIC-001's own risk row demands exactly this: "≥1 evidence на Epic перед активацией; rule 11 не мержит без R_eff>0".)
2. **This guardian EVID (EVID-051) is `verdict: supports`** — together with EVID-049 + EVID-050 it is the RFC-028 leg's design-time lift off the all-`weakens` prior audits.
3. **Each design artifact still needs its own `supports` EVID to reach R_eff>0:** SPEC-004 → a "CONCERNS-resolved re-review PASS" supports EVID (EVID-045 findings already fixed); ADR-006 → the byte-identity + Sankey-resolution + import-graph + symbol-diff test-pass EVID (Phase-0 BUILD); ADR-007 → the classifyIcom-totality + no-mutation + `based_on`-not-null regression EVID (Phase-1 BUILD); **RFC-028 → the post-BUILD conformance-harness PASS + NFR-002 micro-benchmark** (`verdict: supports`, `evidence_type: test`/`measurement`) — producible only after BUILD (Phase 5/6), the guardian-required final lift.

**Activation order (dependency + weakest-link aware):**
```
EPIC-001  (+ ≥1 supports EVID — baseline recon)          ← unblocks the whole chain
   → SPEC-004  (+ re-review PASS supports EVID)          ← frozen contract, findings resolved
   → ADR-006 + ADR-007  (+ their acceptance-test PASS EVIDs)
   → RFC-028  (guardian PASS + EVID-049/050/051 supports; R_eff meaningfully lifted post-BUILD by the conformance-harness EVID)
```

## Orchestrator instructions (load-bearing — read verbatim)

**PASS → the design-fitness gate is CLEARED. Do NOT skip the R_eff sequencing below; guardian does NOT call `forgeplan_activate` (HARD RULE 1) — activation is the orchestrator's call on this PASS.**

1. **Mint the EPIC-001 baseline-recon `supports` EVID** (≈120 edges / spine 22 / density ≈0.095) with `## Structured Fields` (`verdict: supports`, `congruence_level: 3`, `evidence_type: measurement`); `forgeplan_link` it `informs` EPIC-001. This unblocks the chain's R_eff.
2. **Activate in dependency order:** `forgeplan_activate EPIC-001` → `forgeplan_activate SPEC-004` → `forgeplan_activate ADR-006` + `forgeplan_activate ADR-007` → `forgeplan_activate RFC-028`. Each step assumes the artifact has ≥1 `supports` EVID and `forgeplan_validate` clean (all four validate clean today per EVID-048 + this gate).
3. **No fixer / no reviewer re-run required for design fitness.** The RFC r2 fix-loop closed every finding; the architect-reviewer (EVID-049) and system-dev (EVID-050) already re-ran and returned PASS/supports. Do NOT re-dispatch `architect`, `architect-reviewer`, or `system-dev` for these findings.
4. **Proceed to BUILD (EPIC-001 Phase 0 → 5)** once the set is active. GATE-0 hard precondition stands: PROB-060 landed on a clean trunk + clean tree + before/after artifact-count before any tier-lift or T3-A reindex. RFC-028's OWN final `supports` EVID (the 12-scenario conformance harness PASS + NFR-002 ≤50 ms@N=1000 micro-benchmark) is guardian-required at Phase 6 before T1 is "done".
5. **Optional, non-blocking (does NOT gate activation):** RFC-028 carries prose C4 (L1 System Context + L2 Container/Component) rather than a `docs/c4/RFC-028.md` or inline `mermaid`/`flowchart` block. This is a standard-depth RFC (not a "full" ADR), the governing ADRs justify no container diagram (headless pure-TS relocation), and both successor architecture reviewers passed the C4 sections clean — so the ≥3-module C4 heuristic is **considered and does NOT downgrade** this gate. If durable diagrams are wanted, dispatch `/c4-diagram` in a follow-up to materialise the prose L1/L2 as mermaid — not required before activation.

## Notes

- **FPF ADI / S10 design layer — present, row does NOT fire.** RFC-028 §ADI (`forgeplan_reason RFC-028`, re-run for r2) documents **3 hypotheses** (H1 staged pipeline = High; H2 fused traversal = Low; H3 Web-Worker offload = Medium, deferred to host). forgeplan 0.33's artifact-kind enum has no `adi`/`hypotheses` kind — the ADI lives in the RFC body (the standard forgeplan pattern), satisfying the ≥3-hypothesis design-layer discipline. No BLOCKER.
- **OpenSpec delta-spec row — does NOT fire.** RFC-028 has no `supersedes` link (it `refines` EPIC-001, `based_on` SPEC-004/ADR-006/ADR-007). Delta-spec discipline is inapplicable.
- **`mm-gate-failures` mental model is absent from this bank (HTTP 404); `mental_model_list` empty.** Recorded honestly (not fabricated); gate-failure synthesis was substituted with a direct 100% read of RFC-028 r2 + the full EVID-045..050 chain + EPIC-001 risk table + Hindsight `memory_recall` (which surfaced the id-collision reindex-overwrite gotcha behind GATE-0, the stuck-draft-EVID hygiene pattern, and the honest-degradation posture).
- **Residual risks to track even on PASS (all program-level, none a guardian block):** NFR-002 ≤50 ms budget is target-until-measured (Phase-5 EVIDENCE); the dense idef0 path stays synthetic-only-validated until T3 authors the `refines` spine; the second reuse host (Outcome 5) is deferred (T1 evidence must not claim it); T4 composed-map reuse is OQ-1 (§23 MapNode ownership reconciliation), owned by the EPIC.

## References

- Artifact(s) under review: `RFC-028` (r2, claimed), `SPEC-004`, `ADR-006`, `ADR-007`; parent `EPIC-001`
- EVIDENCE chain (full, read this session): `EVID-045` (SPEC, resolved), `EVID-046` (RFC, CONCERNS→resolved), `EVID-047` (RFC, CONCERNS→resolved), `EVID-048` (prior guardian CONCERNS — superseded-in-signal), `EVID-049` (architect-reviewer re-review PASS/supports), `EVID-050` (system-dev re-audit PASS/supports)
- Ground truth: `feat/idef0-decomposition-surfaces` @ `54a905c`; core un-built by design; `forgeplan_validate RFC-028` PASS 0/0; `forgeplan graph --json` link edges (5 `informs` on RFC-028)
- Project-config: `.forgeplan/project-config.yaml` absent → HARD RULE 7 conservative defaults
- Mental models consulted: `mm-gate-failures` — **absent (HTTP 404)**
- Prior guardian gate for this set: `EVID-048` (CONCERNS) — this EVID-051 is its PASS successor after the r2 fix-loop




