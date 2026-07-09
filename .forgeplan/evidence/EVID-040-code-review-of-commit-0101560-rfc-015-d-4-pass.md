---
depth: standard
id: EVID-040
kind: evidence
last_modified_at: 2026-06-23T11:46:47.550981+00:00
last_modified_by: claude-code/2.1.186
links:
- target: RFC-015
  relation: informs
- target: PRD-016
  relation: informs
status: active
title: 'Code review of commit 0101560 (RFC-015 D-4): PASS'
---

## Verdict

PASS

One-line justification: All 192 tests pass (21 files, 0 errors), svelte-check reports 0 errors across 1082 files, the bug-fixing commit introduces a real delta with the expected tokens present, rule 22 and rule 24 are both satisfied, and the new regression test genuinely guards the dropped-fields defect.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Scope

- Parent: RFC-015 (Identity-aware route + structured snapshot error surface)
- Diff range: `1da8c21..HEAD` (commit `01015604a8ec2fe35018da6b14fda4bbe4da3555`)
- Files reviewed: 6 files, ~152 LOC added / ~16 LOC removed (136 net)
- Files:
  - `template/src/routes/api/snapshot/+server.ts`
  - `template/src/routes/api/snapshot/endpoint.test.ts` (new)
  - `template/src/widgets/timeline/ui/Timeline.svelte`
  - `template/src/entities/artifact/lib/identity.ts`
  - `template/src/entities/artifact/model/types.ts`
  - `template/src/shared/server/snapshot.ts`

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| svelte-check (`npm run check`) | 0 | 1082 files, 0 errors, 0 warnings |
| vitest (`npm test`) | 0 | 21 test files, 192 tests, all passed; includes the new `endpoint.test.ts` (3 new tests) |
| eslint | skipped | not wired to `npm test`; svelte-check covers TS correctness |
| tsc --noEmit | n/a | covered by svelte-check (`svelte-kit sync && svelte-check --tsconfig`) |

## Ground-truth verification

- Base..head: `1da8c21..HEAD` (source: prompt)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff --stat 1da8c21..HEAD`
- Diff state: **DELTA=PRESENT**
- Expected delta token: `error_code` (source: claim — "forwards error_code/stderr_excerpt to Timeline")
- Token probe: `grep -rn "error_code" template/src/routes/api/snapshot/+server.ts` → **FOUND** at line 34

```
template/src/entities/artifact/lib/identity.ts    | 14 +++--
template/src/entities/artifact/model/types.ts     | 11 +++-
template/src/routes/api/snapshot/+server.ts       |  9 ++-
template/src/routes/api/snapshot/endpoint.test.ts | 70 ++++++++++++++++++++++
template/src/shared/server/snapshot.ts            | 16 ++++--
template/src/widgets/timeline/ui/Timeline.svelte  | 32 ++++++++++-
6 files changed, 136 insertions(+), 16 deletions(-)
DELTA=PRESENT
```

Verdict floor from ground-truth gate: **PASS-eligible**

## Rule 22 audit (read-only proxy)

`template/src/routes/api/snapshot/+server.ts` exports only `GET` (line 7). The diff adds 7 lines to the failure branch, all composing an object literal from `result.*` fields already returned by `getSnapshot()`. No new `spawn`, no `fetch`, no `exec`, no mutating forgeplan subcommand, no network call added. The endpoint remains a pure pass-through reader. **Rule 22: SATISFIED.**

## Rule 24 audit (shared/ui primitive isolation)

The new CSS in `Timeline.svelte` adds two classes:
- `.snap-error` (lines 301–306): sets `margin-bottom: 8px` and `cursor: pointer` on `summary` — layout/cursor only.
- `.snap-stderr` (lines 307–319): styles a `<pre>` with background token (`--bg-2`), border token (`--line`), border-radius, padding, font-size, color token (`--fg-2`) — all read from CSS variables, no class from `shared/ui/` primitive roster.

Neither class names nor selects into any primitive internal class. The one pre-existing `:global()` in the file (line 359: `.head :global(.timeline-toggle)`) is an existing pre-audit allowance targeting a consumer-supplied forwarded class, not a primitive internal — it is out of scope for this diff review. The new CSS introduces no `:global()`. **Rule 24: SATISFIED.**

## Regression test genuineness

`endpoint.test.ts` mocks `getSnapshot` via `vi.hoisted` to return an object that **includes** `error_code` and `stderr_excerpt`. The test then asserts `body.error_code === "host_config_missing"` and `body.stderr_excerpt === "Error: No such file or directory (os error 2)"`.

If the fix were reverted (i.e., `+server.ts` returned only `{ok, at, sha, error}`), the response JSON would not carry `error_code` or `stderr_excerpt`. The assertions `expect(body.error_code).toBe("host_config_missing")` and `expect(body.stderr_excerpt).toBe(...)` would fail with `received: undefined`. The test is **not tautological** — it would fail on the pre-fix code. The mock does not return what the endpoint fabricates; it returns what `getSnapshot()` already produced, and the test verifies the endpoint passes it through rather than silently dropping it.

The third test (`rejects a malformed 'at' before reaching getSnapshot`) independently verifies the 400 pre-flight path and asserts `getSnapshotMock` was never called — this prevents a regression where the guard is accidentally bypassed.

## Timeline render regression analysis

1. **`<details>` rendered only when both `snapshotStore.error && snapshotStore.stderrExcerpt` are truthy** (line 196). On success path: `stderrExcerpt` is `null` (store initializer + success branch in `snapshot-state.svelte.ts:76-77`). No false-positive rendering.
2. **Error header badge** (lines 181–182): renders `errorCode` only when non-null (`snapshotStore.errorCode ? \` [\${snapshotStore.errorCode}]\` : ''`). Gracefully degrades to bare `error: <msg>` for legacy callers that omit the field.
3. **XSS safety**: `stderrExcerpt` is rendered inside `<pre>{stderrExcerpt}</pre>` — plain Svelte text interpolation, not `{@html}`. Svelte escapes the content automatically. No `innerHTML` or `{@html}` found in the file.
4. **`<details>` is inside `{#if !snapshotStore.collapsed}` block** (line 194) — it disappears when the timeline is collapsed, consistent with all body content. No layout anomaly.
5. **CSS tokens only**: `--bg-2`, `--line`, `--fg-2` are defined in `app.css` and honour both light/dark themes. No hardcoded colours.
6. **a11y**: `<details>/<summary>` is a native disclosure widget with built-in keyboard accessibility. `cursor: pointer` on `summary` reinforces affordance. No aria attributes needed for this pattern. No concern.

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| — | — | — | — | No material findings. Zero bugs, zero rule violations, zero test gaps introduced by this diff. | — |

