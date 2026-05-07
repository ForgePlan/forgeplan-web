<script lang="ts" generics="T extends 'single' | 'multiple'">
  import type { Snippet } from 'svelte';
  import { Accordion as AccordionPrimitive } from 'bits-ui';

  type Orientation = 'horizontal' | 'vertical';
  type ValueOf<TT extends 'single' | 'multiple'> = TT extends 'single'
    ? string
    : string[];

  interface Props {
    type: T;
    value?: ValueOf<T>;
    onValueChange?: (next: ValueOf<T>) => void;
    disabled?: boolean;
    orientation?: Orientation;
    class?: string;
    children?: Snippet;
  }

  let {
    type,
    value = $bindable(),
    onValueChange,
    disabled = false,
    orientation = 'vertical',
    class: className,
    children,
  }: Props = $props();
</script>

{#if type === 'single'}
  <AccordionPrimitive.Root
    type="single"
    bind:value={value as string}
    onValueChange={onValueChange as (v: string) => void}
    {disabled}
    {orientation}
    class="accordion {className ?? ''}"
  >
    {@render children?.()}
  </AccordionPrimitive.Root>
{:else}
  <AccordionPrimitive.Root
    type="multiple"
    bind:value={value as string[]}
    onValueChange={onValueChange as (v: string[]) => void}
    {disabled}
    {orientation}
    class="accordion {className ?? ''}"
  >
    {@render children?.()}
  </AccordionPrimitive.Root>
{/if}

<style>
  :global(.accordion) {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-1);
  }
</style>
