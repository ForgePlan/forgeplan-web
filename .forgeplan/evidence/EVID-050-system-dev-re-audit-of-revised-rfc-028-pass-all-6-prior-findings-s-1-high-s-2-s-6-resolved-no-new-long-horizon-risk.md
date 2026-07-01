---
depth: standard
id: EVID-050
kind: evidence
last_modified_at: 2026-07-01T11:18:41.720860+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-028
  relation: informs
status: active
title: 'System-dev RE-audit of REVISED RFC-028: PASS — all 6 prior findings (S-1 HIGH + S-2..S-6) resolved, no new long-horizon risk'
---

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

(`supports` = this staff RE-audit verifies every prior system-dev finding (EVID-047 S-1 HIGH + S-2..S-6) is genuinely resolved by the RFC-028 r2 revision, and introduces no new long-horizon system risk above LOW; only a `supports` EVID lifts R_eff, and the prior C4 audits were all `weakens`. CL3 = re-review performed directly on the real stored artifacts (RFC-028 r2, SPEC-004-referenced freezes, ADR-006/007, EPIC-001, EVID-046/047/048) + a live `forgeplan graph --json` + the real `feat/idef0-decomposition-surfaces` tree = same context. `audit` = system-level architecture-fitness re-audit; no code executed — the core is still un-built by design, RFC ships draft.)

## Verdict

**PASS**

One-line justification: the RFC-028 r2 revision resolves all six prior system-dev findings with edits that are **honest rather than cosmetic** — the load-bearing S-1 reframe (tier-stack is the first-class default) rests on a premise I re-verified against live data (`refines` still = 11, density ≈ 0.095 « 0.3), and the S-4 T4→builder-surface substitution is backed by a §23 characterization I re-verified verbatim against `docs/PROJECT-MAP-SPEC.md`; over the 6-month horizon the keystone now ships an honest posture (under-delivers the marquee visual on real data until T3, never lies) with no new MEDIUM+ risk introduced.

- **PASS** — no system-wide concern above LOW survives the revision; safe for the system over a 6+ month horizon. ← this re-audit.
- **CONCERNS** — MEDIUM/HIGH system-level finding unresolved. Not the case: all six close cleanly.
- **BLOCKER** — CRITICAL / redesign-requiring. Not the case.

This re-audit runs **after** the RFC r2 fix-loop and re-verifies the exact findings EVID-047 raised. It does not re-open architect-reviewer's F1–F4 (EVID-046) except where they interlock with my S-1 (F1 non-null tier-stack diagram + F2 ≤6-box bound both strengthen the S-1 resolution — noted, not re-litigated).

## Ground-truth verification

This is a **design-RFC re-audit**, not a landed-code claim. The dispatch asks me to verify a prior CONCERNS set is resolved in the revised artifact and confirm no new long-horizon risk. Ground truth = (a) the RFC r2 body actually contains the claimed resolutions, and (b) the external facts the resolutions rest on (live density, §23 contract, EPIC posture).

- Base..head: `n/a — design re-review; no code mutation claimed` (source: dispatch framing). Repo/branch: `/Users/explosovebit/Work/ForgePlanWeb` @ HEAD `54a905c` on `feat/idef0-decomposition-surfaces` (same tree as EVID-046/047).
- Artifact delta probe: RFC-028 `updated_at` 2026-07-01T11:11:33 (r2); read the full 440-line body. **DELTA=PRESENT** — the r2 sections are all materially present.
- Expected delta tokens (the r2 additions the reconciliation table promises) → **all FOUND** in the body:
  - `## Review reconciliation` index table mapping every EVID-046/047/048 finding → resolution section. FOUND (per-finding rows for F1–F4, S-1..S-6, EVID-048).
  - `## Current-data reality` subsection (S-1). FOUND.
  - `## Open Questions` → **OQ-1** (T4 §23 reconciliation, S-4). FOUND.
  - Invariants **I-11** (INV-PORT-EDGE), **I-12** (non-null diagram), **I-13** (relation-drift guard), **I-14** (bounded materialisation). FOUND.
  - `CANONICAL_RELATIONS` registry (S-3), `## API stability posture` (S-5), `serialiseKey` NUL guard (S-6), Phase-0 **GATE-0** hard precondition (S-2). FOUND.
