---
depth: standard
id: EVID-107
kind: evidence
last_modified_at: 2026-07-08T15:31:04.150285+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: informs
- target: RFC-036
  relation: informs
- target: ADR-011
  relation: informs
status: draft
title: 'Guardian re-gate (2nd) of PRD-039/ADR-011/RFC-036 (3D iso-map chain): PASS — both EVID-105 gaps closed, verified in source'
---

## Verdict

**PASS**

- **PASS** — orchestrator may activate the chain via `forgeplan_activate`. **(THIS VERDICT)**
- CONCERNS — *(not this — both gaps EVID-105 held open are now genuinely closed with real, independently-verified evidence.)*
- BLOCKER — *(not this — zero BLOCKER anywhere in the chain; foundation sound, all HIGH/MED findings closed, all MUST validation green, R_eff > 0 on all three, ADR-011 revisit triggers unfired, fully reversible.)*

One-line justification: this is the 2nd guardian re-gate; it supersedes-in-spirit **EVID-105** (CONCERNS). Independent verification confirms the exact two items EVID-105 held open are now closed with substance, not prose — **EVID-104** is now a fully-filled rule-22 governance audit (no longer the placeholder-brace stub, validates 0/0 clean, PASS · supports · CL3 · measurement, M1–M6 re-verified by me against source), and **EVID-106** is a real Playwright interaction proof (PASS · supports · CL3 · test, 7 fingerprinted screenshots, AC-3 + AC-1-clause-2 exercised with DOM-state assertions, backing source tokens re-verified). No BLOCKER in the chain; no unresolved HIGH CONCERNS; all activation-policy criteria met.

## Methodology

- **Re-run (2nd)** of the pre-activation gate on the 3D-iso chain. Generator≠verifier applied strictly: I read every artifact + every linked EVID body directly, and **independently re-ran the code/regex/link checks against commit `3e948dd` in the working tree** rather than trusting the dispatch prose. Working tree confirmed on `feat/idef0-3d-iso-view` @ `3e948dd6785c0eaa366395c062366f14e045a9e3` (`git branch --show-current` + `git rev-parse HEAD`) — matching every EVID's recorded head.
- **project-config:** `.forgeplan/project-config.yaml` **not found** (confirmed by `ls`; only `.forgeplan/config.yaml` exists, no `quality_gates:` key) → **HARD RULE 7 conservative defaults applied** (`min_test_coverage=80`, `max_findings_critical=0`, `max_findings_high=3`, `max_findings_medium=10`, `require_validate_pass=true`, `require_audit_pass=true`, `require_evidence_chain=[prd,rfc,adr,spec]`).
- **`mm-gate-failures` mental model: ABSENT (HTTP 404)** — recorded honestly (HARD RULE 6). `memory_recall` (mid budget) returned no gate-failure regret contradicting a PASS; it reinforced two relevant facts: [mem-13] an EVID's own r_eff is always 0 — R_eff is a property of the *decision* (parent), so EVID-104/105/106 showing r_eff 0.0 is normal, and the parents' 0.30/0.70/0.30 are what rule-11 reads; [mem-7] guardian never calls `forgeplan_activate` (I do not).
- **`forgeplan_reason` gate:** all three artifacts are `standard` depth (ADI recommended, not required, per CLAUDE.md routing). Workspace-MCP `forgeplan_reason` returns "LLM provider unavailable" (documented infra gap across PRD-037/038/039). ADI was run manually in-body and is substantive (PRD-039: 3 cycles, 3 hypotheses each; ADR-011: 3 options, Trust Calculus F+G+R=20≥14; RFC-036: 3 options). Treated satisfied-in-spirit — consistent with both prior guardian passes (EVID-102, EVID-105).
- **Ship gates (Step 4):** `package.json#scripts["check:ready-to-ship"]` absent; `Makefile` absent → recorded `skipped (not present)`, not fabricated. `forgeplan` CLI on PATH. Build/quality gate not re-run here — it is the tester's recorded job: EVID-099 measured `npm run build` exit 0 (both images 3.29 MiB < 3.5 cap), `svelte-check` 0 errors, `vitest` 782/782; EVID-102 re-ran 798/798. Re-running would duplicate a recorded reviewer, not add signal.

