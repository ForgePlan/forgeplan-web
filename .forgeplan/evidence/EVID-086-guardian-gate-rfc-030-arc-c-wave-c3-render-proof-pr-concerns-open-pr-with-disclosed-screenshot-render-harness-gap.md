---
depth: standard
id: EVID-086
kind: evidence
last_modified_at: 2026-07-03T01:57:16.655839+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: draft
title: 'Guardian gate: RFC-030 ARC C Wave C3 render-proof PR — CONCERNS (open PR with disclosed screenshot/render-harness gap)'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

> Structured-fields note: `weakens` is the R_eff signal, not a repudiation of the build. It records that the evidence chain does NOT yet substantiate RFC-030's own load-bearing Phase-1 acceptance bar (the visual render-proof). The build itself is sound and safe to integrate — see Verdict. A `supports` here would inflate R_eff and let "data-flow works" read as "render-proof proven," which is exactly the conflation this gate exists to prevent. CL3 because this audit read the actual code at HEAD `a0a8958`, ran the actual suite, and validated the actual artifact — same context.

## Verdict

**CONCERNS**

- **PASS** — orchestrator may proceed with no further action.
- **CONCERNS** — orchestrator may open the PR, but MUST disclose the gap in the PR body and dispatch the named fast-follow; do NOT treat Phase-1 render-proof as "proven" until the gap is closed.
- **BLOCKER** — halt; artifact stays as-is.

One-line justification: every code/test defect from EVID-082/083 is genuinely fixed and independently re-verified (477/477 vitest, 0 svelte-check errors, AC-2 layout suite present, discriminant bug closed), and the branch is additive + one-revert reversible — so this is safe to open as a PR to `develop`; but RFC-030 names the browser render-proof "the load-bearing Phase-1 gate" and that gate is unmet by BOTH available means (no render-harness test AND no screenshot — EVID-085), so it cannot PASS as "render-proof complete."

## Artifact under review

- ID: `RFC-030` (active, `forgeplan_validate` PASS 0/0, R_eff 0.3)
- Kind: `rfc` (Standard depth)
- Title: Composed-map Phase-1 render-proof: isolated map entity + pure-grid widget + read-only /api/map as the 9th view
- Parents (based_on): `PRD-036`, `SPEC-006`
- Gate context: this is a **go/no-go on opening a PR `feat/idef0-composed-map → develop`**, NOT an artifact-activation gate (RFC-030 is already active) and NOT a ship-to-users gate.
- HEAD gated: `a0a8958` (build+fix-loop range `4c59cda..a0a8958`).

## EVIDENCE chain inspected (chronological)

| EVID | Verdict (structured) | Gate reading | Source | Critical finding (one-line) |
|---|---|---|---|---|
| `EVID-081` | supports / CL? | design-gate PASS | guardian (GATE C2, 2026-07-02) | Design-time PASS; R_eff 1.0 then; predates the build. |
| `EVID-082` | weakens / CL3 test | CONCERNS | tester (independent) | AC-2 (`composed-layout`) had **zero** coverage — a Phase-3 gate silently unmet; Phase-4 render-harness absent (flagged); SD-2 drift. |
| `EVID-083` | weakens / CL3 audit | CONCERNS | code-reviewer (independent) | F1 HIGH (server error masked as "no map yet"), F2 MEDIUM (pre-fetch false validation flash), F3 MEDIUM (SD-2 drift), F4 HIGH (test gap = why F1/F2 shipped), F5 LOW (a11y). |
| `EVID-084` | supports / CL3 test | fix-loop (ACTIVE) | orchestrator | **Closes 082/083 code+test findings**: +`composed-layout.test.ts` (7 tests), F1+F2 discriminant fix, SD-2 RFC amendment. Re-verified 477/477. Explicitly leaves Phase-4 render-harness deferred. |
| `EVID-085` | supports / CL2 measurement | honest-gap (ACTIVE) | orchestrator | Data-flow round-trip verified via `/api/map` (port 5179). **Load-bearing browser screenshot NOT captured** — external Playwright/Chrome contention (PID 19449), not a code defect. |

