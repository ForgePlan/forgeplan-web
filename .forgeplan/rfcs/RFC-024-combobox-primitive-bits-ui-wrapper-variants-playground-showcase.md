---
depth: standard
id: RFC-024
kind: rfc
links:
- target: PRD-028
  relation: based_on
status: active
title: Combobox primitive — bits-ui wrapper, variants, /playground showcase
---

---
id: RFC-024
title: "Combobox primitive — bits-ui wrapper, variants, /playground showcase"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
prd: PRD-028
depth: standard
---

# RFC-024: Combobox primitive — bits-ui wrapper, variants, /playground showcase

## Summary

Architecture for the Combobox primitive (PRD-028): a thin
Svelte 5 wrapper over `bits-ui`'s Combobox parts, with `default` /
`mono` variants and `sm` / `md` sizes, mirroring the file layout and
prop shape of existing primitives (Select, ToggleGroup). Includes
/playground showcase plan.

## Motivation

PRD-028 mandates a new primitive; PRD-029 needs it for the instance
switcher. RFC-016 (bits-ui-based primitives) is the precedent: every
new primitive wraps a bits-ui component, reads CSS vars from
`app.css`, and is showcased on /playground. This RFC nails down the
exact file layout, prop typing, and styling tokens before code lands.

## Goals

- Mirror existing primitive shape exactly: folder + `<Component>.svelte`
  + barrel + top-level re-export.
- Implement variants `default` and `mono` and sizes `sm` and `md` per
  PRD-028 FR-004/005.
- Cover all 2×2×3 combos on /playground.
- Zero new runtime deps (bits-ui already present per PRD-018).

## Non-Goals

- Multi-select Combobox.
- Async option providers.
- Virtualized rendering.
- Migration of existing Select consumers.

## Options Considered

### Option A: Direct bits-ui wrapper (CHOSEN)

**Description**: Each sub-component re-exports the corresponding
bits-ui part (`Combobox.Root`, `Combobox.Trigger`, `Combobox.Content`,
`Combobox.Item`, `Combobox.Input`) wrapped in a Svelte 5 component
that adds variant/size class names + token-driven styles. File layout:

```
template/src/shared/ui/combobox/
├── Combobox.svelte         # Root wrapper (Combobox.Root)
├── ComboboxTrigger.svelte  # Combobox.Trigger
├── ComboboxContent.svelte  # Combobox.Portal + Combobox.Content
├── ComboboxItem.svelte     # Combobox.Item
├── ComboboxInput.svelte    # Combobox.Input (search input)
└── index.ts                # named re-exports
```

**Pros**:
- Mirrors existing primitives 1:1 (Select, Tabs, ToggleGroup).
- bits-ui handles ARIA, keyboard, portal, positioning.
- Variants are pure CSS — no logic duplication.

**Cons**:
- 5 components is more files than a single monolith; cost is offset
  by clarity + composability.

### Option B: Single-file Combobox.svelte that imports bits-ui internally

**Description**: One `Combobox.svelte` that takes `options` array prop
and renders the whole tree internally without exposing parts.

**Pros**:
- One import.

**Cons**:
- Harder to customize trigger / content (consumers can't drop in their
  own trigger).
