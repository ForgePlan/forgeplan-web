<script lang="ts" generics="T extends 'single' | 'multiple'">
  import type { Snippet } from 'svelte';
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';

  type Size = 'sm' | 'md';
  type Orientation = 'horizontal' | 'vertical';
  type Variant = 'default' | 'outline-mono' | 'outline';

  type ValueOf<TT extends 'single' | 'multiple'> = TT extends 'single'
    ? string
    : string[];

  interface Props {
    type: T;
    value?: ValueOf<T>;
    onValueChange?: (next: ValueOf<T>) => void;
    disabled?: boolean;
    orientation?: Orientation;
    size?: Size;
    variant?: Variant;
    spacing?: boolean;
    ariaLabel?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    type,
    value = $bindable(),
    onValueChange,
    disabled = false,
    orientation = 'horizontal',
    size = 'md',
    variant = 'default',
    spacing = false,
    ariaLabel,
    class: className,
    children,
  }: Props = $props();

  const rootClass = $derived(
    `toggle-group orient-${orientation} size-${size} variant-${variant} ${className ?? ''}`,
  );
  const dataSpacing = $derived(spacing ? 'true' : undefined);
</script>

{#if type === 'single'}
  <ToggleGroupPrimitive.Root
    type="single"
    bind:value={value as string}
    onValueChange={onValueChange as (v: string) => void}
    {disabled}
    {orientation}
    aria-label={ariaLabel}
    data-spacing={dataSpacing}
    class={rootClass}
  >
    {@render children?.()}
  </ToggleGroupPrimitive.Root>
{:else}
  <ToggleGroupPrimitive.Root
    type="multiple"
    bind:value={value as string[]}
    onValueChange={onValueChange as (v: string[]) => void}
    {disabled}
    {orientation}
    aria-label={ariaLabel}
    data-spacing={dataSpacing}
    class={rootClass}
  >
    {@render children?.()}
  </ToggleGroupPrimitive.Root>
{/if}

<style>
  :global(.toggle-group) {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: 5px;
    padding: 2px;
  }

  :global(.toggle-group.orient-vertical) {
    flex-direction: column;
  }

  :global(.toggle-group.variant-outline-mono) {
    background: transparent;
    border-color: var(--line-2);
    padding: 0;
    border-radius: 3px;
    gap: 0;
  }

  :global(.toggle-group.variant-outline) {
    background: transparent;
    border: none;
    padding: 0;
    border-radius: 0;
    gap: 2px;
  }

  :global(.toggle-group[data-spacing='true']) {
    background: transparent;
    border: none;
    padding: 0;
    gap: 6px;
    flex-wrap: wrap;
  }

  :global(.toggle-group.orient-vertical[data-spacing='true']) {
    flex-wrap: nowrap;
  }
</style>
