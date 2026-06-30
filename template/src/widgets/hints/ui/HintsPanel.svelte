<script lang="ts">
  import { Button } from '@/shared/ui';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import HintCard from './HintCard.svelte';
  import { DEFAULT_TOP_N } from '../lib/compute-hints';
  import type { Hint } from '../lib/types';

  interface Props {
    hints: Hint[];
    /** FR-001 — collapsed state, persisted by the caller. */
    collapsed?: boolean;
    onSnooze: (id: string, ms: number) => void;
    onDismiss: (id: string) => void;
    onSelect?: (detail: { id: string }) => void;
  }

  let {
    hints,
    collapsed = $bindable(false),
    onSnooze,
    onDismiss,
    onSelect,
  }: Props = $props();

  let showAll = $state(false);

  const hasHints = $derived(hints.length > 0);
  const overflow = $derived(hints.length > DEFAULT_TOP_N);
  const visible = $derived(
    showAll ? hints : hints.slice(0, DEFAULT_TOP_N)
  );
  // FR-011 — aria-live mirror of the currently-shown hint texts. A monotonic
  // prefix would be needed for repeated identical announcements, but the panel
  // re-announces only when the text set changes, which is the desired cadence.
  const liveText = $derived(
    hasHints ? visible.map((h) => h.text).join('. ') : ''
  );
</script>

{#if hasHints}
  <section class="hints-panel" data-test="hints-panel">
    <header class="hints-header">
      <Button
        variant="ghost"
        size="sm"
        class="hints-collapse"
        aria-expanded={!collapsed}
        data-test="hints-collapse"
        onclick={() => (collapsed = !collapsed)}
      >
        <span class="chevron" class:open={!collapsed}><ChevronRight size={13} /></span>
        <Lightbulb size={13} />
        <span class="hints-title">Hints</span>
        <span class="hints-count" data-test="hints-count">{hints.length}</span>
      </Button>
    </header>

    {#if !collapsed}
      <div class="hints-list" data-test="hints-list">
        {#each visible as hint (hint.id)}
          <HintCard {hint} {onSnooze} {onDismiss} {onSelect} />
        {/each}
        {#if overflow}
          <div class="hints-more">
            <Button
              variant="ghost"
              size="sm"
              data-test="hints-show-all"
              onclick={() => (showAll = !showAll)}
            >{showAll ? 'Show fewer' : `Show all ${hints.length}`}</Button>
          </div>
        {/if}
      </div>
    {/if}

    <div aria-live="polite" class="sr-only" data-test="hints-live">{liveText}</div>
  </section>
{/if}

<style>
  .hints-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 20px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }
  .hints-header {
    display: flex;
    align-items: center;
  }
  .hints-title {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-2);
  }
  .hints-count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-3);
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: 999px;
    padding: 1px 7px;
    font-variant-numeric: tabular-nums;
  }
  .chevron {
    display: inline-flex;
    color: var(--fg-3);
    transition: transform 140ms ease;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .hints-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hints-more {
    display: flex;
    justify-content: center;
  }
  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
