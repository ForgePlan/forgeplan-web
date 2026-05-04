<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { select } from 'd3-selection';
  import 'd3-transition';
  import type { ArtifactSummary, GraphEdge, ScoreEntry } from '$lib/types';
  import { kindLabelColor, statusRing } from '$lib/theme';

  export let nodes: ArtifactSummary[] = [];
  export let edges: GraphEdge[] = [];
  export let scores: ScoreEntry[] = [];
  export let selectedId: string | null = null;
  export let kindFilter: Set<string> = new Set();
  export let statusFilter: Set<string> = new Set();

  const dispatch = createEventDispatcher<{ select: { id: string } }>();

  const CELL = 22;
  const HEADER = 110;
  const MARGIN = 24;

  let svgEl: SVGSVGElement;
  let viewportW = 800;
  let viewportH = 600;
  let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let transform = { x: 0, y: 0, k: 1 };
  let didFit = false;

  $: scoreById = new Map<string, number>(scores.map((s) => [s.id, s.r_eff]));

  $: filteredNodes = nodes.filter((n) => {
    const k = n.kind.toLowerCase();
    const s = n.status.toLowerCase();
    if (kindFilter.size > 0 && !kindFilter.has(k)) return false;
    if (statusFilter.size > 0 && !statusFilter.has(s)) return false;
    return true;
  });

  $: ordered = [...filteredNodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.id.localeCompare(b.id);
  });

  $: orderedIds = new Set(ordered.map((n) => n.id));
  $: filteredEdges = edges.filter((e) => orderedIds.has(e.from) && orderedIds.has(e.to));

  type Cell = { row: number; col: number; relation: string; from: string; to: string };

  $: indexById = new Map(ordered.map((n, i) => [n.id, i] as const));

  $: cells = filteredEdges
    .map<Cell | null>((e) => {
      const r = indexById.get(e.from);
      const c = indexById.get(e.to);
      if (r === undefined || c === undefined) return null;
      return { row: r, col: c, relation: e.relation, from: e.from, to: e.to };
    })
    .filter((c): c is Cell => c !== null);

  $: gridSize = ordered.length * CELL;
  $: totalW = HEADER + gridSize + MARGIN * 2;
  $: totalH = HEADER + gridSize + MARGIN * 2;

  function relationFill(relation: string): string {
    const r = relation?.toLowerCase() ?? '';
    if (r === 'informs') return 'rgba(229, 229, 229, 0.65)';
    if (r === 'risks' || r === 'risk') return 'var(--accent)';
    return 'rgba(229, 229, 229, 0.85)';
  }

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewportW = rect.width;
    viewportH = rect.height;
  }

  function fitToView() {
    if (!svgEl || !zoomBehavior) return;
    if (totalW === 0 || totalH === 0) return;
    const k = Math.max(0.2, Math.min(1, (viewportW - 40) / totalW, (viewportH - 40) / totalH));
    const tx = (viewportW - totalW * k) / 2;
    const ty = (viewportH - totalH * k) / 2;
    select(svgEl)
      .transition()
      .duration(300)
      .call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(k));
  }

  $: if (svgEl && zoomBehavior && totalW > 0 && !didFit) {
    didFit = true;
    queueMicrotask(fitToView);
  }

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        transform = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
      });
    select(svgEl).call(zoomBehavior);
    return () => window.removeEventListener('resize', handleResize);
  });

  function resetZoom() {
    fitToView();
  }
  export { resetZoom };

  function onSelect(id: string) {
    dispatch('select', { id });
  }

  $: selectedRow = selectedId ? indexById.get(selectedId) ?? -1 : -1;
</script>

