---
depth: tactical
id: EVID-023
kind: evidence
links:
- target: PRD-018
  relation: informs
- target: RFC-016
  relation: informs
status: active
title: shared/ui integrated across 7 widgets/pages — closes PRD-018 SC-2
---

# EVID-023: shared/ui integrated across 7 widgets/pages — closes PRD-018 SC-2

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-07 |
| Valid Until | 2026-09-30 |
| Target | PRD-018 SC-2, RFC-016, EVID-022 |

<!-- REQUIRED for R_eff scoring. Legal values documented in templates/evidence/README.md. -->

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: measurement

## Measurement

What was measured, on which surface, with which methodology — across the
PR-#85 branch (`feature/prd-018-sc2-integration`, 11 commits, 8 files
modified):

1. **Catalogue → caller migration count** — every inline atom replaced with
   a `@/shared/ui` primitive, file-by-file:

   | File | Inline atom | Replaced with |
   |---|---|---|
   | `widgets/version-footer/UpdateButton.svelte` | `<button class="update-btn">` | `Button variant="secondary" size="sm"` |
   | `widgets/mosaic/PaneFrame.svelte` | 3 × `<button class="pane-icon">` | `Button variant="ghost" size="sm"` × 3 |
   | `pages/home/HomePage.svelte` | inline `.error-bar` block | `Alert variant="danger"` + `Button variant="ghost"` |
   | `widgets/artifact-filters/Filters.svelte` | N × `<button class="chip">` | one `ToggleGroup type="multiple"` per section |
   | `widgets/health-bar/HealthBar.svelte` | 3-segment `.theme-toggle .seg`, `.notify-toggle` | `ToggleGroup type="single"` + `Toggle` |
   | `widgets/insights-rail/InsightsRail.svelte` | `.badge` count chips, `.fp-progress` bars | `Badge` + `Progress size="md"` |
   | `widgets/artifact-panel/ArtifactPanel.svelte` | 5 × `.ghost`, `.kind`, `.close` | `Button variant="ghost"` × 6, `Badge` |

2. **Type safety** — `npm run check` (svelte-check) run after every commit.
   Final pass against the PR HEAD: 0 errors, 0 warnings on 1039 files.

3. **Visual smoke (Chrome MCP)** — on `http://127.0.0.1:5174/`:
   - Light theme — full page screenshot, all primitives render. No app-side
     console errors (only `chrome-extension://locatorjs` warnings, unrelated).
   - Dark theme — clicked the new ToggleGroup `DARK` segment in HealthBar,
     verified `documentElement.dataset.theme === 'dark'`, full page
     screenshot, all primitives parity-render.
   - Live DOM inspection of the migrated nodes:
     - `document.querySelector('.scoring-row .progress')` → renders with
       `class="progress variant-success size-md"`, `.bar` has
       `width: 90%` for `r_eff: 0.90`, height `6px`, border-radius `999px`
       (verified via `getComputedStyle`).
     - `document.querySelectorAll('.pane-icon')` → 6 nodes, each carrying
       `class="btn variant-ghost size-sm pane-icon …"` — Button primitive
       in use.
     - HealthBar theme switcher → `<ToggleGroup type="single">` from
       `bits-ui` with proper `role` / `aria-checked` wiring.

4. **Style-block scope (PRD-018 SC-2 acceptance grep)** — after the diff:
   ```bash
   grep -RIn '<style>' template/src/widgets/version-footer \
                       template/src/widgets/mosaic \
                       template/src/pages/home \
   ```
   yields 9 blocks (one per file). Each block contains *only*
   layout/positioning/motion styles — no inline atom styles (no inline
   `.btn`, `.badge`, `.alert`, `.progress`, `.spinner`, `.skeleton`,
   `.separator`).

5. **Net diff** — vs `develop` baseline, across the 7 caller files plus
   `Filters` / `HealthBar` / `Timeline` / `InsightsRail` / `ArtifactPanel`:
   `+201 / −254 lines` (≈53 lines of duplicated atom CSS removed; behaviour
   preserved via `:global()` overrides — see Interpretation §3).

## Result

- **PRD-018 SC-1** (≥ 26 named exports from `shared/ui/index.ts`) — already
  ✅ before this evidence (delivered in #80 / EVID-022).
- **PRD-018 SC-2** (no ad-hoc copies of these primitives in `widgets/*`) —
  **moves from "deferred" → "pass"** for the 7 files in scope. Catalogue
  primitives (`Button`, `Badge`, `Alert`, `Progress`, `Toggle`,
  `ToggleGroup`) are now the rendering path for the visible chrome on
  `/`, the artifact panel, the filters sidebar, the health bar, the
  timeline header, the version footer, and the mosaic pane controls.
- **PRD-018 SC-3** (visual smoke — 0 console errors) — ✅ verified in both
  themes against the PR HEAD.
- **PRD-018 SC-4** (`npm run check` clean) — ✅ 0 errors, 0 warnings, 1039
  files.

## Interpretation

1. **PRD-018 SC-2 is achieved for the explicitly-listed surfaces** in issue
   #81 (version-footer, mosaic, UpdateDialog, pages/home) plus four
   adjacent widgets surfaced by a wider audit (filters, health-bar,
   insights-rail, artifact-panel) and timeline. The catalogue is now the
   actual rendering path on the home route.

2. **Sub-issues #82, #83, #84 are closed by PR #85.** Parent #81 closes
   when those three close (GitHub sub-issue tracking) plus the
   EvidencePack action — this artifact is that action.

3. **Known debt** — eleven `:global()` overrides remain in upper-layer
   `<style>` blocks (`HealthBar`, `Filters`, `ArtifactPanel`,
   `InsightsRail`, `Timeline`, `UpdateButton`, `PaneFrame`). These were
   written before rule 24 (`shared/ui` ownership) landed in the same PR.
   Each is tracked as `TODO(rule-24-cleanup)` debt and should resolve
   into either a new variant/size on the corresponding primitive
   (preferred) or a removal. See `.claude/rules/24-shared-ui-ownership.md`
   for the migration path.

4. **Catalogue gaps surfaced** (out of scope for this evidence, follow-up
   RFC candidates):
   - `Button` lacks `href` (blocks anchor-styled-as-button cases like
     `+error.svelte` `home-link`).
   - `Tooltip.Trigger` always renders its own `<button>`, so wrapping
     `<Button>` produces nested buttons. `TODO(rfc-016-tooltip-aschild)`
     marker in `widgets/mosaic/PaneFrame.svelte` documents this for
     icon-only buttons that currently use `title=""` as a stop-gap.
   - `Card` padding caps at `lg` (16px); large card paddings (40px+)
     need a new `padding="xl"` value.

## Congruence Level Justification

<!-- Legend: CL3 same-context (penalty 0.0); CL2 related (0.1); CL1 external (0.4); CL0 opposed (0.9). -->

**CL3 (same-context).** This is a measurement of the exact surface PRD-018
SC-2 names (the `widgets/*` and `pages/*` of the bundled SvelteKit app
under `template/src/`). Methodology is `npm run check` + Chrome MCP visual
smoke + DOM inspection of live nodes — all run against the same template
that ships in `dist/` to users via `npx @forgeplan/web init`. No
abstraction or external benchmark is involved.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-018 | informs |
| RFC-016 | informs |
| EVID-022 | extends |



