<script lang="ts">
  import { sankey, sankeyLinkHorizontal, sankeyJustify, type SankeyGraph } from 'd3-sankey';
  import { zoom, zoomIdentity, select, type ZoomBehavior } from '@/widgets/dependency-graph/lib/d3';
  import {
    type ArtifactSummary,
    kindBorder,
    kindLabelColor,
    statusRing
  } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import type { ScoreEntry } from '@/entities/score';
  import { filterArtifacts, filterEdges } from '../lib/filter';
  import { relationStroke } from '../lib/relation';
  import { motionDuration } from '../lib/reduced-motion';
  import {
    highlight,
    setHovered,
    clearHovered,
    edgeClass,
    bfsDistances,
    nodeClass
  } from '../lib/highlight.svelte';
  import {
    buildSankeyPayload,
    type SankeyPayloadNode,
    type SankeyPayloadLink
  } from '../lib/sankey-layout';

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

  // TODO(scoring-overlay): scores prop accepted for API parity but not yet
  // mapped to flow width.
  $effect(() => { void scores; });

  const NODE_WIDTH = 14;
  const NODE_PADDING = 12;
  const MARGIN = 28;
  const VIEW_W = 1200;
  const VIEW_H = 760;

  let svgEl = $state<SVGSVGElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = $state(false);

  const filteredNodes = $derived(filterArtifacts(nodes, kindFilter, statusFilter));
  const filteredIds = $derived(new Set(filteredNodes.map((n) => n.id)));
  const filteredEdges = $derived(filterEdges(edges, filteredIds));
  const focusId = $derived(highlight.hoveredId ?? selectedId);
  const hoverDistances = $derived(bfsDistances(focusId, filteredEdges));

  type SankeyNode = SankeyPayloadNode & {
    x0?: number; x1?: number; y0?: number; y1?: number;
  };
  type SankeyLink = SankeyPayloadLink & {
    width?: number;
    source: SankeyNode | string;
    target: SankeyNode | string;
  };

  const layout = $derived.by<{ nodes: SankeyNode[]; links: SankeyLink[] }>(() => {
    const payload = buildSankeyPayload(filteredNodes, filteredEdges);
    if (payload.nodes.length === 0 || payload.links.length === 0) {
      return { nodes: [], links: [] };
    }
    const generator = sankey<SankeyNode, SankeyLink>()
      .nodeId((d: SankeyNode) => d.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .extent([
        [MARGIN, MARGIN],
        [VIEW_W - MARGIN, VIEW_H - MARGIN]
      ]);
    const graph: SankeyGraph<SankeyNode, SankeyLink> = generator({
      nodes: payload.nodes.map((n) => ({ ...n })),
      links: payload.links.map((l) => ({ ...l }))
    });
    return { nodes: graph.nodes, links: graph.links };
  });

  const linkPath = $derived.by(() => {
    return sankeyLinkHorizontal<SankeyNode, SankeyLink>();
  });

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewportW = rect.width;
    viewportH = rect.height;
  }

  function fitToView(animated = true) {
    if (!svgEl || !zoomBehavior) return;
    const k = Math.max(0.3, Math.min(1, (viewportW - 40) / VIEW_W, (viewportH - 40) / VIEW_H));
    const tx = (viewportW - VIEW_W * k) / 2;
    const ty = (viewportH - VIEW_H * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (svgEl && zoomBehavior && layout.nodes.length > 0 && !didFit) {
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

  function linkPair(l: SankeyLink): { from: string; to: string } {
    const src = l.source as SankeyNode | string;
    const tgt = l.target as SankeyNode | string;
    const from = typeof src === 'string' ? src : src.id;
    const to = typeof tgt === 'string' ? tgt : tgt.id;
    return { from, to };
  }
</script>

<svg
  bind:this={svgEl}
  class="graph"
  class:focus-soft={highlight.hoveredId === null && selectedId !== null}
  role="img"
  aria-label="Sankey flow diagram of hierarchy edges"
>
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    {#each layout.links as l (`${linkPair(l).from}>${linkPair(l).to}:${l.relation}`)}
      {@const pair = linkPair(l)}
      <path
        class="link {edgeClass(pair.from, pair.to, focusId)}"
        d={linkPath(l) ?? ''}
        stroke={relationStroke(l.relation)}
        stroke-width={Math.max(1, l.width ?? 0)}
        fill="none"
        stroke-opacity="0.42"
      >
        <title>{pair.from} → {pair.to} ({l.relation})</title>
      </path>
    {/each}
    {#each layout.nodes as n (n.id)}
      {@const x0 = n.x0 ?? 0}
      {@const x1 = n.x1 ?? 0}
      {@const y0 = n.y0 ?? 0}
      {@const y1 = n.y1 ?? 0}
      <g
        class="node {nodeClass(n.id, focusId, hoverDistances)}"
        class:selected={n.id === selectedId}
        data-id={n.id}
        onclick={(e) => { e.stopPropagation(); selectId(n.id); }}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectId(n.id)}
        onmouseenter={() => setHovered(n.id)}
        onmouseleave={clearHovered}
        onfocus={() => setHovered(n.id)}
        onblur={clearHovered}
        role="button"
        tabindex="0"
        aria-label={`${n.id}: ${n.title}`}
      >
        <rect
          class="bar"
          x={x0}
          y={y0}
          width={x1 - x0}
          height={Math.max(2, y1 - y0)}
          fill={kindBorder(n.kind)}
          opacity="0.82"
        />
        <text
          class="label"
          x={x0 < VIEW_W / 2 ? x1 + 6 : x0 - 6}
          y={(y0 + y1) / 2}
          dy="0.32em"
          text-anchor={x0 < VIEW_W / 2 ? 'start' : 'end'}
          fill={kindLabelColor(n.kind)}
        >
          {n.id}
        </text>
        <circle
          class="status-dot"
          cx={x0 < VIEW_W / 2 ? x1 + 4 : x0 - 4}
          cy={y0 - 4}
          r="2.6"
          fill={statusRing(n.status)}
        />
      </g>
    {/each}
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
  .link {
    transition: stroke-opacity 180ms ease-out, stroke-width 120ms;
  }
  .link.edge-active { stroke-opacity: 0.9 !important; }
  .link.edge-dim { stroke-opacity: 0.18 !important; }
  .node { cursor: pointer; transition: opacity 180ms ease-out; }
  .node-active { opacity: 1; }
  .node-near { opacity: 0.88; }
  .node-mid { opacity: 0.62; }
  .node-far { opacity: 0.46; }
  .node-outside { opacity: 0.34; }
  .graph.focus-soft .node-near { opacity: 0.92; }
  .graph.focus-soft .node-mid { opacity: 0.75; }
  .graph.focus-soft .node-far { opacity: 0.64; }
  .graph.focus-soft .node-outside { opacity: 0.56; }
  .bar {
    transition: opacity 120ms;
  }
  .node:hover .bar, .node:focus-visible .bar {
    opacity: 1;
    filter: drop-shadow(0 0 6px currentColor);
    outline: none;
  }
  .node.selected .bar {
    opacity: 1;
    filter: drop-shadow(0 0 8px currentColor);
  }
  .label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.02em;
    pointer-events: none;
  }
  .status-dot { pointer-events: none; opacity: 0.85; }
</style>