- External-fact probes (the load-bearing premises):
  - **Live `forgeplan graph --json` this session:** edges = 134 → based_on 20 / informs 103 / **refines 11**; nodes array absent from the graph JSON (the forgeplan#397 omission, unchanged). `refines` is still **11** ⇒ density ≈ 11/(N−1) ≈ **0.095**, still far below the 0.3 gate. **S-1's premise is ground-truth-true** — the reframe is not a rationalization. (The informs 100→103 drift vs the RFC's snapshot only deepens the sub-0.3 margin.)
  - **`docs/PROJECT-MAP-SPEC.md` §23:** line 262 "ComposedMap OWNS its `MapNode` and reads `/api/map` exclusively — never shares"; line 317 "Edge superset is real & free; node superset is NOT"; line 336 "Node-type sharing → ComposedMap owns `MapNode` … (no adapter)"; line 237 `sha1(kind+":"+path_or_slug)[:12]`. **The RFC's OQ-1/S-4 characterization is verbatim-accurate** — flagging T4 as an open question (not a reuse host) is correct.
  - **EPIC-001:** draft, R_eff 0.0, evidence-less; Outcome 2 (real depth ≥3), Outcome 5 (≥2 surfaces from one core), Outcome 6 (honest tier-stack degradation), and risk row 1 (reindex-overwrite → "залендить PROB-060 … сверка count до/после") all align with the RFC's S-1/S-2 dispositions.
- Verdict floor from ground-truth gate: **PASS-eligible.** No landed-code claim was made; the empty-diff-is-BLOCKER rule does not fire (the artifact + every external premise are present and accurate). The PASS verdict is a system-fitness judgement that the revision genuinely closes the prior findings.

## Artifact under review

- ID: `RFC-028` — kind: `rfc` (depth: standard) — status: **draft**, R_eff 0.0. Title: "Pure staged idef0 decomposition core (shared/lib/idef0) with id-indexed port and tier lift". **Revision r2 (2026-07-01)**.
- Parent chain: `RFC-028 refines EPIC-001`; `based_on` SPEC-004 (frozen), ADR-006 (tier lift), ADR-007 (projection + Q2 letters).
- **Prior review verdicts (honestly stated, not re-litigated):** architect-reviewer EVID-046 = **CONCERNS** (F1 tier-stack `diagram:null`; F2 ≤6-box/16-root; F3 id-collision edge binding; F4 `takenAt`). system-dev EVID-047 (mine) = **CONCERNS** (S-1 HIGH + S-2..S-6). guardian EVID-048 = **CONCERNS**. My scope here is to re-verify S-1..S-6 close, and confirm the revision adds no new system-wide risk.

## System-wide scope inspected

- **Related artifacts inspected (6):** RFC-028 r2 (subject, full 440-line body); EVID-047 (my prior findings, verified verbatim); EVID-046 (architect-reviewer F1–F4, acknowledged where interlocking with S-1); EVID-048 (guardian CONCERNS — this revision re-enters its gate); EPIC-001 (parent, Outcomes/risk-table, the R_eff weakest link); `docs/PROJECT-MAP-SPEC.md §23` (S-4/OQ-1 contract, re-read on disk). SPEC-004 freezes + ADR-006/007 decisions consumed transitively via the RFC's per-finding citations (not re-opened — frozen contract).
- **Codebase / data areas re-probed (blast radius beyond the RFC's own file list):** live `forgeplan graph --json` relation histogram (S-1 density realism); `docs/PROJECT-MAP-SPEC.md` lines 68/237/262/317/336 (S-4 §23 MapNode ownership).
- **Recent incidents recalled (Hindsight):** the id-collision reindex-overwrite gotcha (parallel checkouts collide on PRD-NNN, reindex silently overwrites, no anomaly) — the concrete basis for S-2/GATE-0; the real data-shape open question (16 parentless PRDs, 84% informs, density-gate → tier-stack fallback) — corroborates S-1; the local `idef0-relation.ts` non-mutation rule + the two-reuse-host framing (buildDecompForest/computeIdef0Diagram later liftable into ComposedMap) — corroborates S-3/S-4.
- **Out of scope (deliberate):** line-level code style; STRIDE/CWE attribution (`security-expert`); re-deriving F1–F4; the IDEF0/ICOM metaphor (ADR-007-decided); the T2/builder host UIs themselves (separate EPIC children — only the core→host contract is in scope); the internal freeze wording of SPEC-004 (frozen; honored, not re-opened).

## Methodology

| Step | Detail |
|---|---|
| System-level categories applied | 📈 maintainability · 🔄 migration · 🛠 operability · 💥 blast radius · 🎯 edge-at-scale · 📜 contract · 🧪 test-surface |
| Horizon checked | 6 months minimum (T1 keystone → T2 first host → T3 spine authoring → T4 graft), re-projected against the r2 reframe |
| Related artifacts traversed | 6 (subject r2 + 3 prior C4 EVIDs + parent EPIC + §23 spec) |
| Prior incidents recalled | 3 (reindex-overwrite; real-data-shape; reuse-host framing) |
| System-scope analysers | see table |

### System-scope analysers

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| forgeplan graph --json | relation histogram over live workspace | executed | ok | 134 edges; refines=11 (unchanged), based_on=20, informs=103 → density ≈ 0.095 « 0.3 (S-1 premise re-verified) |
| grep (§23 facts) | `grep -nE "MapNode\|no adapter\|node superset\|never shares\|sha1" docs/PROJECT-MAP-SPEC.md` | executed | 0-fail | lines 262/317/336/237 confirm ComposedMap owns MapNode, no adapter (S-4/OQ-1 accurate) |
| forgeplan_get (artifacts) | RFC-028, EVID-047, EPIC-001 | executed | ok | full bodies read; r2 sections present; prior findings verified verbatim |
| git / branch | `git branch --show-current`; HEAD | executed | ok | `feat/idef0-decomposition-surfaces` @ 54a905c (same tree as prior C4) |
| cloc / madge | module-graph analysers | N/A | — | core still un-built (RFC draft) — no module to measure; honest negative coverage |
| mm-gate-failures | `mental_model_get` | **skipped (absent — HTTP 404)** | — | not in this bank; recorded honestly, not fabricated |

## Staff-level findings — per-finding resolution verification

Each prior finding is re-verified against the actual r2 section AND, where checkable, the external premise. Verdict per finding: **RESOLVED** / partial / unresolved.

### S-1 (was HIGH, 📈 maintainability) — flagship idef0 mode unreachable on real data → **RESOLVED**

| Required by dispatch | r2 evidence | Verified |
|---|---|---|
| tier-stack is the first-class HONEST default | §Summary ("The honest default on the real project today is the tier-stack render"); §Current-data reality points 1–2; §Data Flow "Primary real-data path (the honest default today)"; I-12 non-null tier-stack diagram | ✓ |
| primary real-data fixture | Test Strategy Hooks → `real-data-tier-stack.spec.ts` **(PRIMARY real-data contract)**: committed authentic `graph --json` snapshot asserts `verdict.mode == "tier-stack"` + non-null tier-stack `Idef0Diagram`; Phase 5 lands it | ✓ |
| dense idef0 diagram framed synthetic / T3-gated | §Current-data reality point 2 ("synthetic-fixture-validated … activates on real data only post-T3"); §Data Flow "Post-T3 dense path (synthetic-fixture-validated today)"; Test Strategy note line 410 | ✓ |
| threshold kept at 0.3 | §Current-data reality point 3 + §Proposed Direction Q1 ("0.3 is kept deliberately — it favours honesty"; worked cases; refuses to lower — would fabricate structure = INV-5 violation) | ✓ |
| T1 avoids over-claiming EPIC Outcome 2 / idef0-half of Outcome 5 | §Current-data reality point 4 ("T1 evidence MUST NOT be used to claim EPIC Outcome 2 … or the idef0 half of Outcome 5") — matches EPIC-001 Outcomes verbatim | ✓ |

External premise re-verified: live `refines` = 11, density ≈ 0.095 « 0.3 — the reframe is grounded in true data, not tuned to hide the gap. My prior O-1 host concern (surface `DensityVerdict.reason`) is also captured (§Current-data reality closing paragraph). **The most complex finding is the most convincingly resolved: the revision makes the honest posture a *tested contract*, not prose.**

### S-2 (was MEDIUM, 🔄 migration) — Phase-0 reindex-overwrite sequencing hazard → **RESOLVED**

r2: Phase 0 **GATE-0** (§Implementation Phases) — a HARD precondition: "(i) PROB-060 landed on a clean trunk and the working tree is clean (no in-flight merge), and (ii) an artifact-count captured before/after any reindex" **before** any relocation OR any T3-A reindex. Mirrored in the Risks table and the reconciliation index. This is the correct disposition: my S-2 observed PROB-060 is not yet landed on trunk; the RFC turns that into an explicit build-time gate rather than an assumption — an RFC cannot itself land PROB-060, so a hard gate is the right instrument. ✓ (The actual PROB-060 landing remains an orchestrator/Phase-0 execution precondition — correctly deferred, now un-loseable because it is a stated gate.)

### S-3 (was MEDIUM, 📈 maintainability) — relation-vocabulary drift over forgeplan-CLI churn → **RESOLVED**

r2: `CANONICAL_RELATIONS` frozen registry in `idef0-relation.ts`; **I-13** invariant ("`CANONICAL_RELATIONS` equals the live `forgeplan_link` canonical relation enum; the drift-guard CI test fails loudly when upstream adds a relation"); `relation-drift.spec.ts` CI test; Risks row. This is exactly my recommended remedy (assert byte-equality to the live enum, not merely case-totality of known relations). ✓ Residual (LOW, recorded below, not verdict-flipping): the guard's effectiveness depends on the tester sourcing the "live" enum from an *independent* reference (forgeplan schema/version pin), not re-declaring the same 5 constants — an implementation detail for BUILD, appropriately out of RFC scope.

### S-4 (was MEDIUM, 📜 contract) — T4 composed-map reuse contradicted by §23 → **RESOLVED**

r2: Outcome 5 is **explicitly re-based off T4** onto **T2 + a builder surface (Mechanism Atlas / ASSAY)**, both feeding `ArtifactSummary + GraphEdge` (§pure-core + N-host-adapter contract; §Summary; §Motivation §2). T4 is downgraded to a **CANDIDATE host, explicitly NOT assumed**, with the full §23 mismatch (owns MapNode, no adapter, sha1 keys, pre-zoned/mega-collapsed) captured in **OQ-1** and flagged for the EPIC owner. The NFR-004 import test now targets the two non-§23 hosts. §23 characterization re-verified verbatim on disk (lines 262/317/336). ✓ Residual (LOW, recorded below): both replacement reuse hosts are themselves *future* — so Outcome 5 stays T1-unprovable until ≥1 lands; this is inherent to "reuse-not-fork" (needs ≥2 consumers) and is honestly disclosed as `(future)` in Related Artifacts, and critically the builder surface carries **no** spec-level contradiction (native `ArtifactSummary+GraphEdge` input), so the substitution is sound.

### S-5 (was LOW, 📜 contract) — no API-stability posture for a ≥6-surface core → **RESOLVED**

r2: new **§API stability posture** — the `index.ts` barrel is the semver-governed public surface; internal modules are `@internal`; breaking signature changes are propagated to all host importers in the same change (or behind a deprecation window). Exactly my one-line remedy, plus the `@internal` boundary. ✓

### S-6 (was LOW, 🎯 edge case) — `serialiseKey` NUL-delimiter ambiguity → **RESOLVED**

r2: §DecompInput port contract — `port()` **strips ASCII control chars (incl. `\0`)** from `id`/`title` before serialising (titles NUL-free by precondition after strip); `nul-key.spec.ts` fixture asserts a `\0`-bearing title does not collapse two distinct composite keys; Risks row. Exactly my recommendation. ✓

### Interlock check — architect-reviewer F1/F2 (not re-litigated, but they strengthen S-1)

My EVID-047 E-note flagged that real-data-always-tier-stack upgrades F1 (`diagram:null`) and F2 (16-root top tier) from "edge" to "the common case". r2 closes both at the core-contract level: **I-12** (non-null `Idef0Diagram` in both modes — no `diagram:null` path) and **I-14** (≤6 boxes/page via focus + mega-node rollup, regardless of N and the 16-root tier). These are the enabling counterparts of the S-1 tier-stack-as-default reframe — the honest default is now uniformly renderable from the diagram (INV-10 holds in fallback). Confirmed consistent; no residual.

### Blast radius (💥) — re-assessed post-revision

**Mandatory section.**

- **Affected scope:** unchanged from EVID-047 and *not widened* by r2 — client-side render only. (a) 7 existing hierarchical views via the ADR-006 tier-lift (highest-impact path; altitude-drift risk guarded by the byte-identity golden + symbol-diff). (b) 1 new `idef0` view (T2, future). (c) The frozen relation table shared by the 7 views (symbol-granular INV-9). **Zero server surface, zero data mutation, zero user-data risk** (rule 22 pure/read-only core).
- **Reuse-host surface (re-checked):** Outcome 5 now rests on T2 + a builder surface (both native `ArtifactSummary+GraphEdge`); T4 is an OQ-1 candidate, not load-bearing. The r2 substitution **narrows** the blast radius risk vs r1 (removes the §23 representational-fork trap from the critical path).
- **Reversibility:** mostly reversible (pure lib ⇒ `git revert` = zero residue; Q1 re-bind = one line; Q2 re-letter = local-table edit). Tier relocation semi-irreversible (ADR-006-owned) but made cheap by the byte-identity golden. Off-switch: not registering the `{:else if view==='idef0'}` branch.
- **Detection time if wrong:** immediate at CI (12-scenario harness + ADR-006 byte-identity golden + NFR-002 micro-benchmark + the new F1/F2/F3/S-3/S-6 fixtures gate each phase PR). The r2 real-data tier-stack fixture closes the prior blind spot (real-data render was previously untested).
- **Customer-visible impact if wrong:** worst case = altitude drift across the 7 views (silent, visual) or a wrong/absent 9th view — a dev-tooling viewer; no checkout/billing/auth analogue.

### Missed edge cases (🎯) — new-risk scan on the revision

The dispatch requires confirming the revision itself introduces no new long-horizon risk. I stress-tested the r2 additions:

| # | Severity | Scenario introduced by r2 | Assessment |
|---|---|---|---|
| N-1 | LOW (residual, not a finding) | **Edge fan-out (I-11) is the `B_from × B_to` product** — quadratic in bucket size for a heavily-collided id | Realistically bounded: id-collision is the rare PROB-060 merge-dup case (bucket ≈ 2 ⇒ ≤4 EdgeIns); the complexity table caps it as `C` "bounded by bucket sizes"; PROB-060 (the collision source) is a GATE-0 precondition. Not a material new risk. |
| N-2 | LOW (residual, not a finding) | **S-4 substitution leaves both reuse hosts (T2 + builder) in the future** — Outcome 5 unprovable at T1 | Inherent to reuse-not-fork (needs ≥2 consumers); honestly disclosed `(future)`; no spec contradiction on either replacement host. Correct posture, not a new gap. |
| N-3 | LOW (residual, not a finding) | **S-3 drift-guard enum sourcing** — could be tautological if the test re-declares the 5 relations | BUILD-time implementation detail; RFC states the intent (byte-equal to live enum) correctly; tester must wire an independent reference. Out of RFC scope. |

**No new edge case rises to MEDIUM.** Explicit staff-level statement: the r2 revision is a set of honesty-improving reframes + hardening invariants (I-11..I-14) that *strengthen* the exact SPEC invariants (INV-5/6/8/10) the ADI names as the reason to prefer Option 1; it removes risk (the §23 fork trap) rather than adding it.

### Contract impact (📜) & Test surface (🧪) — re-checked

- **Contract:** SPEC-004 freezes honored (non-null `Idef0Diagram.mode`, Scenario 3, INV-10 in the tier-stack path — the F1/I-12 fix brings the fallback into conformance). §API stability posture (S-5) adds the missing signature-evolution discipline. No external contract newly broken.
- **Test surface:** the r2 harness adds the 6 review-driven fixtures (real-data tier-stack PRIMARY, collided-id edge, ≤6-box/rollup+16-root, `\0`-key, relation-drift, determinism property) on top of the 12-scenario map — my prior T-1 "highest-value code is real-world-unexercised" gap is now explicitly acknowledged (dense path = synthetic-only until T3) and the real-data default is a *tested* contract. Resolved as far as T1 can (real dense exercise is genuinely T3-gated).

## Recommended action

**PASS — proceed to guardian gate.** Recommended handoff to guardian:

1. **All six system-dev findings (S-1 HIGH + S-2..S-6) are resolved** by RFC r2; this EVID lifts the system-dev signal from `weakens` (EVID-047) to `supports`. The revision is honest, not cosmetic — the S-1 reframe and S-4 substitution are backed by premises I re-verified against live data and the §23 spec on disk.
2. **No new long-horizon risk above LOW.** Three LOW residuals (N-1 fan-out bound, N-2 both-hosts-future, N-3 drift-guard enum sourcing) are BUILD-time / inherent, recorded for transparency, none verdict-flipping.
3. **This does NOT clear the activation gate by itself.** RFC-028 activation remains sequencing-blocked (independently of any finding): `forgeplan_score` chain still has SPEC-004 / ADR-006 / ADR-007 as **draft** (skipped-as-evidence) and parent **EPIC-001 is evidence-less (R_eff 0)**. Guardian/orchestrator must sequence activation (EPIC-001 ≥1 supports EVID → SPEC-004 → ADR-006 + ADR-007 → RFC-028) — this is an orchestrator activation-prerequisite, not an RFC-body defect (as EVID-048/the r2 reconciliation already note).
4. **Not an `architect` redesign trigger** — the core structure was sound in r1 and is unchanged; every prior finding closed via focused RFC edits + harness additions + sequencing discipline.

## Residual risks

- **N-1/N-2/N-3 (all LOW)** as tabled above: edge fan-out product bound; both reuse hosts future (Outcome 5 T1-unprovable, inherent); drift-guard enum-sourcing is a BUILD detail. None blocks the gate.
- **NFR-002 ≤50 ms@N=1000 is target-until-measured** — correct posture; the real number is Phase-5 EVIDENCE, orthogonal to the S-1..S-6 resolutions.
- **Chain-trust / R_eff sequencing** (unchanged from EVID-047): the SPEC + 2 ADRs are still draft and EPIC-001 is evidence-less; RFC-028 cannot activate against a draft foundation regardless of this PASS. Flagged for guardian sequencing.
- **`mm-gate-failures` mental model absent from this bank (HTTP 404)** — the gate-failure synthesis could not be loaded; compensated by direct EVID-046/047/048 + EPIC risk-table + Hindsight recall.
- **Density figure is an upper bound** (≈0.095; multi-parent demotions only lower it) — S-1's "real data ⇒ tier-stack" conclusion is robust to that imprecision, and `refines`=11 was re-confirmed live this session.

## References

- Artifact under review: `RFC-028` r2 (draft, R_eff 0.0, full 440-line body read).
- Prior system-dev audit (this EVID re-verifies + supersedes-in-signal): `EVID-047` (CONCERNS, S-1 HIGH + S-2..S-6, verdict `weakens`).
- Sibling C4 EVIDs: `EVID-046` (architect-reviewer, CONCERNS F1–F4), `EVID-048` (guardian, CONCERNS).
- Parent: `EPIC-001` (critical; draft, R_eff 0.0 — the chain weakest link; Outcomes 2/5/6 + reindex risk row align with S-1/S-2).
- Frozen contract + ADRs (honored, not re-opened): `SPEC-004`, `ADR-006` (tier lift + Sankey shim + GATE-0 preconditions), `ADR-007` (IDEF0-STYLE projection, local relation table, Q2 letters).
- S-4/OQ-1 contract re-verified on disk: `docs/PROJECT-MAP-SPEC.md §23` (lines 262/317/336/237 — MapNode ownership, no adapter, sha1 keys).
- Live workspace signal (S-1 premise re-verified): `forgeplan graph --json` this session → refines 11 · based_on 20 · informs 103 → decomposition density ≈ 0.095 « 0.3.
- Ground-truth tree: `feat/idef0-decomposition-surfaces` @ `54a905c`.
- Mental models consulted: `mm-gate-failures` — **absent from this bank (HTTP 404)**.