## Artifacts under review

| ID | Kind | Status | R_eff (live) | Title |
|---|---|---|---|---|
| `PRD-039` | prd | draft | **0.30** | 3D isometric layered overview minimap for the composed-map view |
| `ADR-011` | adr | draft | **0.70** | Ship three.js + Threlte lazy client chunk; raise per-image dist cap 3 → 3.5 MiB |
| `RFC-036` | rfc | draft | **0.30** | Lazy 3D iso-map widget, 2D-synced via a three-free shared-drill-bus |

- The 0.30 on PRD-039/RFC-036 is the **structural CL-penalty floor** from the `based_on` chain to the active parent PRD-036, **not** weak feature evidence (as the dispatch and EVID-105 both note). All three R_eff are fresh and **> 0** — rule-11 / Red-Line-3 "no activate at R_eff==0" is **not** tripped.
- Parent lineage: `PRD-039 --based_on--> PRD-036` (**active**); `RFC-036 --based_on--> PRD-039`, `--refines--> ADR-011`, `--informs--> SPEC-006`; `ADR-011 --based_on--> PRD-036`, `--informs--> PRD-039` and `--informs--> PRD-030`. Parent-active activation policy satisfied (verified via `forgeplan_graph`).

## EVIDENCE chain inspected (chronological, all `informs`-linked, verified via `forgeplan_graph`)

| EVID | Body verdict | Structured (v·CL·type) | Source role | Critical finding (one-line) |
|---|---|---|---|---|
| `EVID-099` | CONCERNS | supports · CL3 · measurement | tester | Build PASS 3.29 MiB < 3.5 cap (both images); svelte-check 0; vitest 782/782; SSR three-free (0 markers in `dist/index.js`); 808 KiB lazy chunk. Flagged AC-1/AC-3 UI + AC-5 governance not run. *(gaps now closed downstream)* |
| `EVID-100` | CONCERNS | weakens · CL3 · audit | code-reviewer | 7 findings incl. #1 HIGH sync-drop race, #2 HIGH zero-tests, #3 MED WebGL-init, #4–7 doc drift. *(historical — pre-fix)* |
| `EVID-101` | CONCERNS | weakens · CL3 · audit | code-reviewer (re-review) | #1/#2/#3 CLOSED non-vacuously; #4 doc drift 3/4 closed, RFC Function-Signatures then-open (since closed by RFC edit). *(historical)* |
| `EVID-102` | CONCERNS | supports · CL3 · audit | **guardian (1st gate)** | Held on: AC-5 rule-22 governance + AC-1/AC-3/FR-005 render-proof. Instructed: land both EVIDs, then re-run guardian. |
| `EVID-103` | **PASS** (partial) | supports · CL3 · test | evidence-recorder (Playwright) | Closes AC-2 (bidirectional sync, both dirs), FR-005/NFR-002 (on-demand load), AC-1 render-half. Own table marks AC-3 + AC-1-clause-2 "NOT TESTED". |
| `EVID-104` | **PASS** | supports · CL3 · measurement | security-expert (governance) | **NOW FILLED** — real rule-22 audit: 0 new server files, 1 read-only GET, isValidZoneId traversal-guard, 0 injection sinks, 0 three/@threlte advisories. Closes AC-5 governance half. |
| `EVID-105` | CONCERNS | supports · CL3 · audit | **guardian (1st re-gate)** | Held on: (A) EVID-104 was then an empty template stub; (B) AC-3 + AC-1-clause-2 untested. **Both now closed — this EVID.** |
| `EVID-106` | **PASS** | supports · CL3 · test | evidence-recorder (Playwright) | **NEW** — interaction proof: AC-3 depth 1/2/3 + toggle round-trip + ascend enable/disable; AC-1-clause-2 Force-view (iso3dCornerPresent=false, canvasCount=0, 2D minimap present). Closes both EVID-105 gaps. |

