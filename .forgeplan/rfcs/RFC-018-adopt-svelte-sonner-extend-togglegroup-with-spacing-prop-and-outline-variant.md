---
depth: standard
id: RFC-018
kind: rfc
links:
- target: PRD-021
  relation: refines
status: active
title: Adopt svelte-sonner; extend ToggleGroup with spacing prop and outline variant
---

# RFC-018: Adopt svelte-sonner; extend ToggleGroup with spacing prop and outline variant

## Summary

Replace the hand-rolled `shared/ui/toaster/` with a thin svelte-sonner wrapper
keeping the public surface intact, and extend `shared/ui/toggle-group/` with a
`spacing?: boolean` prop and a new `'outline'` variant aligned with
shadcn-svelte's reference, then rewire the artifact-filters widget to use both.

## Motivation

The current `Toaster.svelte` plus `toaster-store.svelte.ts` re-implements ~230
LOC of stack management, animation, and dismissal that svelte-sonner gives for
free, plus features (hover-pause, swipe, promise) that we'd otherwise have to
write by hand. The current `ToggleGroup` exposes only `default` and
`outline-mono` variants and bakes the gap into a `:global()` rule, so
widgets/pages either accept the look or break rule 24 by patching it. Filters
need an outlined look with breathing room — drives both extensions.

Doing nothing means: keep maintaining two divergent toaster code paths over
time; let `widgets/artifact-filters/` either remain visually heavy or grow
rule-24-violating overrides.

## Goals

- Preserve every existing `toast.*` call site without changes.
- Add `spacing?: boolean` and `'outline'` variant to ToggleGroup as proper
  primitive props (no consumer-side `:global()`).
- Filters render with `variant="outline"` + `spacing={true}`.
- `/playground` shows the new combinations under both themes.
- Rule-24 grep over `widgets/artifact-filters/` still passes.

## Non-Goals

- Replacing `bits-ui` ToggleGroup primitive itself.
- Removing `outline-mono` variant.
- Adopting `toast.promise` / custom JSX toasts in this PR (call-site work).
- Theming overhaul.

## Options Considered

### Option A: Thin wrapper over svelte-sonner (chosen)

**Description**: Add `svelte-sonner` to `template/package.json#dependencies`.
Rewrite `shared/ui/toaster/Toaster.svelte` to import sonner's `Toaster` and
override its CSS variables to project tokens. Replace
`toaster-store.svelte.ts` with re-exports of sonner's `toast` plus shape
adapters (`toast.info` → `toast()`, `toast.danger` → `toast.error`).

**Pros**: Minimal surface change; matches shadcn-svelte recipe; ~6KB gzip
runtime; future `toast.promise` available.

**Cons**: Adds one runtime dep; bundle grows ~10–15KB; sonner's CSS has its
own variable namespace that must be mapped.

### Option B: Keep bespoke toaster

**Description**: Continue maintaining the hand-rolled store + DOM rendering;
add hover-pause + promise variant by hand.

**Pros**: Zero new deps.

**Cons**: 230 LOC stays; we re-invent battle-tested behaviour; future
divergence from shadcn-svelte recipes.

### Option C: Use bits-ui Toast (not yet stable)

**Description**: Wait for `bits-ui` to ship a Toast primitive.

**Pros**: One dep family; consistent with our other primitives.

**Cons**: Not available today; unknown shape.

## Trade-off Analysis

| Criterion | A (sonner) | B (bespoke) | C (bits-ui) |
|---|:---:|:---:|:---:|
| LOC delta | -150 | +80 | n/a |
| Runtime cost | +10–15KB | 0 | unknown |
| Feature parity with docs | Full | Partial | n/a |
| Maintenance | Low | Medium | n/a |
| Time-to-ship | Hours | Days | Blocked |

→ **Option A.**

## Architecture

Adopt **Option A**: thin wrapper over `svelte-sonner` for the toaster, plus a
new `'outline'` variant and `spacing?: boolean` prop on `ToggleGroup`.

**Architecture**:

- `shared/ui/toaster/Toaster.svelte` — re-export svelte-sonner's `Toaster`
  with project defaults (`position`, `richColors=false`, `toastOptions`).
  Map sonner's CSS variables (`--normal-bg`, `--normal-text`,
  `--normal-border`, `--success-bg`, `--error-bg`, `--warning-bg`,
  `--info-bg`) to project tokens (`--bg-1`, `--fg-1`, `--line-2`, `--good`,
  `--bad`, `--accent`, `--fg-2`).
- `shared/ui/toaster/toaster-store.svelte.ts` — slim re-exports: import
  sonner's `toast` and re-publish under our names. Keep `toast.danger` as
  an alias of sonner's `toast.error` so call sites do not change. Drop the
  hand-rolled `ToasterStore` class.
