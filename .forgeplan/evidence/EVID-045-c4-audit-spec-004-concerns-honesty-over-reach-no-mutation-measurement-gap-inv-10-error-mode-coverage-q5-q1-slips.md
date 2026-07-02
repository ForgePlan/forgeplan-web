---
depth: standard
id: EVID-045
kind: evidence
last_modified_at: 2026-06-30T22:46:23.211264+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EVID-053
  relation: supersedes
status: superseded
title: 'C4 audit: SPEC-004 — CONCERNS (honesty over-reach, no-mutation measurement gap, INV-10/error-mode coverage, Q5/Q1 slips)'
---

# C4 semantic + health audit: SPEC-004

Independent (generator≠verifier) review of SPEC-004 "TADD derivation and ICOM-grammar
conformance for the IDEF0 decomposition core" — the T1 keystone SPEC of EPIC-001. Reviews the
SPEC as a **frozen conformance contract**: scenario↔invariant↔FR coverage, internal-invariant
consistency, project-rule compliance (rules 22/24 + no-shared-mutation), and Open-Question
deferral scoping. Content-domain fitness of the IDEF0 algorithm itself is architect-reviewer
territory and out of scope here.

## Structured Fields

evidence_type: audit
verdict: weakens
congruence_level: 3
review_verdict: CONCERNS

## Verdict

**CONCERNS** — SPEC-004 is schema-valid, MUST-complete, rule-compliant in intent, and its 6
frozen scenarios broadly map to the FRs/invariants; but six MEDIUM defects survive the gate
against the SPEC's **own** stated contract ("one test per `#### Scenario`", "scenarios are the
freeze", internally-consistent frozen invariants, verifiable measurements). None is fatal — all
are refinements an `artifact-maintainer` / the T1 core-RFC author can resolve before this
keystone is frozen and activated. Activation must therefore not proceed on the current text.

- **PASS** — none above LOW. Not the case here.
- **CONCERNS** — MEDIUM/HIGH present; maintainer + RFC-author fixes required before activation. ← this audit.
- **BLOCKER** — CRITICAL present. Not the case: no missing MUST section, no broken parent link, no rule violation.

## Ground-truth verification

