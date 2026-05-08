<script lang="ts">
  import { Checkbox as CheckboxPrimitive } from 'bits-ui';
  import Check from '@lucide/svelte/icons/check';
  import Minus from '@lucide/svelte/icons/minus';

  interface Props {
    checked?: boolean;
    indeterminate?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    onIndeterminateChange?: (indeterminate: boolean) => void;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    value?: string;
    ariaLabel?: string;
    id?: string;
    class?: string;
  }

  let {
    checked = $bindable(false),
    indeterminate = $bindable(false),
    onCheckedChange,
    onIndeterminateChange,
    disabled = false,
    required = false,
    name,
    value,
    ariaLabel,
    id,
    class: className,
  }: Props = $props();
</script>

<CheckboxPrimitive.Root
  bind:checked
  bind:indeterminate
  {onCheckedChange}
  {onIndeterminateChange}
  {disabled}
  {required}
  {name}
  {value}
  {id}
  aria-label={ariaLabel}
  class="checkbox {className ?? ''}"
>
  {#snippet children({ checked: c, indeterminate: ind })}
    {#if ind}
      <Minus size={11} />
    {:else if c}
      <Check size={11} />
    {/if}
  {/snippet}
</CheckboxPrimitive.Root>

<style>
  :global(.checkbox) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    box-sizing: border-box;
    background: var(--bg-1);
    color: transparent;
    border: 1px solid var(--line-3);
    border-radius: 3px;
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    flex-shrink: 0;
  }

  :global(.checkbox:hover:not([data-disabled])) {
    border-color: var(--line-3);
    background: var(--bg-2);
  }

  :global(.checkbox[data-state='checked']),
  :global(.checkbox[data-state='indeterminate']) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }

  :global(.checkbox[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.checkbox:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