- `shared/ui/toggle-group/ToggleGroup.svelte` — `Variant` widens to
  `'default' | 'outline-mono' | 'outline'`. Add `spacing?: boolean` (default
  `false`) → emits `data-spacing="true"` on the root.
- `shared/ui/toggle-group/ToggleGroupItem.svelte` — CSS for
  `.toggle-group.variant-outline` (transparent container, per-item border,
  sans typography) and `.toggle-group[data-spacing='true']` (gap, no shared
  chrome).
- `widgets/artifact-filters/ui/Filters.svelte` — flip `variant` to
  `'outline'`; add `spacing={true}`; keep the `flex-wrap`/`gap` layout block
  but make it idempotent with the primitive's own gap.

## Invariants

- Public exports of `shared/ui/toaster/index.ts` MUST remain stable
  (`Toaster`, `toast`, `toaster`, `Toast`, `ToastInit`, `ToastVariant`).
- ToggleGroup MUST keep the existing `default` and `outline-mono` variants
  pixel-stable for current callers.
- No `:global()` rule in `widgets/`/`pages/`/`routes/` MUST mention a
  `.toggle-group*` class.
- The bin script MUST stay zero-dep (rule 23) — sonner is a `template/` dep
  only.

## Implementation Phases

### Phase 1 — Toaster migration

- [ ] Add `svelte-sonner` to `template/package.json#dependencies`.
- [ ] Rewrite `shared/ui/toaster/Toaster.svelte` as svelte-sonner wrapper:
  pass `position`, override CSS variables (`--normal-bg`, `--normal-text`,
  `--normal-border`, `--success-bg`, `--error-bg`) to project tokens.
- [ ] Replace `toaster-store.svelte.ts` body with re-exports from
  `svelte-sonner` + shape adapters (`info/success/warning/danger` → sonner's
  `info/success/warning/error`).
- [ ] Keep `index.ts` exports identical (`Toaster`, `toast`, `toaster`,
  `Toast`, `ToastInit`, `ToastVariant` types).
- [ ] Update `/playground` toast tile (rename "Danger" → "Error" only if
  needed; keep `toast.danger` adapter alive).

### Phase 2 — ToggleGroup extension

- [ ] `Variant = 'default' | 'outline-mono' | 'outline'`.
- [ ] Add `spacing?: boolean` prop; default `false`. Render
  `data-spacing="true"` on the root.
- [ ] CSS: `.toggle-group.variant-outline` — transparent container, no
  border, padding 0; each `.toggle-group-item` gets its own border, default
  rounding, sans typography. `.toggle-group[data-spacing='true']` sets
  `gap: 6px` (tunable) and unsets the shared container's chrome.
- [ ] `/playground` ToggleGroup tile: 3 variants × 2 spacings × 2 sizes
  matrix (or a representative subset).
- [ ] Update `shared/ui/README.md` props table.

### Phase 3 — Filters rewire

- [ ] `Filters.svelte`: change `variant="outline-mono"` → `variant="outline"`
  on both ToggleGroups; add `spacing={true}`.
- [ ] Drop the `:global(.filter-group)` override block (gap/wrap go via
  `spacing` + a thin layout class for `flex-wrap`).
- [ ] Verify rule-24 grep still passes.

## Verification

- `npm run check` exits 0.
- `npm run build` exits 0; assertion in `scripts/build.mjs` (3M cap) holds.
- `node scripts/smoke.mjs` exits 0 (init + start path).
- Manual: `/playground` shows new combinations in both themes.
- `rg --type-add 'svelte:*.svelte' ':global\(' template/src/widgets/artifact-filters -A 1 | rg -P '\.(toggle-group|filter-group)\b'`
  → no matches.

## Rollout / Rollback

- **Rollout**: single PR; merge into `develop`. The change is contained to
  `template/` source — published artifacts (`dist/`, `dist-experimental/`)
  rebuild automatically on next release.
- **Rollback**: revert the merge commit; the `outline-mono` variant is
  unchanged, so consumers who don't switch to `outline` are unaffected.

## Open Questions

- Should `spacing` accept a number (px) instead of boolean? Boolean is enough
  today; numeric is a non-breaking follow-up.
- Sonner CSS variables — do we expose all (`--success-bg`, etc.) or only the
  ones needed for default + danger? Start with the minimum needed for a11y +
  visual parity; widen if a call site asks.

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-021 | Drives this RFC | draft |
| EVID-026 | Build + smoke evidence | draft |
| Rule 24 | Constraint on shared/ui ownership | active |