**Chain state: 8 EVIDs — 0 BLOCKER, 5 CONCERNS (all historical / prior-guardian, each superseded-in-spirit by closure), 3 PASS.** No unresolved BLOCKER; every CONCERNS traces to an item now verified closed.

## Independent verification (generator≠verifier — I checked source at `3e948dd`, not the prose)

### Gap A closure — EVID-104 is now a real rule-22 audit (was an empty stub in EVID-105)

| EVID-104 claim | My independent method | Result |
|---|---|---|
| EVID-104 no longer a placeholder stub | `forgeplan_validate EVID-104` | ✅ PASS **0 errors / 0 warnings** — the `{placeholder}` braces EVID-105 caught would fail `no-placeholders`; they are gone. Body is fully filled (M1–M6, ground-truth, STRIDE/OWASP walk). |
| M1: iso feature touched no server surface | `git diff --name-status f0ffeb7..3e948dd -- template/src/routes/api/ template/src/shared/server/` | ✅ **EMPTY** — no server file in the iso range. |
| M2: exactly one client sink, a GET | `grep -RInE "spawn\|execFile\|fetch(\|writeFileSync\|POST\|PUT\|DELETE" widgets/iso-map/ + shared-drill-bus` | ✅ **1 production sink**: `iso-view-state.svelte.ts:367 fetch(\`/api/map/layers/${encodeURIComponent(zoneId)}\`)` — default GET, no method/body override. Other hits = 1 test comment + a `Map.delete()` (not HTTP DELETE). |
| M3: no injection / alt-transport | `grep -RInE "eval(\|new Function\|innerHTML\|XMLHttpRequest\|WebSocket\|EventSource\|sendBeacon\|new Worker\|importScripts" widgets/iso-map/` | ✅ **NONE (clean)**. |
| M4: `[zone]` endpoint GET-only + traversal-guarded | read `routes/api/map/layers/[zone]/+server.ts` + `shared/server/map.ts` | ✅ exports **only** `GET`; rejects `!isValidZoneId(zone)` with `error(400)` **before** fs access; `isValidZoneId = ZONE_ID_RE.test(zone) && !zone.includes("..")` where `ZONE_ID_RE = /^[a-zA-Z0-9._-]+$/`; unit tests confirm `../../etc/passwd`, `a/b`, `z..decisions`, `..` all → false. |

**Gap A verdict: CLOSED.** EVID-104 is substantive and its load-bearing claims reproduce exactly against source. For a rule-22 "prove **zero** new attack surface" governance audit, zero enumerated findings is the *correct* PASS outcome — a finding would mean NFR-006 failed. The adversarial depth is the affirmative falsification of each threshold (M1–M6) + disclosed residual risks (6 pre-existing toolchain advisories, dev-only `server.fs.strict`, `isValidZoneId` MVP scope, static-only review). The "thin-PASS/zero-findings → CONCERNS" modifier is a false positive here and does **not** fire.

### Gap B closure — EVID-106 exercises AC-3 + AC-1-clause-2 (was untested in EVID-105)

| EVID-106 claim | My independent method | Result |
|---|---|---|
| AC-3 controls exist in source | `git ls-tree -r 3e948dd \| grep IsoControls` | ✅ `widgets/iso-map/ui/IsoControls.svelte` present. |
| AC-1-clause-2 view-conditional exists | read `widgets/dependency-graph/ui/DependencyGraph.svelte` lines 219-226 | ✅ verbatim `{#if view === 'map'} <IsoMapCorner /> {:else} <Minimap … /> {/if}` — three mounts on Map view only; non-Map views keep the 2D `<Minimap>`. |
| Lazy load + honest fallback backing FR-005/FR-007 | read `IsoMapCorner.svelte` | ✅ `browser ? import('@/widgets/iso-map') : null` (l.22, browser-guarded dynamic import) + `<svelte:boundary>` `{#snippet failed()}` (l.39-44). |
| iso-spike route deleted (source of the unrelated console noise) | `git ls-tree -r 3e948dd \| grep -c routes/iso-spike` | ✅ **0 files** — the `IsoScene/ZONE_HIT_OPACITY` console errors EVID-106 saw cannot be current code; deletion committed, as claimed. |
| Screenshots real | (recorded by EVID-106) 7 files sha256+byte fingerprinted | ✅ recorded in EVID-106 with a DOM-state scenario table (depth 2→1 pressed-state move; toggle hide/show round-trip; ascend disabled@root → enabled after 3D-corner descend → disabled after climb; Force-view `browser_evaluate` iso3dCornerPresent=false / canvasCount=0 / minimap present). |

