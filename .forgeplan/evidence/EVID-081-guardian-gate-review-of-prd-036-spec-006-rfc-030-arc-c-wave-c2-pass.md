---
depth: standard
id: EVID-081
kind: evidence
last_modified_at: 2026-07-02T14:06:26.163304+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-030
  relation: informs
- target: SPEC-006
  relation: informs
- target: PRD-036
  relation: informs
status: active
title: 'Guardian gate review of PRD-036 + SPEC-006 + RFC-030 (ARC C Wave C2): PASS'
---

# EVID-081: Guardian gate review of the ARC C Wave C2 SHAPE trio (PRD-036 / SPEC-006 / RFC-030)

## Verdict

**PASS**

One-line justification: every gate-relevant finding from the full C4 chain (EVID-076 / EVID-077 / EVID-078 — all CONCERNS, zero BLOCKERs) is verified FIXED in the amended artifact bodies and in committed code at HEAD `be2cc8e`; all three artifacts validate 0 MUST / 0 SHOULD; the link graph is exact; the only residual gap (SPEC-006 R_eff 0.0 — a missing informs edge, not a missing audit) is closed by this EVID's own `informs` link, subject to the mandatory pre-activation score check in Orchestrator instructions below.

- **PASS** — orchestrator may activate the TRIO via `forgeplan_activate`, in the order and with the checks specified in Orchestrator instructions.
- ADR-008 is OUTSIDE this gate: it exists, is correctly shaped (MADR, human-gated in five places, parseable Revisit Triggers, F+G+R=14), and MUST stay draft until the explicit human OK (its INV-5). This verdict neither weighs nor permits its activation.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

(CL3: this gate ran against the actual amended artifact bodies via MCP, the actual committed test file at HEAD, a live vitest run on the touched files, live `forgeplan_validate`/`forgeplan_score`/`forgeplan graph`, on branch `feat/idef0-composed-map`.)

## Artifact(s) under review

