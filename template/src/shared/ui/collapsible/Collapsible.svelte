<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Collapsible as CollapsiblePrimitive } from 'bits-ui';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
    class?: string;
    children?: Snippet;
  }

  let {
    open = $bindable(false),
    onOpenChange,
    disabled = false,
    class: className,
    children,
  }: Props = $props();
</script>

<CollapsiblePrimitive.Root
  bind:open
  {onOpenChange}
  {disabled}
  class="collapsible {className ?? ''}"
>
  {@render children?.()}
</CollapsiblePrimitive.Root>

<style>
  :global(.collapsible) {
    display: block;
    width: 100%;
  }
</style>
