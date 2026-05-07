<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tabs as TabsPrimitive } from 'bits-ui';

  interface Props {
    class?: string;
    ariaLabel?: string;
    wrap?: boolean;
    children?: Snippet;
  }

  let { class: className, ariaLabel, wrap = false, children }: Props = $props();
</script>

<TabsPrimitive.List
  class="tabs-list {wrap ? 'wrap' : ''} {className ?? ''}"
  aria-label={ariaLabel}
>
  {@render children?.()}
</TabsPrimitive.List>

<style>
  :global(.tabs-list) {
    display: inline-flex;
    align-items: center;
    gap: 0;
    border-bottom: 1px solid var(--line-2);
  }

  :global(.tabs-list.wrap) {
    flex-wrap: wrap;
  }

  :global(.tabs.orient-vertical .tabs-list) {
    flex-direction: column;
    align-items: stretch;
    border-bottom: none;
    border-right: 1px solid var(--line-2);
  }
</style>
