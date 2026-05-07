<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Command as CommandPrimitive } from 'bits-ui';

  interface Props {
    value?: string;
    onValueChange?: (next: string) => void;
    label?: string;
    loop?: boolean;
    shouldFilter?: boolean;
    class?: string;
    children?: Snippet;
  }

  let {
    value = $bindable(''),
    onValueChange,
    label,
    loop = true,
    shouldFilter = true,
    class: className,
    children,
  }: Props = $props();
</script>

<CommandPrimitive.Root
  bind:value
  {onValueChange}
  {label}
  {loop}
  {shouldFilter}
  class="command {className ?? ''}"
>
  {@render children?.()}
</CommandPrimitive.Root>

<style>
  :global(.command) {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 6px;
    overflow: hidden;
    color: var(--fg-1);
    font-family: var(--font-sans);
  }
</style>
