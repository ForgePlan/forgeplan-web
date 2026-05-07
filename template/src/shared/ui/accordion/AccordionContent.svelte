<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Accordion as AccordionPrimitive } from 'bits-ui';

  interface Props {
    forceMount?: boolean;
    class?: string;
    children?: Snippet;
  }

  let { forceMount = false, class: className, children }: Props = $props();
</script>

<AccordionPrimitive.Content
  {forceMount}
  class="accordion-content {className ?? ''}"
>
  <div class="accordion-content-inner">{@render children?.()}</div>
</AccordionPrimitive.Content>

<style>
  :global(.accordion-content) {
    overflow: hidden;
    color: var(--fg-2);
    font-family: var(--font-sans);
    font-size: 12px;
    line-height: 1.5;
  }

  .accordion-content-inner {
    padding: 0 12px 10px;
  }

  :global(.accordion-content[data-state='open']) {
    animation: accordion-slide-down 160ms ease;
  }

  :global(.accordion-content[data-state='closed']) {
    animation: accordion-slide-up 140ms ease;
  }

  @keyframes accordion-slide-down {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes accordion-slide-up {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.accordion-content[data-state='open']),
    :global(.accordion-content[data-state='closed']) {
      animation: none;
    }
  }
</style>
