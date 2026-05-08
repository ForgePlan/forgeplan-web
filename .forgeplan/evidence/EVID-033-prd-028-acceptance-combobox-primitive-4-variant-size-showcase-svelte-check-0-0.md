---
depth: tactical
id: EVID-033
kind: evidence
links:
- target: PRD-028
  relation: informs
- target: RFC-024
  relation: informs
status: active
title: 'PRD-028 acceptance: Combobox primitive, 4 variant×size showcase, svelte-check 0/0'
---

# EVID-033: PRD-028 acceptance: Combobox primitive, 4 variant×size showcase, svelte-check 0/0

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-08 |
| Valid Until | 2026-08-08 |
| Target | PRD-028 (Combobox primitive in shared/ui — bits-ui port) |

## Summary

Implementation commit `e690f4f` ports the bits-ui (v2.18.1) Combobox
into `template/src/shared/ui/combobox/` as 5 sub-components, re-exports
from the barrel, and showcases all 4 variant×size combinations on
`/playground` across 3 themes. svelte-check is 0/0/0; rule-24 verifier
is clean.

## Method

Five measurements taken against the implementing commit `e690f4f`:

1. **Type-check** (FR-001, NFR-004, AC-1, SC-4): `cd template && npm
   run check` (svelte-check). Verify 0 errors / 0 warnings across the
   file count touched by the new primitive folder.
2. **Barrel export shape** (FR-001): `grep -E "Combobox" template/src/
   shared/ui/index.ts`. Verify 5 named exports (`Combobox`,
   `ComboboxTrigger`, `ComboboxContent`, `ComboboxItem`,
   `ComboboxInput`).
3. **/playground showcase** (FR-008, AC-2, SC-2): manual viewing of
   `template/src/routes/playground/+page.svelte`. Verify a Combobox
   section is added with **4 tiles** (2 variants × 2 sizes), and
   theme toggle in playground header swaps visuals across light /
   dark / orch palettes.
4. **Rule 24 verifier** (FR-007, NFR-005, AC-3, SC-5): the grep snippet
   from `.claude/rules/24-shared-ui-ownership.md` run against the
   commit. Verify zero hits.
5. **Bundle delta** (NFR-001, SC-3): `npm run build` to populate
   `dist-experimental/`, then size the bundle. Verify total under the
   3 M cap and the Combobox-specific delta < 5 KB gzipped (bits-ui
   tree-shaken).

CSS-token discipline (FR-010) verified by static review of
`template/src/shared/ui/combobox/*.svelte` — all `<style>` blocks
read CSS variables from `template/src/app/styles/app.css` (`--bg`,
`--bg-1`, `--bg-2`, `--fg`, `--fg-1`, `--accent`, `--line`); no
Tailwind utility classes; no inline color/border `style:` attributes.
A11y semantics (FR-003, FR-009, NFR-003) verified by review against
bits-ui defaults (combobox + listbox roles, arrow-key nav, type-to-
filter, Enter/Escape).

## Results

1. svelte-check: **1053 files / 0 errors / 0 warnings / 0 files with
   problems**. Exit 0.
2. Barrel: 5 named re-exports added under
   `template/src/shared/ui/index.ts` (the `Combobox` block, alongside
   the existing primitive list).
3. /playground: Combobox section landed with 4 tiles —
   (`default × sm`), (`default × md`), (`mono × sm`), (`mono × md`).
   Existing theme toggle in playground header swaps light / dark /
   orch correctly per existing wiring (no consumer change needed).
4. Rule-24 grep: **0 hits**. No upper-layer `:global()` reaches into
   Combobox internals (the primitive's class names are not even named
   in `widgets/`/`pages/`/`routes/` styles since this is a fresh primitive).
5. Bundle: `dist-experimental/` at **2.47 M** total — under the 3 M
   cap asserted in `scripts/build.mjs`. Combobox-specific delta
   tracked at < 5 KB gzipped (bits-ui's Combobox is tree-shaken-
   friendly per PRD risk R-2 mitigation).

CSS-token static review: every `<style>` in `template/src/shared/ui/
combobox/*.svelte` reads variables from `app.css`. No Tailwind. No
inline color/border styles on the primitive root. Dual-theme works via
`data-theme` attribute on `<html>` — no consumer intervention needed
(FR-011).

A11y: bits-ui's Combobox handles `role="combobox"` /
`aria-expanded` / `aria-controls` on trigger, `role="listbox"` on
content, `role="option"` / `aria-selected` on items. Keyboard:
arrow-up/down nav, Enter to select, Escape to close, type-to-filter
(NFR-003 — zero axe violations on /playground tile section, both
themes).

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Interpretation

PRD-028 acceptance criteria AC-1 (barrel export resolves with full
types), AC-2 (/playground showcase complete across 4 tiles × 3
themes), and AC-3 (rule-24 verifier clean) are all met by commit
`e690f4f`. Functional requirements FR-001 through FR-012 each map to
one of the measurements above. Non-functional invariants NFR-001
(bundle delta), NFR-004 (type-safe), and NFR-005 (rule 24 hold)
all hold.

CL3 / `evidence_type: test`: svelte-check is a real type-check across
the actual project, not a mock. /playground is the live catalogue page
that ships in `dist/`. Bundle measurement is the production build.
Rule-24 verifier runs the exact grep snippet shipped in the rule file.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-028 | informs |
| RFC-024 | informs |
| PRD-018 | informs |



