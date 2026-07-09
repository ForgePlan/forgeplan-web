---
depth: standard
id: EVID-067
kind: evidence
last_modified_at: 2026-07-02T10:27:19.485123+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EVID-069
  relation: supersedes
status: superseded
title: 'Guardian gate review of RFC-029 (T2 keystone GATE-A): CONCERNS'
---

## Verdict

**CONCERNS**

- **PASS** — orchestrator may activate. *(not selected)*
- **CONCERNS** — orchestrator must dispatch a fixer (named below) and re-run the tester before another guardian pass. *(SELECTED)*
- **BLOCKER** — halt pipeline. *(not selected)*

One-line justification: the T2 engineering is genuinely sound (all three artifacts validate clean, **no BLOCKER anywhere in the chain**, every HIGH finding resolved with committed unit tests + empirical Playwright proof, purely-additive/one-change-reversible read-only viewer) — but **SPEC-005's own GATE-A acceptance criterion AC-4 ("0 scenarios lacking a committed test") is objectively unmet** (5 of 12 render-surface scenarios deferred to a not-yet-built DOM harness), **and SPEC-005 sits at R_eff = 0.0** (zero informing evidence → red-line 3 forbids its activation), so under HARD RULE 4 (PASS requires all activation-policy criteria satisfied) I cannot PASS; the gaps are bounded, budgeted, and cheaply closable, so this is CONCERNS, not BLOCKER.

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

<!-- The R_eff parser contract uses supports/weakens/refutes. The GATE verdict is
     CONCERNS (see above). `verdict: weakens` means this gate found unmet activation-
     policy criteria (SPEC-005 AC-4 5/12; SPEC-005 R_eff 0.0) that weaken the case for
     activating the keystone set AS-IS — NOT that the design is wrong (it is sound,
     additive, reversible, honest, and correctly bound to the frozen core). CL3:
     audited directly against the three frozen artifacts + the full informs-linked
     EVIDENCE chain + git ground truth on feat/idef0-view-t2, in-repo. -->

## Artifact under review

- **Primary ID**: `RFC-029` — kind rfc, status draft, "idef0 view — first host renderer over the TADD core"
- **Keystone set gated together (GATE-A, EPIC-001 Phase 2)**:
  - `PRD-034` — prd, draft — "Standalone idef0 decomposition view" (R_eff 0.10)
  - `SPEC-005` — spec, draft — "idef0 view rendering scenarios" (**R_eff 0.00**)
  - `RFC-029` — rfc, draft — first host renderer (R_eff 0.10)
- **Parents / context**: `EPIC-001` (T2 track, Outcomes 4/5/6), `RFC-028`/`SPEC-004`/`ADR-006`/`ADR-007` (frozen T1 core — all active).
- **Branch**: `feat/idef0-view-t2` (head `2afe90e`). Note the current checkout is a different branch (`feat/prob-060-snapshot-identity`); the T2 code was verified against the T2 branch by git object read (no checkout).

## EVIDENCE chain inspected (chronological — full `informs`-linked chain)

| EVID | R_eff verdict | Health/gate verdict | Source role | Critical finding (one-line) | Resolution |
|---|---|---|---|---|---|
| `EVID-057` | supports (CL2 audit) | — (ADI) | specification / ADI | H1 dedicated-view chosen over extend-existing / do-nothing | terminal reasoning; supports |
| `EVID-058` | supports (CL3 audit) | CONCERNS | artifact-reviewer (health) | MEDIUM: SPEC-005 had no graph edge to PRD-034 | **RESOLVED** (link added, FR cleanup) |
| `EVID-059` | supports (CL2 audit) | CONCERNS | architect-reviewer (fitness) | MED all-derived-fallback data-flow; MED positional-vs-options signature drift | **RESOLVED** (scenario → real-outline/derived-diagram; options-object signature) |
| `EVID-060` | weakens (CL3 audit) | CONCERNS | system-dev staff | **HIGH C-1** rollup-via-`window` unimplementable; MED-HIGH T-1 no component-test harness | **RESOLVED** (rollup=terminal; harness budgeted Phase-3/4) |
| `EVID-061` | weakens (CL3 audit) | CONCERNS | architect-reviewer | **HIGH F1** unbounded fallback DOM off raw `tierStack`; MED F2 rollup/`window`; F3 focus-key; F4 mosaic blast | **RESOLVED** (fallback laid out from bounded `diagram.boxes`; verified in code + tests) |
| `EVID-062` | weakens (CL3 test) — **draft** | CONCERNS | tester (early run) | vitest 398/398 but **svelte-check 2× TS2532** (Idef0View.svelte:28), CI-fail; 6 render scenarios untested | **svelte-check RESOLVED** → 0/0 in EVID-064/065/066 + current ground truth (fix landed 18:42→18:59) |
| `EVID-064` | concerns→scored Supports (CL3 test) | CONCERNS | tester | 398/398 + svelte-check 0/0; **AC-4 7/12 node-env, 5/12 deferred to DOM harness** | partial — the open item (see Gate criteria) |
| `EVID-065` | concerns→scored Supports (CL3 audit) | CONCERNS | code-reviewer | MEDIUM `hasNextPage` false-positive + 3 LOW | **RESOLVED** (peek limit+1 + 3 regression tests, commit 2afe90e; 401/401) |
| `EVID-066` | supports (CL3 test) | supports | orchestrator consolidated | Playwright render proof on 138 real artifacts + code review + laws-of-ux a11y fixes | affirmative; empirically covers the 5 deferred scenarios |

