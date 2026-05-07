# `shared/ui` ownership and customisation discipline

`template/src/shared/ui/` is the **single owner** of visual primitives. Higher
FSD layers (`entities/`, `widgets/`, `pages/`, `routes/`) compose primitives
into features — they MUST NOT modify a primitive's internals from above.

This rule exists because PRD-018 / RFC-016 / EVID-022 made the catalogue the
single source of truth for atom styling. If every widget patches a primitive
with `:global()` overrides, the catalogue becomes a lie and `/playground` no
longer reflects what users see.

## What lives where

| Layer | Allowed |
|---|---|
| `shared/ui/<primitive>/` | The primitive itself (markup + styles + variants + sizes + a11y wiring). The ONLY place that owns the primitive's chrome. |
| `entities/` / `widgets/` / `pages/` / `routes/` | **Composition** of primitives: layout (grid/flex/gap), positioning (fixed/absolute/sticky), motion (transitions, animations), domain glue (data binding, event handlers, ARIA scope at the composition boundary). |

## Required: when you need a new look

If a feature needs a visual you can't get from existing primitive props
(`variant`, `size`, etc.) one of two things must happen:

1. **Add a new `variant` / `size` / prop to the primitive itself** in
   `shared/ui/<primitive>/<Primitive>.svelte`, document it in
   `shared/ui/README.md`, and surface it on `/playground`. Then *use* the new
   prop in the higher layer.
2. **Create a new primitive** in `shared/ui/<new-name>/` with the same shape
   as the existing ones (folder + `<Component>.svelte` + barrel `index.ts` +
   top-level re-export from `shared/ui/index.ts`). Showcase it on
   `/playground`. The new primitive must follow the rules below.

## Required: when you create a new primitive

- **Prefer porting from shadcn-svelte / `bits-ui`.** The catalogue is built on
  `bits-ui` (already in `template/package.json#dependencies`). Wrap the
  bits-ui primitive with a thin Svelte 5 component; do not re-implement
  accessibility from scratch.
- **Styles only via plain CSS + CSS variables** from `template/src/app/styles/app.css`
  (`--bg`, `--bg-1`, `--bg-2`, `--fg`, `--fg-1`, `--accent`, `--line`, …).
  No Tailwind. No `style` attribute on the primitive's root for color/border —
  always go through CSS classes that read tokens. Dual-theme (light/dark via
  `data-theme`) MUST keep working with no caller intervention.
- **Public surface mirrors existing primitives**: `Variant`, `Size`,
  `class?: string` (forwarded to root), `children?: Snippet`, typed props.
  Use `$bindable()` for two-way state where bits-ui supports it.
- **Re-exported from `shared/ui/index.ts`** by name.
- **Showcase on `/playground`** — every variant + size combination, in both
  light and dark themes, before any caller in `widgets/` / `pages/` is allowed
  to use it.

## Forbidden in `entities/` / `widgets/` / `pages/` / `routes/`

These are anti-patterns. Every example below is a sign the primitive itself
should grow a new prop, OR the upper layer should compose differently.

1. **`:global()` selectors that reach into a primitive's internal class names.**
   Examples that violate this rule:

   ```css
   /* in widgets/foo/ui/Foo.svelte — FORBIDDEN */
   .meta :global(.theme-toggle) { background: transparent; }       /* strips primitive's bg */
   .meta :global(.theme-toggle .toggle-group-item) { font-family: var(--font-mono); }  /* re-skins items */
   :global(.panel-action) { border: 1px solid var(--line-2); }     /* re-skins Button */
   :global(.filter-group .toggle-group-item[data-state='on']) {    /* changes pressed visuals */
     background: var(--accent-dim);
   }
   ```

   Each of these mutates a primitive's appearance from above. If the primitive
   doesn't already support what you want — add a variant/size to the
   primitive, do not patch it here.

2. **Re-implementing an atom that already exists.** Inline `<button class="btn">`,
   `<span class="badge">`, custom `.alert`, custom progress bars, custom
   spinners, etc. — all of these have primitives. If a primitive doesn't fit,
   extend it (rule above), don't fork it inline.

3. **Adding a new `variant` / `size` value as a CSS class on the consumer side.**
   Variants live inside the primitive. Don't pretend by writing
   `<Button class="variant-foo">` plus `:global(.variant-foo) { ... }` in a widget.

