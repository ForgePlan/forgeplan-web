<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover as PopoverPrimitive } from 'bits-ui';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<PopoverPrimitive.Trigger class="popover-trigger {className ?? ''}">
  {@render children?.()}
</PopoverPrimitive.Trigger>

<style>
  :global(.popover-trigger) {
    background: transparent;
    border: none;
    padding: 0;
    cursor: inherit;
    color: inherit;
    font: inherit;
    display: inline-flex;
  }
</style>
