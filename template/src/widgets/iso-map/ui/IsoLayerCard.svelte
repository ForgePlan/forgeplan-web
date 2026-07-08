<script lang="ts">
  // Stage 3 — sibling of IsoNodeCard.svelte (SAME token-styled card
  // chrome, same reasoning: rule 24, no shared/ui primitive re-skin), for
  // a hovered/dwelt LEVEL/plane ("sheet") instead of a node box. Content
  // is exactly what model/iso-view-state.svelte.ts#resolveDwellCardData
  // already resolved: the level's label, its zone/node counts, and (when
  // this level IS the decomposition of a parent zone) that zone's own
  // description_ru — this component derives NONE of it itself (DIP).
  //
  // Same non-sticky, no-close-button, pointer-events:none shape as
  // IsoNodeCard — see that file's header comment for why.
  let {
    label,
    zoneCount,
    nodeCount,
    descriptionRu,
    cardEl = $bindable(null),
  }: {
    label: string;
    zoneCount: number;
    nodeCount: number;
    descriptionRu?: string;
    cardEl?: HTMLElement | null;
  } = $props();

  $effect(() => {
    return () => {
      cardEl = null;
    };
  });
</script>

<div class="iso-card" role="note" aria-label="Layer detail" bind:this={cardEl}>
  <h3 class="iso-card-title">{label}</h3>
  <div class="iso-card-kind">layer</div>
  {#if descriptionRu}
    <p class="iso-card-desc">{descriptionRu}</p>
  {/if}
  <div class="iso-card-stats">
    <span>{zoneCount} {zoneCount === 1 ? 'zone' : 'zones'}</span>
    <span class="iso-card-stats-sep">·</span>
    <span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
  </div>
</div>

<style>
  .iso-card {
    position: absolute;
    bottom: 16px;
    left: 16px;
    max-width: 300px;
    max-height: calc(100vh - 84px);
    overflow-y: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: var(--shadow-mini);
    z-index: 4;
    pointer-events: none;
  }

  .iso-card-title {
    margin: 0 0 2px;
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 15px;
    color: var(--fg);
  }

  .iso-card-kind {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-3);
    margin-bottom: 8px;
  }

  .iso-card-desc {
    font-size: 12px;
    line-height: 1.5;
    color: var(--fg-2);
    margin: 0 0 8px;
  }

  .iso-card-stats {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-2);
  }

  .iso-card-stats-sep {
    color: var(--fg-3);
    margin: 0 6px;
  }
</style>
