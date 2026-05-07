<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Collapsible as CollapsiblePrimitive } from 'bits-ui';

  interface Props {
    forceMount?: boolean;
    class?: string;
    children?: Snippet;
  }

  let { forceMount = false, class: className, children }: Props = $props();
</script>

<CollapsiblePrimitive.Content {forceMount} class="collapsible-content {className ?? ''}">
  {@render children?.()}
</CollapsiblePrimitive.Content>

<style>
  :global(.collapsible-content) {
    overflow: hidden;
  }

  :global(.collapsible-content[data-state='open']) {
    animation: collapsible-slide-down 160ms ease;
  }

  :global(.collapsible-content[data-state='closed']) {
    animation: collapsible-slide-up 140ms ease;
  }

  @keyframes collapsible-slide-down {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes collapsible-slide-up {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.collapsible-content[data-state='open']),
    :global(.collapsible-content[data-state='closed']) {
      animation: none;
    }
  }
</style>
