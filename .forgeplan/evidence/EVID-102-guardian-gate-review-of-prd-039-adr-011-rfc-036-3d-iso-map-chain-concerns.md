---
depth: standard
id: EVID-102
kind: evidence
last_modified_at: 2026-07-08T10:42:02.046721+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: informs
- target: ADR-011
  relation: informs
- target: RFC-036
  relation: informs
status: draft
title: 'Guardian gate review of PRD-039/ADR-011/RFC-036 (3D iso-map chain): CONCERNS'
---

## Verdict

**CONCERNS**

- **PASS** — orchestrator may activate. *(not this)*
- **CONCERNS** — orchestrator must dispatch the named fixers/reviewers, land their EVIDENCE, then re-run `guardian` before activation. **(THIS VERDICT)**
- **BLOCKER** — halt. *(not this — nothing is broken; foundation is sound and reversible)*

One-line justification: every prior finding (#1 sync-drop race, #2 test-gap, #3 WebGL boundary, #4 RFC/code drift) is **genuinely closed** — verified in the actual fix code + 16 passing non-vacuous sync tests + the reconciled RFC body, with build/cap/svelte-check/SSR-exclusion all measured green — but the chain carries **zero terminal PASS EVIDENCE** and **two of PRD-039's own ship-gate acceptance criteria are never verified by any EVID**: AC-5's rule-22 governance half and AC-1/AC-3 + FR-005's browser render-proof / on-demand-load network trace (the latter is the exact "load-bearing gate" a prior guardian pass, EVID-086, refused to waive for this same composed-map arc).

## Artifacts under review

- **PRD-039** — `prd`, status `draft`, R_eff **0.30** (live score; grade B) — "3D isometric layered overview minimap for the composed-map view". Parent lineage: PRD-036 (`based_on`), EPIC-001 T4.
- **ADR-011** — `adr`, status `draft`, R_eff **0.70** (live score; grade B) — "Ship three.js+Threlte lazy client chunk; raise per-image dist cap 3 → 3.5 MiB". `based_on` PRD-039/036, `informs` PRD-030.
- **RFC-036** — `rfc`, status `draft`, R_eff **0.30** (live score; grade B) — "Lazy 3D iso-map widget, 2D-synced via a three-free shared-drill-bus". `based_on` PRD-039, `refines` ADR-011, `informs` SPEC-006.

> **R_eff note (correction of a stale field).** `forgeplan_get` returned `r_eff_score: 0.0` for ADR-011 and RFC-036 (a stale cached field). The live `forgeplan_score` recomputation returns **0.70 / 0.30 / 0.30** — all **> 0**, so the CLAUDE.md Red-Line-3 / rule-11 "no activation at R_eff==0" gate is **NOT** tripped. My `forgeplan_score` calls should have refreshed the persisted values; the orchestrator should confirm `forgeplan_score` ≥ 0 immediately before `forgeplan_activate`.

## EVIDENCE chain inspected (chronological)

| EVID | Body verdict | Structured `verdict` (R_eff) | Source role | Critical findings (one-line) |
|---|---|---|---|---|
| `EVID-099` | CONCERNS | supports · CL3 · measurement (score 1.0) | tester | Build PASS 3.29 MiB < 3.5 cap (both images); svelte-check 0; vitest 782/782; SSR three-free (0 markers in `dist/index.js`); 808 KiB lazy chunk. Flagged AC-1/AC-3 (UI) + AC-5 governance half **not run**; AC-2 unit tests **absent at the time**. Ground-truth: DELTA=PRESENT, tokens FOUND. |
| `EVID-100` | CONCERNS | weakens · CL3 · audit (score 0.5) | code-reviewer | 7 findings: #1 HIGH sync-drop race, #2 HIGH zero-tests, #3 MED WebGL-init-not-caught, #4–7 doc/RFC drift. three-leak flag refuted as false positive. Ground-truth: DELTA=PRESENT, `shared-drill-bus` token FOUND, SSR grep 0. |
| `EVID-101` | CONCERNS | weakens · CL3 · audit (score 0.5) | code-reviewer (re-review) | #1/#2/#3 **CLOSED non-vacuously** (pendingExternal retry + `<svelte:boundary>` + 16 passing tests, full suite 798/798); #4 doc-drift **3/4 closed**, RFC Function-Signatures item still open **at time of writing (10:16)**. Ground-truth: DELTA=PRESENT, `pendingExternal`/`svelte:boundary`/test-files FOUND. |

No superseding EVID exists, but the single open item in the latest EVID (EVID-101 Finding #1 — RFC Function-Signatures drift) was closed by a **later artifact edit**: RFC-036 `updated_at 2026-07-08T10:31` — **15 min after** EVID-101 (10:16). I verified against the **current** RFC body (generator≠verifier): its Function-Signatures section now documents exactly `sharedFocusChain()/focusTo()/chainsEqual()` and states descend/ascend are consumer-level and depth/visibility are local — the stale `descend()/ascend()/setDepth()/toggleVisible()` bus API is **gone**. Finding #4 is therefore closed at both code and doc level.

**Chain state: 3 EVIDs — 0 BLOCKER, 3 CONCERNS, 0 PASS.**

## Independent verification (generator≠verifier — I checked the code + ran tests, not the prose)

| Claim | Method | Result |
|---|---|---|
| #1 sync-drop race fixed | `grep pendingExternal / $effect.root` in `iso-view-state.svelte.ts` | ✅ `pendingExternal` slot (l.127) + `$effect.root` watcher (l.134-138) re-applies on `animationKind` settle; `applyExternalFocusChain` (l.443-448) records instead of dropping |
| #3 WebGL boundary | read `IsoMapCorner.svelte` | ✅ `<svelte:boundary>` + `{#snippet failed()}` wrapping `<mod.IsoMinimap/>` (l.39-44); browser-guarded dynamic `import()` (l.22) |
| #2 test-gap | `find … *.test.*` | ✅ `shared-drill-bus.svelte.test.ts` + `iso-view-state.render.test.ts` present on disk |
| #2 tests pass + non-vacuous | `npx vitest run shared-drill-bus iso-view-state.render` | ✅ **2 files, 16/16 passed**; assertions test content-equality, idempotence via array-ref identity, single-source-of-truth, echo-loop-guard — not tautological |
| #4 RFC/code contract match | `grep export … shared-drill-bus.svelte.ts` | ✅ exports exactly `sharedFocusChain / chainsEqual / focusTo`; **zero** stale `descend/ascend/setDepth/toggleVisible/setSharedFocusChain` |
| Dist under cap | `find dist* -stat` byte sum | ✅ dist 3.28 MiB, dist-nightly 3.28 MiB — both < 3.5 MiB cap (3,670,016 B); ADR-011 metric revisit trigger NOT fired |
| rule-22 client surface | `grep spawn/fetch/write` new widget code | ✅ only 1 `fetch()` — a **GET** to existing read-only `/api/map/layers/<zone>` (encodeURIComponent'd); no new endpoint / spawn / mutation / external net |

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact MUST validation (all 3) | ✅ | `forgeplan_validate` PASS, 0 MUST errors each. SHOULD `no-placeholders` warnings on ADR-011/RFC-036 are the **intentional** `TODO(iso-adr)`/`TODO(iso-promote)`/`TODO(iso-draco-basis)` code-marker references — accurate, not stubs. |
| 2 | Required reviewer EVIDENCE linked | ⚠️ | tester + code-review + re-review present; **no governance/security EVID (rule-22, AC-5) and no render-proof EVID (AC-1/AC-3/FR-005 dynamic)** — both are PRD-039 ship-gates. |
| 3 | No BLOCKER in chain | ✅ | Zero BLOCKER verdicts; all HIGH/MED findings verified closed. |
| 4 | Unresolved HIGH-severity CONCERNS | ✅ (0) | #1/#2 HIGH → CLOSED; #3 MED → CLOSED; #4 doc → CLOSED via RFC edit. |
| 5 | Activation policy satisfied | ⚠️ | R_eff>0 ✅; ADI on ADR-011 sound (3 options, F+G+R=20≥14) ✅; but PRD-039's own AC-1/AC-5 verifications are unrecorded. |
| 6 | Project-specific gates | ✅ | build/cap/svelte-check/SSR-exclusion independently confirmed. |
| 7 | Blast radius within stated threshold | ✅ | see below — matches artifacts' "additive, read-only, reversible" claims. |
| 4b | Linked-ADR Revisit Triggers | ✅ | ADR-011's own triggers: metric (image>3.5MiB) NOT fired (3.28 MiB); event (three dropped) NOT fired (present); date 2027-01-08 in future. No FIRED/DATE-FIRED. No `mm-gate-failures` needed. |

### Project-config gates (`.forgeplan/project-config.yaml` **absent** → HARD-RULE-7 conservative defaults applied)

Config source: **not found — built-in defaults applied** (`config.yaml` exists but has no `quality_gates` key).

| Criterion | Threshold (default) | Observed | Result |
|---|---|---|---|
| Test coverage | ≥80% (`min_test_coverage`) | **not measured** (tester reported 782/798 pass counts, not %) | ⚠️ unverifiable (informational — the load-bearing sync contract IS tested) |
| Critical findings | ≤0 (`max_findings_critical`) | 0 | ✅ |
| High findings | ≤3 (`max_findings_high`) | 2 (both closed; 0 unresolved) | ✅ |
| Medium findings | ≤10 (`max_findings_medium`) | 1 (closed; 0 unresolved) | ✅ |
| Validate pass | required (`require_validate_pass`) | 3/3 PASS | ✅ |
| Audit pass (≥1 Profile B EVID with body-verdict PASS) | required (`require_audit_pass`) | **0 PASS** (all 3 CONCERNS) | ⚠️ **CONCERNS** |
| Evidence chain | required for prd/rfc/adr | 3 EVIDs linked (but 2 reviewer classes missing — crit.2) | ⚠️ |

**Gates summary: 5/7 green** (source: defaults). Not-green: **audit-pass** (no terminal PASS EVID) and **coverage** (unmeasured). The BMAD-discipline "zero-PASS → BLOCKER" row is **not** applied — this is a SPARC feature gate on an existing system, not a BMAD greenfield sub-cycle; the general `require_audit_pass → CONCERNS` interpretation governs, consistent with this project's own precedent (EVID-086 issued CONCERNS + fast-follow for a comparable render-proof gap, not BLOCKER).

## Blast radius

- **Affected scope on activation:** the read-only forgeplan-web **viewer** (client-side), Map view only. The 3D overview replaces the flat 2D minimap in the Map view's corner **only**; every other view + its 2D minimap is byte-unchanged (FR-006, verified additive by EVID-100 rule-24 grep clean). No production data path, no host mutation.
- **Reversibility:** **fully reversible by design** — ADR-011 + RFC-036 both carry a 4–5-step rollback (drop the `IsoMapCorner` dynamic import → 2D fallback; delete widget+bus; revert cap commit `a6ef030`; drop `three`/`@threlte` deps). The prior "Force 3D" revert (`7f907dd`) proves the pattern is clean. Not a one-way door.
- **Server / governance surface:** the new widget adds exactly **one** call site — a client `fetch()` GET to the **existing** read-only `/api/map/layers/<zone>` endpoint. **Zero** new endpoints, spawn, write, or external network in the new code. Rule-22 risk is low — but **not formally recorded in an EVID** (the gap below).
- **Packaging:** +~808 KiB irreducible `three` chunk (lazy). Both images at 3.28 MiB, ~360 KiB margin under the raised 3.5 MiB cap. The cap is a real +0.5 MiB governance-slack widening (ADR-011 DD-5/INV-3 acknowledges it; residual editorial drift in PRD-030/rule-21 text is a tracked fix-forward, not a blocker).
- **Downstream artifacts:** ADR-011 `informs` PRD-030's cap NFR (amends, does not supersede); RFC-036 `refines` ADR-011; the shared-drill-bus contends with PRD-038's onboarding-tour camera (RFC-036 R-6 / PRD-039 Q4 — flagged **unresolved**, tracked, not silently assumed).
- **Threshold check:** actual blast radius (additive, read-only, Map-view-scoped, reversible) **matches** the artifacts' stated claims — no scope broadening. This criterion does not itself downgrade the verdict.

## Why CONCERNS, not PASS (the three unmet gaps — all cheap to close)

1. **No terminal PASS EVIDENCE (`require_audit_pass` unmet).** All 3 EVIDs are CONCERNS. The closures were confirmed by EVID-101 (itself CONCERNS due to the then-open RFC drift, now closed by the 10:31 edit), but **no fresh Profile B EVID recorded a clean PASS after the final closure**.
2. **AC-5 governance half never verified (rule-22 / NFR-006).** PRD-039 makes "rule-22 greps report 0 new endpoints and 0 spawn/write/network call sites" a ship-gate. No security/governance EVID exists. My blast-radius spot-check suggests low real risk (1 read-only GET), but a **recorded** rule-22 pass over the server `/api/*` + `shared/server` surface is required to close AC-5 honestly.
3. **AC-1/AC-3 + FR-005 dynamic browser render-proof never captured.** Map-view-only render (AC-1), depth control/toggle (AC-3), and the on-demand-load network trace (chunk absent on non-Map view / fetched on Map-open — NFR-002) rest on **one manual dev observation** (EVID-100, explicitly recorded as "manual, NOT a regression guard") + structural chunk analysis. `memory_recall` surfaced the directly-relevant precedent: **EVID-086** (prior guardian pass on this same composed-map arc) named the missing browser render-proof the single "load-bearing Phase-1 gate" and would not waive it. Waiving it here is the "drift accepted as good enough" failure guardian exists to prevent.

## Orchestrator instructions

**CONCERNS → do NOT activate yet. Dispatch the following, land their EVIDENCE, then re-run `guardian`:**

1. **Dispatch `agents-pro:security-expert`** (or a rule-22 grep pass) to verify PRD-039 AC-5 / NFR-006: 0 new `/api/*` endpoints, 0 spawn/write/network call sites, the overview reads only existing GET-only `/api/map` + `/api/map/layers/<zone>`. → record as a Profile B EVID (`informs` PRD-039). *(Expected clean — my spot-check found 1 read-only GET — but it must be recorded, not inferred.)*
2. **Dispatch `agents-core:tester`** for a Playwright/browser render-proof capturing PRD-039 AC-1 (Map-view-only 3D render; every other view's 2D minimap unchanged), AC-3 (depth 1/2/3 + ascend + show/hide toggle), and FR-005/NFR-002 (network/asset trace: 3D chunk **absent** on non-Map view load, **fetched** only on Map-view open). → record as a Profile B EVID (`informs` PRD-039).
3. **Optional but recommended (closes `require_audit_pass`):** a short Profile B re-review recording a clean **PASS** now that #1–#4 are all closed and RFC-036 is reconciled — this converts the chain from all-CONCERNS to having a terminal PASS.
4. **Then re-run `guardian`.** With items 1–2 (and ideally 3) landed, the chain has no remaining gaps and is activatable.

**Incremental option (secondary, orchestrator's call):** **ADR-011** alone is evidence-sufficient for its own decision — its cap bump (3 → 3.5 MiB) is empirically verified (build 3.28 MiB < 3.5, SSR three-free, lazy chunk, R_eff 0.70, ADI F+G+R=20, no revisit trigger fired), and EVID-099 itself states its measurements "can support activating ADR-011 specifically." If the orchestrator wants to unblock the cap decision (already applied in code as `a6ef030`) ahead of the UI work, ADR-011 could be activated first, with **PRD-039 + RFC-036 held in draft** pending items 1–2. Cleaner path is to close 1–2 and activate all three together.

## Notes

- `mm-gate-failures` mental model: **not present (HTTP 404)** — recorded honestly per HARD RULE 6; `memory_recall` still surfaced the load-bearing precedent (EVID-086 render-proof gate; EVID-082/083 zero-coverage silent-miss) which directly informed gap #3.
- No project-config.yaml → conservative defaults (HARD RULE 7). No claim collision: only PRD-038 held a (stale, expired 2026-07-06) claim — not on this chain.
- Residual tracked risks the orchestrator should carry even after activation: PRD-039 Q4 / RFC-036 R-6 (focus-chain vs PRD-038 onboarding-camera hand-off, unresolved); the load-bearing draco/basis vite stub (RFC-036 R-4, `TODO(iso-draco-basis)`); PRD-030/rule-21 editorial cap-text drift (3 → 3.5 MiB fix-forward).

## References

- Artifacts under review: PRD-039, ADR-011, RFC-036
- EVIDENCE chain: EVID-099, EVID-100, EVID-101
- Mental models consulted: `mm-gate-failures` (absent — 404); memory_recall surfaced EVID-086 / EVID-082 / EVID-083
- Independent runs: `npx vitest run shared-drill-bus iso-view-state.render` (16/16 pass); code greps of `iso-view-state.svelte.ts` / `IsoMapCorner.svelte` / `shared-drill-bus.svelte.ts`; `find dist* -stat` size sum

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit




