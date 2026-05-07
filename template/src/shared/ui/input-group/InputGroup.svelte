<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'prefix'> {
    prefix?: Snippet;
    suffix?: Snippet;
    children?: Snippet;
  }

  let { class: className, prefix, suffix, children, ...rest }: Props = $props();
</script>

<div class="input-group {className ?? ''}" {...rest}>
  {#if prefix}
    <div class="addon prefix">{@render prefix()}</div>
  {/if}
  <div class="control">{@render children?.()}</div>
  {#if suffix}
    <div class="addon suffix">{@render suffix()}</div>
  {/if}
</div>

<style>
  .input-group {
    display: inline-flex;
    align-items: stretch;
    width: 100%;
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
  }

  .input-group:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-dim);
  }

  .addon {
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    background: var(--bg-2);
    color: var(--fg-3);
    font-family: var(--font-sans);
    font-size: 11px;
    user-select: none;
  }

  .prefix {
    border-right: 1px solid var(--line);
  }

  .suffix {
    border-left: 1px solid var(--line);
  }

  .control {
    flex: 1;
    display: flex;
    min-width: 0;
  }

  .control :global(.input) {
    flex: 1;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  .control :global(.input:focus-visible) {
    box-shadow: none;
  }
</style>
