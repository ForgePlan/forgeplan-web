<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';

  interface Props {
    value: string;
    disabled?: boolean;
    ariaLabel?: string;
    role?: string;
    'aria-checked'?: boolean | 'true' | 'false';
    class?: string;
    children?: Snippet;
  }

  let {
    value,
    disabled = false,
    ariaLabel,
    role,
    'aria-checked': ariaChecked,
    class: className,
    children,
  }: Props = $props();
</script>

<ToggleGroupPrimitive.Item
  {value}
  {disabled}
  aria-label={ariaLabel}
  role={role}
  aria-checked={ariaChecked}
  class="toggle-group-item {className ?? ''}"
>
  {@render children?.()}
</ToggleGroupPrimitive.Item>

<style>
  :global(.toggle-group-item) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 22px;
    padding: 0 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--fg-2);
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease;
    user-select: none;
  }

  :global(.toggle-group.size-md .toggle-group-item) {
    height: 26px;
    padding: 0 12px;
    font-size: 12px;
  }

  :global(.toggle-group-item:hover:not([data-disabled])) {
    color: var(--fg-1);
  }

  :global(.toggle-group-item[data-state='on']) {
    background: var(--bg-1);
    color: var(--fg);
    border-color: var(--line-2);
  }

  :global(.toggle-group-item[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.toggle-group-item:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  :global(.toggle-group.variant-outline-mono .toggle-group-item) {
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: 0;
  }
  :global(.toggle-group.variant-outline-mono .toggle-group-item[data-state='on']) {
    background: transparent;
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
