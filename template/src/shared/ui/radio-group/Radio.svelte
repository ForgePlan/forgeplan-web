<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';

  interface Props {
    value: string;
    disabled?: boolean;
    id?: string;
    ariaLabel?: string;
    class?: string;
  }

  let {
    value,
    disabled = false,
    id,
    ariaLabel,
    class: className,
  }: Props = $props();
</script>

<RadioGroupPrimitive.Item
  {value}
  {disabled}
  {id}
  aria-label={ariaLabel}
  class="radio {className ?? ''}"
>
  <span class="radio-dot"></span>
</RadioGroupPrimitive.Item>

<style>
  :global(.radio) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    box-sizing: border-box;
    background: var(--bg-1);
    border: 1px solid var(--line-3);
    border-radius: 50%;
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease;
    flex-shrink: 0;
  }

  :global(.radio:hover:not([data-disabled])) {
    background: var(--bg-2);
  }

  :global(.radio[data-state='checked']) {
    border-color: var(--accent);
  }

  :global(.radio[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.radio:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  :global(.radio-dot) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: transparent;
    transition: background 120ms ease;
  }

  :global(.radio[data-state='checked'] .radio-dot) {
    background: var(--accent);
  }
</style>
