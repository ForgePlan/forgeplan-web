<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  type Size = 'sm' | 'md' | 'lg';

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    size?: Size;
    label?: string;
  }

  let {
    size = 'md',
    label = 'Loading…',
    class: className,
    ...rest
  }: Props = $props();
</script>

<span
  class="spinner size-{size} {className ?? ''}"
  role="status"
  aria-label={label}
  {...rest}
>
  <span class="ring"></span>
</span>

<style>
  .spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-2);
  }

  .ring {
    display: block;
    border-radius: 50%;
    border: 2px solid var(--line-2);
    border-top-color: currentColor;
    animation: spinner-spin 0.7s linear infinite;
  }

  .size-sm .ring {
    width: 12px;
    height: 12px;
    border-width: 2px;
  }

  .size-md .ring {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  .size-lg .ring {
    width: 24px;
    height: 24px;
    border-width: 3px;
  }

  @keyframes spinner-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring {
      animation-duration: 2s;
    }
  }
</style>