- Diverges from existing primitive convention.
- Less testable (can't isolate parts).

### Option C: Hand-rolled (no bits-ui)

**Description**: Build accessibility from scratch.

**Pros**:
- No bits-ui surface to track.

**Cons**:
- Re-implements ARIA combobox pattern (hard to get right).
- Duplicates focus management.
- Violates RFC-016 convention.

## Trade-off Analysis

| Критерий | A: bits-ui parts (chosen) | B: monolithic | C: hand-rolled |
|----------|---------------------------|---------------|-----------------|
| A11y rigor | High (bits-ui) | High (bits-ui) | Variable |
| Composability | High (drop-in parts) | Low | High |
| Convention parity | High (mirrors Select) | Low | Low |
| Implementation cost | Low | Low | Very high |
| Maintenance burden | Low | Low | High |

## Proposed Direction

**Option A.** Component sketches:

`Combobox.svelte`:

```svelte
<script lang="ts">
  import { Combobox as BC } from 'bits-ui';
  import type { Snippet } from 'svelte';

  export type ComboboxVariant = 'default' | 'mono';
  export type ComboboxSize = 'sm' | 'md';

  interface Props {
    value?: string;
    onValueChange?: (v: string) => void;
    variant?: ComboboxVariant;
    size?: ComboboxSize;
    class?: string;
    children?: Snippet;
  }

  let {
    value = $bindable(),
    onValueChange,
    variant = 'default',
    size = 'md',
    class: className = '',
    children,
  }: Props = $props();
</script>

<BC.Root
  bind:value
  onValueChange={onValueChange}
  class={`combobox combobox-${variant} combobox-${size} ${className}`}
>
  {@render children?.()}
</BC.Root>

<style>
  /* tokens-only — no inline color */
  :global(.combobox) {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
  }
  :global(.combobox-mono) {
    font-family: var(--font-mono);
  }
  :global(.combobox-sm) {
    font-size: 12px;
  }
  :global(.combobox-md) {
    font-size: 13px;
  }
</style>
```

Other parts follow the same shape — `ComboboxTrigger.svelte` wraps
`BC.Trigger`, `ComboboxContent.svelte` wraps `BC.Portal` + `BC.Content`
with surface tokens (`--bg-1`, `--line-2`, `--shadow-1`),
`ComboboxItem.svelte` wraps `BC.Item` with `--accent` highlight on
selected/active, `ComboboxInput.svelte` wraps `BC.Input` with the
`Input` primitive's typography.

`index.ts`:

```ts
export { default as Combobox } from './Combobox.svelte';
export { default as ComboboxTrigger } from './ComboboxTrigger.svelte';
export { default as ComboboxContent } from './ComboboxContent.svelte';
export { default as ComboboxItem } from './ComboboxItem.svelte';
export { default as ComboboxInput } from './ComboboxInput.svelte';
export type { ComboboxVariant, ComboboxSize } from './Combobox.svelte';
```

`template/src/shared/ui/index.ts` adds:

```ts
export {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxItem,
  ComboboxInput,
  type ComboboxVariant,
  type ComboboxSize,
} from './combobox';
```

/playground showcase:

```svelte
<section>
  <h2>Combobox</h2>
  {#each (['default', 'mono'] as ComboboxVariant[]) as variant}
    {#each (['sm', 'md'] as ComboboxSize[]) as size}
      <div class="tile">
        <Combobox bind:value={demoValue} {variant} {size}>
          <ComboboxTrigger>{demoValue ?? 'Pick…'}</ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput placeholder="Search…" />
            {#each demoOptions as o}
              <ComboboxItem value={o.value}>{o.label}</ComboboxItem>
            {/each}
          </ComboboxContent>
        </Combobox>
      </div>
    {/each}
  {/each}
</section>
```

The /playground page already supports theme switching (light / dark /
orch), so the 2×2 tiles render under all 3 themes via the existing
toolbar.

## Risks & Open Questions

- **R-1: bits-ui Combobox positioning** in a fixed-height bar like
  HealthBar — must use `Portal` to escape overflow contexts. The
  `ComboboxContent` wrapper bakes Portal in by default.
- **R-2: SSR-safety** — bits-ui's Combobox uses client-only state.
  Wrapper is fine in SvelteKit because it lives in `+page.svelte`
  client section; no SSR markup mismatch.
- **R-3: Type-narrowing on `value`** when options array changes —
  document that consumer is responsible (no runtime guard added).
- **R-4: Variant naming drift** — Toggle uses `outline-mono`, this
  uses `mono`. Acceptable: each primitive's variant set is independent;
  PRD-028 names exactly two.
- **OQ-1**: Should we expose a `disabled` prop? Bits-ui supports it;
  yes, forward it. (Add to FR if needed; safe additive default.)

## Implementation Phases

### Phase 1: Scaffold

- [ ] **1.1** Create folder + 5 component files + barrel.
- [ ] **1.2** Wire bits-ui imports; verify type-check passes.

### Phase 2: Variants + tokens

- [ ] **2.1** Implement `default` / `mono` variants via class chains.
- [ ] **2.2** Implement `sm` / `md` sizes.
- [ ] **2.3** Style only via CSS vars from `app.css`.

### Phase 3: /playground showcase

- [ ] **3.1** Add Combobox section to `template/src/routes/playground/
  +page.svelte`.
- [ ] **3.2** Verify across 3 themes manually.

### Phase 4: Re-export + docs

- [ ] **4.1** Add to `template/src/shared/ui/index.ts`.
- [ ] **4.2** Add row to `template/src/shared/ui/README.md`.

### Phase 5: Verify

- [ ] **5.1** Rule 24 verification snippet — 0 hits.
- [ ] **5.2** Bundle delta < 5KB.
- [ ] **5.3** axe scan on /playground Combobox section — 0 violations.

## Affected Files

- `template/src/shared/ui/combobox/*` (NEW — 5 files + barrel)
- `template/src/shared/ui/index.ts`
- `template/src/shared/ui/README.md`
- `template/src/routes/playground/+page.svelte`

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-028 | PRD | based_on |
| RFC-016 | RFC | informs (bits-ui primitives convention) |
| PRD-018 | PRD | informs (foundation) |
| PRD-029 | PRD | informs (consumer) |
| GitHub #114 | Issue | implements |

---

> **Next step**: Land alongside PRD-028. PRD-029 imports Combobox after this lands.



