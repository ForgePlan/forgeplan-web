<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Accordion as AccordionPrimitive } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<AccordionPrimitive.Header level={3}>
  <AccordionPrimitive.Trigger class="accordion-trigger {className ?? ''}">
    <span class="accordion-trigger-label">{@render children?.()}</span>
    <ChevronDown size={14} class="accordion-chevron" />
  </AccordionPrimitive.Trigger>
</AccordionPrimitive.Header>

<style>
  :global(.accordion-trigger) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: transparent;
    border: none;
    color: var(--fg-1);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
    text-align: left;
    padding: 10px 12px;
    cursor: pointer;
  }

  :global(.accordion-trigger:hover) {
    background: var(--bg-2);
  }

  :global(.accordion-trigger:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  :global(.accordion-chevron) {
    color: var(--fg-3);
    transition: transform 160ms ease;
  }

  :global(.accordion-trigger[data-state='open'] .accordion-chevron) {
    transform: rotate(180deg);
  }

  .accordion-trigger-label {
    flex: 1;
    min-width: 0;
  }
</style>
