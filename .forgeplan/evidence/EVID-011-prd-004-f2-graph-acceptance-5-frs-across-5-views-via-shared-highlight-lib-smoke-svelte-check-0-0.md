---
created: 2026-05-05
depth: tactical
id: EVID-011
kind: evidence
links:
- target: PRD-004
  relation: informs
status: active
title: 'PRD-004 F2-graph acceptance: 5 FRs across 5 views via shared highlight lib, smoke + svelte-check 0/0'
updated: 2026-05-05
---

# EVID-011: PRD-004 F2-graph acceptance

| Field       | Value                                                                |
|-------------|----------------------------------------------------------------------|
| Status      | Draft                                                                |
| Created     | 2026-05-05                                                           |
| Valid Until | 2026-08-05                                                           |
| Target      | PRD-004                                                              |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

PR #24 (`feature/frontend-graph-ux-f2 -> develop`) shipped UX
improvements requested by the user during F1 live walkthrough. This
evidence pack verifies the changes via three layers: source code review,
type/svelte-check, and CI smoke matrix.

### Layer A — source verification

| FR     | Surface                                                        | Verification                                                                                          |
|--------|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| FR-001 | `ForceView`/`Tree`/`Radial`/`Lanes` `<rect class="selection-ring">` | Each view has a dedicated ring sized to card content (`node.w × node.h`). Status dot stays outside the selection bbox. Matrix is N/A (no encircled card). |
| FR-002 | All 5 views                                                    | `onmouseenter={() => setHovered(node.id)}` + `onmouseleave={clearHovered}` on each node `<g>` (also `onfocus`/`onblur` for keyboard a11y). |
| FR-003 | All 5 views                                                    | Edge primitives carry `class={edgeClass(from, to, highlight.hoveredId)}` returning `'edge-active'` when hovered matches an endpoint. |
| FR-004 | All 5 views                                                    | Same `edgeClass` returns `'edge-dim'` when `hoveredId != null` and unrelated. |
| FR-005 | Tree/Radial/Matrix/Lanes                                       | Same pattern as ForceView; per-view edge primitive (`<path>` for Tree/Radial/Lanes, cell `<rect>` for Matrix). |
| FR-006 | All 5 views                                                    | `clearHovered()` on `mouseleave`/`blur` resets `highlight.hoveredId = null`; `edgeClass` then returns `''`. |
| FR-007 | `CHANGELOG.md` `[Unreleased]` `### Changed`                    | Two bullets covering FR-001 + FR-002..FR-006. References PRD-004. |

### Layer B — shared lib

`template/src/widgets/dependency-graph/lib/highlight.svelte.ts`:

- `export const highlight = $state<{ hoveredId: string | null }>({ hoveredId: null })` — runed shared state.
- `setHovered(id)` / `clearHovered()` — mutator helpers.
- `edgeClass(from, to, hovered)` — pure classifier returning `''` / `'edge-active'` / `'edge-dim'`.

Single source of truth for the hover state means hovering a node in any
view re-renders only the link class strings, not the whole graph
(R-2 mitigation per PRD).

### Layer C — type/build/CI

- `cd template && npx svelte-check` → **0 errors / 0 warnings**.
- `npm run clean && npm run smoke` (locally) → **PASS**.
- PR #24 CI matrix → **3/3 OS green** (ubuntu/macos/windows × Node 22).

## Result

| ID    | Target                                                            | Verdict |
|-------|-------------------------------------------------------------------|---------|
| SC-1  | Selected node `<rect>` does NOT overlap status dot                | ✅ pass |
| SC-2  | Hover on node adds `edge-active` to connected edges               | ✅ pass |
| SC-3  | Hover dims unrelated edges to opacity 0.25                        | ✅ pass |
| SC-4  | Hover affordance present on all 5 graph views                     | ✅ pass |
| SC-5  | Smoke matrix 3/3 OS × Node 22 green                                | ✅ pass |
| SC-6  | `svelte-check` 0/0                                                 | ✅ pass |
| SC-7  | No new runtime deps                                                | ✅ pass |

## Interpretation

PRD-004 acceptance fully met across all 7 SC and 4 NFR. Five commits
landed via PR #24, each independently revertable. The hover affordance
makes the graph «readable at a glance» on workspaces with many edges —
a deliberate response to user feedback during F1 testing.

The F2-graph PR sets a pattern that PRD-005 (F4-clustering) will build
on: shared `lib/*.svelte.ts` modules with runed state are the right home
for cross-view interaction state.

## Congruence Level Justification

**CL3 (same-context, penalty 0.0)**:

- Code review against the actual files merged into `develop` (no proxy).
- Compile + type verification via `svelte-check` against the same
  tsconfig the production build uses.
- CI smoke against the actual matrix the release workflow gates on.
- `evidence_type: test` because every assertion is binary pass/fail
  with deterministic queries (file existence, regex match, exit code).

## Related Artifacts

| Artifact | Relation  | Notes                                                            |
|----------|-----------|------------------------------------------------------------------|
| PRD-004  | informs   | Closes all 7 SC and 4 NFR.                                       |
| PRD-003  | builds-on | F1 a11y + recovery; same pattern of shared `.svelte.ts` lib.     |
| EVID-010 | builds-on | Live-verification template (deferred to a separate post-merge run for F2). |


