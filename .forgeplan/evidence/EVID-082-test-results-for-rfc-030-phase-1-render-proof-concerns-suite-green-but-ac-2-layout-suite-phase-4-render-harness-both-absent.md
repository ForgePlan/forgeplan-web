---
depth: standard
id: EVID-082
kind: evidence
last_modified_at: 2026-07-03T01:16:45.675135+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: draft
title: 'Test results for RFC-030 Phase-1 render-proof: CONCERNS — suite green but AC-2 layout suite + Phase-4 render-harness both absent'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: test

## Verdict

**CONCERNS**

470/470 tests pass (37/37 files), 0 failed/skipped/flaky, `svelte-check` 0 errors across 1154 files (0 regression in the 8 pre-existing views). Everything that IS tested — `validate.test.ts` (14/14 SPEC-006 C4 rules, non-tautological), `map.test.ts` (3/3 E1 rows), the `MapEdge→GraphEdge` compile-time Liskov assertion (AC-4) — is real and comprehensive. But **SPEC-006 AC-2 (pure-layout determinism/pinned-cols/append-stability/bounded-output) has ZERO test coverage**: no `composed-layout.test.ts` exists anywhere, despite AC-2 being a named SMART Acceptance Criterion ("all green in CI at arc-PR time") and RFC-030 Implementation Phase 3's explicit gate ("Gate: vitest green"). This is a more severe gap than the anticipated Phase-4 render-harness deferral (also confirmed absent) because it is a Phase-3 gate that appears to have been silently skipped rather than a scope reduction the RFC itself flagged.

## Ground-truth verification

- Base..head: `4c59cda..39a93ab` (source: prompt — the 6 build commits `b64fd09..39a93ab`, base = their common parent `4c59cda` "ARC C GATE C2 PASS — activate PRD-036/SPEC-006/RFC-030")
- Diff probe: `git diff --stat 4c59cda..39a93ab -- template/ .forgeplan/map/`
- Diff state: **DELTA=PRESENT** (22 files changed, +3007/-1)
- Expected delta tokens: `computeComposedLayout`, `MapEdge extends GraphEdge`, `ComposedMapView` (source: RFC-030 Function Signatures section)
- Token probe: `git diff 4c59cda..39a93ab -- template/ | grep -c "<token>"` → **FOUND** (computeComposedLayout: 5 hits; `MapEdge extends GraphEdge`: 1 hit; ComposedMapView: 5 hits)
- Verdict floor from ground-truth gate: PASS-eligible (real work landed, not a vacuous green)

```
$ git diff --stat 4c59cda..39a93ab -- template/ .forgeplan/map/
 .forgeplan/map/map.json                                       | 364 +++++++++++++++
 template/src/app/styles/app.css                               |  43 ++
 template/src/entities/map/api/store.ts                        |  20 +
 template/src/entities/map/index.ts                             |  29 ++
 template/src/entities/map/lib/composed-layout.ts               | 308 +++++++++++++
 template/src/entities/map/lib/fixtures/checkpoint-map.json     | 364 +++++++++++++++
 template/src/entities/map/lib/is-empty-map-response.ts         |  13 +
 template/src/entities/map/lib/validate.test.ts                 | 331 +++++++++++++
 template/src/entities/map/lib/validate.ts                       | 426 +++++++++++++++++
 template/src/entities/map/model/types.ts                        | 175 +++++++
 template/src/pages/home/ui/HomePage.svelte                     |   1 +
 template/src/routes/api/map/+server.ts                          |   9 +
 template/src/shared/config/ui-prefs.ts                          |  10 +-
 template/src/shared/server/index.ts                             |   7 +
 template/src/shared/server/map.test.ts                          |  62 +++
 template/src/shared/server/map.ts                               |  62 +++
 template/src/widgets/composed-map/ui/ComposedMapView.svelte    | 513 +++++++++++++++++++++
 template/src/widgets/composed-map/ui/EdgeLayer.svelte           |  88 ++++
 template/src/widgets/composed-map/ui/FlowChips.svelte           |  38 ++
 template/src/widgets/composed-map/ui/NodeCard.svelte            |  59 +++
 template/src/widgets/composed-map/ui/ZoneSlab.svelte            |  69 +++
 template/src/widgets/dependency-graph/ui/DependencyGraph.svelte |  17 +
 22 files changed, 3007 insertions(+), 1 deletion(-)
DELTA=PRESENT

$ git diff 4c59cda..39a93ab -- template/ | grep -c "computeComposedLayout"   → 5
$ git diff 4c59cda..39a93ab -- template/ | grep -c "MapEdge extends GraphEdge" → 1
$ git diff 4c59cda..39a93ab -- template/ | grep -c "ComposedMapView"         → 5
```

Note: `git diff --cached` was empty (all 6 commits are already committed to `feat/idef0-composed-map`, nothing staged) — the base..head range against the real commit range is the correct ground-truth probe here, not the working tree.

## Runner detected

