<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'secondary' | 'ghost';
  type Size = 'sm' | 'md';

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    variant?: Variant;
    size?: Size;
    children?: Snippet;
  }

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    class: className,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  {type}
  class="btn variant-{variant} size-{size} {className ?? ''}"
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    font-family: var(--font-sans);
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    white-space: nowrap;
    user-select: none;
  }

  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .size-sm {
    font-size: 11px;
    padding: 4px 8px;
    height: 22px;
  }

  .size-md {
    font-size: 12px;
    padding: 6px 12px;
    height: 28px;
  }

  .variant-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #0b0b0b;
  }
  .variant-primary:hover:not(:disabled) {
    background: var(--accent-soft);
    border-color: var(--accent-soft);
  }

  .variant-secondary {
    background: var(--bg-2);
    border-color: var(--line-2);
    color: var(--fg-1);
  }
  .variant-secondary:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--line-3);
  }

  .variant-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--fg-2);
  }
  .variant-ghost:hover:not(:disabled) {
    background: var(--bg-2);
    color: var(--fg-1);
  }
</style>
