---
depth: standard
id: EVID-090
kind: evidence
last_modified_at: 2026-07-03T14:30:28.660695+00:00
last_modified_by: claude-code/2.1.199
links:
- target: RFC-030
  relation: informs
status: draft
title: 'Test verification of coder''s 1.A/1.B/1.C composed-map fixes: green suite, uncommitted diff, nav-contract test gap'
---

## Verdict

**CONCERNS**

481/481 vitest passed (477 baseline + 4 new, 0 regressions, reproducible across 2 runs), svelte-check 0 errors across 1156 files (+1 file vs 1155 baseline, 2 pre-existing a11y warnings unrelated to this diff). Ground-truth diff confirmed present and correct for fixes 1.B and 1.C. Fix 1.A's code change (`onClearSelection` wiring) is real and correctly threaded, but the "nav-contract test suite (Esc-reset, drag-suppression, wheel-routing)" that RFC-030:151 pins as a **checkpoint acceptance bullet, not fast-follow polish** — and that EVID-089 finding 1.A explicitly called out as missing — is still not delivered: the only artifact added is `probe.render.test.ts`, a debug scratch file with zero `expect()` assertions in its Escape-reset test. No coder report was provided to this agent to evaluate as a reasoned scope decision, so the gap is recorded as unresolved, not accepted.

## Ground-truth verification

- Base..head: `80c9015` (the "prior known-good checkpoint" cited by the dispatch prompt) `..` **uncommitted working tree** — HEAD is still `80c9015`; there is no new commit. Source: dispatch prompt (baseline) + `git rev-parse HEAD` (current state, read directly).
- Diff probe: `git status --short` / `git diff --stat -- template/src/widgets/composed-map/ template/src/entities/map/ template/src/pages/home/ template/src/widgets/dependency-graph/ .forgeplan/map/`
- Diff state: **DELTA=PRESENT** (in the working tree only — see claim-vs-reality gap below)
- Expected delta tokens (source: EVID-089 findings 1.A/1.B/1.C, which this fix-round targets):
  - 1.A → `onClearSelection` — **FOUND**, threaded `ComposedMapView.svelte` → `DependencyGraph.svelte` → `HomePage.svelte` (`onClearSelection={closePanel}`), called from both `handleCanvasClick` and the Escape keydown handler.
  - 1.B → `highlightedIds` prop on `NodeCard.svelte` — **FOUND**, mirrors `EdgeLayer.svelte`'s existing `ReadonlySet<string> | null` + dim pattern; `ComposedMapView.svelte` passes `activeHighlight` to both `EdgeLayer` (pre-existing) and now `NodeCard` (new).
  - 1.C → `checkZoneAccent` guard in `validate.ts` + corrected fixture token — **FOUND**, `--map-accent-olive` (undefined token) replaced with `--map-accent-violet` (one of the 7 real tokens) in both `checkpoint-map.json` (canonical) and `.forgeplan/map/map.json` (workspace copy, byte-identical per SD-3), plus a new warning-severity validator rule with 2 dedicated tests.
- Verdict floor from ground-truth gate: diff PRESENT + tokens FOUND → PASS-eligible on the narrow git-delta gate. **However** — see claim-vs-reality gap immediately below, which independently caps the verdict at CONCERNS.

### Claim-vs-reality gap (process, not code)

The dispatch prompt states the coder "committed the result." This is **false**: `git status --short` shows all 8 touched tracked files as modified-but-uncommitted (`M`), plus one untracked new test file. `git rev-parse HEAD` == `80c9015`, identical to the cited prior-checkpoint commit. No new commit exists on `feat/idef0-composed-map`. This is not a vacuous-green (DELTA is not empty — real code changed), so it does not hit the HARD-RULE-9 BLOCKER floor, but it is a real hygiene gap the guardian must know before activation: if the working tree is reset/discarded, this fix vanishes with no commit to recover from.

