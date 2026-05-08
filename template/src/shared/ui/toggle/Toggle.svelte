<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Toggle as TogglePrimitive } from 'bits-ui';

  type Size = 'sm' | 'md';
  type Variant = 'default' | 'outline' | 'outline-mono';

  interface Props {
    pressed?: boolean;
    onPressedChange?: (pressed: boolean) => void;
    disabled?: boolean;
    size?: Size;
    variant?: Variant;
    ariaLabel?: string;
    id?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    pressed = $bindable(false),
    onPressedChange,
    disabled = false,
    size = 'md',
    variant = 'default',
    ariaLabel,
    id,
    class: className,
    children,
  }: Props = $props();
</script>

<TogglePrimitive.Root
  bind:pressed
  {onPressedChange}
  {disabled}
  {id}
  aria-label={ariaLabel}
  class="toggle size-{size} variant-{variant} {className ?? ''}"
>
  {@render children?.()}
</TogglePrimitive.Root>

<style>
  :global(.toggle) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    color: var(--fg-2);
    font-family: var(--font-sans);
    font-weight: 500;
    line-height: 1;
    transition:
      background 120ms ease,
      color 120ms ease,
      border-color 120ms ease;
    user-select: none;
  }

  :global(.toggle.size-sm) {
    height: 22px;
    padding: 0 8px;
    font-size: 11px;
  }
  :global(.toggle.size-md) {
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
  }

  :global(.toggle.variant-outline) {
    border-color: var(--line-2);
  }

  :global(.toggle.variant-outline-mono) {
    border-color: var(--line-2);
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  :global(.toggle.variant-outline-mono[data-state='on']) {
    background: transparent;
    color: var(--accent);
    border-color: var(--accent);
  }

  :global(.toggle:hover:not([data-disabled])) {
    background: var(--bg-2);
    color: var(--fg-1);
  }

  :global(.toggle[data-state='on']) {
    background: var(--accent-dim);
    color: var(--accent);
    border-color: var(--accent);
  }

  :global(.toggle[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.toggle:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
