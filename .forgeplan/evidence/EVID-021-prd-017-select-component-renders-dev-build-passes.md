---
depth: standard
id: EVID-021
kind: evidence
last_modified_at: 2026-05-06T21:52:43.653157+00:00
last_modified_by: claude-code/2.1.131
links:
- target: PRD-017
  relation: informs
status: draft
title: PRD-017 Select component renders + dev build passes
---

# EVID-021 — PRD-017 Select component renders + dev build passes

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Context

PRD-017 introduces a shared `Select` primitive (`bits-ui` + `@lucide/svelte`) and
replaces the native `<select>` in `template/src/widgets/mosaic/ui/PaneFrame.svelte` with
icon-augmented options for each of the 7 graph views.

## Test surface

- `vite build` against `template/` (production build, esbuild CSS minify, adapter-node).
- `svelte-check` against `template/tsconfig.json`.
- Live render in Chrome at `http://127.0.0.1:5175/` via dev server, exercised through
  the browser-automation MCP.

## Observations

- `vite build`: ✓ built in 4.57s. All chunks emitted. No type errors. No new circular
  dependency warnings beyond the pre-existing d3-interpolate / d3-transition cycles.
- `svelte-check`: 950 files, 0 errors, 0 warnings, 0 files with problems.
- Live render: trigger shows the active view's Lucide icon (Share2 for Force) plus the
  label and a chevron. Clicking the trigger opens the bits-ui portal listbox; all 7
  rows render with their icon + label + hint, and the active row is highlighted with a
  check mark. No browser-console errors during open / close cycles.
- The pane drag-handle continues to work — clicking the trigger does not initiate a
  pane drag because the new selector matches `[data-select-trigger]` / `role='listbox'`
  / `role='option'` instead of the legacy `select / option / button` family.

## Conclusion

The implementation satisfies PRD-017's MUST requirements: shared component lives in
`shared/ui/select`, exported from `@/shared/ui`; consumed in `PaneFrame.svelte`; each
of the 7 graph views has a Lucide icon defined in `shared/config/ui-prefs.ts`; no
Tailwind; only CSS variables. Both build and runtime verifications are green against
the actual surface (`template/dist` and live viewport).


