<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tabs as TabsPrimitive } from 'bits-ui';

  interface Props {
    value: string;
    disabled?: boolean;
    class?: string;
    children?: Snippet;
  }

  let { value, disabled = false, class: className, children }: Props = $props();
</script>

<TabsPrimitive.Trigger
  {value}
  {disabled}
  class="tabs-trigger {className ?? ''}"
>
  {@render children?.()}
</TabsPrimitive.Trigger>

<style>
  :global(.tabs-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--fg-2);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition:
      color 120ms ease,
      border-color 120ms ease;
    margin-bottom: -1px;
  }

  :global(.tabs-trigger:hover:not([data-disabled])) {
    color: var(--fg-1);
  }

  :global(.tabs-trigger[data-state='active']) {
    color: var(--fg);
    border-bottom-color: var(--accent);
  }

  :global(.tabs-trigger[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.tabs-trigger:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  :global(.tabs.orient-vertical .tabs-trigger) {
    justify-content: flex-start;
    border-bottom: none;
    border-right: 2px solid transparent;
    margin-bottom: 0;
    margin-right: -1px;
  }

  :global(.tabs.orient-vertical .tabs-trigger[data-state='active']) {
    border-bottom: none;
    border-right-color: var(--accent);
  }
</style>
