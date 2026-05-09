<script lang="ts" module>
  export type ComboboxVariant = 'default' | 'mono' | 'ghost';
  export type ComboboxSize = 'sm' | 'md';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Combobox as ComboboxPrimitive } from 'bits-ui';

  interface Props {
    value?: string;
    open?: boolean;
    inputValue?: string;
    onValueChange?: (next: string) => void;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
    name?: string;
    required?: boolean;
    variant?: ComboboxVariant;
    size?: ComboboxSize;
    class?: string;
    ariaLabel?: string;
    children?: Snippet;
  }

  let {
    value = $bindable(''),
    open = $bindable(false),
    inputValue = '',
    onValueChange,
    onOpenChange,
    disabled = false,
    name,
    required = false,
    variant = 'default',
    size = 'md',
    class: className,
    ariaLabel,
    children,
  }: Props = $props();

  const rootClass = $derived(
    `combobox combobox-${variant} combobox-${size} ${className ?? ''}`,
  );

  function handleValueChange(next: string) {
    if (next === value) return;
    onValueChange?.(next);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange?.(next);
  }
</script>

<div class={rootClass} aria-label={ariaLabel}>
  <ComboboxPrimitive.Root
    type="single"
    bind:value
    bind:open
    {inputValue}
    onValueChange={handleValueChange}
    onOpenChange={handleOpenChange}
    {disabled}
    {name}
    {required}
  >
    {@render children?.()}
  </ComboboxPrimitive.Root>
</div>

<style>
  :global(.combobox) {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }
  :global(.combobox-mono) {
    font-family: var(--font-mono);
    letter-spacing: 0.02em;
  }
  :global(.combobox-sm) {
    font-size: 11px;
  }
  :global(.combobox-md) {
    font-size: 13px;
  }
  :global(.combobox-ghost) {
    font-family: var(--font-mono);
    letter-spacing: 0.02em;
  }
</style>
