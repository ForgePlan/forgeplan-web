---
depth: standard
id: EVID-083
kind: evidence
last_modified_at: 2026-07-03T01:29:10.804589+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: active
title: 'Code review of RFC-030: CONCERNS'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

## Verdict

CONCERNS

One-line justification: rule-22/21/24/10 discipline, additive-only FSD registration, and Invariant-8 time-travel honesty are all correctly implemented and verified — but the client's live/empty/error discriminant has a confirmed bug that silently masks a genuine server-side error as "no map yet" (contradicting RFC-030's own Failure-Path-B contract), and this shipped undetected because `composed-layout.ts` (the pure layout engine the RFC is titled after) and the entire `widgets/composed-map/ui/*` layer carry **zero** test coverage — corroborating and extending the parallel tester's EVID-082 CONCERNS finding, not a BLOCKER (the happy-path render-proof genuinely works, verified by direct code trace and the fixture-driven test suite that does exist).

## Scope

- Parent: RFC-030 (based_on PRD-036 / SPEC-006)
- Diff range: `4c59cda..39a93ab`
- Files reviewed: 23 files changed, 3045 insertions(+), 1 deletion(-) — every changed file read in full, not diff-hunks only
- Files: `.claude/rules/22-readonly-proxy.md`, `.forgeplan/map/map.json`, `template/src/app/styles/app.css`, `template/src/entities/map/{api/store.ts,index.ts,lib/composed-layout.ts,lib/fixtures/checkpoint-map.json,lib/is-empty-map-response.ts,lib/validate.test.ts,lib/validate.ts,model/types.ts}`, `template/src/pages/home/ui/HomePage.svelte`, `template/src/routes/api/map/+server.ts`, `template/src/shared/config/ui-prefs.ts`, `template/src/shared/server/{index.ts,map.test.ts,map.ts}`, `template/src/widgets/composed-map/ui/{ComposedMapView,EdgeLayer,FlowChips,NodeCard,ZoneSlab}.svelte`, `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte`

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| `vitest run src/entities/map src/shared/server/map.test.ts` (directly, this review) | 0 | 23/23 passed (validate.test.ts + map.test.ts) |
| `svelte-check --tsconfig ./tsconfig.json` (directly, this review) | 0 | 1154 files, 0 errors, 2 a11y WARNINGs — both `ComposedMapView.svelte:339` (`a11y_click_events_have_key_events`, `a11y_no_noninteractive_element_interactions`) |
| Full template suite (470 tests) | n/a — not independently re-run | Reported green by the parallel tester agent (EVID-082); consistent with, but not a substitute for, the subset I ran myself above |
| eslint | skipped (not installed) | no eslint config/script found under `template/` |

## Ground-truth verification

- Base..head: `4c59cda..39a93ab` (source: task prompt, explicit)
- Diff probe: `git diff 4c59cda..39a93ab --stat`
- Diff state: **DELTA=PRESENT** — 23 files changed, 3045 insertions(+), 1 deletion(-)
- Expected delta token: `computeComposedLayout` (the pure layout function RFC-030 is titled after)
- Token probe: `grep -rn "computeComposedLayout" template/src/entities/map/lib/composed-layout.ts` → **FOUND** (defined `composed-layout.ts:174`, re-exported `entities/map/index.ts:21`, consumed `widgets/composed-map/ui/ComposedMapView.svelte:24,133`)
- Verdict floor from ground-truth gate: PASS-eligible (diff present, token found) — actual verdict lowered to CONCERNS by findings below, not by the ground-truth gate itself

