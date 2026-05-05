<script lang="ts">
  import type { Snippet } from 'svelte';
  import { nodeHover } from '@/entities/graph';
  import { kindLabelColor } from '../lib/theme';

  let {
    id,
    kind = null,
    onSelect,
    weight = 'normal',
    tone = 'kind',
    title,
    ariaLabel,
    children
  }: {
    id: string;
    kind?: string | null;
    onSelect?: (id: string) => void;
    weight?: 'normal' | 'strong';
    tone?: 'kind' | 'accent' | 'warn' | 'inherit';
    title?: string;
    ariaLabel?: string;
    children?: Snippet;
  } = $props();

  const interactive = $derived(typeof onSelect === 'function');
  const color = $derived(tone === 'kind' && kind ? kindLabelColor(kind) : undefined);

  function handleClick() {
    onSelect?.(id);
  }
</script>

{#if interactive}
  <button
    type="button"
    class="noderef"
    class:strong={weight === 'strong'}
    class:tone-accent={tone === 'accent'}
    class:tone-warn={tone === 'warn'}
    class:tone-inherit={tone === 'inherit'}
    style:color={color}
    {title}
    aria-label={ariaLabel}
    use:nodeHover={id}
    onclick={handleClick}
  >
    {#if children}{@render children()}{:else}{id}{/if}
  </button>
{:else}
  <span
    class="noderef static"
    class:strong={weight === 'strong'}
    class:tone-accent={tone === 'accent'}
    class:tone-warn={tone === 'warn'}
    class:tone-inherit={tone === 'inherit'}
    style:color={color}
    {title}
    use:nodeHover={id}
  >
    {#if children}{@render children()}{:else}{id}{/if}
  </span>
{/if}

<style>
  .noderef {
    background: transparent;
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--accent);
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: color 120ms;
  }
  .noderef.static {
    cursor: default;
    color: var(--fg);
  }
  .noderef.strong {
    color: var(--fg);
    font-weight: 600;
  }
  .noderef.tone-accent {
    color: var(--accent);
  }
  .noderef.tone-warn {
    color: var(--accent);
  }
  .noderef.tone-inherit {
    color: inherit;
  }
  .noderef:not(.static):hover,
  .noderef:not(.static):focus-visible {
    text-decoration: underline;
    outline: none;
  }
</style>
