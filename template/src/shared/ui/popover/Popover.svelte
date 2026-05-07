<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover as PopoverPrimitive } from 'bits-ui';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    modal?: boolean;
    class?: string;
    children?: Snippet;
  }

  let {
    open = $bindable(false),
    onOpenChange,
    children,
  }: Props = $props();
</script>

<PopoverPrimitive.Root bind:open {onOpenChange}>
  {@render children?.()}
</PopoverPrimitive.Root>
