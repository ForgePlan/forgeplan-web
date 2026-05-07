<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  type Orientation = 'horizontal' | 'vertical';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    orientation?: Orientation;
    decorative?: boolean;
  }

  let {
    orientation = 'horizontal',
    decorative = true,
    class: className,
    ...rest
  }: Props = $props();
</script>

<div
  class="separator {orientation} {className ?? ''}"
  role={decorative ? 'none' : 'separator'}
  aria-orientation={decorative ? undefined : orientation}
  {...rest}
></div>

<style>
  .separator {
    background: var(--line-2);
    flex-shrink: 0;
  }

  .horizontal {
    width: 100%;
    height: 1px;
  }

  .vertical {
    width: 1px;
    height: 100%;
    align-self: stretch;
  }
</style>