Chain state: **0 unresolved BLOCKERs.** EVID-082/083 (both CONCERNS/weakens) are superseded-in-substance by EVID-084's verified fix-loop — I re-checked each fix against HEAD, not the EVID prose (see Ground-truth). The two "weakens" EVIDs remain in `draft` in the graph, which is why RFC-030's R_eff sits at 0.3 (graph hygiene, not a live defect).

## Ground-truth verification (guardian re-check, HEAD a0a8958)

Every EVID-084 claim was re-verified against the real tree — not trusted from prose:

| Claim | Probe | Result |
|---|---|---|
| 477/477 vitest, 0 svelte-check errors | `npx vitest run` + `npx svelte-check --threshold error` (run by me now) | **CONFIRMED**: 477 passed / 38 files, exit 0; svelte-check 1155 files, 0 errors, 2 pre-existing a11y warnings. (`zsh: _encode/_decode not found` lines are harmless shell-profile noise.) |
| AC-2 layout suite backfilled | `git ls-tree a0a8958 … composed-layout.test.ts` + test count | **CONFIRMED**: file present in HEAD, **7 tests**. |
| F1/F2 discriminant fixed | grep `liveBranch` in `ComposedMapView.svelte` | **CONFIRMED**: destructures `{data, error, lastFetched}`; `loading` branch first (`raw===null && lastFetched===null`); `error` checked before `isEmptyMapResponse`. |
| SD-3 fixture identity | `diff fixtures/checkpoint-map.json .forgeplan/map/map.json` | **CONFIRMED**: byte-identical. |
| Rule 22 GET-only | grep exports + spawn/write/fetch in `+server.ts`/`map.ts` | **CONFIRMED**: `GET` only, zero spawn/write/fetch. |
| Build diff is real & substantial | `git diff 4c59cda..a0a8958 --stat` | **CONFIRMED**: 29 files, +3629/-24. |
| Render-harness suite exists | `find widgets/composed-map -iname '*test*'` | **ABSENT** (expected) — Phase-4 gate genuinely unmet. |

## Gate criteria

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Artifact MUST validation | ✅ | `forgeplan_validate RFC-030` → PASS, 0 errors / 0 warnings. |
| 2 | Required EVIDENCE linked | ✅ | tester + code-reviewer + fix-loop + data-flow EVIDs all present and read in full. |
| 3 | No unresolved BLOCKER in chain | ✅ | 082/083 CONCERNS resolved by verified 084 fix-loop. |
| 4 | Unresolved CONCERNS | ⚠️ (2) | (a) Phase-4 **render-harness test** absent; (b) **browser render-proof screenshot** not captured. Both bear on the RFC's self-named "load-bearing Phase-1 gate." |
| 5 | Activation/deliverable policy | ⚠️ | RFC Phase 5 requires a "manual dual-theme + EN/neutral-chrome visual pass" — not performed (EVID-085). "Deferred" ≠ "done." |
| 6 | Project-specific gates | ✅ | vitest + svelte-check green (see Ground-truth). |
| 7 | Blast radius within stated threshold | ✅ | PR-to-`develop`, additive, one-revert reversible — see Blast radius. |

### Project-config gates (`.forgeplan/project-config.yaml`)

**Config source:** `not found — conservative defaults applied (HARD RULE 7)`. Recorded per Methodology.

