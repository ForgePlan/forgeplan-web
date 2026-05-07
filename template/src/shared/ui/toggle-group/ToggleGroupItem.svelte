<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';

  interface Props {
    value: string;
    disabled?: boolean;
    ariaLabel?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    value,
    disabled = false,
    ariaLabel,
    class: className,
    children,
  }: Props = $props();
</script>

<ToggleGroupPrimitive.Item
  {value}
  {disabled}
  aria-label={ariaLabel}
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
</style>
