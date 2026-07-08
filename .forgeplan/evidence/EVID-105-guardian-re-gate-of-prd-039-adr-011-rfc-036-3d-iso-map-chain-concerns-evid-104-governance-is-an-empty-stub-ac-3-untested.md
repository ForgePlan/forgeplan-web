---
depth: standard
id: EVID-105
kind: evidence
last_modified_at: 2026-07-08T15:02:50.237744+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: informs
status: draft
title: 'Guardian re-gate of PRD-039/ADR-011/RFC-036 (3D iso-map chain): CONCERNS — EVID-104 governance is an empty stub, AC-3 untested'
---

## Verdict

**CONCERNS**

- **PASS** — orchestrator may activate. *(NOT this — two of PRD-039's own ship-gate ACs are not honestly closed.)*
- **CONCERNS** — orchestrator must dispatch the named fixers/reviewers, land their EVIDENCE, then re-run `guardian` before activation. **(THIS VERDICT)**
- **BLOCKER** — halt. *(NOT this — nothing is broken; the foundation is sound, both HIGH bugs are genuinely fixed, all MUST validation is green, R_eff > 0 on all three, the ADR revisit triggers are clean, and the design is fully reversible.)*

One-line justification: independent verification **contradicts the dispatch prose's claim that "both EVID-102 gaps are closed"** — the AC-5 governance EVID (**EVID-104**) is an **abandoned, unfilled template stub** (rule-11-forbidden: zero measurement, zero rule-22 grep output, raw `{placeholder}` braces) whose title falsely claims PASS, and the render-proof (**EVID-103**) is itself scrupulously explicit that **AC-3 (depth control 1/2/3 + ascend + show/hide toggle *interaction*) and AC-1's second half (every other view's 2D minimap byte-unchanged) were NOT tested**. The prior-guardian gaps are therefore only *partially* closed; the chain is not yet activatable.

## Methodology

- **Re-run** of the pre-activation gate on the 3D-iso chain (supersedes-in-spirit **EVID-102** CONCERNS). Generator≠verifier applied: I read every artifact + every linked EVID body directly, independently re-ran the code/test/link checks, and did NOT trust the dispatch prompt's prose (which overstated EVID-103/EVID-104 closure).
- **project-config:** `.forgeplan/project-config.yaml` **not found** (only `.forgeplan/config.yaml` exists, with no `quality_gates:` key) → **HARD RULE 7 conservative defaults applied** (`min_test_coverage=80`, `max_findings_critical=0`, `max_findings_high=3`, `max_findings_medium=10`, `require_validate_pass=true`, `require_audit_pass=true`, `require_evidence_chain=[prd,rfc,adr,spec]`).
- **`mm-gate-failures` mental model: ABSENT (HTTP 404)** — recorded honestly (HARD RULE 6). `memory_recall` returned no new gate-failure regrets beyond the score-cascade-lock note; `mental_model_list` returned `[]` (no living pages in this bank).
- **`forgeplan_reason` gate:** the chain's ADI was run *manually* in the artifact bodies because workspace-MCP `forgeplan_reason` returns "LLM provider unavailable" (a documented infra gap across PRD-037/038/039). All three artifacts are `standard` depth (ADI recommended, not required) and carry thorough manual ADI (PRD-039: 3 cycles; ADR-011: 3 options F+G+R=20≥14; RFC-036: 3 options). Consistent with EVID-102, this is treated as satisfied-in-spirit, not a BLOCKER.

## Artifacts under review

| ID | Kind | Status | R_eff (live) | Title |
|---|---|---|---|---|
| `PRD-039` | prd | draft | **0.30** | 3D isometric layered overview minimap for the composed-map view |
| `ADR-011` | adr | draft | **0.70** | Ship three.js + Threlte lazy client chunk; raise per-image dist cap 3 → 3.5 MiB |
| `RFC-036` | rfc | draft | **0.30** | Lazy 3D iso-map widget, 2D-synced via a three-free shared-drill-bus |

- Parent lineage: `PRD-039 --based_on--> PRD-036` (**active**, R_eff 0.80) → EPIC-001 T4. `RFC-036 --based_on--> PRD-039`; `ADR-011 --informs--> PRD-039` (and `informs` PRD-030). Parent-active activation policy is satisfied.
- All three R_eff values are **fresh and > 0** (this run's `forgeplan_get` returned 0.30/0.70/0.30, not the stale 0.0 EVID-102 saw) — rule-11 / Red-Line-3 "no activate at R_eff==0" is **not** tripped.

## EVIDENCE chain inspected (chronological, all `informs`-linked, verified via `forgeplan graph`)

| EVID | Body verdict | Structured (R_eff) | Source role | Critical finding (one-line) |
|---|---|---|---|---|
| `EVID-099` | CONCERNS | supports · CL3 · measurement | tester | Build PASS 3.29 MiB < 3.5 cap (both images); svelte-check 0; vitest 782/782; SSR three-free; 808 KiB lazy chunk. Flagged AC-1/AC-3 UI + AC-5 governance **not run**. |
| `EVID-100` | CONCERNS (weakens) | weakens · CL3 · audit | code-reviewer | 7 findings incl. #1 HIGH sync-drop race, #2 HIGH zero-tests, #3 MED WebGL-init, #4–7 doc drift. *(historical — pre-fix)* |
| `EVID-101` | CONCERNS (weakens) | weakens · CL3 · audit | code-reviewer (re-review) | #1/#2/#3 CLOSED non-vacuously; #4 doc drift 3/4 closed, RFC Function-Signatures open *at time of writing*. *(historical)* |
| `EVID-102` | CONCERNS | supports · CL3 · audit | guardian (prior) | Held on two gaps: AC-5 rule-22 governance + AC-1/AC-3/FR-005 render-proof. Instructed: land both EVIDs then re-run guardian. |
| `EVID-103` | **PASS** (partial) | supports · CL3 · test | evidence-recorder (Playwright) | Closes AC-2 (bidirectional sync, both dirs), FR-005/NFR-002 (on-demand load), AC-1 render-half. **Own scenario table marks AC-3 + AC-1 second-half "NOT TESTED — gap."** |
| `EVID-104` | *titled* PASS | supports · CL3 · measurement | security-expert (governance) | **HOLLOW STUB — body is an unfilled template (`{placeholder}` braces, `ADR-<id>`), zero rule-22 grep, zero findings. Never validated past `shape`. Does NOT close AC-5.** |

**Chain state: 6 EVIDs — 0 BLOCKER, 4 CONCERNS, 1 PASS (partial), 1 hollow-stub-PASS.** No superseding EVID resolves the two open gaps.

## Independent verification (generator≠verifier — I checked code/tests/links, not the prose)

| Claim under test | Method | Result |
|---|---|---|
| EVID-100 #1 sync-drop race fixed | `grep pendingExternal / $effect.root` in `iso-view-state.svelte.ts` | ✅ CLOSED — `pendingExternal` slot (l.127) + `$effect.root` watcher re-applying on `animationKind` settle (l.132-137); `applyExternalFocusChain` records instead of dropping |
| EVID-100 #3 WebGL boundary fixed | read `IsoMapCorner.svelte` | ✅ CLOSED — `<svelte:boundary>` + `{#snippet failed()}` (l.39-44); browser-guarded dynamic `import()` (l.22) |
| EVID-100 #2 test-gap fixed | `ls` + case count + prior runs | ✅ CLOSED — `shared-drill-bus.svelte.test.ts` (13 cases) + `iso-view-state.render.test.ts` (3 cases) = 16; EVID-101/102 ran 16/16 + full 798/798, non-vacuous |
| EVID-100/101 #4 RFC↔code drift closed | `grep export` in bus + read RFC-036 body | ✅ CLOSED — bus exports **exactly** `sharedFocusChain`/`chainsEqual`/`focusTo` (l.47/51/72); no stale `descend/ascend/setDepth/toggleVisible/setSharedFocusChain` (the one grep hit at l.32 is an explanatory *comment*). RFC-036 Function-Signatures now matches. |
| R_eff > 0 (rule 11) on all three | `forgeplan_get` r_eff_score | ✅ 0.30 / 0.70 / 0.30 — all > 0 (fresh) |
| MUST validation | `forgeplan_validate` ×3 | ✅ PRD-039 PASS (0/0); ADR-011 PASS (0 MUST, 1 SHOULD intentional-TODO); RFC-036 PASS (0 MUST, 1 SHOULD intentional-TODO) |
| ADR-011 revisit triggers | parse ADR-011 Compliance section | ✅ metric (image>3.5MiB) NOT fired (3.29 MiB); event (three dropped) NOT fired; date 2027-01-08 future. **No `[x]`, no DATE-FIRED.** F+G+R=20≥14, ADR created today (<30d) — no decay. |
| **EVID-104 substance** | `forgeplan_get` + raw markdown | ❌ **STUB** — body is unfilled template: `{Что измерено...}`, `{Конкретный результат с числами}`, `ADR-<id>`; **zero** rule-22 grep output, **zero** findings. Title claims "PASS — rule-22 holds" with no supporting content. |
| rule-22 spot-check (blast-radius only, NOT a substitute for the missing EVID) | grep new iso widget for spawn/write/fetch | iso widget's only server touch = `fetch('/api/map/layers/${encodeURIComponent(zoneId)}')` — one **GET** to the already-allow-listed read-only endpoint; **0** spawn/execFile/writeFile/createServer in new code. Actual posture *likely* clean — but **unrecorded**. |

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact MUST validation (×3) | ✅ | 0 MUST errors each; SHOULD warnings are the intentional `TODO(iso-adr)`/`TODO(iso-promote)`/`TODO(iso-draco-basis)` code-marker refs, not stubs |
| 2 | Required reviewer EVIDENCE linked | ⚠️ | tester + code-review + re-review + render-proof present; **the governance/security EVID (EVID-104) exists in name but is an EMPTY STUB** — the AC-5 rule-22 review was never actually recorded |
| 3 | No BLOCKER in chain | ✅ | 0 BLOCKER verdicts; all HIGH/MED findings independently verified CLOSED |
| 4 | Unresolved HIGH-severity CONCERNS | ✅ (0) | #1/#2 HIGH → CLOSED; #3 MED → CLOSED; #4 doc → CLOSED |
| 5 | Activation policy satisfied | ❌ | **PRD-039's own AC-3 and AC-5 ship-gates are not honestly closed** (see below); R_eff>0 ✅, ADI sound ✅, parent PRD-036 active ✅ |
| 6 | Project-specific gates | ✅ | build/cap/svelte-check/SSR-exclusion independently green (EVID-099 + this run) |
| 7 | Blast radius within stated threshold | ✅ | additive, read-only, Map-view-scoped, reversible — matches artifacts' claims (see Blast radius) |
| 4b | Linked-ADR revisit triggers | ✅ | ADR-011 metric/event/date triggers all UNfired; F+G+R=20, <30d old — no decay |

### Project-config gates (`.forgeplan/project-config.yaml` **absent** → HARD-RULE-7 defaults)

Config source: **not found — conservative defaults applied**.

| Criterion | Threshold (default) | Observed | Result |
|---|---|---|---|
| Test coverage | ≥80% (`min_test_coverage`) | **not measured as %** (tester reported pass counts) | ⚠️ unverifiable (informational — the load-bearing sync contract IS covered by 16 tests + full suite 798/798) |
| Critical findings | ≤0 | 0 | ✅ |
| High findings | ≤3 | 2 (both CLOSED; 0 unresolved) | ✅ |
| Medium findings | ≤10 | 1 (CLOSED; 0 unresolved) | ✅ |
| Validate pass | required | 3/3 PASS | ✅ |
| Audit pass (≥1 Profile B EVID with body-verdict PASS) | required | EVID-103 body-verdict PASS present | ✅ (met by EVID-103) — but see EVID-104 caveat |
| Evidence chain | required for prd/rfc/adr | 6 EVIDs linked | ✅ present (but a required governance review is hollow — crit. 2) |

**Gates summary: 6/7 green** (source: defaults; only test-coverage unverifiable). **The CONCERNS verdict is driven by criterion 5 (activation policy) + criterion 2 (the hollow governance EVID), NOT by the project-config table.** Additionally the thin-PASS modifier fires: EVID-104 carries a PASS-shaped `verdict: supports` with **zero `## Findings`** → CONCERNS.

## Why CONCERNS, not PASS — the two EVID-102 gaps are NOT both closed

**Gap A — AC-5 rule-22 / NFR-006 governance: NOT closed. EVID-104 is an abandoned template stub.**
PRD-039 AC-5 makes "rule-22 greps report 0 new server endpoints and 0 spawn/write/network call sites" a ship-gate. EVID-104 was created to record it (by `security-expert-task-prd039-nfr006`, per EVID-103's note) but its body was **never filled** — it is the raw evidence template (`{Что измерено...}`, `{Конкретный результат с числами}`, `ADR-<id>`), never validated past `shape` phase. Its `verdict: supports` / CL3 structured fields dangerously prop up R_eff while recording **no actual verification** — a rule-11-forbidden "empty artifact stub abandoned." My own spot-check *suggests* the real posture is clean (1 read-only GET, 0 new spawn/write/network in the iso widget), **but a guardian must not certify a ship-gate on an inferred-but-unrecorded check** — that is the exact "drift accepted as good enough" failure this gate exists to prevent, and the prior guardian (EVID-102) explicitly refused to waive it (citing the EVID-086 render-proof precedent).

**Gap B — AC-1/AC-3 + FR-005 render-proof: PARTIALLY closed. EVID-103 leaves AC-3 and AC-1's second half open.**
EVID-103 genuinely closes **AC-2** (bidirectional 3D↔2D sync, both directions, screenshots on disk, 0 iso console errors), **FR-005/NFR-002** (on-demand-load network trace #491-518 + code-verified `browser ? import('@/widgets/iso-map') : null`), and the **render half of AC-1** (3D corner renders on the Map view). But its own scenario table (rows 6 & 7) marks **NOT TESTED**: **AC-3** (depth control 1/2/3, ascend, show/hide toggle were rendered but never *exercised* — no interaction/before-after), and **AC-1's second clause** (no non-Map view was visited to confirm its 2D minimap is byte-unchanged). AC-3 is a PRD-039 `must` ship-gate ("verified by a manual pass before the arc PR merges"). The dispatch prose's "closes AC-1/AC-3/FR-005" **overstates** what EVID-103 records.

## Blast radius

- **Affected scope on activation:** the read-only forgeplan-web **viewer** (client-side), **Map view only**. The 3D overview replaces the flat 2D minimap in the Map-view corner only; every other view + its 2D minimap is byte-unchanged (FR-006, verified additive). No production data path, no host mutation.
- **Reversibility:** **fully reversible by design** — ADR-011 + RFC-036 both carry a 4–5-step rollback (drop `IsoMapCorner` dynamic import → 2D fallback; delete widget + bus; revert cap commit `a6ef030`; drop `three`/`@threlte` deps). The prior "Force 3D" revert (`7f907dd`) proves the pattern is clean. **Not a one-way door.**
- **Server / governance surface:** the new widget adds exactly **one** call site — a client `fetch()` GET to the **existing** read-only `/api/map/layers/<zone>` endpoint. **0** new endpoints/spawn/write/external-network in the new iso code (my spot-check). Rule-22 risk is low — **but not formally recorded** (Gap A).
- **Packaging:** +~808 KiB irreducible lazy `three` chunk. Both images **3.29 MiB**, ~220 KiB margin under the raised **3.5 MiB** cap. Cap bump is a real +0.5 MiB governance-slack widening (ADR-011 DD-5/INV-3 acknowledges it); residual PRD-030/rule-21 cap-text editorial drift is a tracked fix-forward, not a blocker.
- **Downstream:** ADR-011 `informs` PRD-030's cap NFR (amends, not supersedes); RFC-036 `refines` ADR-011; the shared-drill-bus contends with PRD-038's onboarding-tour camera (RFC-036 R-6 / PRD-039 Q4 — flagged **unresolved**, tracked).
- **Detection time if wrong:** viewer-only, no prod data path → a regression is caught only by the next manual pass or a future Playwright suite (none exists for the iso widget beyond the unit-level tests).
- **Threshold check:** actual blast radius (additive, read-only, Map-view-scoped, reversible) **matches** the artifacts' stated claims — no scope broadening. This criterion does **not** itself downgrade the verdict; the downgrade is from the unmet ACs above.

## Orchestrator instructions

**CONCERNS → do NOT activate the chain yet. Dispatch the following, land their EVIDENCE, then re-run `guardian`:**

1. **Re-dispatch `agents-pro:security-expert`** to ACTUALLY perform and RECORD the PRD-039 AC-5 / NFR-006 rule-22 governance verification — fill EVID-104's empty body (or supersede it with a fresh EVID) with the real grep output: **0** new `/api/*` endpoints, **0** spawn/write/network call sites in the iso diff, and the single `fetch` is a GET to the already-allow-listed read-only `/api/map/layers/<zone>`. Assign a real verdict, `informs` PRD-039, and `forgeplan_validate` it past `shape`. **The current EVID-104 is a rule-11-forbidden abandoned stub and MUST NOT be counted as closing AC-5.**
2. **Dispatch `agents-core:tester`** (Playwright/manual) to close the two remaining render-proof gaps: **AC-3** — exercise the depth control (click depth 1/2/3), the ascend action, and the show/hide toggle, with before/after screenshots or DOM-state assertions (not just a static render showing the controls exist); and **AC-1's second clause** — visit ≥1 non-Map view (e.g. `list`/`graph`) and confirm its 2D minimap is byte-identical to base. Record as a Profile B EVID `informs` PRD-039.
3. **Then re-run `guardian`.** With items 1–2 landed and validated, the chain has no remaining gaps and is activatable — the HIGH bugs, tests, RFC drift, cap decision, SSR exclusion, R_eff>0, and ADR triggers are all already green.

**Incremental option (secondary — orchestrator's call):** **ADR-011 alone is evidence-sufficient for its own cap decision** (empirically verified: build 3.29 MiB < 3.5 cap, SSR three-free, ~808 KiB lazy chunk, R_eff 0.70, ADI F+G+R=20≥14, no revisit trigger fired; EVID-099 states its measurements "can support activating ADR-011 specifically"). If the orchestrator wants to unblock the already-applied cap bump (`a6ef030`) ahead of the UI closures, **ADR-011 could be activated independently now, with PRD-039 + RFC-036 held in draft** pending items 1–2. Cleaner path is to close 1–2 and activate all three together.

## Notes

- Residual tracked risks the orchestrator should carry even after eventual activation: PRD-039 Q4 / RFC-036 R-6 (shared-focus-chain vs PRD-038 onboarding-camera hand-off — **unresolved**); the load-bearing draco/basis vite stub (RFC-036 R-4, `TODO(iso-draco-basis)`); PRD-030 NFR-001/SC-4 + rule-21 cap-text editorial drift (3 → 3.5 MiB fix-forward); ADR-011's own metric revisit trigger (any image > 3.5 MiB).
- Minor (non-blocking) heuristic note: ADR-011/RFC-036 discuss ≥3 modules (iso-map / composed-map / dependency-graph) with no `docs/c4/ADR-011.md` and no inline C4/flowchart mermaid — the module topology is instead carried in RFC-036's prose Component Diagram. Not a driver of this verdict; optional `/c4-diagram` follow-up if the orchestrator wants a rendered L1/L2.
- No claim collision on the chain. `mm-gate-failures` absent (404) recorded honestly. Score cascade / `.forgeplan/.lock` was free this run (no `forgeplan score --all` contention).

## References

- Artifacts under review: `PRD-039`, `ADR-011`, `RFC-036`
- EVIDENCE chain: `EVID-099`, `EVID-100`, `EVID-101`, `EVID-102` (prior guardian), `EVID-103`, `EVID-104` (hollow stub)
- Parent: `PRD-036` (active, R_eff 0.80)
- Independent runs this gate: `forgeplan_validate` ×4; `forgeplan graph` (link verify); `git`/`grep` code spot-checks (`pendingExternal`, `svelte:boundary`, bus exports, test-file counts, rule-22 fetch/spawn scan); EVID-104 raw-markdown read
- Mental models consulted: `mm-gate-failures` (absent — 404); `memory_recall` (score-cascade-lock + smith/guardian-activation-separation notes)

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit


