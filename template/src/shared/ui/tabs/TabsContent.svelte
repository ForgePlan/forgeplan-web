<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tabs as TabsPrimitive } from 'bits-ui';

  interface Props {
    value: string;
    class?: string;
    children?: Snippet;
  }

  let { value, class: className, children }: Props = $props();
</script>

<TabsPrimitive.Content
  {value}
  class="tabs-content {className ?? ''}"
>
  {@render children?.()}
</TabsPrimitive.Content>

<style>
  :global(.tabs-content) {
    padding: 12px 0;
    flex: 1;
    min-width: 0;
  }

  :global(.tabs.orient-vertical .tabs-content) {
    padding: 0 16px;
  }

  :global(.tabs-content:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
</style>
