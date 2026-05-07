<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Padding = 'none' | 'sm' | 'md' | 'lg';
  type Variant = 'flat' | 'elevated' | 'outlined';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    padding?: Padding;
    variant?: Variant;
    children?: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }

  let {
    padding = 'md',
    variant = 'outlined',
    class: className,
    children,
    header,
    footer,
    ...rest
  }: Props = $props();
</script>

<div class="card variant-{variant} {className ?? ''}" {...rest}>
  {#if header}
    <div class="card-header pad-{padding}">{@render header()}</div>
  {/if}
  <div class="card-body pad-{padding}">
    {@render children?.()}
  </div>
  {#if footer}
    <div class="card-footer pad-{padding}">{@render footer()}</div>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--bg-1);
    border-radius: 6px;
    color: var(--fg-1);
  }

  .variant-flat {
    background: var(--bg-2);
    border: 1px solid transparent;
  }

  .variant-outlined {
    background: var(--bg-1);
    border: 1px solid var(--line-2);
  }

  .variant-elevated {
    background: var(--bg-1);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-mini);
  }

  .card-header {
    border-bottom: 1px solid var(--line);
    font-weight: 500;
    color: var(--fg-1);
  }

  .card-footer {
    border-top: 1px solid var(--line);
    color: var(--fg-2);
  }

  .pad-none {
    padding: 0;
  }
  .pad-sm {
    padding: 8px 10px;
  }
  .pad-md {
    padding: 12px 14px;
  }
  .pad-lg {
    padding: 16px 20px;
  }
</style>
