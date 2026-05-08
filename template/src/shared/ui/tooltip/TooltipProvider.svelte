<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip as TooltipPrimitive } from 'bits-ui';

  interface Props {
    delayDuration?: number;
    skipDelayDuration?: number;
    disableHoverableContent?: boolean;
    children?: Snippet;
  }

  let {
    delayDuration = 300,
    skipDelayDuration = 100,
    disableHoverableContent = false,
    children,
  }: Props = $props();
</script>

<TooltipPrimitive.Provider
  {delayDuration}
  {skipDelayDuration}
  {disableHoverableContent}
>
  {@render children?.()}
</TooltipPrimitive.Provider>
