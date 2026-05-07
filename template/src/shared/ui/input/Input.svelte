<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Size = 'sm' | 'md';

  interface Props extends Omit<HTMLInputAttributes, 'size'> {
    inputSize?: Size;
    invalid?: boolean;
  }

  let {
    inputSize = 'md',
    invalid = false,
    type = 'text',
    class: className,
    value = $bindable(),
    ...rest
  }: Props = $props();
</script>

<input
  {type}
  bind:value
  class="input size-{inputSize} {className ?? ''}"
  data-invalid={invalid ? '' : undefined}
  aria-invalid={invalid ? 'true' : undefined}
  {...rest}
/>

<style>
  .input {
    display: inline-flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-1);
    color: var(--fg-1);
    border: 1px solid var(--line-2);
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: 12px;
    line-height: 1;
    transition:
      border-color 120ms ease,
      background 120ms ease;
    outline: none;
  }

  .size-sm {
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
  }

  .size-md {
    height: 28px;
    padding: 0 10px;
    font-size: 12px;
  }

  .input::placeholder {
    color: var(--fg-3);
  }

  .input:hover:not(:disabled) {
    border-color: var(--line-3);
  }

  .input:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-dim);
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--bg-2);
  }

  .input[data-invalid] {
    border-color: var(--bad);
  }
  .input[data-invalid]:focus-visible {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
  }
</style>
