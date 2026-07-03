---
depth: standard
id: EVID-076
kind: evidence
last_modified_at: 2026-07-02T13:26:13.622941+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-036
  relation: informs
status: draft
title: 'Artifact-health audit: ARC-C wave (PRD-036 / SPEC-006 / ADR-008 / RFC-030) — CONCERNS: 2 MEDIUM coherence findings'
---

# Artifact-health audit: ARC-C wave (PRD-036 / SPEC-006 / ADR-008 / RFC-030)

Independent Profile-B artifact-health review of the four SHAPE-wave artifacts of EPIC-001's T4 track. Reviewer identity: `claude-code/fable-5/artifact-reviewer-task-5`. Scope: artifact FORM only (schema, coherence, links, freshness, R_eff) — content/design fitness belongs to architect-reviewer.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

## Verdict

**CONCERNS** — all four artifacts are schema-valid (0 MUST / 0 SHOULD each), every MUST section non-stub, all 5 dispatch-expected graph edges present (0 missing / 0 stale / 0 broken), PRD FRs rule-11 clean, Non-Goals fencing correct, ADR fully MADR-shaped with the amendment appendix and status draft. Two MEDIUM cross-artifact coherence defects require artifact-maintainer wording fixes before the activation gate: (1) PRD-036 attributes the GATE-C ordering supersession to "this wave's ADR", but ADR-008 does not record that decision; (2) SPEC-006 claims rule 22 "stays byte-intact this arc" while its child RFC-030 schedules an in-arc edit of the rule file.

Note on axes: the review outcome is CONCERNS (above); the structured field `verdict: supports` is the evidence relation per the house parser enum — this audit supports, not weakens, the chain's structural fitness once the two single-section wording fixes land.

## Ground-truth verification

