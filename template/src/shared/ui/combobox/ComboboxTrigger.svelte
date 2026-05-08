<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Combobox as ComboboxPrimitive } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  interface Props {
    class?: string;
    ariaLabel?: string;
    title?: string;
    fullWidth?: boolean;
    children?: Snippet;
  }

  let {
    class: className,
    ariaLabel,
    title,
    fullWidth = false,
    children,
  }: Props = $props();
</script>

<ComboboxPrimitive.Trigger
  class={`combobox-trigger ${className ?? ''}`}
  aria-label={ariaLabel}
  {title}
  data-full-width={fullWidth ? '' : undefined}
>
  <span class="combobox-trigger-content">
    {@render children?.()}
  </span>
  <ChevronDown size={14} class="combobox-chevron" />
</ComboboxPrimitive.Trigger>

<style>
  :global(.combobox-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 3px;
    color: var(--fg-1);
    line-height: 1;
    cursor: pointer;
    user-select: none;
    transition:
      border-color 120ms ease,
      color 120ms ease,
      background 120ms ease;
    font: inherit;
  }
  :global(.combobox-sm .combobox-trigger) {
    padding: 3px 6px 3px 8px;
    height: 22px;
  }
  :global(.combobox-md .combobox-trigger) {
    padding: 4px 8px 4px 10px;
    height: 26px;
  }
  :global(.combobox-trigger[data-full-width]) {
    width: 100%;
  }
  :global(.combobox-trigger:hover:not([data-disabled])) {
    border-color: var(--line-3);
    color: var(--fg);
  }
  :global(.combobox-trigger:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  :global(.combobox-trigger[data-state='open']) {
    border-color: var(--accent);
    color: var(--fg);
  }
  :global(.combobox-trigger[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }
  :global(.combobox-trigger-content) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.combobox-chevron) {
    flex: 0 0 auto;
    color: var(--fg-3);
    transition: transform 140ms ease;
  }
  :global(.combobox-trigger[data-state='open'] .combobox-chevron) {
    transform: rotate(180deg);
    color: var(--accent);
  }
</style>
