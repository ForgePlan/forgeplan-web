<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'mono';
  type Size = 'sm' | 'md';

  interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
    variant?: Variant;
    size?: Size;
    children?: Snippet;
  }

  let {
    variant = 'secondary',
    size = 'sm',
    class: className,
    children,
    ...rest
  }: Props = $props();
</script>

<span class="badge variant-{variant} size-{size} {className ?? ''}" {...rest}>
  {@render children?.()}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid transparent;
    border-radius: 999px;
    font-family: var(--font-sans);
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.01em;
    white-space: nowrap;
    user-select: none;
  }

  .size-sm {
    font-size: 10px;
    padding: 2px 7px;
    height: 16px;
  }

  .size-md {
    font-size: 11px;
    padding: 3px 9px;
    height: 20px;
  }

  .variant-primary {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent);
  }

  .variant-secondary {
    background: var(--bg-2);
    border-color: var(--line-2);
    color: var(--fg-2);
  }

  .variant-success {
    background: var(--good-dim);
    border-color: var(--good);
    color: var(--good);
  }

  .variant-danger {
    background: rgba(239, 68, 68, 0.16);
    border-color: var(--bad);
    color: var(--bad);
  }

  .variant-ghost {
    background: transparent;
    border-color: var(--line-2);
    color: var(--fg-3);
  }

  .variant-mono {
    background: transparent;
    border-color: var(--line-2);
    color: var(--fg-2);
    border-radius: 0;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }
</style>