- Base..head: n/a — artifact mutations in LanceDB + `.forgeplan/` projections; no git-diff-based code change claimed by the workers.
- Diff probe: n/a — verified via `forgeplan_get` on all four IDs + on-disk `ls` of the four markdown projections.
- Token probes against the STORED bodies (never the workers' transcripts):
  - PRD-036: `### FR-012 — Append-loop job intake (Phase 4; HUMAN-GATED)` → FOUND; `## SMART Acceptance Criteria` with AC-1…AC-5 → FOUND; 12 FRs + 5 NFRs + 5 Open Questions → FOUND.
  - SPEC-006: `## Summary` → FOUND (the author's reported first-pass MUST fix is really in the stored body); sub-contracts `### C1` … `### C6` → FOUND; E2 catalog with 14 error-rule rows → FOUND; 6 `#### Scenario` blocks → FOUND.
  - ADR-008: `## Appendix — EXACT proposed amendment text for `.claude/rules/22-readonly-proxy.md`` → FOUND (sections A/B/C); 3 options each with Pro/Con/Verdict → FOUND; `Status | Draft — **HUMAN-GATED**` row → FOUND; index status = `draft` → CONFIRMED.
  - RFC-030: `## Options Considered` (Option 1 CHOSEN / Option 2 REFUTED / Option 3 FOLDED + SD-1..SD-3) → FOUND; `## Implementation Phases` (5 ordered phases) → FOUND; `## Invariants` (7) → FOUND.
- On-disk projections (`ls -la`): `PRD-036-…md` 19,920 B · `SPEC-006-…md` 30,936 B · `ADR-008-…md` 27,596 B · `RFC-030-…md` present under `.forgeplan/rfcs/` — all exist, none empty.
- ADR-008's "modifies no file" claim: `git status --porcelain -- .claude/rules/` → EMPTY; last commit touching `22-readonly-proxy.md` is pre-wave (`364c5e1`). CONFIRMED.
- Verdict floor from ground-truth gate: **PASS-eligible** — no claim-vs-reality gap on any of the four artifacts.

## Schema completeness (MUST sections per kind — all non-stub)

| Artifact | MUST sections | Present | Notes |
|---|---|:-:|---|
| PRD-036 | Problem · Goals · Non-Goals · Functional Requirements · Target Users · Related Artifacts | ✓ all | 12 FRs with priorities + per-FR ACs; validator PASS 0 MUST / 0 SHOULD (1 COULD: FR checkbox style — author-acknowledged) |
| SPEC-006 | Contract · Data Models · Errors (+ Summary, required by this workspace's spec template) | ✓ all | 6 sub-contracts; full TS shapes; complete E1/E2/E3 taxonomy; validator PASS 0/0/0 |
| ADR-008 | Context · Decision · Consequences | ✓ all | + Drivers, 3 weighed options, Decision Outcome w/ trust calculus, Affected Files, Rollback, Revisit Triggers, Invariants, Appendix; validator PASS 0 MUST / 0 SHOULD (2 COULD: Preconditions/Postconditions — author-acknowledged style notes) |
| RFC-030 | Summary · Motivation · Options Considered · Proposed Direction · Implementation Phases | ✓ all | + Invariants, Risks, Test Strategy Hooks, Rollback; validator PASS 0/0/0 |

## Dispatch-specific checks

- **PRD FRs capability-only (rule 11)**: PASS — FR-001…FR-012 contain no library/framework names (view ids and the HTTP verb GET are product/protocol vocabulary, not implementation leakage). Tool names (`svelte-check`, `vitest`) appear only in SMART-AC measurement clauses, matching the house precedent for measurable ACs (cf. CLAUDE.md's own `node scripts/smoke.mjs` CL3 example); rule 11's prohibition targets FR bodies, which are clean.
- **SMART ACs measurable**: PASS — PRD AC-1…5 and SPEC AC-1…5 each carry a countable threshold (100% of zones, 0 fills, ≥14 fixtures, deep-equal, 0 grep findings) and a verification point (CI / PR review, "before the arc PR merges").
- **Non-Goals fencing**: PASS — PRD-036 § Non-Goals fences (a) browser-initiated mutation (rule 22 intact this arc), (b) daemon / agent-spawn (out of this repo permanently), (c) Phases 2–4 (FR-010/011/012 explicitly staged; FR-012 double-gated on the human-activated rule-22 amendment ADR).
- **ADR MADR shape**: PASS — status draft + human gate declared in the header table AND in index metadata; ≥3 genuinely weighed options (A adopted; B1 REFUTED with real cons, B2 subsumed; C NEEDS-MORE-DATA with its timing discipline adopted and its escape path encoded as Revisit Trigger 1); Consequences split positive/negative/neutral with the residual drive-by risk honestly named; exact amendment text confined to the Appendix; no rule file touched (verified above).

## Section coherence

| Pair | Coherent | Issue |
|---|:-:|---|
| PRD AC-1…5 ↔ FR-001…007 | ✓ | every AC names its FRs; all named FRs exist |
| SPEC C1–C6 ↔ PRD FR-001…007 | ✓ | contract covers Phase-1 FRs; staged FRs correctly excluded |
| RFC resolutions ↔ PRD Q1/Q2/Q3/Q5 + SPEC Q1/Q2/Q3 | ✓ | each open question resolved or explicitly deferred with owner |
| PRD § Problem "recorded in this wave's ADR" ↔ ADR-008 content | ✗ | **Finding 1** — ADR-008 records only the rule-22 write carve-out, not the GATE-C ordering supersession |
| SPEC § Out of scope "rule 22 stays byte-intact this arc" ↔ RFC-030 Governance/Module Breakdown | ✗ | **Finding 2** — RFC schedules an in-arc read-only allow-list edit of the rule file |
| 9th-view count across PRD FR-006 / SPEC C6 / RFC registration section | ✓ | consistent "9th"; RFC corrects the task hint "10th" and §8's stale "8th" against the real 8-entry registry |

## Link graph health

| Relation | Source | Target | Expected by dispatch | Status |
|---|---|---|:-:|---|
| refines | PRD-036 | EPIC-001 | ✓ | OK (EPIC-001 active) |
| based_on | SPEC-006 | PRD-036 | ✓ | OK |
| based_on | ADR-008 | PRD-036 | ✓ | OK |
| based_on | RFC-030 | PRD-036 | ✓ | OK |
| based_on | RFC-030 | SPEC-006 | ✓ | OK |
| informs | EVID-076 (this) | PRD-036 | — | created this audit |

0 missing edges, 0 stale, 0 broken. No duplicate/parallel edges among the four.

## Freshness

- References to superseded/deprecated artifacts: **none**. EPIC-001 active; PRD-034 / RFC-029 / RFC-028 / ADR-006 / ADR-007 / SPEC-004 / SPEC-005 / PRD-016 / RFC-015 all exist and none is superseded.
- Observations (parent-side maintenance, NOT findings against the audited four): EPIC-001 § Risks still carries the pre-supersession GATE-C mitigation un-annotated, and § Children still lists the T4 PRD as "(планируется)" — worth an epic-body refresh when the guardian processes this wave. EPIC-001's embedded frontmatter `status: Draft` also desyncs from index status `active` (systemic, pre-existing, out of this audit's scope).

## R_eff trust

- PRD-036 R_eff at audit time: **0.0** (`forgeplan_score`: "No evidence found (L0)"; formality 0.95, granularity 0.8, grade B) — the EXPECTED pre-prove draft state; this EVID (CL3, audit) is the first link and lifts it above 0.
- SPEC-006 / ADR-008 / RFC-030: r_eff 0.0, same expected state; each body correctly plans its prove-phase CL3 EvidencePack before activation (rule 11).
- CL parse errors in linked EVIDs: **none** (no prior EVIDs linked to any of the four).
- Weakest link after this audit: EVID-076 itself (CL3) on PRD-036; siblings remain evidence-less until the prove phase.

## Findings (severity-ranked)

- 🟡 MEDIUM — **PRD-036 § Problem (para 2) + § Related Artifacts (EPIC-001 bullet): dangling decision-record pointer.** Both passages state the GATE-C ordering supersession ("render against a HAND-WRITTEN map.json first", replacing EPIC-001's "не строим рендерер, пока картограф не эмитит реальный map.json") is "recorded in this wave's ADR". The wave's only ADR, ADR-008, records solely the rule-22 write-carve-out decision — its Context/Decision/Options never record the ordering supersession. Sibling RFC-030 § Related Artifacts instead attributes the supersession to PRD-036 itself ("recorded in PRD-036"). A guardian or future reader chasing PRD-036's pointer finds no such record, while EPIC-001 § Risks still carries the superseded mitigation as normatively active. Fix (artifact-maintainer): repoint PRD-036's two mentions to "recorded in this PRD (§ Problem)" — or the orchestrator decides the ordering supersession deserves its own small decision record + an EPIC-001 risk-row annotation.
- 🟡 MEDIUM — **SPEC-006 § Out of scope (final bullet) contradicts child RFC-030 on rule-22 file byte-intactness.** SPEC-006 states "rule 22 stays byte-intact this arc"; RFC-030 (based_on SPEC-006) § Proposed Direction → "Governance: rule-22 posture" + § Module Breakdown schedule an in-arc, same-PR **edit** of `.claude/rules/22-readonly-proxy.md` (read-only allow-list section for `/api/map` — required by rule 22's own "any additional non-forgeplan endpoint requires … a fresh amendment to this rule" clause, mirroring the `/api/instances` precedent). The RFC's posture is the correct one; the SPEC's "byte-intact" wording will be falsified the moment the build-wave PR lands. Fix (artifact-maintainer): soften SPEC-006's bullet to "zero write surface this arc; the read-only allow-list amendment for `/api/map` is owned by RFC-030's build wave" (C5's "adds zero write surface" is accurate and stays).

No CRITICAL, no HIGH, no LOW findings survived the Pre-Report Gate. Dropped as false positives: tool names in SMART ACs (house-precedented measurement clauses); PRD FR checkbox style + ADR Pre/Postconditions (COULD-level, author-acknowledged); index `depth: standard` vs body-declared Deep/Critical depth (systemic CLI indexing behaviour across the whole workspace, incl. EPIC-001, pre-existing); EPIC-001 body staleness (parent artifact, outside the audited set — recorded as observation above).

## Recommendation

**CONCERNS** — dispatch `artifact-maintainer` for the two wording fixes (both single-section prose edits, no design change), then the chain is guardian-gate ready from the FORM side:

1. PRD-036: repoint the "recorded in this wave's ADR" supersession attribution (§ Problem + § Related Artifacts).
2. SPEC-006: replace "rule 22 stays byte-intact this arc" with wording that matches RFC-030's in-arc read-only amendment.

Activation remains with guardian/orchestrator. SPEC-006 / ADR-008 / RFC-030 additionally stay blocked on their own prove-phase EVIDs (R_eff = 0.0 today, rule 11); ADR-008 must NEVER be activated without the explicit human OK (its INV-5) regardless of R_eff.

## Method (audit trail)

Profile-B 8-step procedure: claim PRD-036 (`claude-code/fable-5/artifact-reviewer-task-5`; 1 lock-contention retry) → `forgeplan_get` × 5 (four targets + EPIC-001 parent) → memory grounding (`memory_recall` 11 hits; mental-model step unsatisfiable — `mental_model_list` returned an empty bank, `mm-pipeline-methodology` unavailable, consistent with all four author reports) → `forgeplan_validate` × 4 (all PASS 0 MUST) → Step-4.5 ground-truth token/file/git probes → Step-5 mental reasoning across schema/coherence/links/freshness/R_eff (NOT `forgeplan_reason`) → `forgeplan_score` PRD-036 → this EVID (`forgeplan_new` kind=evidence parent_id=PRD-036 auto-informs) → validate + release.

