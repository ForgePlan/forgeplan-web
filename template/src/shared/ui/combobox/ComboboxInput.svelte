<script lang="ts">
  import { Combobox as ComboboxPrimitive } from 'bits-ui';

  interface Props {
    placeholder?: string;
    defaultValue?: string;
    clearOnDeselect?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    class?: string;
  }

  let {
    placeholder = 'Search…',
    defaultValue,
    clearOnDeselect = false,
    disabled = false,
    ariaLabel,
    class: className,
  }: Props = $props();
</script>

<ComboboxPrimitive.Input
  {placeholder}
  {defaultValue}
  {clearOnDeselect}
  {disabled}
  aria-label={ariaLabel ?? placeholder}
  class={`combobox-input ${className ?? ''}`}
/>

<style>
  :global(.combobox-input) {
    display: inline-flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    background: var(--bg);
    color: var(--fg-1);
    border: 1px solid var(--line);
    border-radius: 3px;
    line-height: 1;
    transition:
      border-color 120ms ease,
      background 120ms ease;
    outline: none;
    font: inherit;
  }
  :global(.combobox-sm .combobox-input) {
    height: 22px;
    padding: 0 8px;
  }
  :global(.combobox-md .combobox-input) {
    height: 26px;
    padding: 0 10px;
  }
  :global(.combobox-input::placeholder) {
    color: var(--fg-3);
  }
  :global(.combobox-input:hover:not(:disabled)) {
    border-color: var(--line-2);
  }
  :global(.combobox-input:focus-visible) {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-dim);
  }
  :global(.combobox-input:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--bg-2);
  }
</style>
