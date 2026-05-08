<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { Combobox as ComboboxPrimitive } from 'bits-ui';
  import Check from '@lucide/svelte/icons/check';

  type IconComponent = Component<{ size?: number | string; class?: string }>;

  interface Props {
    value: string;
    label?: string;
    disabled?: boolean;
    icon?: IconComponent;
    hint?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    value,
    label,
    disabled = false,
    icon,
    hint,
    class: className,
    children: childrenSnippet,
  }: Props = $props();
</script>

<ComboboxPrimitive.Item
  {value}
  label={label ?? value}
  {disabled}
  class={`combobox-item ${className ?? ''}`}
>
  {#snippet children({ selected })}
    <span class="combobox-item-icon" aria-hidden="true">
      {#if icon}
        {@const Icon = icon}
        <Icon size={13} />
      {/if}
    </span>
    <span class="combobox-item-label">
      {#if childrenSnippet}
        {@render childrenSnippet()}
      {:else}
        {label ?? value}
      {/if}
    </span>
    {#if hint}
      <span class="combobox-item-hint">{hint}</span>
    {/if}
    <span class="combobox-item-check" aria-hidden="true">
      {#if selected}
        <Check size={13} />
      {/if}
    </span>
  {/snippet}
</ComboboxPrimitive.Item>

<style>
  :global(.combobox-item) {
    display: grid;
    grid-template-columns: 16px 1fr auto 16px;
    align-items: center;
    column-gap: 8px;
    padding: 5px 8px;
    border-radius: 3px;
    cursor: pointer;
    user-select: none;
    color: var(--fg-1);
    outline: none;
    transition:
      background 100ms ease,
      color 100ms ease;
  }
  :global(.combobox-item[data-highlighted]) {
    background: var(--bg-2);
    color: var(--fg);
  }
  :global(.combobox-item[data-selected]) {
    color: var(--accent);
  }
  :global(.combobox-item[data-disabled]) {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
  :global(.combobox-item-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-2);
  }
  :global(.combobox-item[data-highlighted] .combobox-item-icon),
  :global(.combobox-item[data-selected] .combobox-item-icon) {
    color: inherit;
  }
  :global(.combobox-item-label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.combobox-item-hint) {
    color: var(--fg-3);
    font-size: 0.85em;
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 12px;
  }
  :global(.combobox-item-check) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
  }
</style>
