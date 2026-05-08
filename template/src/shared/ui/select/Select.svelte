<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { Select as SelectPrimitive } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';

  type IconComponent = Component<{ size?: number | string; class?: string }>;

  export interface SelectItem {
    value: string;
    label: string;
    icon?: IconComponent;
    hint?: string;
    disabled?: boolean;
  }

  interface Props {
    value: string;
    items: SelectItem[];
    onValueChange: (next: string) => void;
    placeholder?: string;
    title?: string;
    ariaLabel?: string;
    fullWidth?: boolean;
    triggerSnippet?: Snippet<[SelectItem | undefined]>;
  }

  let {
    value,
    items,
    onValueChange,
    placeholder = 'Select…',
    title,
    ariaLabel,
    fullWidth = true,
    triggerSnippet,
  }: Props = $props();

  const active = $derived(items.find((it) => it.value === value));

  function handleValueChange(next: string) {
    if (next === value) return;
    onValueChange(next);
  }
</script>

<SelectPrimitive.Root
  type="single"
  {value}
  onValueChange={handleValueChange}
  {items}
>
  <SelectPrimitive.Trigger
    class="select-trigger"
    aria-label={ariaLabel ?? title ?? placeholder}
    {title}
    data-full-width={fullWidth ? '' : undefined}
  >
    {#if triggerSnippet}
      {@render triggerSnippet(active)}
    {:else}
      <span class="select-trigger-content">
        {#if active?.icon}
          {@const Icon = active.icon}
          <Icon size={13} class="select-icon" />
        {/if}
        <span class="select-trigger-label">{active?.label ?? placeholder}</span>
      </span>
    {/if}
    <ChevronDown size={14} class="select-chevron" />
  </SelectPrimitive.Trigger>

  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      class="select-content"
      sideOffset={4}
    >
      <SelectPrimitive.Viewport class="select-viewport">
        {#each items as item (item.value)}
          <SelectPrimitive.Item
            class="select-item"
            value={item.value}
            label={item.label}
            disabled={item.disabled}
          >
            {#snippet children({ selected })}
              <span class="select-item-icon" aria-hidden="true">
                {#if item.icon}
                  {@const Icon = item.icon}
                  <Icon size={13} />
                {/if}
              </span>
              <span class="select-item-label">{item.label}</span>
              {#if item.hint}
                <span class="select-item-hint">{item.hint}</span>
              {/if}
              <span class="select-item-check" aria-hidden="true">
                {#if selected}
                  <Check size={13} />
                {/if}
              </span>
            {/snippet}
          </SelectPrimitive.Item>
        {/each}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
</SelectPrimitive.Root>

<style>
  :global(.select-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--line-2);
    border-radius: 3px;
    color: var(--fg-1);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1;
    padding: 3px 6px 3px 8px;
    height: 22px;
    cursor: pointer;
    user-select: none;
    transition:
      border-color 120ms ease,
      color 120ms ease,
      background 120ms ease;
  }
  :global(.select-trigger[data-full-width]) {
    width: 100%;
  }
  :global(.select-trigger:hover:not([data-disabled])) {
    border-color: var(--line-3);
    color: var(--fg);
  }
  :global(.select-trigger:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  :global(.select-trigger[data-state='open']) {
    border-color: var(--accent);
    color: var(--fg);
  }
  :global(.select-trigger[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.select-trigger-content) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
  }
  :global(.select-trigger-label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1 1 auto;
    text-align: left;
  }
  :global(.select-icon) {
    flex: 0 0 auto;
    color: var(--fg-2);
  }
  :global(.select-chevron) {
    flex: 0 0 auto;
    color: var(--fg-3);
    transition: transform 140ms ease;
  }
  :global(.select-trigger[data-state='open'] .select-chevron) {
    transform: rotate(180deg);
    color: var(--accent);
  }

  :global(.select-content) {
    z-index: 60;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 4px;
    box-shadow: var(--shadow-card);
    padding: 4px;
    min-width: var(--bits-select-anchor-width, 200px);
    max-height: min(var(--bits-select-content-available-height, 320px), 320px);
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-1);
    outline: none;
  }

  :global(.select-viewport) {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
    max-height: inherit;
  }

  :global(.select-item) {
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
  :global(.select-item[data-highlighted]) {
    background: var(--bg-2);
    color: var(--fg);
  }
  :global(.select-item[data-selected]) {
    color: var(--accent);
  }
  :global(.select-item[data-disabled]) {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
  :global(.select-item-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-2);
  }
  :global(.select-item[data-highlighted] .select-item-icon),
  :global(.select-item[data-selected] .select-item-icon) {
    color: inherit;
  }
  :global(.select-item-label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.select-item-hint) {
    color: var(--fg-3);
    font-size: 10px;
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 12px;
  }
  :global(.select-item-check) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
  }
</style>
