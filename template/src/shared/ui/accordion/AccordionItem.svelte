<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Accordion as AccordionPrimitive } from 'bits-ui';

  interface Props {
    value: string;
    disabled?: boolean;
    class?: string;
    children?: Snippet;
  }

  let { value, disabled = false, class: className, children }: Props = $props();
</script>

<AccordionPrimitive.Item {value} {disabled} class="accordion-item {className ?? ''}">
  {@render children?.()}
</AccordionPrimitive.Item>

<style>
  :global(.accordion-item) {
    border-bottom: 1px solid var(--line);
  }

  :global(.accordion-item:last-child) {
    border-bottom: none;
  }
</style>