- Base..head: `n/a — artifact review, no git/code mutation claimed by this dispatch`.
- Diff probe: `n/a — verified via forgeplan_get(SPEC-004)`.
- Diff state: **n/a**.
- Expected delta token: the 6 `#### Scenario` headers, INV-1..INV-10, FR-001..FR-007, AC-1..AC-5, Q1..Q5 (source: the dispatch's described structure).
- Token probe: `grep of the forgeplan_get(SPEC-004) body` → **FOUND** all of: 6× `#### Scenario:` (tier-vocab / buildDecompForest / densityGate / honesty / (id,title) numbering / classifyIcom case-per-relation), INV-1..INV-10, FR-001..FR-007, AC-1..AC-5, Q1..Q5.
- Verdict floor from ground-truth gate: **PASS-eligible** (the artifact under review is present and complete in stored state; the CONCERNS verdict is a semantic-quality judgement, not a claim-vs-reality gap).

Stored-state proof (excerpts read from `forgeplan_get(SPEC-004)`):
- `forgeplan_validate(SPEC-004)` → `passed: true, error_count: 0, warning_count: 0`.
- `forgeplan_score(SPEC-004)` (pre-EVID) → `r_eff: 0.0, evidence: [], weakest_link: EPIC-001` (parent link present; no evidence yet — expected for a pre-review draft).
- Contract pipeline present (port → buildDecompForest → buildTierStackForest → assignNodeNumbers → classifyIcom → computeIdef0Diagram → densityGate → structuralSignature → flattenOutline); Data Models table present (Relation … Outline); Errors table present (E-MISSING-IDENTITY … E-EMPTY).

## Schema completeness (MUST sections for kind=spec)

| MUST section | Present | Notes |
|---|:-:|---|
| Contract | ✓ | Pure-pipeline contract + frozen pipeline order + 10 invariants. OK |
| Data Models | ✓ | 18-row type table; geometry intentionally absent (headless). OK |
| Errors | ✓ | 7 typed never-throw states (E-MISSING-IDENTITY … E-EMPTY). OK |

Schema validator: PASS (0 MUST errors, 0 warnings). The SPEC also voluntarily carries
Summary/Problem/Goals/Non-Goals/Actors/FRs/Scenarios/NFRs/Constraints/SMART-AC/Open-Questions/
Related — well above the MUST floor. No missing-section finding.

## Section coherence — coverage matrix (task dimension a)

Scenario → FR / INV it freezes:

| `#### Scenario` | Covers FR | Covers INV |
|---|---|---|
| tier-vocab byte-identical | FR-001 | INV-1 |
| buildDecompForest 1-parent + informs=Mechanism | FR-003 | INV-2, INV-4 |
| densityGate threshold + tier-stack fallback | FR-004 | INV-6 |
| honesty real-vs-derived | FR-005 | INV-5 |
| (id,title) numbering stability | FR-006 | INV-7 |
| classifyIcom case-per-relation incl. based_on | FR-002 | INV-3, INV-9 (regression guard) |

Every `#### Scenario` does map to a concrete testable Given/When/Then assertion — no empty/
narrative scenario. FR/INV coverage by scenario **or** SMART-AC:

- FR-001..FR-006: covered by a scenario (and AC-1/AC-2/AC-3/AC-4). ✓
- FR-007 (pure + no-x/y): determinism half covered by **AC-5** + NFR-001; the **no-x/y** half has **no scenario and no SMART-AC** (see LOW finding F7).
- INV-1,2,3,4,5,6,7,9: covered by scenario and/or AC. ✓
- INV-8 (determinism): covered by AC-5 + the S5 `structuralSignature` snapshot clause. ✓
- **INV-10 (headless metadata sufficiency): no scenario, no SMART-AC** (see MEDIUM finding F3).
- **Errors E-EMPTY / E-CYCLE / E-UNKNOWN-RELATION / E-MISSING-IDENTITY-degraded-key: committed in the Errors table but no frozen `#### Scenario`** (see MEDIUM finding F4). E-ID-COLLISION→S5, E-MULTI-PARENT→S2/S4, E-DENSITY-BELOW→S3 are covered.

## Section coherence — consistency analysis (task dimension b)

Checked the invariant pairs the dispatch named. Two are clean; three surface defects:

- **INV-2 (informs=Mechanism) vs INV-4 (one structural parent): CONSISTENT.** The spine is
  `refines`-only and `informs` is explicitly excluded from parent/child creation, so the two
  invariants are mutually reinforcing, not contradictory. S2 exercises both jointly. No finding.
- **INV-7 ((id,title) stability + collision surfacing): CONSISTENT.** "same id, distinct
  (id,title) ⇒ both retained, idCollision=true" aligns with E-ID-COLLISION and the S5/P3
  PRD-016 merge-dup fixture (a real dogfood case — PRD-016 is dirty in the working tree). The
  order-invariance is well-defined because the forest is deterministic (INV-8). No finding.
- **INV-3 (total/explicit/no-drop): CONSISTENT** with E-UNKNOWN-RELATION (default branch
  reachable only for non-canonical strings) and S6. The canonical-5 `{informs, based_on,
  supersedes, contradicts, refines}` matches forgeplan's actual `forgeplan_link` relation enum
  exactly (verified against the live tool schema) — the widget's `HIERARCHY_RELATIONS`
  `{contains, belongs-to, refines, informs, supersedes}` is a *different* display set, correctly
  not reused. No finding.
- **INV-5 (honesty real/derived): UNDER-SPECIFIED → finding F1.** "real ⇒ authored edge … No
  element is ever real without an authored source edge", with FR-005 AC-3 measuring
  `count(elements with provenance==real lacking an authored source edge) == 0` over **nodes and
  edges**. A real **root** node (e.g. an authored EPIC) has no incoming authored edge, yet is
  plainly `real`. As frozen, a literal test forces every root to `derived` (contradicting
  "authored ⇒ real") or the AC is unsatisfiable. The predicate conflates node-provenance
  (real = present in snapshot) with edge-provenance (real = authored link).
- **INV-9 (no shared mutation): CONSISTENT in intent but UNVERIFIABLE as measured → finding
  F2.** See rule-compliance below.

## Link graph health

| Relation | Source | Target | Status |
|---|---|---|---|
| refines | SPEC-004 | EPIC-001 | OK — parent present (confirmed via `forgeplan_score` weakest_link traversal); EPIC-001 lists this SPEC as the T1 "SPEC TADD+ICOM" keystone child |
| informs | EVID-045 | SPEC-004 | OK — this audit, auto-linked at creation |

No broken/stale links. EPIC-001 and SPEC-004 are both `draft` (active arc, not stale). The
"(planned) RFC T1 / ADR tier-lift / ADR projection" children referenced by SPEC-004 do not yet
exist as artifacts — that is expected at this pre-RFC stage, not a broken-link finding.

## Freshness

- References to active artifacts: EPIC-001 (draft, current), PROB-060 / forgeplan#397 (live basis for INV-7).
- References to superseded/deprecated artifacts: none.
- Stale reference count: 0. The SPEC's external citations (forgeplan 0.33 `get --json` omissions, the 2026-06-30 gemini ADI run) are current.

## R_eff trust

- Current R_eff (SPEC-004, pre-EVID): 0.0 (no evidence linked) — normal for a pre-review draft.
- Linked EVID count after this audit: 1 (EVID-045, informs).
- This EVID: `congruence_level: 3` (audit performed directly on the real stored artifact = same context), `evidence_type: audit`, numeric CL present → no CL0/parse-collapse risk.
- CL parse errors in the chain: none.
- Note: SPEC-004's R_eff remains gated by parent EPIC-001 (itself R_eff 0, unactivated) — a chain-level observation, not a defect in SPEC-004's body.

## Findings (severity-ranked)

- 🟠 MEDIUM (F1) — **SPEC-004 § INV-5 / § FR-005 AC-3 / § Scenario "honesty real-vs-derived"**: the honesty predicate "real ⇒ authored source edge" over-reaches from edges to nodes. A real *root* node has no incoming authored edge, so the frozen count `count(elements with provenance==real lacking an authored source edge)==0` is unsatisfiable for roots (or forces roots to `derived`). Scope the predicate: node-provenance `real` = present in snapshot; edge/inferred-link-provenance `real` = authored link.
- 🟠 MEDIUM (F2) — **SPEC-004 § FR-002 AC-2 / § NFR-003 (Measurement) / § SMART AC-2**: the no-shared-mutation guarantee (INV-9) is measured as `git diff --stat` / `git diff` on `type-tier.ts` + `cluster.svelte.ts`, but FR-001/INV-1 **require those same files to change** (tier vocabulary is lifted out and the widget re-exports). A file-level diff cannot distinguish the allowed tier-lift edit from a forbidden `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge` mutation. Re-specify the check at **symbol granularity** (golden snapshot of the `HIERARCHY_RELATIONS` literal + `normaliseHierarchyEdge` body), not whole-file.
- 🟠 MEDIUM (F3) — **SPEC-004 § INV-10 vs § Behavioural Scenarios / § SMART AC (absent)**: INV-10 (headless metadata sufficiency — host renders without recomputing classification/numbering; resolves the ADI "reuse-not-fork needs metadata" risk) has **no** frozen scenario and **no** SMART-AC. NFR-004 measures symbol non-duplication, which is a different property (reuse ≠ metadata completeness). Add a scenario asserting an `Idef0Diagram` carries every field a host needs (icom role + provenance + number) with no recompute.
- 🟠 MEDIUM (F4) — **SPEC-004 § Errors vs § Behavioural Scenarios**: committed never-throw behaviours **E-EMPTY**, **E-CYCLE**, **E-UNKNOWN-RELATION**, and the **E-MISSING-IDENTITY degraded-key** path have no frozen `#### Scenario`. The SPEC states "the harness MUST implement one test per `#### Scenario`" and "scenarios are the freeze", so these contracted behaviours fall outside the conformance gate. Add scenarios (or explicitly mark them RFC-bound).
- 🟠 MEDIUM (F5, deferral) — **SPEC-004 § Open Questions Q5 vs § Errors E-MISSING-IDENTITY vs § Data Models ForestNode**: Q5 (degraded-key keep-vs-drop) is owned by "this SPEC" and marked unresolved/pending T3 data, yet the Errors table and `ForestNode.degradedKey` already **freeze** "keep with degraded key `(id,"")`". This is an internal contradiction: a SPEC-owned decision the body has both made and left open, with no scenario. Q5 is the one Open Question hiding a genuine SPEC-level gap (resolve it in-SPEC or stop freezing the behaviour).
- 🟠 MEDIUM (F6, deferral) — **SPEC-004 § Open Questions Q1 vs § Scenario "densityGate…" vs § INV-6**: deferring the density-**metric definition** (children-per-page vs authored-depth vs fan-out) to the RFC leaves S3 non-executable as a *deterministic* frozen test — no fixture can be provably "below threshold" without a metric (S3 itself hedges "a single refines chain … or fan-out below the gate"). Freeze at least the metric's **monotonic/directional contract** (what "denser" means) in-SPEC; the threshold value + exact formula may remain RFC-bound.
- 🔵 LOW (F7) — **SPEC-004 § FR-007 AC-2**: the "`Idef0Diagram` contains no x/y/pixel fields" assertion appears only in FR-007 prose + the Data-Models note; it is in no `#### Scenario`/SMART-AC. Low materiality because the type shape already enforces absence at compile time, but given "no geometry in T1" is EPIC Outcome-5's load-bearing premise, a one-line static/type assertion in the freeze would harden it.

Correctly-scoped deferrals (no finding): **Q2** (exact ICOM letter for based_on/supersedes/
contradicts → projection ADR; S6 tests only "non-null, non-mechanism", so S6 stays executable),
**Q3** (multi-parent tie-break order → RFC; S2 asserts only determinism + count==0, executable
without it), **Q4** (NFR-002 N≥1000 frame budget → pseudocode/Big-O; an NFR, not a MUST FR).

Tooling note (not a finding): `mm-pipeline-methodology` mental model is absent from this bank
(HTTP 404), so the methodology synthesis could not be loaded; phase/status coherence was checked
directly instead (SPEC draft + EPIC draft + Phase-1 "Shaping" are mutually consistent).

## Rule compliance (task dimension c)

- **Rule 22 (pure headless, read-only `/api/*`, no mutation): COMPLIANT.** Non-Goals + Constraints
  explicitly forbid any forgeplan mutation, `spawn`, or new endpoint; `computeIdef0Diagram` emits
  topology + ICOM roles with no I/O. No violation.
- **Rule 24 (FSD `shared/` ⊅ `widgets/`; lift target `shared/lib/tier/`): COMPLIANT.** INV-1,
  FR-001, NFR-003, and S1's static-import check all enforce zero `widgets/` imports from
  `shared/lib/{idef0,tier}/`; widgets re-export *from* shared (allowed direction). No violation.
- **No mutation of shared `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge` the 7 views depend on:
  COMPLIANT in intent** (core ships its own `idef0-relation.ts`; INV-9), **but the verification
  method is flawed** — finding F2 (file-diff cannot separate the allowed tier-lift edit from a
  forbidden table mutation). No rule violation; one verifiability gap.

## Recommendation

**CONCERNS** — resolve before SPEC-004 is frozen/activated as the T1 keystone. Dispatch to the
SPEC author / `artifact-maintainer` (form fixes) and surface F5/F6 to the T1 core-RFC author:

- F1 — scope INV-5 / FR-005 AC-3 honesty predicate so real *root nodes* are not forced to `derived`.
- F2 — re-specify INV-9 / NFR-003 / AC-2 measurement at symbol granularity (not whole-file diff).
- F3 — add a frozen scenario (or SMART-AC) for INV-10 metadata sufficiency.
- F4 — add scenarios for E-EMPTY / E-CYCLE / E-UNKNOWN-RELATION / degraded-key, or mark them RFC-bound.
- F5 — resolve Q5 in-SPEC (it is SPEC-owned and already half-frozen) or remove the frozen E-MISSING-IDENTITY behaviour.
- F6 — freeze the density-metric's directional contract in-SPEC so S3 becomes a deterministic test (threshold value stays RFC-bound).
- F7 (LOW) — optionally add a no-coordinates static assertion to the freeze.

No `forgeplan_activate` performed (outside this role's whitelist and explicitly out of scope per
the dispatch). The SPEC body was not edited. Activation decision is the orchestrator/guardian's
after maintainer fixes and a re-review.




