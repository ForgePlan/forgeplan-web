<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'success' | 'warning' | 'danger';
  type Size = 'sm' | 'md';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    value?: number | null;
    max?: number;
    variant?: Variant;
    size?: Size;
    label?: string;
  }

  let {
    value = null,
    max = 100,
    variant = 'primary',
    size = 'md',
    label,
    class: className,
    ...rest
  }: Props = $props();

  const indeterminate = $derived(value === null);
  const clamped = $derived(
    indeterminate ? 0 : Math.max(0, Math.min(max, value as number)),
  );
  const pct = $derived(indeterminate ? 0 : (clamped / max) * 100);
</script>

<div
  class="progress variant-{variant} size-{size} {className ?? ''}"
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={indeterminate ? undefined : clamped}
  aria-label={label}
  data-indeterminate={indeterminate ? '' : undefined}
  {...rest}
>
  <div class="bar" style="width: {indeterminate ? 100 : pct}%"></div>
</div>

<style>
  .progress {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: var(--bg-2);
    border-radius: 999px;
  }

  .size-sm {
    height: 4px;
  }
  .size-md {
    height: 6px;
  }

  .bar {
    height: 100%;
    border-radius: inherit;
    transition: width 200ms ease;
  }

  .variant-primary .bar {
    background: var(--accent);
  }
  .variant-success .bar {
    background: var(--good);
  }
  .variant-warning .bar {
    background: var(--accent);
  }
  .variant-danger .bar {
    background: var(--bad);
  }

  .progress[data-indeterminate] .bar {
    width: 40% !important;
    animation: progress-indeterminate 1.4s ease-in-out infinite;
  }

  @keyframes progress-indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(250%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress[data-indeterminate] .bar {
      animation: none;
      width: 100% !important;
      opacity: 0.5;
    }
  }
</style>
