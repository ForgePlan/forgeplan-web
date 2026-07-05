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

  // With a flow active, an edge is LIT when both endpoints are in the flow
  // (it's part of the traced path) and DIMMED otherwise. Mirrors the spike's
  // .stage.flowing .edge / .edge.lit split (PROJECT-MAP-SPEC §15/§22).
  function isLit(a: string, b: string): boolean {
    return hasHighlight && !!highlightedIds && highlightedIds.has(a) && highlightedIds.has(b);
  }
  function isDimmed(a: string, b: string): boolean {
    return hasHighlight && !isLit(a, b);
  }

  // Edge rollup (RFC-031 follow-up) — an aggregated edge (rollup_count > 1,
  // set by entities/map/lib/edge-rollup.ts) renders slightly thicker, capped
  // so a 90-edge rollup doesn't dwarf the card it points at. Base/scale/cap
  // chosen to stay subtle: count=2 is barely distinguishable, count>=~20
  // saturates at the cap.
  const ROLLUP_BASE_WIDTH = 1.5;
  const ROLLUP_SCALE = 0.6;
  const ROLLUP_MAX_WIDTH = 4;
  function rollupStrokeWidth(count: number): number {
    return Math.min(
      ROLLUP_BASE_WIDTH + Math.log2(count) * ROLLUP_SCALE,
      ROLLUP_MAX_WIDTH,
    );
  }

  function startPoint(d: string): { x: number; y: number } {
    const match = /^M\s*(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
    return match
      ? { x: Number(match[1]), y: Number(match[2]) }
      : { x: 0, y: 0 };
  }
  // Last coordinate pair in the path `d` (the edge's target end).
  function endPoint(d: string): { x: number; y: number } {
    const nums = d.match(/-?[\d.]+/g);
    if (!nums || nums.length < 2) return { x: 0, y: 0 };
    return { x: Number(nums[nums.length - 2]), y: Number(nums[nums.length - 1]) };
  }
  function midPoint(d: string): { x: number; y: number } {
    const a = startPoint(d);
    const b = endPoint(d);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
</script>

<g class="edge-layer">
  <defs>
    <marker
      id="cm-arrow"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6.4"
      markerHeight="6.4"
      orient="auto-start-reverse"
    >
      <path class="cm-arrow-head" d="M0,1 L9,5 L0,9" />
    </marker>
    <marker
      id="cm-arrow-lit"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6.4"
      markerHeight="6.4"
      orient="auto-start-reverse"
    >
      <path class="cm-arrow-head-lit" d="M0,1 L9,5 L0,9" />
    </marker>
  </defs>

  {#each edgePaths as entry (entry.edge.from + ">" + entry.edge.to + ":" + entry.edge.relation)}
    {@const lit = isLit(entry.edge.from, entry.edge.to)}
    {@const count = entry.edge.rollup_count ?? 1}
    {@const aggregated = count > 1}
    <path
      class="edge-path"
      class:dimmed={isDimmed(entry.edge.from, entry.edge.to)}
      class:lit
      style={aggregated ? `--rollup-w: ${rollupStrokeWidth(count)}` : undefined}
      marker-end={lit ? "url(#cm-arrow-lit)" : "url(#cm-arrow)"}
      d={entry.d}
    />
    {#if lit || (aggregated && !hasHighlight)}
      {@const mid = midPoint(entry.d)}
      <text
        class="edge-label"
        class:lit
        class:aggregated-count={aggregated && !lit}
        x={mid.x}
        y={mid.y - 4}
        >{lit
          ? aggregated
            ? `${entry.edge.relation} ×${count}`
            : entry.edge.relation
          : `×${count}`}</text
      >
    {/if}
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
    stroke-width: var(--rollup-w, 1.5);
    transition:
      opacity 160ms ease-out,
      stroke-width 160ms ease-out;
  }

  .cm-arrow-head {
    fill: none;
    stroke: var(--edge-default);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .cm-arrow-head-lit {
    fill: none;
    stroke: var(--map-clay);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Active-flow edge: clay, thin, marching-ants (spike @keyframes march). */
  .edge-path.lit {
    stroke: var(--map-clay);
    stroke-width: var(--rollup-w, 1.5);
    stroke-dasharray: 7 5;
    animation: march 0.9s linear infinite;
  }
  @keyframes march {
    to {
      stroke-dashoffset: -12;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .edge-path.lit {
      animation: none;
      stroke-dasharray: none;
    }
  }

  .edge-label {
    font-family: var(--font-mono);
    font-size: 9px;
    text-anchor: middle;
    pointer-events: none;
  }
  .edge-label.lit {
    fill: var(--map-clay);
    font-weight: 600;
  }
  /* Baseline (no flow active) count label on an aggregated edge — subtle,
     neutral; never competes visually with the .lit clay treatment. */
  .edge-label.aggregated-count {
    fill: var(--fg-3);
    font-size: 8.5px;
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

  /* Dim-all (spike .stage.flowing .edge/.elbl) — covers both non-lit edges
     and their labels (connector-label uses the same class), matching the
     reference's uniform ~0.09 for both. */
  .dimmed {
    opacity: 0.09;
  }
</style>
