<script lang="ts">
  import { zoom, zoomIdentity, select, type ZoomBehavior } from '@/widgets/dependency-graph/lib/d3';
  import {
    type ArtifactSummary,
    kindLabelColor,
    statusRing
  } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import type { ScoreEntry } from '@/entities/score';
  import { filterArtifacts, filterEdges } from '../lib/filter';
  import { relationFill } from '../lib/relation';
  import { motionDuration } from '../lib/reduced-motion';
  import { highlight, setHovered, clearHovered, edgeClass, bfsDistances, nodeClass } from '../lib/highlight.svelte';

  let {
    nodes = [],
    edges = [],
    scores = [],
    selectedId = null,
    kindFilter = new Set<string>(),
    statusFilter = new Set<string>(),
    onSelect
  }: {
    nodes?: ArtifactSummary[];
    edges?: GraphEdge[];
    scores?: ScoreEntry[];
    selectedId?: string | null;
    kindFilter?: Set<string>;
    statusFilter?: Set<string>;
    onSelect?: (detail: { id: string }) => void;
  } = $props();

  // TODO(scoring-overlay): `scores` prop accepted but unused in matrix view —
  // wire R_eff into cell intensity. Kept in $props for API parity with other views.

  const CELL = 22;
  const HEADER = 110;
  const MARGIN = 24;

  let svgEl = $state<SVGSVGElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = false;

  const filteredNodes = $derived(filterArtifacts(nodes, kindFilter, statusFilter));

  const ordered = $derived(
    [...filteredNodes].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.id.localeCompare(b.id);
    })
  );

  const orderedIds = $derived(new Set(ordered.map((n) => n.id)));
  const filteredEdges = $derived(filterEdges(edges, orderedIds));
  const hoverDistances = $derived(bfsDistances(highlight.hoveredId, filteredEdges));

  type Cell = { row: number; col: number; relation: string; from: string; to: string };

  const indexById = $derived(new Map(ordered.map((n, i) => [n.id, i] as const)));

  const cells = $derived(
    filteredEdges
      .map<Cell | null>((e) => {
        const r = indexById.get(e.from);
        const c = indexById.get(e.to);
        if (r === undefined || c === undefined) return null;
        return { row: r, col: c, relation: e.relation, from: e.from, to: e.to };
      })
      .filter((c): c is Cell => c !== null)
  );

  const gridSize = $derived(ordered.length * CELL);
  const totalW = $derived(HEADER + gridSize + MARGIN * 2);
  const totalH = $derived(HEADER + gridSize + MARGIN * 2);

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewportW = rect.width;
    viewportH = rect.height;
  }

  function fitToView(animated = true) {
    if (!svgEl || !zoomBehavior) return;
    if (totalW === 0 || totalH === 0) return;
    const k = Math.max(0.2, Math.min(1, (viewportW - 40) / totalW, (viewportH - 40) / totalH));
    const tx = (viewportW - totalW * k) / 2;
    const ty = (viewportH - totalH * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (svgEl && zoomBehavior && totalW > 0 && !didFit) {
      didFit = true;
      queueMicrotask(() => fitToView(false));
    }
  });

  $effect(() => {
    if (!svgEl) return;
    handleResize();
    window.addEventListener('resize', handleResize);
    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        transform = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
      });
    zoomBehavior = zb;
    select(svgEl).call(zb);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (svgEl) select(svgEl).on('.zoom', null);
    };
  });

  export function resetZoom() {
    fitToView();
  }

  function selectId(id: string) {
    onSelect?.({ id });
  }

  const selectedRow = $derived(selectedId ? indexById.get(selectedId) ?? -1 : -1);
</script>

<svg bind:this={svgEl} class="graph" role="img" aria-label="Adjacency matrix of artifact-to-artifact links">
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
          class="row-header {nodeClass(n.id, highlight.hoveredId, hoverDistances)}"
          class:selected={n.id === selectedId}
          transform="translate(0,{HEADER + i * CELL})"
          onclick={(e) => { e.stopPropagation(); selectId(n.id); }}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectId(n.id)}
          onmouseenter={() => setHovered(n.id)}
          onmouseleave={clearHovered}
          onfocus={() => setHovered(n.id)}
          onblur={clearHovered}
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
          class="col-header {nodeClass(n.id, highlight.hoveredId, hoverDistances)}"
          class:selected={n.id === selectedId}
          transform="translate({HEADER + i * CELL + CELL / 2},{HEADER - 8}) rotate(-45)"
          onclick={(e) => { e.stopPropagation(); selectId(n.id); }}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectId(n.id)}
          onmouseenter={() => setHovered(n.id)}
          onmouseleave={clearHovered}
          onfocus={() => setHovered(n.id)}
          onblur={clearHovered}
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

      {#each ordered as n, i (n.id)}
        <line class="grid-line" x1={HEADER} y1={HEADER + i * CELL} x2={HEADER + gridSize} y2={HEADER + i * CELL} />
        <line class="grid-line" x1={HEADER + i * CELL} y1={HEADER} x2={HEADER + i * CELL} y2={HEADER + gridSize} />
        <line class="diag" x1={HEADER + i * CELL} y1={HEADER + i * CELL} x2={HEADER + (i + 1) * CELL} y2={HEADER + (i + 1) * CELL} />
      {/each}
      <line class="grid-line" x1={HEADER} y1={HEADER + gridSize} x2={HEADER + gridSize} y2={HEADER + gridSize} />
      <line class="grid-line" x1={HEADER + gridSize} y1={HEADER} x2={HEADER + gridSize} y2={HEADER + gridSize} />

      {#each cells as c (c.from + '>' + c.to + ':' + c.relation)}
        <rect
          class="cell {edgeClass(c.from, c.to, highlight.hoveredId)}"
          x={HEADER + c.col * CELL + 2}
          y={HEADER + c.row * CELL + 2}
          width={CELL - 4}
          height={CELL - 4}
          fill={relationFill(c.relation)}
          onclick={(e) => { e.stopPropagation(); selectId(c.to); }}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectId(c.to)}
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
  .row-header, .col-header {
    cursor: pointer;
    transition: opacity 180ms ease-out;
  }
  .node-active { opacity: 1; }
  .node-near { opacity: 0.85; }
  .node-mid { opacity: 0.5; }
  .node-far { opacity: 0.28; }
  .node-outside { opacity: 0.12; }
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
    transition: filter 120ms, fill 180ms ease-out, opacity 180ms ease-out;
  }
  .cell:hover, .cell:focus-visible {
    filter: drop-shadow(0 0 4px var(--accent));
    outline: none;
  }
  .hl-row, .hl-col {
    fill: var(--accent-dim);
    pointer-events: none;
  }
  .edge-active {
    fill: var(--accent);
    opacity: 1;
  }
  .edge-dim {
    opacity: 0.25;
  }
</style>