- Ecosystem: node (SvelteKit / Vite)
- Runner: vitest (`npx vitest run`) + svelte-check
- Output format: text (verbose reporter); no `--reporter=json` used because the verbose text reporter already gave per-test file:line-equivalent names and durations sufficient for this audit
- Config source: `template/package.json` (vitest config via `vite.config.ts`), `template/tsconfig.json`

## Command run

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template
npx vitest run --reporter=verbose
npx svelte-check --tsconfig ./tsconfig.json --threshold error
```

Exit code: `0` (both commands)

## Summary

| Metric | Value |
|---|---|
| Passed | 470 |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 470 |
| Duration | 3.81s (vitest); svelte-check completed near-instantly (1154 files, 0 errors, 2 pre-existing warnings, 1 file with problems — unrelated to this arc) |

## AC coverage delta

Parent: RFC-030 (`based_on` PRD-036, SPEC-006)

| SPEC-006 AC | Target | Actual | Delta |
|---|---|---|---|
| AC-1 (validator honesty) | ≥14 failing fixtures + ≥1 valid + multi-error + never-throws, all green | **MET** — `validate.test.ts` has all 14 E2 rules individually (rule 10 and 11 each contribute 2 legitimate sub-cases), 1 valid-doc test, 1 multi-error-collects-all test, 1 never-throws-on-hostile-input test. Verified non-tautological: every invalid-fixture test calls a fresh `baseDoc()` and breaks exactly one field before asserting. | 0 |
| AC-2 (layout determinism) | same-input-twice deep-equal, non-wrapping append, wrapping append, pinned-cols, bounded/finite — "all green in CI at arc-PR time" | **NOT MET — zero coverage.** No `composed-layout.test.ts` exists anywhere in the tree (`find . -iname "*composed-layout*"` returns only the implementation file). None of the 5 named properties has a single assertion. | **-100% (untested)** |
| AC-3 (endpoint honesty + rule 22) | 3 automatable E1 rows + rule-22 greps 0 spawn/execFile/fetch/write + GET-only export | **MET** — `map.test.ts` covers present→mirror, ENOENT→ok-empty, malformed→ok-false-no-throw, with fs properly mocked and isolated via `beforeEach`. `routes/api/map/+server.ts` is 9 lines, `GET`-only export, delegates entirely to `readMapFile()`, no spawn/write. Rule 22 (`.claude/rules/22-readonly-proxy.md`) carries the `/api/map` allow-list extension section, landed in commit `b64fd09` (same PR as the endpoint, per RFC-030 Governance). | 0 |
| AC-4 (edges-only compatibility) | compile-time or unit assertion that `MapEdge` narrows to `GraphEdge` | **MET** — `entities/map/model/types.ts:118-123`: `type _GraphEdgeFrom_MapEdge = Pick<MapEdge, "from" \| "to" \| "relation"> extends GraphEdge ? true : never;` + `const _assertLiskov: _GraphEdgeFrom_MapEdge = true;`. This is a real compile-time gate — assigning `true` where the conditional resolves to `never` is a TS2322 error, and `svelte-check` reporting 0 errors confirms it currently holds. | 0 |
| AC-5 (checkpoint conformance) | committed `map.json` passes validation with 0 errors + FR-007 minima (≥2 zones, ≥3 node kinds, ≥1 edge, ≥1 flow, ≥1 connector) | **MET, exceeded** — `validate.test.ts`'s "validates the checked-in checkpoint fixture with zero errors" test passes. Independently verified: grid 2 rows × 4 cols (matches §14 spike ground truth), 5 zones, 16 nodes, 14 edges, 2 flows, 3 zone connectors, 9 distinct node kinds (gate, component, store, truth, epic, prd, rfc, spec, adr) — well past the FR-007 floor. `.forgeplan/map/map.json` is byte-identical to `template/.../fixtures/checkpoint-map.json` (SD-3 satisfied, `diff` reports no difference). | 0 |

Overall AC coverage: **4 of 5 MET, 1 of 5 completely uncovered (AC-2)**.

## Failing tests

None.

## Slow tests (top 5)

| Test | Duration |
|---|---|
| `nfr002.test.ts > NFR-002 frame budget > deriveIdef0 at N=1000 completes well under the 50ms budget` | 265ms |
| `idef0.test.ts > INV-8: determinism + scale (N=1000) > deriveIdef0 is deterministic and completes at N=1000 without throwing` | 47ms |
| `idef0-view.render.test.ts > SPEC-005: permanent ICOM legend (RC-4) > legend renders in tier-stack fallback mode with all 4 roles + honesty key` | 29ms |
| `idef0-layout.test.ts > bounded box-count at N≥1000 — SPEC-005 NFR-001 > idef0 mode: ≤7 layout boxes regardless of N (O(1)-DOM, RC-5)` | 20ms |
| `endpoint.test.ts > /api/snapshot endpoint > forwards error_code and stderr_excerpt on failure` | 18ms |

None of the slowest tests belong to this arc (`entities/map` / `shared/server/map.test.ts` / `widgets/composed-map`) — they are all pre-existing idef0/snapshot suites, unaffected by this change.

## Flaky candidates

None observed. Single run, no retries configured for this suite; no evidence of nondeterminism in the map-related tests (all sub-ms except the pre-existing idef0 perf tests above).

## Findings beyond pass/fail

1. **[Primary — weakens] SPEC-006 AC-2 has zero test coverage.** `computeComposedLayout` (`template/src/entities/map/lib/composed-layout.ts`) — the pure-grid layout engine that is literally the "pure-grid widget" named in RFC-030's own title — has no test file anywhere. `find . -iname "*composed-layout*"` returns only the implementation. RFC-030 Implementation Phase 3 explicitly gates on "vitest green" for determinism / pinned-cols / non-wrapping-append / wrapping-append / bounded-output; SPEC-006 marks the same 5 properties as SMART AC-2. Manual code review of the implementation is reassuring but is not a substitute for the required test: `zone.cols` is read verbatim at line 100 (`Math.max(1, zone.cols)`, never derived from node count — matches Invariant 4), and the stable sort at lines 101-109 orders by `(layer, found_at, id)` matching the required append-stability key — but none of this is asserted by any test today. This is a coverage gap the tester agent, not the coder, is positioned to catch, and it should block sign-off on "Phase 3 complete" until a `composed-layout.test.ts` exists covering the 5 named AC-2 properties.

2. **[Secondary — anticipated] RFC-030 Implementation Phase 4 render-harness tests are entirely absent.** No test file exists for `ComposedMapView.svelte` / `widgets/composed-map` mirroring `idef0-view.render.test.ts` (confirmed: `find . -iname "*composed-map*" | grep test` → no results). This was named explicitly in the RFC's own Test Strategy Hooks and Implementation Phase 4 gate: render-proof scenario, empty-state, wrong-schema-tag→error-surface (not empty state), time-travel suspension (`isLive={false}`), and the §15 nav contract (Esc-reset, drag-suppression, wheel-routing). Unlike finding 1, the underlying UI logic for all of these IS present in the code (confirmed by inspection, not test): `isLive` is threaded `HomePage.svelte:463` (`isLive={!snapshotting}`) → `DependencyGraph.svelte:195` → `ComposedMapView.svelte` (ref-counted acquire/release gated on `isLive`, frozen-class + overlay render at `!isLive`); the Esc handler, the >3px drag-suppression comment, and the `ctrlKey`/`metaKey` wheel filter are all present in `ComposedMapView.svelte`. So this is "implemented but unverified by automated test" rather than "not implemented" — still a real gap before activation-grade confidence, but lower risk than finding 1.

3. **[Minor — documentation drift, not a defect] SD-2 architectural decision not followed.** RFC-030 §SD-2 explicitly weighed and chose `widgets/composed-map/lib/composed-layout.ts` (to match the repo convention where `tree-layout.ts` / `sankey-layout.ts` / `idef0-layout.ts` all live in the owning widget's `lib/`). The actual implementation instead places `computeComposedLayout` plus its output types (`ComposedLayout`, `Rect`, `Point`) at `entities/map/lib/composed-layout.ts` / `entities/map/model/types.ts`. This is not an FSD violation (widgets legally import from entities) and does not affect correctness, but it silently reverses a named, weighed RFC decision without an amendment. Worth a one-line RFC update or a follow-up note, not a blocker.

## Next steps

- **CONCERNS**: before treating Phase 3 as closed, add `composed-layout.test.ts` covering SPEC-006 AC-2's 5 named properties (determinism/repeat-call deep-equal, pinned-cols, non-wrapping append, wrapping append, bounded/finite output) — hand to `coder` (Profile C) per SPEC-006 Test Strategy Hooks; this tester profile does not author tests.
- Recommend a follow-up render-harness test file (`ComposedMapView.render.test.ts` or similar) mirroring `idef0-view.render.test.ts`'s happy-dom + `mount()` pattern, covering the 6 scenarios RFC-030 Phase 4 names — can ship in the same follow-up as the AC-2 suite, or a fast-follow PR, at the orchestrator's discretion given "keep build-agent scope small" was the stated reason for deferral.
- Note the SD-2 file-location drift in the next RFC-030 revision or a short ADR-style note, so future maintainers don't hunt for `composed-layout.ts` under `widgets/composed-map/lib/` where the RFC says it should be.
- Once the AC-2 suite lands and is verified (a follow-up EVID), hand back to guardian/orchestrator for the activation gate.
- Claim-hygiene note: `RFC-030` was already claimed by `claude-code/5.0/code-reviewer-task-idef0-composed-map-review` (TTL to 2026-07-03 01:56 UTC) when this tester attempted `forgeplan_claim`; this EVID was produced without an exclusive claim on the parent (read + informs-link only, no RFC-030 body mutation). Orchestrator should sweep/reconcile the two parallel reviews per rule 12 claim hygiene once both land.
