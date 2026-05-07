<script lang="ts">
  import type { Snippet } from 'svelte';
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';

  type Orientation = 'horizontal' | 'vertical';

  interface Props {
    value?: string;
    onValueChange?: (next: string) => void;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    orientation?: Orientation;
    ariaLabel?: string;
    id?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    value = $bindable(''),
    onValueChange,
    disabled = false,
    required = false,
    name,
    orientation = 'vertical',
    ariaLabel,
    id,
    class: className,
    children,
  }: Props = $props();
</script>

<RadioGroupPrimitive.Root
  bind:value
  {onValueChange}
  {disabled}
  {required}
  {name}
  {orientation}
  {id}
  aria-label={ariaLabel}
  class="radio-group orient-{orientation} {className ?? ''}"
>
  {@render children?.()}
</RadioGroupPrimitive.Root>

<style>
  :global(.radio-group) {
    display: inline-flex;
    gap: 8px;
  }

  :global(.radio-group.orient-vertical) {
    flex-direction: column;
  }

  :global(.radio-group.orient-horizontal) {
    flex-direction: row;
    align-items: center;
  }
</style>