All items from the Pre-Report Gate were evaluated:
- `+server.ts` change: 7-line object literal extension, purely additive, no logic branch introduced.
- `endpoint.test.ts`: 70-line new file; 3 tests covering failure forwarding, success cleanliness, and 400 pre-flight. Coverage is proportionate to the change surface.
- `Timeline.svelte`: gated render, safe interpolation, CSS-token-only styling, no primitive invasion.
- Comment reconciliation in `types.ts`, `identity.ts`, `snapshot.ts`: purely documentary, accurately describes the 0.33 CLI contract. No functional change.

## Positive observations

- **Strong**: `vi.hoisted()` used correctly to hoist the mock before the module-under-test is imported. This is the correct Vitest pattern for mocking modules that are imported at the top level by the SUT — avoids ordering pitfalls that plague naive `vi.mock` placements.
- **Strong**: The endpoint's failure object uses explicit property enumeration rather than spread (`...result`). This is a deliberate containment pattern — only fields the server intends to expose reach the wire, never accidental fields that `getSnapshot()` might add internally in future.
- **Strong**: The comment in `snapshot-state.svelte.ts` (line 92) correctly documents the backward-compat contract ("new clients should switch on `error_code`"), making the optional-field dual-path self-explanatory.

## Test coverage delta

- Before: new file — 0 tests for the `/api/snapshot` endpoint construction logic.
- After: 3 tests in `endpoint.test.ts` covering the primary failure path (RFC-015 D-4 guard), the success path (no spurious fields), and the 400 input-validation path.
- Suite total: 21 files, 192 tests, all passed.

## Next steps

- Orchestrator may proceed to activation gate for RFC-015 (R_eff already 1.0 per `forgeplan_get`; this EVID is additive evidence).
- No coder dispatch needed — no findings to remediate.

## References

- Parent: RFC-015
- Reviewed commit: `01015604a8ec2fe35018da6b14fda4bbe4da3555`
- Reviewer identity: `claude-code/sonnet-4-6/code-reviewer-task-prob060`