```
$ git rev-parse HEAD
80c90153b7d1d72e8fefb42dfac2481b49249a0e

$ git status --short --branch
## feat/idef0-composed-map...origin/feat/idef0-composed-map [ahead 1]
 M .forgeplan/map/map.json
 M template/src/entities/map/lib/fixtures/checkpoint-map.json
 M template/src/entities/map/lib/validate.test.ts
 M template/src/entities/map/lib/validate.ts
 M template/src/pages/home/ui/HomePage.svelte
 M template/src/widgets/composed-map/ui/ComposedMapView.svelte
 M template/src/widgets/composed-map/ui/NodeCard.svelte
 M template/src/widgets/dependency-graph/ui/DependencyGraph.svelte
?? template/src/widgets/composed-map/ui/probe.render.test.ts
 (+ unrelated untracked docs/screenshots/scratch files from prior sessions)

$ git diff --stat -- template/src/widgets/composed-map/ template/src/entities/map/ template/src/pages/home/ template/src/widgets/dependency-graph/ .forgeplan/map/
 .forgeplan/map/map.json                                    |  2 +-
 template/src/entities/map/lib/fixtures/checkpoint-map.json |  2 +-
 template/src/entities/map/lib/validate.test.ts             | 27 ++++++++++++++++++++++
 template/src/entities/map/lib/validate.ts                  | 26 +++++++++++++++++++++
 template/src/pages/home/ui/HomePage.svelte                 |  1 +
 template/src/widgets/composed-map/ui/ComposedMapView.svelte| 11 ++++++++-
 template/src/widgets/composed-map/ui/NodeCard.svelte       | 20 +++++++++++++++-
 template/src/widgets/dependency-graph/ui/DependencyGraph.svelte | 5 +++-
 8 files changed, 89 insertions(+), 5 deletions(-)
```

### Token probes (verbatim)

```
$ git diff -- template/src/widgets/composed-map/ui/ComposedMapView.svelte | grep -n onClearSelection
+    onClearSelection,
+    onClearSelection?: (detail: { id: string; event?: Event }) => void;   # (actual sig: () => void)
+    onClearSelection?.();   # in handleCanvasClick
+    onClearSelection?.();   # in Escape keydown handler

$ git diff -- template/src/widgets/composed-map/ui/NodeCard.svelte | grep -n highlightedIds
+    highlightedIds = null,
+    highlightedIds?: ReadonlySet<string> | null;
+  const isDimmed = $derived(
+    !!highlightedIds && highlightedIds.size > 0 && !highlightedIds.has(node.id),

$ git diff -- template/src/entities/map/lib/validate.ts | grep -n "checkZoneAccent\|VALID_ZONE_ACCENT"
+const VALID_ZONE_ACCENT =
+function checkZoneAccent(zones: unknown[], errs: MapValidationError[]): void {
+  checkZoneAccent(zones, errs);

$ git diff -- template/src/entities/map/lib/fixtures/checkpoint-map.json .forgeplan/map/map.json | grep -n accent
-      "accent": "--map-accent-olive",
+      "accent": "--map-accent-violet",
-      "accent": "--map-accent-olive",
+      "accent": "--map-accent-violet",
```

All three expected tokens FOUND. Fixture stays byte-identical between the canonical `template/` copy and the workspace `.forgeplan/map/map.json` copy (SD-3 requirement) — confirmed identical diffs above.

## Runner detected

- Ecosystem: node (SvelteKit / Vite)
- Runner: vitest (v4.1.5) for tests; svelte-check for type/a11y
- Output format: text (stdout summary) + json (`--reporter=json --outputFile=`) for the reproducibility re-run
- Config source: `template/package.json#scripts.test` = `"vitest run"`; `#scripts.check` = `"svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"`

## Command run

```bash
cd template
npx vitest run                                            # run 1 (text)
npx vitest run --reporter=json --outputFile=/tmp/vitest-run2.json   # run 2 (reproducibility check)
npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json
```

Exit code: `0` (all three invocations)

## Summary

| Metric | Value |
|---|---|
| Passed | 481 |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 (identical 481/481/0/0 across 2 independent runs) |
| Total | 481 |
| Duration | 4.81s (run 1) |
| Test files | 39 (all passed) |

**Baseline comparison** (prior known-good checkpoint, commit `80c9015`): 477/477 vitest, 0 svelte-check errors / 1155 files. Current: 481/481 vitest (**+4, 0 regressions**), 0 svelte-check errors / 1156 files (**+1 file**, matches the one new test file `probe.render.test.ts`). The +4 test delta = 2 new `validate.test.ts` cases (rule-15 zone-accent, 1.C) + 2 new `probe.render.test.ts` cases (mount smoke test + Escape-reset probe, 1.A).

## AC coverage delta

