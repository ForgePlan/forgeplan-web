<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip as TooltipPrimitive } from 'bits-ui';

  type Side = 'top' | 'right' | 'bottom' | 'left';
  type Align = 'start' | 'center' | 'end';

  interface Props {
    label: string;
    side?: Side;
    align?: Align;
    sideOffset?: number;
    delayDuration?: number;
    disabled?: boolean;
    children?: Snippet;
  }

  let {
    label,
    side = 'top',
    align = 'center',
    sideOffset = 4,
    delayDuration = 300,
    disabled = false,
    children,
  }: Props = $props();
</script>

<TooltipPrimitive.Root {delayDuration} {disabled}>
  <TooltipPrimitive.Trigger class="tooltip-trigger">
    {@render children?.()}
  </TooltipPrimitive.Trigger>
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      {side}
      {align}
      {sideOffset}
      class="tooltip-content"
    >
      {label}
      <TooltipPrimitive.Arrow class="tooltip-arrow" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
</TooltipPrimitive.Root>

<style>
  :global(.tooltip-trigger) {
    display: inline-flex;
    background: transparent;
    border: none;
    padding: 0;
    cursor: inherit;
    color: inherit;
    font: inherit;
  }

  :global(.tooltip-content) {
    background: var(--bg-3);
    color: var(--fg-1);
    border: 1px solid var(--line-2);
    border-radius: 4px;
    padding: 4px 8px;
    font-family: var(--font-sans);
    font-size: 11px;
    line-height: 1.3;
    max-width: 240px;
    box-shadow: var(--shadow-mini);
    z-index: 1100;
  }

  :global(.tooltip-arrow) {
    fill: var(--bg-3);
    stroke: var(--line-2);
  }
</style>
