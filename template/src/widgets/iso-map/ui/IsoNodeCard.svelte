<script lang="ts">
  // Stage 3 — a 3D-flavored sibling of
  // widgets/composed-map/ui/ZoneDetailCard.svelte: SAME token-styled card
  // chrome (rule 24 — plain CSS reading the SAME --bg-1/--line-2/--fg-*
  // tokens, no shared/ui primitive re-skin), but for a hovered/dwelt 3D
  // NODE box instead of a 2D zone. Content only, per this stage's brief:
  // label, kind, description_ru, and connections (via the EXISTING
  // widgets/composed-map/model/node-tabs.svelte#buildNodeConnections,
  // reused verbatim — not reinvented here).
  //
  // Unlike ZoneDetailCard this card is NOT sticky/pinned: it is a
  // transient hover-dwell affordance (model/iso-view-state.svelte.ts),
  // closed by the SAME leave/blur that closed the dwell, so it carries no
  // close button. `pointer-events: none` — it never intercepts the
  // pointer itself; the 3D mesh hover is the only thing that opens/closes
  // it, and letting the mouse "arrive" over the card must not be a way to
  // keep it open past that (kept simple on purpose for this spike stage).
  import type { MapNode } from '@/entities/map';
  import type { NodeConnection } from '@/widgets/composed-map/model/node-tabs.svelte';

  let {
    node,
    connections,
    cardEl = $bindable(null),
  }: {
    node: MapNode;
    connections: readonly NodeConnection[];
    cardEl?: HTMLElement | null;
  } = $props();

  // Resets the parent's bound ref on unmount so a stale, detached DOM node
  // never lingers as IsoLeaderLine's supposed target (+page.svelte swaps
  // between this and IsoLayerCard, never both at once).
  $effect(() => {
    return () => {
      cardEl = null;
    };
  });
</script>

<div class="iso-card" role="note" aria-label="Node detail" bind:this={cardEl}>
  <h3 class="iso-card-title">{node.label}</h3>
  <div class="iso-card-kind">{node.kind}</div>
  {#if node.description_ru}
    <p class="iso-card-desc">{node.description_ru}</p>
  {/if}
  {#if connections.length > 0}
    <div class="iso-card-section-label">Connections</div>
    <ul class="iso-card-list">
      {#each connections as conn (conn.dir + '|' + conn.relation + '|' + conn.label)}
        <li>
          <span class="iso-card-dir" class:iso-card-dir-in={conn.dir === 'in'}>
            {conn.dir === 'out' ? '→' : '←'}
          </span>
          {conn.label}
          <span class="iso-card-relation">({conn.relation})</span>
        </li>
      {/each}
    </ul>
  {/if}
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

  .iso-card-section-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-3);
    margin-bottom: 4px;
  }

  .iso-card-list {
    margin: 0;
    padding-left: 16px;
    font-size: 11.5px;
    line-height: 1.6;
    color: var(--fg-2);
    max-height: 130px;
    overflow-y: auto;
  }

  .iso-card-dir {
    display: inline-block;
    width: 1em;
    color: var(--accent);
  }

  .iso-card-dir-in {
    color: var(--fg-3);
  }

  .iso-card-relation {
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 10px;
  }
</style>
