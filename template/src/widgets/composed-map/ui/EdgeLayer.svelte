<script lang="ts">
  import type { MapEdge } from "@/entities/map";

  let {
    edgePaths,
    connectorPaths,
    highlightedIds = null,
  }: {
    edgePaths: ReadonlyArray<{ edge: MapEdge; d: string }>;
    connectorPaths: ReadonlyArray<{
      from: string;
      to: string;
      label: string;
      d: string;
    }>;
    highlightedIds?: ReadonlySet<string> | null;
  } = $props();

  const hasHighlight = $derived(!!highlightedIds && highlightedIds.size > 0);

  function isDimmed(a: string, b: string): boolean {
    if (!hasHighlight || !highlightedIds) return false;
    return !(highlightedIds.has(a) && highlightedIds.has(b));
  }

  // Simpler alternative chosen over getPointAtLength(totalLength / 2): the
  // path's `d` string already encodes its start point (`M x y ...`), so the
  // label anchors there with a small offset — no DOM-bound length
  // measurement, no post-mount effect required for a Phase-1 render-proof.
  function startPoint(d: string): { x: number; y: number } {
    const match = /^M\s*(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
    return match
      ? { x: Number(match[1]), y: Number(match[2]) }
      : { x: 0, y: 0 };
  }
</script>

<g class="edge-layer">
  {#each edgePaths as entry (entry.edge.from + ">" + entry.edge.to + ":" + entry.edge.relation)}
    <path
      class="edge-path"
      class:dimmed={isDimmed(entry.edge.from, entry.edge.to)}
      d={entry.d}
    />
  {/each}
  {#each connectorPaths as entry (entry.from + ">" + entry.to)}
    {@const start = startPoint(entry.d)}
    <path
      class="connector-path"
      class:dimmed={isDimmed(entry.from, entry.to)}
      d={entry.d}
    />
    <text
      class="connector-label"
      class:dimmed={isDimmed(entry.from, entry.to)}
      x={start.x + 6}
      y={start.y - 6}
    >{entry.label}</text>
  {/each}
</g>

<style>
  .edge-path {
    fill: none;
    stroke: var(--edge-default);
    stroke-width: 1;
    transition: opacity 160ms ease-out;
  }

  .connector-path {
    fill: none;
    stroke: var(--map-zone-line);
    stroke-width: 2.5;
    transition: opacity 160ms ease-out;
  }

  .connector-label {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--fg-2);
    pointer-events: none;
    transition: opacity 160ms ease-out;
  }

  .dimmed {
    opacity: 0.2;
  }
</style>
