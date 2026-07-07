<script lang="ts">
  /**
   * ZoneDetailCard — sticky detail panel for a zone (floating card,
   * fixed bottom-left corner). Opens after the cursor DWELLS on a zone's
   * empty area or title (ComposedMapView gates detailZoneId behind a
   * ~350ms dwell timer so a fast pass across zones doesn't flicker the
   * card) and STAYS OPEN once the cursor leaves — ComposedMapView tracks
   * the pinned zone separately from the transient ZoneSlab hover ring, so
   * this card only ever changes when a different zone is dwelt on or the
   * user dismisses it explicitly (× button).
   *
   * Interactive: the "What's inside" list is mouse-scrollable, node rows
   * with an `artifact_id` open that artifact via `onNodeSelect`, and
   * "Провалиться →" descends into the zone via `onDescend` (same
   * isLive/isDrillable guards as the empty-zone click).
   *
   * Degrades gracefully: `description_ru` and the node list are each
   * omitted independently when absent/empty — no fabricated text.
   */
  import type { MapNode, MapZone } from "@/entities/map";
  import { NodeRef } from "@/entities/artifact";
  import { Button } from "@/shared/ui";

  let {
    zone,
    nodes = [],
    isLive = true,
    drillable = false,
    onClose,
    onDescend,
    onNodeSelect,
  }: {
    zone: MapZone;
    nodes?: readonly MapNode[];
    isLive?: boolean;
    drillable?: boolean;
    onClose?: () => void;
    onDescend?: () => void;
    onNodeSelect?: (id: string, event?: Event) => void;
  } = $props();
</script>

<div class="zone-detail-card" role="note" aria-label="Zone detail">
  <Button
    variant="ghost"
    size="icon"
    class="zdc-close-pos"
    onclick={() => onClose?.()}
    aria-label="Close zone detail"
  >
    <span aria-hidden="true">×</span>
  </Button>
  <h3 class="zdc-title">{zone.label}</h3>
  {#if zone.sub}
    <div class="zdc-sub">{zone.sub}</div>
  {/if}
  {#if zone.description_ru}
    <p class="zdc-desc">{zone.description_ru}</p>
  {/if}
  {#if nodes.length > 0}
    <div class="zdc-inside-label">What's inside</div>
    <ul class="zdc-inside-list">
      {#each nodes as node (node.id)}
        <li>
          {#if node.artifact_id}
            <NodeRef
              id={node.artifact_id}
              display={node.label}
              onSelect={onNodeSelect}
            />
          {:else}
            <span class="zdc-node-plain">{node.label}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <Button
    variant="secondary"
    size="sm"
    class="zdc-descend"
    disabled={!isLive || !drillable}
    onclick={() => onDescend?.()}
  >
    Провалиться →
  </Button>
</div>

<style>
  .zone-detail-card {
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
    z-index: 3;
  }

  :global(.zdc-close-pos) {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  .zdc-title {
    margin: 0 28px 2px 0;
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
    margin: 0 0 10px;
    padding-left: 16px;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--fg-2);
    max-height: 130px;
    overflow-y: auto;
  }

  .zdc-node-plain {
    color: var(--fg-2);
  }

  :global(.zdc-descend) {
    width: 100%;
  }
</style>