<svg bind:this={svgEl} class="graph" role="application" aria-label="Forgeplan adjacency matrix">
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    <g transform="translate({MARGIN},{MARGIN})">
      <text class="legend" x={HEADER - 4} y={HEADER - 6} text-anchor="end">FROM \ TO</text>

      {#if selectedRow >= 0}
        <rect
          class="hl-row"
          x={HEADER}
          y={HEADER + selectedRow * CELL}
          width={gridSize}
          height={CELL}
        />
        <rect
          class="hl-col"
          x={HEADER + selectedRow * CELL}
          y={HEADER}
          width={CELL}
          height={gridSize}
        />
      {/if}

      {#each ordered as n, i (n.id)}
        <g
          class="row-header"
          class:selected={n.id === selectedId}
          transform="translate(0,{HEADER + i * CELL})"
          on:click|stopPropagation={() => onSelect(n.id)}
          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(n.id)}
          role="button"
          tabindex="0"
          aria-label={`row ${n.id}`}
        >
          <text class="row-label" x={HEADER - 8} y={CELL / 2 + 4} text-anchor="end" fill={kindLabelColor(n.kind)}>
            {n.id}
          </text>
          <circle class="status-dot" cx={HEADER - 4} cy={CELL / 2} r="3" fill={statusRing(n.status)} />
        </g>

        <g
          class="col-header"
          class:selected={n.id === selectedId}
          transform="translate({HEADER + i * CELL + CELL / 2},{HEADER - 8}) rotate(-45)"
          on:click|stopPropagation={() => onSelect(n.id)}
          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(n.id)}
          role="button"
          tabindex="0"
          aria-label={`col ${n.id}`}
        >
          <text class="col-label" x="0" y="0" text-anchor="start" fill={kindLabelColor(n.kind)}>
            {n.id}
          </text>
        </g>
      {/each}

      <rect class="grid-bg" x={HEADER} y={HEADER} width={gridSize} height={gridSize} />

      {#each ordered as _, i (i)}
        <line class="grid-line" x1={HEADER} y1={HEADER + i * CELL} x2={HEADER + gridSize} y2={HEADER + i * CELL} />
        <line class="grid-line" x1={HEADER + i * CELL} y1={HEADER} x2={HEADER + i * CELL} y2={HEADER + gridSize} />
        <line class="diag" x1={HEADER + i * CELL} y1={HEADER + i * CELL} x2={HEADER + (i + 1) * CELL} y2={HEADER + (i + 1) * CELL} />
      {/each}
      <line class="grid-line" x1={HEADER} y1={HEADER + gridSize} x2={HEADER + gridSize} y2={HEADER + gridSize} />
      <line class="grid-line" x1={HEADER + gridSize} y1={HEADER} x2={HEADER + gridSize} y2={HEADER + gridSize} />

      {#each cells as c (c.from + '>' + c.to + ':' + c.relation)}
        <rect
          class="cell"
          x={HEADER + c.col * CELL + 2}
          y={HEADER + c.row * CELL + 2}
          width={CELL - 4}
          height={CELL - 4}
          fill={relationFill(c.relation)}
          on:click|stopPropagation={() => onSelect(c.to)}
          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(c.to)}
          role="button"
          tabindex="0"
          aria-label={`${c.from} → ${c.to}: ${c.relation}`}
        >
          <title>{c.from} → {c.to} ({c.relation})</title>
        </rect>
      {/each}
    </g>
  </g>
</svg>

<style>
  .graph {
    width: 100%;
    height: 100%;
    background: var(--bg);
    cursor: grab;
    user-select: none;
  }
  .graph:active { cursor: grabbing; }
  .legend {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    fill: var(--fg-3);
    pointer-events: none;
  }
  .grid-bg {
    fill: var(--bg-1);
    stroke: var(--line);
    stroke-width: 1;
  }
  .grid-line {
    stroke: var(--line);
    stroke-width: 0.5;
  }
  .diag {
    stroke: rgba(255, 255, 255, 0.04);
    stroke-width: 1;
  }
  .row-header, .col-header { cursor: pointer; }
  .row-label, .col-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.02em;
    pointer-events: none;
  }
  .row-header.selected .row-label,
  .col-header.selected .col-label {
    text-decoration: underline;
  }
  .status-dot { pointer-events: none; opacity: 0.85; }
  .cell {
    cursor: pointer;
    transition: filter 120ms;
  }
  .cell:hover, .cell:focus-visible {
    filter: drop-shadow(0 0 4px var(--accent));
    outline: none;
  }
  .hl-row, .hl-col {
    fill: var(--accent-dim);
    pointer-events: none;
  }
</style>
