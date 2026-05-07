<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tabs as TabsPrimitive } from 'bits-ui';

  type Orientation = 'horizontal' | 'vertical';
  type ActivationMode = 'manual' | 'automatic';

  interface Props {
    value?: string;
    onValueChange?: (next: string) => void;
    orientation?: Orientation;
    activationMode?: ActivationMode;
    disabled?: boolean;
    id?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    value = $bindable(''),
    onValueChange,
    orientation = 'horizontal',
    activationMode = 'automatic',
    disabled = false,
    id,
    class: className,
    children,
  }: Props = $props();
</script>

<TabsPrimitive.Root
  bind:value
  {onValueChange}
  {orientation}
  {activationMode}
  {disabled}
  {id}
  class="tabs orient-{orientation} {className ?? ''}"
>
  {@render children?.()}
</TabsPrimitive.Root>

<style>
  :global(.tabs) {
    display: flex;
  }

  :global(.tabs.orient-horizontal) {
    flex-direction: column;
  }

  :global(.tabs.orient-vertical) {
    flex-direction: row;
  }
</style>
