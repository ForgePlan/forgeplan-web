<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover as PopoverPrimitive } from 'bits-ui';

  type Side = 'top' | 'right' | 'bottom' | 'left';
  type Align = 'start' | 'center' | 'end';

  interface Props {
    side?: Side;
    align?: Align;
    sideOffset?: number;
    showArrow?: boolean;
    class?: string;
    children?: Snippet;
  }

  let {
    side = 'bottom',
    align = 'center',
    sideOffset = 6,
    showArrow = false,
    class: className,
    children,
  }: Props = $props();
</script>

<PopoverPrimitive.Portal>
  <PopoverPrimitive.Content
    {side}
    {align}
    {sideOffset}
    class="popover-content {className ?? ''}"
  >
    {@render children?.()}
    {#if showArrow}
      <PopoverPrimitive.Arrow class="popover-arrow" />
    {/if}
  </PopoverPrimitive.Content>
</PopoverPrimitive.Portal>

<style>
  :global(.popover-content) {
    background: var(--bg-1);
    color: var(--fg-1);
    border: 1px solid var(--line-2);
    border-radius: 6px;
    padding: 10px 12px;
    font-family: var(--font-sans);
    font-size: 12px;
    box-shadow: var(--shadow-card);
    min-width: 160px;
    max-width: 360px;
    z-index: 1100;
  }

  :global(.popover-arrow) {
    fill: var(--bg-1);
    stroke: var(--line-2);
  }
</style>