Parent: RFC-030
AC target: n/a — RFC-030 states no blanket numeric coverage threshold; its "Test Strategy Hooks" section instead names specific required test categories (nav-contract, discriminant-honesty, determinism, time-travel-honesty, etc.) for the Phase-4 render-harness suite.
Actual: no coverage instrumentation configured in this project (no `@vitest/coverage-*` devDependency, no `--coverage` script) — reporting qualitative hook-coverage instead of a %.
Delta: n/a for numeric coverage. **Qualitative delta against RFC-030's named "nav contract" test hook: NOT satisfied** — see Failing/Inadequate tests section below.

## Failing tests

None — 0 failures. (The gap below is a *missing/inadequate test*, not a failing one.)

## Inadequate test — RFC-030's promised nav-contract suite not delivered

| File:line | Test name | Problem |
|---|---|---|
| `template/src/widgets/composed-map/ui/probe.render.test.ts:48-67` | `probe > Escape resets transform after a manual pan` | Zero `expect()` assertions — only `console.log` of intermediate state. Passes unconditionally regardless of whether Escape actually resets transform/selection. Cannot detect a regression of fix 1.A. |
| `template/src/widgets/composed-map/ui/probe.render.test.ts` (whole file) | — | Filename/style is a debug scratch probe (mock via `vi.mock`, manual `console.log` inspection), not a spec-style interaction test. No drag-suppression test exists anywhere in the codebase. No wheel-routing (plain-wheel-pans vs Ctrl/⌘-wheel-zooms) test exists anywhere in the codebase. RFC-030:121-125 pins all three (Esc-reset, drag-suppression, wheel-routing) as **"checkpoint acceptance bullets, not fast-follow polish."** EVID-089 finding 1.A explicitly required "add the promised interaction test" as part of the fix — this was not done. No coder report was available to this agent explaining the omission as a deliberate, reasoned scope cut (e.g., "no render-harness pattern exists to reuse") — and in fact `idef0-view.render.test.ts` (cited by RFC-030 itself, "Implementation Phase 4," as the precedent to mirror) already demonstrates the happy-dom + `mount()` render-harness pattern this suite needed, so the "no pattern to reuse" justification would not have held up if offered. |
| `template/src/widgets/composed-map/ui/NodeCard.svelte` (1.B) | — | Fix is wired correctly (verified by reading code — mirrors `EdgeLayer`'s existing pattern) but has **no dedicated test** asserting the `.dimmed` class / opacity behavior when a node is outside the active flow's `highlightedIds`. Lower-severity gap than 1.A (EVID-089 itself called this "wiring only," implying lower test urgency), but still untested. |

## Slow tests (top 5)

| Test | Duration |
|---|---|
| `probe.render.test.ts` — Escape resets transform after a manual pan | 613.6ms |
| `nfr002.test.ts` — NFR-002 frame budget deriveIdef0 at N=1000 | 279.8ms |
| `idef0.test.ts` — INV-8 determinism + scale (N=1000) | 52.0ms |
| `idef0-view.render.test.ts` — SPEC-005 permanent ICOM legend | 29.7ms |
| `idef0-layout.test.ts` — bounded box-count at N≥1000 (tier-stack) | 28.2ms |

Note: the slowest test in the entire 481-test suite is the non-asserting probe file (two hard-coded 300ms `setTimeout` waits) — further evidence it is debug scaffolding, not a maintained spec.

## Flaky candidates

None. 481/481/0/0 (pass/fail/skip/total-consistency) identical across 2 independent full runs.

## Next steps

- **CONCERNS, not BLOCKER**: fixes 1.B and 1.C are complete and verified (code + fixture + tests, where applicable). Fix 1.A's functional code is correctly wired but its explicitly RFC-030-promised nav-contract test suite (Esc-reset assertions, drag-suppression, wheel-routing) is missing — hand back to `coder` to write real assertion-based render/interaction tests mirroring `idef0-view.render.test.ts`'s established happy-dom + `mount()` pattern (already cited as the precedent in RFC-030 itself), and either delete or promote `probe.render.test.ts` into that real suite.
- Coder (or orchestrator) should **commit the working-tree changes** before this can be considered "done" — nothing is currently committed on `feat/idef0-composed-map` beyond `80c9015`.
- Consider a companion NodeCard dimming test (1.B) alongside the above, low priority.
- Guardian: do not activate on this EVID alone — read alongside the code-reviewer's EVID before any activation decision (per dispatch instructions, this agent does not call `forgeplan_activate`).

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: test

