<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import Search from '@lucide/svelte/icons/search';

  interface Props {
    value?: string;
    placeholder?: string;
    class?: string;
  }

  let {
    value = $bindable(''),
    placeholder = 'Type a command…',
    class: className,
  }: Props = $props();
</script>

<div class="command-input-wrap">
  <Search size={14} class="command-input-icon" />
  <CommandPrimitive.Input
    bind:value
    {placeholder}
    class="command-input {className ?? ''}"
  />
</div>

<style>
  .command-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
  }

  :global(.command-input-icon) {
    color: var(--fg-3);
    flex-shrink: 0;
  }

  :global(.command-input) {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--fg-1);
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.2;
    padding: 0;
    min-width: 0;
  }

  :global(.command-input::placeholder) {
    color: var(--fg-3);
  }
</style>