| ID | Kind | Status | R_eff at gate-entry | Title |
|---|---|---|---|---|
| PRD-036 | prd | draft | 0.8 (EVID-076, CL3) | Composed-map graft + onboarding (T4) |
| SPEC-006 | spec | draft | **0.0** (no informs edge — see Gate criteria #7) | Composed-map render contract + map.json schema (forgeplan.map/v1) |
| RFC-030 | rfc | draft | 0.8 (EVID-077 + EVID-078, CL3) | Composed-map Phase-1 render-proof: isolated map entity + pure-grid widget + read-only /api/map as the 9th view |

Parent: EPIC-001 (active). Existence-only check: ADR-008 (draft, human-gated Phase-4 decision record) — present, correct shape, deliberately not gated here.

## EVIDENCE chain inspected (chronological, full chain per HARD RULE 2)

| EVID | Verdict | Source agent | Critical findings (one-line) | Fix state (verified in amended bodies / code) |
|---|---|---|---|---|
| EVID-076 | CONCERNS | artifact-reviewer | 2 MEDIUM: (1) GATE-C supersession attributed to "this wave's ADR" which doesn't record it; (2) SPEC-006 "rule 22 byte-intact" contradicts RFC-030's in-arc read-only amendment | BOTH FIXED: PRD-036 §Problem now records the supersession in itself ("recorded here, in this PRD… EVID-076 finding 1 resolved"); SPEC-006 §Out of scope now reads "zero write surface this arc; the rule-22 FILE is not byte-intact… EVID-076 finding 2 resolved" |
| EVID-077 | CONCERNS | system-dev | **HIGH E-1**: time-travel scrubber + live-polling map = lying map; MEDIUM G-1: `GRAPH_VIEW_IDS.size === 8` test breaks on 9th view; deferred C-1/C-2/E-2/M-1/M-2/M-3/T-1 | E-1 FIXED: RFC-030 SD-1 amendment + Invariant 8 + `isLive = !snapshotting` prop + poll suspension + "Map is live-only" overlay; SPEC-006 C6 bullet + dedicated time-travel-suspension scenario + Phase-4 test hook. G-1 FIXED IN COMMITTED CODE (see Ground-truth). Deferred items: staged via this EVID's build-wave obligations (below) — not silently dropped |
| EVID-078 | CONCERNS | architect-reviewer | MEDIUM F1: schema-tag discriminant before validation → wrong-tag file silently renders empty state (vacuous green); LOW F2: no FlowChips owner; LOW F3: §15 nav set neither pinned nor staged | ALL FIXED: `is-empty-map-response.ts` — view branches on envelope EMPTINESS only, every non-empty payload reaches `validateMapDocument`, wrong-tag render-harness case named in Impl Phase 4 + Test Strategy Hooks; `FlowChips.svelte` component contract added (HTML chip strip, dim/highlight via `highlightedIds`); §15 nav set PINNED in PRD-Q1 resolution (Esc full reset; >3 px drag click-suppression; plain-wheel pan vs Ctrl/⌘-wheel zoom filter) as checkpoint acceptance bullets + test hooks |

Sibling-wave chain (NOT informs-linked to the trio, swept per "no unresolved BLOCKER anywhere"): EVID-079 (tester, **BLOCKER** — 1 red test, FIX-1 fixture 320≯320) and EVID-080 (code-reviewer, CONCERNS) both target PRD-035 (idef0 wave-2 UX) on the same branch. The BLOCKER is **empirically resolved**: this gate re-ran `npx vitest run` on both touched files → **85/85 passed** (exactly EVID-080's stated PASS-eligibility target). No unresolved BLOCKER exists anywhere on the branch's evidence graph.

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact body MUST validation | ✅ | `forgeplan_validate`: PRD-036 PASS 0/0 (1 COULD style note), SPEC-006 PASS 0/0/0, RFC-030 PASS 0/0/0 — run fresh this gate, post-amendment |
| 2 | All required EVIDENCE linked | ✅ (with one edge gap) | prd: EVID-076; rfc: EVID-077 + EVID-078; spec: audit EXISTS (EVID-076's scope explicitly covers SPEC-006 — title + schema/coherence rows + finding 2) but the informs EDGE was minted only to PRD-036; this EVID closes the edge gap (see #7) |
| 3 | No BLOCKER in chain | ✅ | Trio chain: 3× CONCERNS, 0 BLOCKER. Sibling EVID-079 BLOCKER resolved — verified by live test run (85/85) |
| 4 | Unresolved CONCERNS count | 0 HIGH / ~6 MEDIUM-LOW acknowledged | The only HIGH (E-1) is designed out and invariant-pinned. Remaining MEDIUM/LOW (C-1, C-2, E-2, M-1, M-2, M-3, T-1) were explicitly adjudicated by EVID-077 itself as "acknowledged follow-ups tracked in the build wave / Phase-4 gate" — carried as MANDATORY build-wave obligations below |
| 5 | Activation policy satisfied | ✅ (sequenced) | EPIC-001 (parent) active; RFC-030's parents activate first per the order below; R_eff: PRD 0.8 / RFC 0.8 / SPEC > 0 after this EVID's link (red-line #3 check mandatory pre-activation); ADR-008 stays draft (human gate, INV-5) |
| 6 | Project-specific gates | ✅ / N/A | No `check:ready-to-ship` script, no Makefile (recorded honestly). Targeted validation run: vitest on both touched test files → 85/85 green. svelte-check not re-run this gate: last full run 0 errors/0 warnings/1136 files (EVID-079+EVID-080), and the post-run delta (`be2cc8e`) touches only `.forgeplan/*.md` + the two test files re-run green here |
| 7 | Blast radius within stated threshold | ✅ | See Blast radius. One policy note: SPEC-006 at R_eff 0.0 CANNOT be activated (workspace red-line #3); this EVID's informs link to SPEC-006 resolves it — orchestrator MUST verify `forgeplan_score SPEC-006` > 0 before `forgeplan_activate SPEC-006` |

### Project-config gates (`.forgeplan/project-config.yaml` → `quality_gates`)

**Config source:** not found — built-in conservative defaults applied (HARD RULE 7): min_test_coverage=80, max_findings_critical=0, max_findings_high=3, max_findings_medium=10, require_validate_pass=true, require_audit_pass=true, require_evidence_chain=[prd,rfc,adr,spec].

| Criterion | Threshold (defaults) | Observed | Result |
|---|---|---|---|
| Test coverage | ≥80% | N/A at SHAPE gate — no code exists for the trio yet; no tester EVID structurally possible. Merge-gate obligation staged (build wave MUST attach CL3 conformance/tester EVIDs to SPEC-006 + RFC-030 before the arc PR merges, rule 11) | ✅ N/A-at-SHAPE, staged |
| Critical findings | ≤0 | 0 across the trio chain | ✅ |
| High findings | ≤3 | 1 raised (E-1), 0 unresolved (fix verified) | ✅ |
| Medium findings | ≤10 (informational below 2×) | ~7 raised, 4 resolved (EVID-076 ×2, G-1, F1), remainder acknowledged with recorded mitigation paths | ✅ |
| Validate pass | required | PASS ×3 (fresh run) | ✅ |
| Audit pass | required (≥1 Profile B EVID with PASS) | House enum carries no PASS value in structured fields — all three audits are `verdict: supports` @ CL3 with gate verdicts CONCERNS whose required fixes are verified landed (EVID-076's support is explicitly conditioned on the two fixes, which landed; EVID-078 required its F1 amendment "before Impl Phase 4" — it landed pre-gate). This guardian EVID (supports/CL3/audit, gate verdict PASS) completes the requirement in workspace-native semantics | ✅ (recorded, not silent) |
| Evidence chain | required for prd/rfc/spec | prd ✓, rfc ✓, spec: edge gap at gate-entry, closed by this EVID's informs link at gate-exit (substance existed in EVID-076 throughout — audit trail never missing, only the edge) | ✅ at gate-exit |

**Gates summary:** 7/7 (source: defaults).

## Revisit Trigger check (Step 4b)

- The trio depends on NO active ADR: graph edges show `ADR-008 →based_on PRD-036` (the ADR depends on the PRD, not vice versa); no edge from the trio to ADR-006/ADR-007 or any other ADR.
- ADR-008 (existence check + decay sweep anyway): Compliance/Revisit Trigger section parses cleanly — 2 event triggers + 1 date trigger (2027-01-02, future), all `[ ]` unchecked → no FIRED, no DATE-FIRED. F+G+R recorded in-body: F=5 G=4 R=5 = **14** ≥ full-ADR threshold 14; created 2026-07-02 (fresh). No Evidence Decay exposure.
- Delta-spec gate: no `supersedes` edges on any trio artifact → N/A. (PRD-036's GATE-C ordering supersession is a recorded prose decision in §Problem, not a supersede operation.)
- ADI discipline: this workspace's kind enum has no `adi`/`hypotheses` EVID kind; ADI ran in its workspace-native form — `forgeplan_reason PRD-036` (this wave), 3 hypotheses recorded verbatim in RFC-030 §Options Considered (H1 CHOSEN / H2 REFUTED / H3 FOLDED) and ADR-008 §Considered options. Depth is Standard (ADI recommended, not mandatory, per this repo's routing table) — satisfied and exceeded.
- C4-diagram discipline: RFC-030 discusses ≥3 modules (entities/map, widgets/composed-map, shared/server, routes/api); no `docs/c4/RFC-030.md` and the component diagram is deliberate prose. This workspace's CLAUDE.md declares NO C4-diagram requirement (its design-source norm is `docs/PROJECT-MAP-SPEC.md` + verified-in-code integration sections, which RFC-030 meets exemplarily). Recorded as an informational note, not a downgrade; optional build-wave nicety: a mermaid `flowchart` block in the RFC.

## Ground-truth verification

- Branch: `feat/idef0-composed-map` @ HEAD `be2cc8e` ("docs(forgeplan): ARC C fix-loop — time-travel invariant, spike-grid alignment, G-1 test guard").
- `git show be2cc8e --stat` → amends exactly: EPIC-001 (+2), PRD-036 (14), RFC-030 (84), SPEC-006 (34), `idef0-view.render.test.ts` (12) — the fix-loop delta is REAL and matches the claimed fixes. DELTA=PRESENT.
- G-1 token probe against COMMITTED code (not transcripts): `idef0-view.render.test.ts:561-584` — RC-6 describe now asserts `ids.slice(0, 7)` = the 7 originals + `expect(ids).toContain("idef0")` + `GRAPH_VIEW_IDS.size === GRAPH_VIEWS.length`, with the in-code comment naming EVID-077 G-1 and RFC-030's future `map` registration. FOUND. Working tree clean on this file.
- Live test run: `npx vitest run src/widgets/dependency-graph/lib/idef0-layout.test.ts src/widgets/dependency-graph/ui/idef0-view.render.test.ts` → **2 files passed, 85/85 tests, 3.43 s** (EVID-079's blocker fixture fix confirmed green first-hand).
- Amended-body token probes via `forgeplan_get` (stored bodies, never transcripts): PRD-036 "Program decision — recorded here, in this PRD" + "EVID-076 finding 1 resolved" → FOUND; SPEC-006 "The rule-22 FILE is not byte-intact this arc" + "EVID-076 finding 2 resolved" + "#### Scenario: time-travel suspension" → FOUND; RFC-030 "Invariant 8"/"isLive"/"SD-1 amendment"/"is-empty-map-response"/"FlowChips.svelte"/"EVID-078 F1/F2/F3" → FOUND; spike grid "2 rows × 4 cols" + pinned constants (190/60/36, zpad 50/24/24, gap 88/70, margin 40) in SPEC-006 C1 + RFC-030 PRD-Q5 → FOUND; `--map-*` namespaced tokens (RFC Module Breakdown + Invariant 7 + SPEC C1) → FOUND; "Volatile emit-time counts never enter identity" (SPEC C1 nodes) → FOUND.
- Link graph: `forgeplan graph` → `PRD-036 -->|refines| EPIC-001`, `SPEC-006 -->|based_on| PRD-036`, `RFC-030 -->|based_on| PRD-036`, `RFC-030 -->|based_on| SPEC-006`, `EVID-076 -->|informs| PRD-036`, `EVID-077/078 -->|informs| RFC-030`, `ADR-008 -->|based_on| PRD-036`. Exactly as required.

## Blast radius

- **Affected scope on activation:** artifact-graph only — three drafts flip active on a feature branch; zero production/deploy surface (the design's own blast radius is a local read-only viewer: one GET file-read endpoint, one entity, one widget, +1 registry entry with mosaic auto-enrol — assessed and accepted by EVID-077/EVID-078 with verified rollback).
- **Reversibility:** activation is reversible via supersede/deprecate; the designed code change is single-revert additive (verified against `persist.ts` `allViewsKnown` + `settings.ts` unknown-id drop by EVID-077). No one-way doors. ADR-008 (the only red-line-adjacent decision) stays human-gated and untouched by this gate.
- **Downstream artifacts:** build wave consumes SPEC-006's frozen C1–C6 + RFC-030's Impl Phases 1–5; Phase 2–4 RFCs consume the same contract; ADR-008's Appendix consumes the Phase-4 RFC (C-1 ordering constraint stands).
- **Detection time if wrong:** design defects surface at the build wave's phase gates (each Impl Phase carries a test gate) and at the checkpoint render-proof — days, not months; the months-scale silent failure (E-1) is the one this gate verified designed-out.
- **Threshold check:** actual blast radius matches what the artifact bodies claim (additive, read-only, reversible). No downgrade per HARD RULE 5.

## Orchestrator instructions

**PASS → activate the TRIO in this exact order:**

1. `forgeplan_activate PRD-036` (R_eff 0.8).
2. Verify `forgeplan_score SPEC-006` returns R_eff > 0 (this EVID's `informs` link provides it). **If — and only if — the score is > 0:** `forgeplan_activate SPEC-006`. NEVER activate SPEC-006 at R_eff 0.0 (workspace red-line #3).
3. `forgeplan_activate RFC-030` (R_eff 0.8; parents now active).
4. **Do NOT activate ADR-008** — human gate (its INV-5 + PRD-036 Q4); it stays draft until explicit user OK in the Phase-4 wave.

**Mandatory build-wave obligations (carry verbatim into the build dispatch prompt — these are staged, not optional):**

- EVID-077 deferred follow-ups, recorded here so the build wave cannot miss them by reading only the RFC: **E-2** (timeline-events pathspec: optionally `:(exclude).forgeplan/map/` or note that the OQ-1 gitignore flip silences it), **M-1** (record `.forgeplan/map/` path contract as a named cross-repo dependency — one line or core-repo issue), **M-2** (render a "hand-authored · version" provenance chip — fast-follow), **T-1** (emit `severity: "warning"` for an edge relation outside the 11-entry list). **C-1** binds at the Phase-4 human gate: ADR-008's Appendix MUST be re-materialized with the Phase-4 RFC's literal values (queue cap N, same-origin mechanism) before any rule-file edit; **C-2** (widen ADR-008 trigger 1 to any `.forgeplan/map/` path/format contract) rides with it.
- Rule 11 MERGE gate: before the arc PR merges, the build wave MUST mint CL3 conformance EVIDs (test/measurement — the prove-phase EvidencePack all three bodies already plan) and link them `informs` to SPEC-006 and RFC-030. SHAPE-phase activation on audit-type evidence is house-precedented; it does not discharge the merge-time requirement.
- Rule-22 read-only allow-list amendment for `/api/map` lands in the SAME PR as the endpoint (RFC-030 Impl Phase 2 named deliverable).

## Notes

- Position on R_eff at SHAPE (asked explicitly by the orchestrator): red-line #3 binds ACTIVATION of any artifact at R_eff == 0 — no exceptions, including SHAPE phase. SHAPE-phase 0.0 is acceptable only while the artifact stays draft. PRD-036/RFC-030 clear the bar on CL3 audits; SPEC-006 clears it via this EVID's link (a genuine CL3 audit of SPEC-006 — this gate read its full contract, validated it, and cross-checked C1–C6 against RFC-030 and the spike ground truth). The stricter test/measurement evidence remains a MERGE-time obligation per rule 11, staged above.
- `mm-gate-failures` mental model: 404 (bank carries zero mental models) — recorded honestly, consistent with all three chain EVIDs; `memory_recall` (13 hits) used instead, which surfaced the guardian/orchestrator activation-boundary convention and the T4 two-repo split.
- EPIC-001 has a one-line uncommitted whitespace diff on its markdown projection (trailing blank line — formatting-hook noise); housekeeping, not gate-relevant.
- EVID-076's parent-side observations (EPIC-001 §Risks stale mitigation annotation, §Children "(планируется)") were partially addressed in `be2cc8e` (+2 lines to EPIC-001); residual epic-body freshening remains cosmetic.

## References

- Artifacts under review: PRD-036, SPEC-006, RFC-030 (this EVID informs all three). Existence-checked: ADR-008.
- EVIDENCE chain: EVID-076, EVID-077, EVID-078 (trio chain); EVID-079, EVID-080 (sibling PRD-035 wave, swept — blocker resolved, verified by live run).
- Ground truth: HEAD `be2cc8e` on `feat/idef0-composed-map`; `template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts:561-584`; live vitest 85/85; `forgeplan_validate` ×3 PASS; `forgeplan graph` edges.
- Mental models: `mm-gate-failures` unavailable (404, recorded).
- Gate identity: `claude-code/2.0/guardian-task-arcC-waveC2`.