4. **Bypassing the primitive's prop API to set internals.** No
   `style:background` / `style:border` on a primitive root to recolour it. No
   `class="primitive-internal-name"` on a primitive root to hijack its rules.

## Allowed in `entities/` / `widgets/` / `pages/` / `routes/`

These are the *only* visual things upper layers may write CSS for:

1. **Wrapper / layout / positioning.** Flex direction, grid templates, gap,
   margin, position, z-index, transforms. Anything about how primitives are
   *arranged*, not what they *look like internally*.

   ```css
   .row { display: flex; gap: 6px; flex-wrap: wrap; }   /* OK — composing */
   .update-btn-pos { position: fixed; bottom: 32px; }   /* OK — positioning */
   ```

2. **Container chrome that does NOT shadow a primitive.** Section borders,
   panel backgrounds, dividers between primitive groups, sticky headers.

3. **Motion** — fade-ins, slide-ins, reveal-on-hover for the wrapper.
   Transitions on a primitive's own internals stay in the primitive.

4. **Passing props.** `<Button variant="ghost" size="sm" class="my-wrapper-class">`
   is fine — `class` lands on the primitive root for *layout* needs (margin,
   width, alignment), not for restyling.

## Verification

A reviewer must be able to confirm from the diff that:

- New `:global()` selectors in `entities/` / `widgets/` / `pages/` / `routes/`
  do NOT name a class published by a `shared/ui/<primitive>/` component.
  Forbidden tokens to grep for in upper-layer Svelte `<style>` blocks:
  `.btn`, `.badge`, `.alert`, `.toggle`, `.toggle-group`, `.toggle-group-item`,
  `.tabs-list`, `.tabs-trigger`, `.tabs-content`, `.progress`, `.spinner`,
  `.skeleton`, `.popover-content`, `.tooltip-content`, `.command-input`,
  `.dialog-content`, `.modal-overlay`, `.field-label`, `.field-error`,
  `.input-root`, `.select-trigger`, `.card-body`, `.separator`,
  `.accordion-trigger`, `.collapsible-content`, `.toaster-viewport`.

  ```bash
  # one-shot check, run from template/
  PRIMITIVE_CLASSES='\.(btn|badge|alert|toggle(-group(-item)?)?|tabs-(list|trigger|content)|progress|spinner|skeleton|popover-content|tooltip-content|command-input|dialog-content|modal-overlay|field-(label|error)|input-root|select-trigger|card-body|separator|accordion-trigger|collapsible-content|toaster-viewport)\b'
  rg ':global\(' src/{entities,widgets,pages,routes} --type svelte -A 1 \
    | rg -P "$PRIMITIVE_CLASSES" \
    && echo "FAIL: upper-layer Svelte file is overriding a primitive class via :global()" \
    || echo "OK: no upper-layer reaches into primitive internals"
  ```

- Any new visual that doesn't fit existing variants/sizes is followed in the
  same PR (or immediately preceding one) by a corresponding edit to
  `shared/ui/<primitive>/` adding the new prop, plus a `/playground`
  showcase update.

- New primitives import only from `bits-ui` (or have an explicit
  `// TODO(rule-24-bits-ui)` justification in the file's header) and read
  colors / borders only from CSS variables defined in
  `template/src/app/styles/app.css`.

## Existing violations (known debt)

A few `:global()` overrides currently live in upper-layer files (see
`widgets/health-bar/HealthBar.svelte`, `widgets/artifact-filters/Filters.svelte`,
`widgets/artifact-panel/ArtifactPanel.svelte`, `widgets/insights-rail/InsightsRail.svelte`,
`widgets/timeline/Timeline.svelte`, `widgets/version-footer/UpdateButton.svelte`,
`widgets/mosaic/PaneFrame.svelte`). These were written before this rule
landed and are tracked as `TODO(rule-24-cleanup)` cleanup work — each one
should resolve into either a new primitive variant/size or a removal. Do not
add new violations.

## Rationale

`/playground` is the contract. If half the app's visuals are produced by
overrides scattered across `widgets/`, the catalogue lies and the next
contributor copies an inline override instead of a proper variant. The
catalogue is the single source of truth for *what an atom looks like*; upper
layers are the source of truth for *how atoms are arranged into features*.
Keeping the boundary clean is what makes the design system durable.
