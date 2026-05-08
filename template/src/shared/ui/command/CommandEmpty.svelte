<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Command as CommandPrimitive } from 'bits-ui';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<CommandPrimitive.Empty class="command-empty {className ?? ''}">
  {@render children?.()}
</CommandPrimitive.Empty>

<style>
  :global(.command-empty) {
    padding: 24px 12px;
    text-align: center;
    font-size: 12px;
    color: var(--fg-3);
  }
</style>
