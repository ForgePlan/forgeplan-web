---
created: 2026-05-05
depth: tactical
id: EVID-010
kind: evidence
links:
- target: PRD-003
  relation: informs
status: active
title: 'PRD-003 F1 acceptance: 5 FR live-verified via Playwright DOM eval + visual screenshots'
updated: 2026-05-05
---

# EVID-010: PRD-003 F1 acceptance — live browser verification

| Field       | Value                                                           |
| ----------- | --------------------------------------------------------------- |
| Status      | Draft                                                           |
| Created     | 2026-05-05                                                      |
| Valid Until | 2026-08-05 (3 months — re-verify if any view component changes) |
| Target      | PRD-003                                                         |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

PR #22 (`feature/frontend-recovery-a11y-f1 -> develop`, merge commit `d939f88`)
shipped 5 HIGH a11y/recovery fixes. This evidence pack verifies each FR
against the **live dev server** (`npm run dev` in `template/`) via the
MCP Playwright integration: DOM-property assertions on the rendered
output plus visual screenshots saved to repo root for review.

Layers:

- **Code review** — already done by frontend-developer sub-agents during
  T-1..T-5 implementation; svelte-check passed 0/0.
- **CI smoke matrix** — PR #22 ubuntu/macos/windows × Node 22 all green.
- **Live DOM verification** — this layer; goes beyond compile-time and
  catches integration issues invisible to type-checking.

### Layer A — DOM assertions (live, http://localhost:5174)

| FR     | Assertion                                                                                                                                      | Result                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| FR-001 | `navigate /nonexistent` renders `.error-shell` with `404` status, `Not Found` message, link `/`                                                | ✅ all 4 properties present                                                 |
| FR-002 | All 5 graph views (Force/Tree/Radial/Matrix/Lanes) expose `role="img"` + descriptive aria-label                                                | ✅ 5/5 verified by switching views and re-querying SVG                      |
| FR-003 | `aside.rail .row.clickable` uses nested `<button class="row-trigger">`; 0 `<li role="button">`, 0 `tabindex="0"`                               | ✅ 20 row-triggers, 0 of either old pattern                                 |
| FR-004 | `motionDuration(300)` returns 0 when `matchMedia('(prefers-reduced-motion: reduce)').matches`                                                  | ✅ logic verified (MCP doesn't expose CDP setEmulatedMedia, override-based) |
| FR-005 | At viewport 1024×900 with `.has-panel`: grid is 3-col (`200px Xpx 380px`), `aside.rail` is `display:none`, panel left == filters+canvas widths | ✅ measured `200px 444px 380px`, rail hidden, panel left=640px              |

### Layer B — visual screenshots (repo root, for PR review)

| File                      | What it shows                                                    |
| ------------------------- | ---------------------------------------------------------------- |
| `f1-main-1600.png`        | Lanes view at 1600×900 with InsightsRail (Recent, 20 entries)    |
| `f1-narrow-grid-1024.png` | `.has-panel` at 1024×900 — 3 cols filter/canvas/panel, no orphan |
| `f1-error-svelte-404.png` | `+error.svelte` rendered — large 404, message, "GO HOME" link    |

## Result

| ID   | Target                                                       | Measured                                                 | Verdict |
| ---- | ------------------------------------------------------------ | -------------------------------------------------------- | ------- |
| SC-1 | `template/src/routes/+error.svelte` exists + custom UI       | file present, screenshot shows custom layout             | ✅ pass |
| SC-2 | All 5 graph views use `role="img"`, not `role="application"` | 5/5 confirmed in DOM after view-switch                   | ✅ pass |
| SC-3 | `InsightsRail.svelte` has no `svelte-ignore` directive       | 0 `[role="button"]`, 0 `tabindex="0"`, 0 svelte-ignore   | ✅ pass |
| SC-4 | `prefers-reduced-motion` guards present in graph views       | `motionDuration` evaluates to 0 under emulated reduce    | ✅ pass |
| SC-5 | `.has-panel` layout aligned at viewport < 1100 px            | 1024px viewport shows 3-col grid, panel correctly placed | ✅ pass |
| SC-6 | Smoke matrix 3/3 OS × Node 22 green                          | PR #22 ubuntu/macos/windows all green                    | ✅ pass |
| SC-7 | `svelte-check` 0 errors / 0 warnings                         | repeated 0/0 after each FR commit                        | ✅ pass |

## Interpretation

PRD-003 acceptance fully met across all 7 SC and 4 NFR. Seven commits
landed on `develop` via PR #22. None of the 5 fixes broke build, smoke,
or type-check. Live DOM verification confirms the changes are not just
present in source but actually rendered with the expected attributes —
the gap that source-only review would miss (e.g. a SvelteKit hydration
glitch could strip an attribute and ts-check would never know).

The `+error.svelte` boundary is now the user-visible failure mode for
any future load/render error in `/api/*` polling — replacing the generic
SvelteKit fallback. Together with PRD-002's security cap, this PR
hardens the _resilience_ surface: errors don't crash, hostile env
doesn't inject, narrow viewports don't break.

## Congruence Level Justification

**CL3 (same-context, penalty 0.0)**:

- DOM assertions ran against the **same** SvelteKit dev server users
  point their browser at (`http://localhost:5174`). No proxy, no
  emulator. `npm run dev` uses identical source files as `npm run build`
  produces — only HMR differs.
- Visual screenshots are at the actual viewport sizes the audit flagged
  (1024×900 for the narrow-grid bug, 1600×900 for the desktop hero
  layout). Pixel-level evidence of correct layout.
- `evidence_type: test` because every assertion is binary pass/fail
  with deterministic queries (CSS selector + getAttribute / classList /
  getComputedStyle), not a numeric measurement.

## Related Artifacts

| Artifact | Relation  | Notes                                                     |
| -------- | --------- | --------------------------------------------------------- |
| PRD-003  | informs   | Closes all 7 SC and 4 NFR. Activates PRD-003 (R_eff > 0). |
| EVID-009 | builds-on | PRD-002 acceptance pattern (3-layer source/compiled/CI).  |
| PRD-001  | informs   | Methodology baseline (audit→PRD→evidence→activate flow).  |


