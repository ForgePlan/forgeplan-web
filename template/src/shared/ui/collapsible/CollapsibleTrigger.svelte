<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Collapsible as CollapsiblePrimitive } from 'bits-ui';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<CollapsiblePrimitive.Trigger class="collapsible-trigger {className ?? ''}">
  {@render children?.()}
</CollapsiblePrimitive.Trigger>

<style>
  :global(.collapsible-trigger) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--fg-1);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 0;
  }

  :global(.collapsible-trigger:hover) {
    color: var(--fg);
  }

  :global(.collapsible-trigger:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 3px;
  }
</style>