`EVID-063`: hard-deleted (hollow stub; the independent code-review agent failed twice) — confirmed "not found". Not in chain.

**Chain-state summary: 0 BLOCKER · all HIGH/MEDIUM findings resolved with committed fixes + tests · 1 open budgeted coverage gap (AC-4 5/12) · SPEC-005 R_eff 0.0.** No superseding EVID needed — the resolutions are in-place in RFC-029's revision + the landed code.

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact-body MUST validation | ✅ | `forgeplan_validate` RFC-029 / PRD-034 / SPEC-005 → **0 MUST errors, 0 warnings** each (COULD-level heuristic hints only: RFC "invariants/rollback" — RFC has `## Migration/Rollback`; PRD "FR-checkbox" — house `### FR-NNN` form). `require_validate_pass` ✓ |
| 2 | All required EVIDENCE linked | ✅ | RFC-029 ← EVID-060/061/062/064/065/066 (informs, confirmed via `forgeplan_score`). PRD-034 ← EVID-057/058/059. SPEC-005 ← **none linked** (see #8). Reviewer roster complete: architect ×2, system-dev, tester ×2, code-reviewer, artifact-health, ADI, consolidated |
| 3 | No unresolved BLOCKER in chain | ✅ | Zero EVID with BLOCKER verdict. Two `weakens` HIGH findings (C-1, F1) both **resolved** + unit-tested + Playwright-confirmed. EVID-062 svelte-check fail **resolved** (0/0 since) |
| 4 | Unresolved HIGH CONCERNS | 0 | F1 (unbounded fallback) + C-1 (rollup/window) closed: `layoutTierBands` reads bounded `diagram.boxes`, rollup terminal; box-count-bounded tests both modes; Playwright shows banded ≤6/tier, not one-box-per-artifact |
| 5 | Activation policy satisfied | ❌ | **SPEC-005 AC-4 unmet at GATE-A**: 5/12 render-surface scenarios (no-regression #3, legend #5, keyboard #7, reduced-motion #8, dual-theme #9) lack a committed conformance test; SPEC-005 threshold = 0. The independent tester (EVID-064) explicitly recommends closing this "before GATE-A full activation" |
| 6 | Project-specific gates | ✅/N-A | svelte-check **0/0 (1135 files)** + vitest **401/401** (orchestrator-verified; upstream EVID-064/065/066). No `check:ready-to-ship`/Makefile gate exists. `npm run smoke` present but not the T2 surface. Not re-run by guardian (upstream tester EVIDs authoritative; ground-truth-verified) |
| 7 | Blast radius within stated threshold | ✅ | Actual blast (additive registry entry + 1 host branch + 2 new files, read-only) **matches** the PRD/RFC claim. No downgrade-for-scope-mismatch (HARD RULE 5) |
| 8 | R_eff > 0 for each keystone member (red-line 3) | ❌ | RFC-029 = 0.10 ✓, PRD-034 = 0.10 ✓, **SPEC-005 = 0.00 ✗**. Red-line 3 forbids activating SPEC-005 at R_eff == 0 — it has zero informing EVID |

### Project-config gates (`.forgeplan/project-config.yaml`)

**Config source:** `not found — built-in conservative defaults applied (HARD RULE 7)`. Recorded in Methodology.

| Criterion | Threshold (default) | Observed | Result |
|---|---|---|---|
| Test coverage | `≥80%` (`min_test_coverage`) | no line-coverage figure reported; **scenario** coverage 7/12 committed + 5/12 empirical (Playwright/laws-of-ux) | ⚠️ CONCERNS (AC-4 scenario gap; no line-% to compare) |
| Critical findings | `≤0` (`max_findings_critical`) | 0 unresolved (laws-of-ux 2 CRITICAL a11y **fixed** per EVID-066) | ✅ PASS |
| High findings | `≤3` (`max_findings_high`) | 0 unresolved (C-1, F1 both resolved) | ✅ PASS |
| Medium findings | `≤10` (`max_findings_medium`) | 0 unresolved (EVID-058/059/060/061/065 MEDIUMs all resolved) | ✅ PASS |
| Validate pass | required | RFC-029/PRD-034/SPEC-005 all PASS | ✅ |
| Audit pass (≥1 affirmative Profile B EVID) | required | EVID-066 supports CL3 test; EVID-064/065/066 score Supports 1.0 | ✅ |
| Evidence chain (rfc kind) | required | RFC-029 has 6 informing EVIDs; **SPEC-005 has 0** | ⚠️ CONCERNS (SPEC-005 unlinked → R_eff 0.0) |

**Gates summary:** `5/7` green (Coverage/scenario gate ⚠️, SPEC-005 evidence-chain/R_eff ⚠️). Source: defaults.

## Blast radius

- **Affected scope on activation:** a **read-only browser viewer** — a 9th dependency-graph view (`idef0`) plus its auto-enrolment into the existing mosaic view-tiler. No `/api/*` mutation, no host filesystem write, no CLI/bin dependency, no core change (rule 22 upheld; verified across EVID-060/061/065/066). Shared surface touched = `shared/config/ui-prefs.ts` (union + `GRAPH_VIEWS`) + one `{:else if view==='idef0'}` branch in `DependencyGraph.svelte`; the seven existing views and the frozen `shared/lib/idef0/*` core are byte-untouched.
- **Reversibility:** **one-change, minutes.** Remove the registry entry + `GraphView` member + the one host branch + 2 new files → exact seven-view state. No data migration, no `/api/*` change, no core change. Mosaic de-enrols automatically (registry-derived). This is the lowest-risk activation class.
- **Downstream artifacts:** none re-baselined. The reserved `map`/composed slot (T4) is left free (distinct `idef0` id — verified). PRD-034/SPEC-005/ADR-007 are the informing set, not dependents.
- **Detection time if wrong:** immediate — a registration/type break surfaces at build/CI or first view-switch; the 5 deferred scenarios' failure modes (a regressed existing view, missing legend, broken keyboard path, unsuppressed animation, theme-breaking colour) are user-visible and **non-destructive**. Playwright already exercised the live view once on 138 real artifacts with no T2 console errors.
- **Threshold check:** actual blast radius **matches** the artifact's stated "purely additive, reversible" claim — no downgrade for scope mismatch (HARD RULE 5). The residual risk is a *presentation* regression the one-shot Playwright pass didn't catch — real but low-severity and instantly reversible.

## Orchestrator instructions

**CONCERNS → dispatch fixers to address the two open items, then re-run the tester, then re-run guardian. Do NOT activate `PRD-034` / `SPEC-005` / `RFC-029` before both close.**

Specifically:

1. **[→ `agents-core:coder`]** Bootstrap the **budgeted** component-test harness (RFC-029 Phase-3/4 prerequisite): add `@testing-library/svelte`, use `@vitest-environment happy-dom` per-file pragmas, honour the macOS fork-limit `pool:'threads'` convention. Implement the **5 deferred SPEC-005 render-surface conformance tests** so AC-4 reaches 12/12: no-regression of the 7 existing views (§3), permanent legend in every state (§5), keyboard navigation + focus change (§7), reduced-motion respected (§8), dual-theme token correctness (§9). *(Correctness invariants — F1 bounded fallback, honesty encoding, rollup-terminal, V-COLLISION, ICOM geometry — are already committed node-env tests; do not re-do them.)*

2. **[→ `agents-core:tester`]** Re-run the suite; certify **SPEC-005 AC-4 = 12/12** (0 scenarios lacking a committed test); record a conformance EVIDENCE with `## Structured Fields` (`verdict: supports` / `congruence_level: 3` / `evidence_type: test`) and **link it `informs SPEC-005`** (not only RFC-029). This lifts **SPEC-005 R_eff above 0.0** — mandatory, because red-line 3 forbids activating SPEC-005 at R_eff == 0. (Optionally link it to RFC-029/PRD-034 too, to strengthen their 0.10 R_eff.)

3. **[→ `agents-pro:guardian`]** After 1–2 land, re-run this gate for the final GATE-A pass. On PASS, the orchestrator activates via `forgeplan_activate(id=PRD-034)`, `forgeplan_activate(id=SPEC-005)`, `forgeplan_activate(id=RFC-029)` — in parent→child order (PRD → SPEC → RFC).

**Alternative resolution path (orchestrator's call, NOT the guardian's to make — a recorded contract change, never a silent waiver):** if the team decides the empirical Playwright + laws-of-ux coverage is the *accepted* GATE-A conformance method for the 5 DOM scenarios, dispatch **`agents-sparc:specification`** to AMEND SPEC-005 AC-4 to state that explicitly (re-scoping the committed-DOM-test requirement to a documented Phase-3/4 follow-up). Even on this path, item 2's SPEC-005→conformance-EVID link (R_eff > 0) is still required before activation.

**BLOCKER items:** none.

## Notes

- **Buried-stale-EVID check (HARD RULE 2):** EVID-062's svelte-check CI-fail (2× TS2532) is **not** a live blocker — it was fixed and independently re-verified 0/0 by EVID-064/065/066 and the current ground truth. Flagging it here so it is not re-surfaced as a false BLOCKER on the re-gate.
- **Ground-truth discipline (HARD RULE 9):** every code-claiming reviewer EVID (060/061/062/064/065) carries a `## Ground-truth verification` section citing real `git` base..head diffs + token probes (DELTA=PRESENT). No reviewer trusted the worker's word — the empty-diff / trust-the-claim BLOCKER row does not trigger.
- **`mm-gate-failures`** mental model requested but **absent from this bank** (404 — `mental_model_list` empty for this project, as EVID-059/060/061 also recorded). Applied the gate-failure patterns from role memory instead (drift-accepted-as-good-enough, scanner-substituted-under-pressure, BLOCKER-in-stale-EVID, blast-radius-unassessed) — all four explicitly checked above.
- **Out of scope (do NOT block T2):** the pre-existing `state_unsafe_mutation` in `entities/graph/lib/highlight.svelte.ts#clearHovered` (fires during the OUTGOING view's hover teardown on any view switch) is shared infra, not in the T2 diff — track as a separate tactical fix, per the task directive.
- **On the PASS-vs-CONCERNS boundary:** this is NOT a "work is bad" verdict — the team did honest, high-quality work and was transparent about the deferral. CONCERNS is driven strictly by (a) SPEC-005's own GATE-A AC-4 being objectively 7/12 committed with the domain tester recommending closure before activation, and (b) SPEC-005 at R_eff 0.0 (red-line 3). Both are bounded and cheaply closable; hence CONCERNS, not BLOCKER, and certainly not PASS.

## References

- Artifact under review: `RFC-029` (keystone set: `PRD-034`, `SPEC-005`, `RFC-029`)
- EVIDENCE chain: `EVID-057`, `EVID-058`, `EVID-059`, `EVID-060`, `EVID-061`, `EVID-062`, `EVID-064`, `EVID-065`, `EVID-066` (`EVID-063` deleted)
- R_eff at gate: RFC-029 0.10 (weakest link RFC-028), PRD-034 0.10, SPEC-005 0.00
- Validation: `forgeplan_validate` — all three 0 MUST / 0 warnings
- Ground truth: `feat/idef0-view-t2` head `2afe90e`; `idef0-layout.ts` + `Idef0View.svelte` present; commit `2afe90e` (pagination fix + 3 tests) confirmed
- Project-config: `.forgeplan/project-config.yaml` not found → conservative defaults (HARD RULE 7)
- Mental models consulted: `mm-gate-failures` (absent — 404; role-memory patterns applied)
- Prior guardian precedent (same pipeline, T1 keystone): `EVID-048` (CONCERNS) → `EVID-051` (re-gate PASS) — the CONCERNS→fix→re-gate→PASS discipline this verdict continues





