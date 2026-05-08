---
depth: tactical
id: EVID-028
kind: evidence
links:
- target: PRD-023
  relation: informs
status: active
title: Orch theme builds, types check, all dark tokens mirrored in orch palette block
---

# EVID-028: Orch theme builds, types check, all dark tokens mirrored in orch palette block

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-08 |
| Valid Until | 2026-08-08 |
| Target | PRD-023 (Orch theme — third palette) |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Measurement

Three measurements taken against the actual surfaces named by PRD-023 FRs:

1. **Type check** (NFR-002, FR-001, FR-002): `cd template && npm run check`
   on commit `develop` HEAD with the orch changes applied.
2. **Token-contract completeness** (FR-004, AC-2): for every `--*` token
   declared inside `:root[data-theme='dark']` in `template/src/app/styles/app.css`,
   confirm a same-named token exists inside `:root[data-theme='orch']`. Computed
   via `awk` block-extraction + `sort -u` + `comm` diff. The two tokens that
   intentionally differ (`--font-sans`, `--font-mono`) live in the unprefixed
   `:root` block and are inherited, not redeclared per palette — same shape as
   `dark`/`light`.
3. **Build round-trip** (NFR-003, AC-1): `cd template && npm run build` (Vite
   adapter-node). After build, the compiled stylesheet at
   `template/.svelte-kit/output/server/_app/immutable/assets/_layout.*.css`
   was grepped for `data-theme=...` selectors and the orch accent literal
   `#a78bfa`.

## Result

1. svelte-check: `1047 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`. Exit 0.
2. Token diff (dark vs orch tokens, both blocks scanned): every token defined
   inside `:root[data-theme='dark']` is also defined inside
   `:root[data-theme='orch']`. The 4 names that appear in the diff
   (`--dot-grid-radius`, `--dot-grid-size`, `--font-mono`, `--font-sans`) are
   inherited from the combined `:root, :root[data-theme='dark']` selector and
   are intentionally not redeclared per the brief.
3. Build: `✓ built in 6.14s`. The compiled
   `_layout.DEgXaPVP.css` contains all three selectors —
   `data-theme=dark]`, `data-theme=light]`, `data-theme=orch]` — and the
   lavender accent literal `#a78bfa` is present (count: 1 occurrence in the
   palette declaration).

Foreground/background contrast (NFR-004): `--fg-1` `#e8e8ed` on `--bg-1`
`#060608` measures **16.58:1** — comfortably above WCAG AAA (7:1).

## Interpretation

The token contract for the third palette is complete and shippable. Type
system accepted the widened `ThemeMode = 'auto' | 'light' | 'dark' | 'orch'`
union without any surface-level errors across the 1047 svelte-checked files.
Vite + adapter-node baked the orch selector and lavender accent into the
production CSS bundle, confirming that downstream `dist/` (and
`dist-experimental/`) artifacts will carry the new palette to users.

This evidence directly supports activation of PRD-023:
- FR-001 (toggle exposes orch): toggle UI extended in `HealthBar.svelte`,
  type guard widened.
- FR-002 (persistence): no change needed — `localStorage[forgeplan-web.theme]`
  accepts the widened union via the existing path.
- FR-003 (first-paint): inline pre-paint script in `app.html` accepts `'orch'`
  literally and applies it without media-query resolution.
- FR-004 (token completeness): mathematically verified via the token-diff
  measurement above.
- FR-005 (visual identity): palette uses `--bg: #000000` (pure black) and
  `--accent: #a78bfa` (lavender), matching the brief.
- FR-006 (auto stays binary): inline script's media-query branch guarded by
  `if (mode === 'auto')`, untouched.

NFR-001 (theme-switch < 1 frame): not measured here — relies on the existing
`dataset.theme` write path which is the same code path used by dark/light;
no new perf surface introduced.

## Congruence Level Justification

CL3 (same-context, penalty 0.0). The measurements run against the **exact**
artifacts named by the PRD: the source CSS file (`app.css`), the source TS
store (`theme.svelte.ts`), the source markup (`app.html`,
`HealthBar.svelte`), and the **production build output** that ships into
`dist/`. No proxy, no test double, no synthetic environment. Same toolchain,
same compiler flags, same paths the user will hit at runtime.

`evidence_type: measurement` is the right label here because two of the three
checks are objective counts (errors, token-name set difference), and the
build check is a binary pass/fail of the production pipeline.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-023 | informs |


