<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Command as CommandPrimitive } from 'bits-ui';

  interface Props {
    heading?: string;
    value?: string;
    class?: string;
    children?: Snippet;
  }

  let { heading, value, class: className, children }: Props = $props();
</script>

<CommandPrimitive.Group {value} class="command-group {className ?? ''}">
  {#if heading}
    <CommandPrimitive.GroupHeading class="command-group-heading">
      {heading}
    </CommandPrimitive.GroupHeading>
  {/if}
  <CommandPrimitive.GroupItems>
    {@render children?.()}
  </CommandPrimitive.GroupItems>
</CommandPrimitive.Group>

<style>
  :global(.command-group) {
    padding: 4px 0;
  }

  :global(.command-group-heading) {
    padding: 4px 8px 2px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-3);
  }
</style>
