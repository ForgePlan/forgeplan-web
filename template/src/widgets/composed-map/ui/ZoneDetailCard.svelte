<script lang="ts">
  /**
   * ZoneDetailCard — hover preview for a zone (floating card, top-right,
   * anchored below the FlowChips row). Shown on hover of a zone's empty
   * area or title; never steals the click-to-select / click-to-descend
   * affordances owned by ComposedMapView + ZoneSlab.
   *
   * Anchored top-right (not bottom-right) so it clears both the minimap
   * and the flowcap step-narration card, which both live bottom-of-canvas.
   *
   * Degrades gracefully: `description_ru` and the node list are each
   * omitted independently when absent/empty — no fabricated text.
   */
  import type { MapZone } from "@/entities/map";

  let {
    zone,
    nodeLabels = [],
  }: {
    zone: MapZone;
    nodeLabels?: readonly string[];
  } = $props();
</script>

<div class="zone-detail-card" role="note" aria-label="Zone detail">
  <h3 class="zdc-title">{zone.label}</h3>
  {#if zone.sub}
    <div class="zdc-sub">{zone.sub}</div>
  {/if}
  {#if zone.description_ru}
    <p class="zdc-desc">{zone.description_ru}</p>
  {/if}
  {#if nodeLabels.length > 0}
    <div class="zdc-inside-label">What's inside</div>
    <ul class="zdc-inside-list">
      {#each nodeLabels as label (label)}
        <li>{label}</li>
      {/each}
    </ul>
  {/if}
  <div class="zdc-hint">→ клик, чтобы провалиться</div>
</div>

<style>
  .zone-detail-card {
    position: absolute;
    top: 52px;
    right: 16px;
    max-width: 320px;
    max-height: calc(100vh - 84px);
    overflow-y: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: var(--shadow-mini);
    z-index: 3;
    pointer-events: none;
  }

  .zdc-title {
    margin: 0 0 2px;
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 15px;
    color: var(--fg);
  }

  .zdc-sub {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-3);
    margin-bottom: 8px;
  }

  .zdc-desc {
    font-size: 12px;
    line-height: 1.5;
    color: var(--fg-2);
    margin: 0 0 8px;
  }

  .zdc-inside-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-3);
    margin-bottom: 4px;
  }

  .zdc-inside-list {
    margin: 0 0 8px;
    padding-left: 16px;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--fg-2);
    max-height: 130px;
    overflow-y: auto;
    pointer-events: auto;
  }

  .zdc-hint {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--map-clay);
  }
</style>
