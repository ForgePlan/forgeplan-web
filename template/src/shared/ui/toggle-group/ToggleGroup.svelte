<script lang="ts" generics="T extends 'single' | 'multiple'">
  import type { Snippet } from 'svelte';
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';

  type Size = 'sm' | 'md';
  type Orientation = 'horizontal' | 'vertical';

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
    ariaLabel,
    class: className,
    children,
  }: Props = $props();
</script>

{#if type === 'single'}
  <ToggleGroupPrimitive.Root
    type="single"
    bind:value={value as string}
    onValueChange={onValueChange as (v: string) => void}
    {disabled}
    {orientation}
    aria-label={ariaLabel}
    class="toggle-group orient-{orientation} size-{size} {className ?? ''}"
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
    class="toggle-group orient-{orientation} size-{size} {className ?? ''}"
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
</style>