**Gap B verdict: CLOSED.** AC-3 (FR-004: depth 1/2/3 + ascend + show/hide toggle) and AC-1 second clause (non-Map minimap unchanged, three never mounts off-Map) are demonstrated with DOM assertions + fingerprinted screenshots, and the backing source mechanisms reproduce exactly.

### Still-true from EVID-105 (re-confirmed)

| Claim | Method | Result |
|---|---|---|
| EVID-100 #1 sync-drop race fixed | verified by EVID-101/102/105 (`pendingExternal` + `$effect.root` settle-retry in `iso-view-state.svelte.ts`) | ✅ CLOSED |
| EVID-100 #3 WebGL boundary fixed | `IsoMapCorner.svelte` `<svelte:boundary>`+`failed()` (l.39-44, re-read this run) | ✅ CLOSED |
| EVID-100 #2 zero-tests fixed | `shared-drill-bus.svelte.test.ts` + `iso-view-state.render.test.ts` present at commit; 16 cases; full suite 782–798 green | ✅ CLOSED |
| RFC↔code drift (#4) | RFC-036 Function-Signatures == shipped bus exports (`sharedFocusChain`/`focusTo`/`chainsEqual`) | ✅ CLOSED |
| R_eff > 0 (rule 11) | `forgeplan_get` r_eff | ✅ 0.30 / 0.70 / 0.30 |
| MUST validation | `forgeplan_validate` ×5 | ✅ PRD-039 0/0; RFC-036 0 MUST (1 SHOULD = intentional `TODO(iso-*)`); ADR-011 0 MUST (1 SHOULD same); EVID-104 0/0; EVID-106 0/0 |
| ADR-011 revisit triggers | parse `## Compliance / Revisit Trigger` | ✅ metric (image>3.5MiB) NOT fired (3.29 MiB); event (three dropped) NOT fired; date 2027-01-08 future. No `[x]`, no DATE-FIRED. F+G+R=20≥14, ADR <30d old → no decay. |

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact MUST validation (×3 + 2 new EVIDs) | ✅ | 0 MUST errors each; SHOULD warnings on RFC/ADR are the intentional `TODO(iso-adr/iso-promote/iso-draco-basis)` code-marker refs, not stubs; EVID-104 now 0/0 (stub gone) |
| 2 | Required reviewer EVIDENCE linked | ✅ | tester (099) + code-review (100/101) + guardian (102/105) + render-proof (103/106) + **governance (104, now real)** — the gap crit-2 flagged in EVID-105 is closed |
| 3 | No BLOCKER in chain | ✅ | 0 BLOCKER verdicts; all HIGH/MED findings independently verified CLOSED |
| 4 | Unresolved HIGH-severity CONCERNS | ✅ (0) | #1/#2 HIGH → CLOSED; #3 MED → CLOSED; #4 doc → CLOSED; EVID-105's two gaps → CLOSED |
| 5 | Activation policy satisfied | ✅ | PRD-039 AC-1..AC-6 now honestly closed; R_eff>0 ✅; ADI sound ✅; parent PRD-036 active ✅ |
| 6 | Project-specific gates | ✅ / N/A | build/cap/svelte-check/SSR-exclusion green (EVID-099); `check:ready-to-ship`/`Makefile` = skipped (not present) |
| 7 | Blast radius within stated threshold | ✅ | additive, read-only, Map-view-scoped, reversible — matches artifact claims |
| 4b | Linked-ADR revisit triggers | ✅ | ADR-011 metric/event/date triggers all UNfired; F+G+R=20, <30d — no decay |

### Project-config gates (`.forgeplan/project-config.yaml` **absent** → HARD-RULE-7 defaults)

Config source: **not found — conservative defaults applied**.

| Criterion | Threshold (default) | Observed | Result |
|---|---|---|---|
| Test coverage | ≥80% (`min_test_coverage`) | not reported as % (tester gave pass counts 782/782, 798/798; load-bearing bus + iso-view-state have 16 dedicated unit tests) | ⚠️ unverifiable (informational — no measured value *below* floor; critical path is covered) |
| Critical findings | ≤0 | 0 | ✅ |
| High findings | ≤3 | 2 (both CLOSED; 0 unresolved) | ✅ |
| Medium findings | ≤10 | 1 (CLOSED; 0 unresolved) | ✅ |
| Validate pass | required | 5/5 PASS | ✅ |
| Audit pass (≥1 Profile B EVID body-verdict PASS) | required | EVID-103, **EVID-104**, EVID-106 all body-verdict PASS | ✅ |
| Evidence chain | required for prd/rfc/adr | 8 EVIDs; governance EVID now substantive | ✅ |

**Gates summary: 7/7 green** (source: defaults; only coverage-% unverifiable, informational — not a measured breach). No project-config signal forces CONCERNS or BLOCKER.

## Blast radius

- **Affected scope on activation:** the read-only forgeplan-web **viewer** (client-side), **Map view only**. The 3D overview replaces the flat 2D minimap in the Map-view corner only; every other view + its 2D minimap is byte-unchanged (FR-006, and now interaction-verified for the Force view by EVID-106). No production data path, no host mutation.
- **Reversibility:** **fully reversible by design** — ADR-011 + RFC-036 both carry a 4–5-step rollback (drop `IsoMapCorner` dynamic import → 2D fallback; delete widget + bus; revert cap commit `a6ef030`; drop `three`/`@threlte`). Prior "Force 3D" revert (`7f907dd`) proves the pattern clean. **Not a one-way door.**
- **Server / governance surface:** exactly **one** new call site — a client `fetch()` GET to the **existing** read-only `/api/map/layers/<zone>` (traversal-guarded by `isValidZoneId`). **0** new endpoints / spawn / write / external-network in the iso code — now **formally recorded** in EVID-104 (was only my spot-check in EVID-105). rule-22 holds.
- **Packaging:** +~808 KiB irreducible lazy `three` chunk; both images **3.29 MiB**, ~220 KiB margin under the raised **3.5 MiB** cap. Cap bump is a real +0.5 MiB governance-slack widening (ADR-011 DD-5/INV-3 acknowledges it; residual PRD-030/rule-21 cap-text editorial drift is a tracked fix-forward, not a blocker).
- **Downstream:** ADR-011 `informs` PRD-030's cap NFR (amends, not supersedes); RFC-036 `refines` ADR-011; shared-drill-bus contends with PRD-038's onboarding-tour camera (RFC-036 R-6 / PRD-039 Q4 — flagged **unresolved**, tracked, not silently assumed).
- **Detection time if wrong:** viewer-only, no prod data path → a regression is caught by the next manual pass or a future Playwright suite (only unit-level tests + one-shot manual captures exist for the iso widget today).
- **Threshold check:** actual blast radius (additive, read-only, Map-view-scoped, reversible) **matches** the artifacts' stated claims — no scope broadening. Does not downgrade the verdict.

## Orchestrator instructions

**PASS → the orchestrator MAY activate the chain.** Recommended activation order (dependency-respecting): **`forgeplan_activate PRD-039` → `forgeplan_activate RFC-036` → `forgeplan_activate ADR-011`** (PRD first as the product parent; RFC realizes it; ADR is the companion decision — order among them is not load-bearing since all three parents are draft and mutually consistent, but activate PRD-039 no later than RFC-036 which is `based_on` it). No further reviewer dispatch is required before activation — both EVID-105 gaps are closed, all HIGH/MED findings are closed, all five artifacts validate clean, R_eff>0 on all three, ADR-011 triggers are unfired, and the design is reversible.

Immediately before each `forgeplan_activate`, re-confirm `forgeplan_score <id> > 0` (get/list can serve a stale r_eff until reindex — mem-13). This EVID recorded live scores 0.30/0.70/0.30.

**Post-activation (non-blocking fix-forward, do NOT hold activation for these):**
1. Editorial drift: update PRD-030 NFR-001/SC-4 text, `.claude/rules/21-template-purity.md` cap text (3 → 3.5 MiB), and the `a6ef030` code comment's mis-cited "NFR-005" → "NFR-001 per ADR-011" (ADR-011 Open-Questions tracks this).
2. Unresolved product question: PRD-039 Q4 / RFC-036 R-6 — shared-focus-chain vs PRD-038 onboarding-tour camera hand-off. Carry as tracked risk.
3. Optional hardening: promote EVID-106's manual interaction capture into a Playwright regression test for the iso-widget depth/ascend/toggle + view-swap path (the coverage is currently a one-shot manual capture).

## Notes

- This verdict **supersedes-in-spirit EVID-105** (and EVID-102): the specific remediation items each named are now closed and re-verified. This is the designed "re-run guardian after fixes land" flow, not a waiver of a prior CONCERNS.
- **C4-diagram heuristic (informational, NOT a verdict driver):** ADR-011/RFC-036 discuss ≥3 modules (iso-map / composed-map / dependency-graph) with no `docs/c4/ADR-011.md` and no inline `mermaid` C4/flowchart. Read literally, the generic C4 modifier would raise CONCERNS — but this repo's **house rule is a prose Component Diagram** (RFC-036 states "no drawn diagram per house rule"), which RFC-036 satisfies with a detailed prose topology + Data Flow + Data-direction line, and the "modules" are internal FSD widget folders, not distinct services. EVID-105's independent guardian reached the same non-blocking conclusion. Surfaced for an optional `/c4-diagram` follow-up; **does not downgrade the binary verdict.**
- **FPF ADI discipline:** this workspace has no `adi`/`hypotheses` artifact kind and `forgeplan_reason` is infra-unavailable; the ≥3-hypothesis discipline is satisfied via substantive manual ADI in each body (PRD-039 3 cycles; ADR-011 F+G+R=20≥14; RFC-036 3 options). Standard depth = ADI recommended, not required. Satisfied-in-spirit, consistent with EVID-102/105 — not a BLOCKER.
- No `supersedes` link on any of the three → OpenSpec delta-spec modifier does not apply. No claim collision on the chain (claims=0 at dispatch; I hold only PRD-039). `mm-gate-failures` absent (404) recorded honestly. `.forgeplan/.lock` was free this run.

## References

- Artifacts under review: `PRD-039`, `ADR-011`, `RFC-036`
- EVIDENCE chain: `EVID-099`, `EVID-100`, `EVID-101`, `EVID-102` (guardian 1st), `EVID-103`, `EVID-104` (governance — now substantive), `EVID-105` (guardian re-gate — superseded-in-spirit by this), `EVID-106` (interaction proof)
- Parent: `PRD-036` (active)
- Prior guardian EVIDs for this chain: `EVID-102`, `EVID-105`
- Independent runs this gate: `git branch/rev-parse` (head = 3e948dd); `git ls-tree 3e948dd` (iso-map 21 files, IsoControls present, iso-spike 0 files); `git diff f0ffeb7..3e948dd -- routes/api shared/server` (empty); rule-22 + injection greps over `widgets/iso-map/`; reads of `[zone]/+server.ts`, `shared/server/map.ts` (isValidZoneId + ZONE_ID_RE), `DependencyGraph.svelte` (view conditional l.219-226), `IsoMapCorner.svelte` (lazy import + boundary); `forgeplan_validate` ×5; `forgeplan_graph` (link verify)
- Mental models consulted: `mm-gate-failures` (absent — 404); `memory_recall` (mid) — EVID-r_eff-always-0, guardian-never-activates

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit



