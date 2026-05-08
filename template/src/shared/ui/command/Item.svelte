<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Command as CommandPrimitive } from 'bits-ui';

  interface Props {
    value?: string;
    keywords?: string[];
    disabled?: boolean;
    onSelect?: () => void;
    class?: string;
    children?: Snippet;
  }

  let {
    value,
    keywords,
    disabled = false,
    onSelect,
    class: className,
    children,
  }: Props = $props();
</script>

<CommandPrimitive.Item
  {value}
  {keywords}
  {disabled}
  {onSelect}
  class="command-item {className ?? ''}"
>
  {@render children?.()}
</CommandPrimitive.Item>

<style>
  :global(.command-item) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    color: var(--fg-1);
    font-size: 12px;
    line-height: 1.3;
    cursor: pointer;
    user-select: none;
  }

  :global(.command-item[data-selected]) {
    background: var(--accent-dim);
    color: var(--fg);
  }

  :global(.command-item[data-disabled]) {
    opacity: 0.5;
    pointer-events: none;
    cursor: not-allowed;
  }
</style>
