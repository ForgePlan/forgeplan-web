<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Command as CommandPrimitive } from 'bits-ui';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<CommandPrimitive.List class="command-list {className ?? ''}">
  <CommandPrimitive.Viewport class="command-viewport">
    {@render children?.()}
  </CommandPrimitive.Viewport>
</CommandPrimitive.List>

<style>
  :global(.command-list) {
    max-height: 320px;
    overflow: auto;
  }

  :global(.command-viewport) {
    padding: 4px;
  }
</style>