Additional ground-truth checks run directly:
- `diff template/src/entities/map/lib/fixtures/checkpoint-map.json .forgeplan/map/map.json` → **byte-identical** (SD-3 compliance confirmed, no drift)
- `find . -iname "*composed-layout*"` → only `template/src/entities/map/lib/composed-layout.ts` — **confirms the tester's EVID-082 finding: no `composed-layout.test.ts` exists anywhere**
- `grep -RnE "#[0-9a-fA-F]{3,8}|rgba?\(" template/src/widgets/composed-map/ template/src/entities/map/` (excluding fixtures/tests) → no matches (zero raw hex/rgb in new components)
- `grep -RnE "TODO|FIXME"` over the same scope → exactly one hit, `ComposedMapView.svelte:58` (`map-data-source`)
- `git diff --stat` restricted to `entities/graph/**` and the 8 pre-existing view components → empty (zero changes); only `DependencyGraph.svelte` (+17, one dispatcher branch + `isLive` prop), `HomePage.svelte` (+1, single `isLive={!snapshotting}`), `ui-prefs.ts` (+10, 9th registry entry) touched among existing files
- `grep -RnE "/Users/|/home/[a-z]+/|/root/"` over new template files → no matches; no symlinks under `entities/map`/`widgets/composed-map`

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | HIGH | 🐛 Bug | `template/src/widgets/composed-map/ui/ComposedMapView.svelte:102-108` (`liveBranch`) | The discriminant only inspects `mapPoller.state.data`, never `mapPoller.state.error`. `MapFileErr.data` (server malformed/unreadable-JSON case, `shared/server/map.ts:42-59`) is typed `Record<string, never>` — the exact same `{}` shape ENOENT returns. Both collapse through `createPoller`'s stale-while-error branch (`poller.svelte.ts:51`, `state.data = state.data ?? env.data ?? null`) into `data: {}`, and `isEmptyMapResponse({})` is `true` for both — so a genuinely corrupt/unreadable `map.json` on disk silently renders "No map yet" instead of the error surface RFC-030's own Failure-Path-B explicitly requires ("malformed → error surface … never render garbage"). This is exactly the class of bug the missing render-harness suite (finding #4) exists to catch. | In `liveBranch`, branch on `mapPoller.state.error` (or a new server-side discriminant field distinguishing ENOENT from parse failure) before falling back to `isEmptyMapResponse` |
| 2 | MEDIUM | 🐛 Bug | `template/src/widgets/composed-map/ui/ComposedMapView.svelte:102-108` (`liveBranch`) | Before the poller's first fetch resolves, `mapPoller.state.data` is `null` (`poller.svelte.ts:25-31`). `isEmptyMapResponse(null)` is `false` (explicit `data !== null` guard), so `raw` falls through to `validateMapDocument(null)`, which returns `{ ok:false, errors:[{message:"document must be a non-null object"}] }`. Every mount of the map view — including the happy-path checkpoint render — briefly renders "Map document failed validation" before the first successful fetch lands, because `state.loading`/`lastFetched` are never consulted. | Add a third branch (`raw === null` / `state.loading && !state.lastFetched`) rendering a neutral loading state instead of routing through the validator |
| 3 | MEDIUM | 🏗 Architecture | `template/src/entities/map/lib/composed-layout.ts` (whole file, 308 lines) + `template/src/entities/map/index.ts:20-28` + `widgets/composed-map/ui/{ZoneSlab,NodeCard,EdgeLayer}.svelte` imports | RFC-030 SD-2 explicitly decided: *"CHOSEN: `widgets/composed-map/lib/composed-layout.ts`… `entities/map` keeps only document-shaped concerns (types, validator, poller)."* The actual `computeComposedLayout`/`ComposedLayout`/`Rect`/`Point`/`curve` live in `entities/map/lib/` instead; no `widgets/composed-map/lib/` or `widgets/composed-map/model/` directory was created at all, and the widget's own UI components import `Rect`/`Point` from `@/entities/map` rather than a widget-owned module. This directly contradicts the RFC's own documented decision and rationale, and re-opens exactly the entities-as-dumping-ground coupling risk SD-2 was written to avoid. | Move `composed-layout.ts` (and its `Rect`/`Point`/`ComposedLayout`/`EdgePathEntry`/`ConnectorPathEntry` types) to `widgets/composed-map/lib/composed-layout.ts` + `widgets/composed-map/model/types.ts` per SD-2; update the 4 import sites |
| 4 | HIGH | 🧪 Test gap | `template/src/entities/map/lib/composed-layout.ts` (no test file) + `template/src/widgets/composed-map/ui/*.svelte` (no test file) | Confirms and extends EVID-082: `find . -iname "*composed-layout*"` shows only the implementation, zero tests — RFC-030 Implementation Phase 3's named gate ("determinism, pinned-cols, append-stability ×2, bounded/finite output — vitest green") has nothing to run. Beyond that, Phase 4's ~9 named render-harness scenarios (render-proof, empty-state, wrong-schema-tag-error, error-surface, time-travel-suspension, 3× nav-contract, token/EN conformance, registry no-regression, mosaic no-regression) also have zero test files anywhere under `widgets/composed-map/`. Only `entities/map/lib/validate.test.ts` and `shared/server/map.test.ts` exist (23/23 passing, confirmed by direct run) — both real and well-built, but they cover the document/server layer only. This gap is precisely why findings #1 and #2 shipped undetected — a green suite with no test touching the client discriminant is a vacuous-green risk on exactly the surface that broke. | Author `composed-layout.test.ts` (the 5 named determinism/pinned-cols/append/bounded properties) and a `ComposedMapView.render.test.ts` mirroring `idef0-view.render.test.ts`'s happy-dom harness, at minimum covering the malformed-JSON and initial-null scenarios from findings #1/#2 |
| 5 | LOW | 🐛 Bug | `template/src/widgets/composed-map/ui/ComposedMapView.svelte:339` | `svelte-check` flags the canvas `<svg onclick={handleCanvasClick} onpointerdown=… onpointerup=…>` with `a11y_click_events_have_key_events` + `a11y_no_noninteractive_element_interactions` (0 errors, 2 warnings, confirmed by direct run). Impact is low — the global `Escape` handler (`handleKeydown`) already performs the equivalent reset — but this is a genuinely new pattern (the pre-existing `ForceView.svelte`'s top-level `<svg>` does not attach `onclick` directly, confirmed by grep), not an extension of house style. | Add `role="button" tabindex="0"` + an `onkeydown` handler mapping Enter/Space to `handleCanvasClick` on the `<svg>`, or move the click-to-deselect affordance off the non-interactive root |

## Positive observations

- Rule 22 compliance is exemplary: `readMapFile()` is a genuinely dumb, honest mirror (GET-only, no spawn, no `validateMapDocument` server-side), the 3 automatable E1 rows are unit-tested and pass, and the `.claude/rules/22-readonly-proxy.md` amendment text matches the actual code's constraints byte-for-byte (`shared/server/map.ts:1-60`, `routes/api/map/+server.ts`).
- `validateMapDocument` (`entities/map/lib/validate.ts`) is a well-built 14-rule, never-throwing, all-errors-collected validator with 23 passing fixture assertions and no early-bail-out that would hide a second error — a strong example of C4's design intent.
- Invariant 8 (time-travel honesty) is correctly wired: `lastDoc` (`ComposedMapView.svelte:113-117`) only commits while `isLive`, the ref-counted poller correctly suspends/resumes on `isLive` transitions (`ComposedMapView.svelte:143-147`), and no synthetic historical data is ever fabricated — verified by structural trace, not just reading the comment.
- FSD "additive-only" Invariant 6 fully holds: `git diff --stat` confirms zero changes to `entities/graph/**` or any of the 8 pre-existing view components; only the three named touch points (`DependencyGraph.svelte`, `HomePage.svelte`, `ui-prefs.ts`) are edited, exactly matching the RFC's stated blast radius.
- Token discipline (Invariant 7) and rule 24 (shared/ui ownership) both hold cleanly: zero raw hex/rgb in any new component, and the single `:global(.live-only-alert)` block only sets `pointer-events`/`max-width` (layout, not chrome) on a consumer-forwarded class — textbook-compliant composition, not re-skinning.

## Test coverage delta

- Before: 0 tests existed for this feature area (new code)
- After: 23 tests (`entities/map/lib/validate.test.ts` + `shared/server/map.test.ts`), both green
- Branches gained: document-schema validation (14 rules), server read-path contract (3 E1 rows)
- Branches still uncovered: `computeComposedLayout` (determinism, pinned-cols, both append-stability cases, bounded output — SPEC AC-2, 0 tests); the entire `widgets/composed-map/ui/*` render layer (0 tests) — including the malformed-JSON and initial-null-render bugs in findings #1/#2, which a render-harness suite would very likely have caught

## Next steps

- Dispatch a coder agent for findings #1 and #2 (both isolated to the same `liveBranch` derivation — one fix pass can address both) and for finding #3 (file move + import updates)
- Author the missing `composed-layout.test.ts` + `ComposedMapView.render.test.ts` suites named in RFC-030 Implementation Phases 3-4 (finding #4) — this should happen before or alongside the fixes above, since it is the regression guard for #1/#2
- Optional low-priority a11y fix for finding #5
- Re-review the patched diff before considering RFC-030's Phase-1 render-proof checkpoint fully proven

## References

- Parent: RFC-030
- Related EVIDENCE: EVID-082 (parallel tester review, CONCERNS — composed-layout.ts test-coverage gap; this review independently confirms that finding and extends it to the entire widget UI layer, plus surfaces two additional bugs the gap left undetected)
- Related artifacts: PRD-036, SPEC-006 (parents); EVID-076/077/078 (prior C4 SHAPE-wave reviews this RFC revision addressed)



