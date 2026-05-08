<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Combobox as ComboboxPrimitive } from 'bits-ui';

  type Side = 'top' | 'right' | 'bottom' | 'left';
  type Align = 'start' | 'center' | 'end';

  interface Props {
    side?: Side;
    align?: Align;
    sideOffset?: number;
    class?: string;
    children?: Snippet;
  }

  let {
    side = 'bottom',
    align = 'start',
    sideOffset = 4,
    class: className,
    children,
  }: Props = $props();
</script>

<ComboboxPrimitive.Portal>
  <ComboboxPrimitive.Content
    {side}
    {align}
    {sideOffset}
    class={`combobox-content ${className ?? ''}`}
  >
    <ComboboxPrimitive.Viewport class="combobox-viewport">
      {@render children?.()}
    </ComboboxPrimitive.Viewport>
  </ComboboxPrimitive.Content>
</ComboboxPrimitive.Portal>

<style>
  :global(.combobox-content) {
    z-index: 60;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 4px;
    box-shadow: var(--shadow-card);
    padding: 4px;
    min-width: var(--bits-combobox-anchor-width, 220px);
    max-height: min(var(--bits-combobox-content-available-height, 320px), 320px);
    overflow: hidden;
    color: var(--fg-1);
    outline: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font: inherit;
  }

  :global(.combobox-viewport) {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
    max-height: inherit;
  }
</style>
