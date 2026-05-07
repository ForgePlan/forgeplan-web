<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    width?: string | number;
    height?: string | number;
    radius?: string | number;
    inline?: boolean;
  }

  let {
    width = '100%',
    height = '1em',
    radius = 4,
    inline = false,
    class: className,
    style,
    ...rest
  }: Props = $props();

  function dim(v: string | number): string {
    return typeof v === 'number' ? `${v}px` : v;
  }

  const inlineStyle = $derived(
    [
      `width:${dim(width)}`,
      `height:${dim(height)}`,
      `border-radius:${dim(radius)}`,
      style ?? '',
    ]
      .filter(Boolean)
      .join(';'),
  );
</script>

<div
  class="skeleton {inline ? 'inline' : ''} {className ?? ''}"
  style={inlineStyle}
  aria-hidden="true"
  {...rest}
></div>

<style>
  .skeleton {
    display: block;
    background: linear-gradient(
      90deg,
      var(--bg-2) 0%,
      var(--bg-3) 50%,
      var(--bg-2) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }

  .skeleton.inline {
    display: inline-block;
    vertical-align: middle;
  }

  @keyframes skeleton-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
    }
  }
</style>
