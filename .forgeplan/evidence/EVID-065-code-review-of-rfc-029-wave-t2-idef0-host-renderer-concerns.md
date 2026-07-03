---
depth: standard
id: EVID-065
kind: evidence
last_modified_at: 2026-07-01T19:20:26.562843+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-029
  relation: informs
status: active
title: Code review of RFC-029 Wave T2 idef0 host renderer — CONCERNS
---

## Verdict

CONCERNS

One-line justification: One MEDIUM pagination bug (`hasNextPage` false-positive) and two LOW findings need fixing before merge; all compliance checks (rule 21, 22, 24, tier-stack layout contract) are clean, and svelte-check reports 0 errors / 0 warnings.

## Scope

- Parent: RFC-029
- Diff range: `54a905c862b542f14a2c5929aa44f450c63ffd21..080d6d9c32062c289d34c410f13d327fcbc8a4dc`
- Files reviewed: 5 primary changed files, full-file read for all
- Files:
  - `template/src/widgets/dependency-graph/lib/idef0-layout.ts`
  - `template/src/widgets/dependency-graph/lib/idef0-layout.test.ts`
  - `template/src/widgets/dependency-graph/ui/Idef0View.svelte`
  - `template/src/shared/config/ui-prefs.ts`
  - `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte`

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| svelte-check | 0 | 0 errors, 0 warnings — 1135 files checked |
| tsc (via svelte-check) | 0 | Full tsconfig including noUncheckedIndexedAccess |
| eslint | skipped | Not invoked separately — svelte-check covers TS type surface |
| vitest | n/a | Orchestrator reports 398/398 pass (not re-run in this review) |

## Ground-truth verification

- Base..head: `54a905c..080d6d9` (source: `git merge-base develop HEAD` + `git rev-parse HEAD`)
- Diff probe: `git diff --stat 54a905c..080d6d9 -- template/src/widgets/dependency-graph/`
- Diff state: **DELTA=PRESENT** (6 files, 1983 insertions, 49 deletions)
- Expected delta token: `resolveFocusKey` (RFC-029 F3 — pure focus-seed function in layout lib)
- Token probe: `grep -rn "resolveFocusKey" template/src/widgets/dependency-graph/lib/idef0-layout.ts` → **FOUND** at line 397
- Verdict floor from ground-truth gate: **PASS-eligible**

```
BASE=54a905c862b542f14a2c5929aa44f450c63ffd21 HEAD=080d6d9c32062c289d34c410f13d327fcbc8a4dc
DELTA=PRESENT
resolveFocusKey FOUND at idef0-layout.ts:397
svelte-check: 1135 FILES 0 ERRORS 0 WARNINGS
```

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | MEDIUM | 🐛 Bug | `Idef0View.svelte:128` | `hasNextPage = outline.length >= OUTLINE_LIMIT` is a false positive when the page has exactly 50 items: pressing Next renders an empty outline ("No nodes") and an inverted row hint (`row 51–50`). | Change to `> OUTLINE_LIMIT` by asking the core for `limit + 1` rows and checking `length > OUTLINE_LIMIT` (slice to `OUTLINE_LIMIT` for display), or auto-clamp `outlineOffset` back if the next page returns 0 items. |
| 2 | LOW | ⚡ Performance | `Idef0View.svelte:412` | Band-first dedup uses `findIndex(...) === indexOf(...)` — O(n²) per render tick in tier-stack mode. Bounded to ≤7 boxes today but fragile if the box cap is relaxed in T3. | Extract a `Set<number>` of seen band indices before the `{#each}` filter; O(n) and more readable. |
| 3 | LOW | 🎨 Style | `Idef0View.svelte:32` | `"decomposition": "D"` in `ICOM_SIDE_LABELS` is dead code: the legend filter at line 432 explicitly excludes `"decomposition"`, so this label is never rendered. | Remove the entry, or add `// TODO(t3-decomp): D label reserved for decomposition arrows, wired in T3` if it will be used in a later phase. |
| 4 | LOW | 🧪 Test gap | `idef0-layout.test.ts` | No test exercises the `hasNextPage` boundary (outline.length === OUTLINE_LIMIT → ghost next page → empty outline render). The 36 geometry tests in the layout lib are thorough but the pagination edge case lives in the view and has no coverage. | Add a view-level or integration test driving `outlineOffset` to exactly the boundary and asserting `hasNextPage === false` on the final page. |

## Positive observations

- Strong: `layoutTierBands` correctly enumerates members exclusively from `diagram.boxes` (the bounded TADD output), iterating `tierStack.tiers` only for band metadata — the EVID-061 F1 invariant is preserved, no `tierStack.tiers[i].members` path exists anywhere in the diff.
- Strong: All five `:global()` blocks in `Idef0View.svelte` target SVG-internal class names (`.icom-arrow`, `.arrow-marker-real`, `.arrow-marker-derived`, `.band-label`) that do not appear in the `shared/ui` primitive roster — rule 24 compliance is clean.
- Strong: `resolveFocusKey` handles the V-COLLISION (id-collision) case correctly: sorts matches by `serialiseKey` to produce a deterministic tie-break, guarded by `noUncheckedIndexedAccess` via the `first ? … : null` check.
- Strong: `diagram.focus` is typed `CompositeKey | null` (not `| undefined`), making the `!== null` guard at `idef0-layout.ts:222` type-safe. The `focusSerial !== null ? serialiseKey(…) : null` chain never calls `serialiseKey` with a null key.
- Strong: Registration is correct end-to-end — `idef0` added to `GraphView` union, to `GRAPH_VIEWS` array (with icon, label, hint), and as `{:else if view === 'idef0'}` at line 169 in `DependencyGraph.svelte` (before the final `{:else}` fallback at line 182).

## Test coverage delta

- Before (develop): 362 passing tests
- After (HEAD): 398 passing tests (36 new geometry/NFR tests in `idef0-layout.test.ts`)
- Branches gained: layout geometry for `layoutIdef0Diagram` (focus-present, focus-absent, no-children, arrow-slot-assignment), `layoutTierBands` (band grouping, T-prefix parse, empty-box fallback), `resolveFocusKey` (null input, single match, V-COLLISION tie-break)
- Branches still uncovered: `hasNextPage` exact-boundary render (view-level, not in layout lib), `outlineOffset` auto-clamp on empty page

## Next steps

- Dispatch coder for findings #1 (MEDIUM), #3 (LOW-Style) then re-review the patched diff; #2 and #4 are informational and can follow in T3.
- Finding #1 (`hasNextPage` false-positive) MUST be resolved before merge — it produces a misleading "No nodes" state on valid workspaces.

## References

- Parent: RFC-029
- Auto-linked: `informs RFC-029`
- Related EVIDENCE: EVID-061 (tier-stack layout contract, referenced in findings)
- Related EVIDENCE: EVID-063 (prior T2 review — similar title, draft status; this review supersedes it for the post-fix HEAD)

## Structured Fields

verdict: concerns
congruence_level: 3
evidence_type: audit