| Criterion | Threshold (default) | Observed | Result |
|---|---|---|---|
| Test coverage | ≥80% (`min_test_coverage`) | not measured (`--coverage` not run); the specific AC-2 gap that drove the concern is now closed (7 tests) | ⚠️ informational (no % available) |
| Critical findings | 0 (`max_findings_critical`) | 0 | ✅ |
| High findings | ≤3 (`max_findings_high`) | 2 HIGH in chain (083 F1, F4) — **both resolved** by 084 (F4's layout half closed; render-harness half remains as a MEDIUM test-gap) | ✅ (no unresolved HIGH) |
| Medium findings | ≤10 (`max_findings_medium`) | 3 (083 F2 resolved; F3 resolved via amendment; render-harness gap ~MEDIUM) | ✅ |
| Validate pass | required | PASS | ✅ |
| Audit pass | required (≥1 Profile B EVID w/ PASS/supports) | EVID-084 supports/CL3 present | ✅ |
| Evidence chain | required for rfc | 5 `informs`-linked EVIDs | ✅ |

**Gates summary:** 6/7 (criterion 4/5 = the render-proof gap is the CONCERNS driver; no project-config numeric threshold is breached).

### Methodology notes

- `.forgeplan/project-config.yaml`: not found → conservative defaults applied silently (HARD RULE 7).
- `mm-gate-failures` mental model: **not found (HTTP 404)** in this bank. Fell back to `memory_recall` (13 memories) — confirmed the render-proof-first ordering (T4 GATE-C: "no renderer until a real map.json exists", superseded to hand-written-first) and that guardian, not smith, owns activation. Recorded as honest negative coverage.
- Independent re-run of full suite + svelte-check performed (not carried from EVID-084).
- Workspace `.forgeplan/.lock`: flock contention from a concurrent sub-agent delayed this EVID write (~several min, multiple 30s timeouts); not force-cleared (guardian has no `--force`; must not corrupt a concurrent write). Persisted on a release window.

## The judgment (task questions 1–3)

**Q1 — Does the chain satisfy RFC-030's Phase-1 acceptance bar?** Partially. The *build* bar is met (fixes real + re-verified, additive/reversible, validate PASS). The *render-proof* bar is not: RFC Motivation is "prove the `forgeplan.map/v1` **renderer** against a hand-written document," and RFC Phase 5 requires a manual visual pass. EVID-084's real fixes weigh heavily in favour of the branch's soundness; EVID-085's honest admission that the load-bearing gate was not captured is decisive against calling Phase-1 "proven."

**Q2 — Is EVID-085's CL2/supports honest?** The **body** is scrupulously honest ("NOT verified this wave … not swept under the rug"). But the `supports` verdict, read in isolation on an EVID titled "…render-proof," understates the gap: it supports the *narrower* claim (document round-trips file→endpoint→JSON), not the RFC's claim (the SVG canvas paints coherently). CL2/measurement against the HTTP surface is accurate for that narrower claim. My independent read: 085 proves data-flow, not render — and must not be counted as the render-proof.

**Q3 — Is HTTP data-flow a meaningfully different claim than "the canvas renders correctly"?** Yes, materially. Data-flow proves the document reaches the client; it proves nothing about whether `computeComposedLayout` + the 5 components compose into a non-broken visual. Is the residual covered elsewhere? Partially, not fully: `composed-layout.test.ts` proves the layout **math** is deterministic/pinned/bounded; `svelte-check` proves the components **type-check**. Neither proves they **paint** — there is no render-harness test that mounts `ComposedMapView` and asserts zone slabs/node cards/edges appear, and no screenshot. So the exact surface the render-proof exists to prove is unproven by any automated OR manual means. That residual is real, RFC-acknowledged, and load-bearing — hence CONCERNS, not PASS. It is not BLOCKER because it is an environmental-contention gap on a green, additive, reversible branch, not a code defect.

## Blast radius

- **Affected scope on this action:** the `develop` **integration** branch only — via a normal PR that still faces human review + the CI matrix (ubuntu/macos/windows) before any further promotion. Per CLAUDE.md git-flow (`main ← release/* ← develop ← feature/*`), opening this PR does **not** ship to users; users are reached only via a later `develop → release/* → main → tag → npm publish`, behind multiple additional gates.
- **Reversibility:** high. RFC-030 Rollback is purely additive — one revert removes the registry entry, the `DependencyGraph` branch + `isLive` prop, all new `entities/map` / `widgets/composed-map` / `shared/server/map.ts` / route files, the css tokens, the checkpoint doc, and the rule-22 read-only amendment; mosaic de-enrols automatically. EVID-083 verified zero changes to `entities/graph` or the 8 existing views.
- **Downstream artifacts:** PRD-036 / SPEC-006 Phase-1 FRs; EPIC-001 T4 row. The uncaptured render-proof matters most if this rides toward `release/main` still unproven.
- **Detection time if the render is actually broken:** currently only at a human's first browser open — precisely because the render-harness test is absent. That is the risk the fast-follow closes.
- **Threshold check:** actual blast radius (PR to a reversible integration branch) is **within** what the artifact implies. The gap does not endanger `develop`; it endangers the *claim* "render-proof complete." Hence CONCERNS with disclosure, not BLOCKER.

## Orchestrator instructions

**CONCERNS → the PR may be opened now, WITH the gap disclosed, AND a fast-follow dispatched. Do NOT record Phase-1 render-proof as "proven" until the fast-follow lands.**

1. **Open `feat/idef0-composed-map → develop`** — the branch is green (477/477, 0 svelte-check errors), additive, one-revert reversible, `forgeplan_validate RFC-030` PASS. The build defects (EVID-082/083) are genuinely fixed (guardian-reverified).
2. **The PR body MUST flag the known gap verbatim** in its Test plan section: *"Phase-4 render-harness suite (`ComposedMapView.render.test.ts`) not yet written; the browser screenshot render-proof — which RFC-030 calls the load-bearing Phase-1 gate — was NOT captured this wave (blocked by external Playwright/Chrome contention, EVID-085). Data-flow verified end-to-end; visual render pending."* Do not open the PR silently.
3. **Dispatch `agents-core:coder` (Profile C) for the fast-follow** (author the automated substitute that does NOT depend on browser availability): `widgets/composed-map/ui/ComposedMapView.render.test.ts` mirroring `idef0-view.render.test.ts` (happy-dom + `mount()`), covering render-proof, empty, **loading**, **error-surface (malformed → not "no map yet")**, time-travel suspension (`isLive={false}`), and the §15 nav contract (Esc reset / >3px drag-suppression / plain-wheel-pan vs ⌘-wheel-zoom). This is the durable regression guard that would have caught F1/F2, and it closes the "do the components paint?" residual (Q3) independently of Playwright. Then re-run `agents-core:tester` for a fresh coverage EVID.
4. **Capture the actual browser screenshot** once Playwright/Chrome access frees — port 5179 is left running per EVID-085 — and record it as a follow-up CL3 EVID (`evidence_type: measurement`, the manual visual pass RFC Phase 5 requires). This can be the same fast-follow or immediately after; it is required before this arc promotes past `develop`.
5. **Graph hygiene (optional but recommended):** EVID-082/083 (weakens, draft) still drag RFC-030's R_eff to 0.3; once the fast-follow EVID lands, reconcile the chain so R_eff reflects the resolved state.
6. **Re-run `guardian`** on the patched branch before this arc is promoted `develop → release/*` — at that promotion the render-proof gap flips from CONCERNS-acceptable to BLOCKER-worthy.

## Notes

- Recall surfaced the program's own safety framing: T4 GATE-C originally said "no renderer until the cartographer emits a real map.json," superseded to "hand-written render-proof first." The whole point of this wave is to prove the renderer against that hand-written doc — which sharpens why the *visual* proof (not just data-flow) is the load-bearing artefact, and why leaving it uncaptured is a real (if non-blocking-for-develop) gap.
- Positive: the fix-loop is a model of the intended discipline — independent reviewers found real bugs (error-masking, false-validation-flash) that a green-but-thin suite hid, and the orchestrator closed them with tests + a re-verified run rather than assertion. The remaining gap is honestly recorded, not hidden.

## References

- Artifact: `RFC-030` (parents `PRD-036`, `SPEC-006`)
- EVIDENCE chain: `EVID-081`, `EVID-082`, `EVID-083`, `EVID-084`, `EVID-085`
- Mental models: `mm-gate-failures` not found (404) → `memory_recall` fallback used
- HEAD gated: `a0a8958` (`4c59cda..a0a8958`, +3629/-24, 29 files)

