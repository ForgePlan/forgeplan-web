<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLLabelAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLLabelAttributes, 'children'> {
    required?: boolean;
    optional?: boolean;
    children?: Snippet;
  }

  let {
    required = false,
    optional = false,
    class: className,
    children,
    ...rest
  }: Props = $props();
</script>

<label class="label {className ?? ''}" {...rest}>
  <span class="label-text">{@render children?.()}</span>
  {#if required}
    <span class="label-required" aria-label="required">*</span>
  {:else if optional}
    <span class="label-optional">(optional)</span>
  {/if}
</label>

<style>
  .label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--fg-2);
    line-height: 1.2;
    user-select: none;
  }

  .label-required {
    color: var(--bad);
    font-weight: 600;
  }

  .label-optional {
    color: var(--fg-3);
    font-weight: 400;
    font-size: 10px;
  }
</style>
