<script lang="ts">
  import { sankey, sankeyLinkHorizontal, sankeyJustify, type SankeyGraph } from 'd3-sankey';
  import { zoom, zoomIdentity, select, type ZoomBehavior } from '@/widgets/dependency-graph/lib/d3';
  import {
    type ArtifactSummary,
    kindBorder,
    statusRing
  } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import type { ScoreEntry } from '@/entities/score';
  import { filterArtifacts, filterEdges } from '../lib/filter';
  import { nodesContentSignature, edgesContentSignature } from '../lib/filter-memo.svelte';
  import { relationStroke } from '../lib/relation';
  import { motionDuration } from '../lib/reduced-motion';
  import {
    highlight,
    setHovered,
    clearHovered,
    edgeClass,
    bfsDistances,
    nodeClass,
    adjacentToSet,
  } from '../lib/highlight.svelte';
  import {
    buildSankeyPayload,
    adaptiveCanvasHeight,
    dropCollidingLabels,
    MIN_CANVAS_HEIGHT_PX,
    MIN_NODE_HEIGHT_PX,
    LABEL_LINE_HEIGHT_PX,
    type SankeyPayloadNode,
    type SankeyPayloadLink
  } from '../lib/sankey-layout';
  import { TYPE_ORDER } from '../lib/cluster.svelte';

  let {
    nodes = [],
    edges = [],
    scores = [],
    selectedId = null,
    openedIds = new Set<string>(),
    kindFilter = new Set<string>(),
    statusFilter = new Set<string>(),
    onSelect,
    onViewState
  }: {
    nodes?: ArtifactSummary[];
    edges?: GraphEdge[];
    scores?: ScoreEntry[];
    selectedId?: string | null;
    openedIds?: ReadonlySet<string>;
    kindFilter?: Set<string>;
    statusFilter?: Set<string>;
    onSelect?: (detail: { id: string; event?: Event }) => void;
    onViewState?: (state: {
      nodes: Array<{ id: string; x: number; y: number; kind: string }>;
      transform: { x: number; y: number; k: number };
      viewport: { w: number; h: number };
    }) => void;
  } = $props();

  // TODO(scoring-overlay): scores prop accepted for API parity but not yet
  // mapped to flow width.
  $effect(() => { void scores; });

  // Layer gap is the breathing space between two adjacent type-tier
  // columns. 160 logical units ≈ 60-80 screen px after fitToView, so
  // groups read as separate "tiers" rather than one wall of bars.
  const NODE_WIDTH = 16;
  const LAYER_GAP = 200;
  const NODE_PADDING = 12;
  const MARGIN = 32;
  const LABEL_GUTTER = 92;
  const LINK_HEIGHT = 12;
  const ORPHAN_BAR_HEIGHT = LINK_HEIGHT;
  const ORPHAN_GROUP_GAP = 36;

  let svgEl = $state<SVGSVGElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = $state(false);

  // Filter memoization: 10s polling layer hands fresh array refs even when
  // payload is unchanged; signature gate avoids cascading layout invalidation.
  const nodesSig = $derived(nodesContentSignature(nodes, kindFilter, statusFilter));
  let lastNodesSig = '';
  let cachedFilteredNodes: ArtifactSummary[] = [];
  const filteredNodes = $derived.by(() => {
    if (nodesSig === lastNodesSig) return cachedFilteredNodes;
    lastNodesSig = nodesSig;
    cachedFilteredNodes = filterArtifacts(nodes, kindFilter, statusFilter);
    return cachedFilteredNodes;
  });
  const filteredIds = $derived(new Set(filteredNodes.map((n) => n.id)));
  const edgesSig = $derived(edgesContentSignature(edges, filteredIds));
  let lastEdgesSig = '';
  let cachedFilteredEdges: GraphEdge[] = [];
  const filteredEdges = $derived.by(() => {
    if (edgesSig === lastEdgesSig) return cachedFilteredEdges;
    lastEdgesSig = edgesSig;
    cachedFilteredEdges = filterEdges(edges, filteredIds);
    return cachedFilteredEdges;
  });
  const focusId = $derived(highlight.hoveredId ?? selectedId);
  const hoverDistances = $derived(bfsDistances(focusId, filteredEdges));
  const visibleIds = $derived(adjacentToSet(openedIds, filteredEdges));

  type SankeyNode = SankeyPayloadNode & {
    x0?: number; x1?: number; y0?: number; y1?: number;
    sourceLinks?: SankeyLink[];
    targetLinks?: SankeyLink[];
  };
  type SankeyLink = Omit<SankeyPayloadLink, 'source' | 'target'> & {
    width?: number;
    source: SankeyNode | string;
    target: SankeyNode | string;
  };

  // Tier label per column (for header text). Computed from the
  // present kinds in the same compact-tier order as sankey-layout.ts
  // assignSankeyColumns.
  const columnLabels = $derived.by(() => {
    const present = new Set(filteredNodes.map((n) => String(n.kind).toLowerCase()));
    const ordered: string[] = [];
    for (const t of TYPE_ORDER) if (present.has(t)) ordered.push(t);
    for (const t of present) if (!ordered.includes(t)) ordered.push(t);
    return ordered;
  });

  const layout = $derived.by<{ nodes: SankeyNode[]; links: SankeyLink[]; viewW: number; viewH: number; droppedLabels: Set<string> }>(() => {
    const payload = buildSankeyPayload(filteredNodes, filteredEdges);
    const colCount = Math.max(1, columnLabels.length);
    // Width = left gutter + each column (node + gap) + right gutter.
    const viewW = LABEL_GUTTER + MARGIN + colCount * NODE_WIDTH + (colCount - 1) * LAYER_GAP + MARGIN + LABEL_GUTTER;

    if (payload.nodes.length === 0) {
      return { nodes: [], links: [], viewW, viewH: MIN_CANVAS_HEIGHT_PX, droppedLabels: new Set<string>() };
    }

    // Per-node flow weight = max(sum_incoming_value, sum_outgoing_value).
    // Bar height = weight * LINK_HEIGHT, exactly like classic sankey diagrams.
    // Orphans (no edges) get ORPHAN_BAR_HEIGHT so they remain visible.
    const inSum = new Map<string, number>();
    const outSum = new Map<string, number>();
    for (const l of payload.links) {
      inSum.set(l.target, (inSum.get(l.target) ?? 0) + l.value);
      outSum.set(l.source, (outSum.get(l.source) ?? 0) + l.value);
    }
    const flowWeight = (id: string) => Math.max(inSum.get(id) ?? 0, outSum.get(id) ?? 0);

    // Compute viewH from the densest column. Connected bars contribute
    // weight * LINK_HEIGHT; orphans contribute ORPHAN_BAR_HEIGHT each.
    // Padding goes between every node within a column; ORPHAN_GROUP_GAP
    // separates the connected and orphan groups when both are present.
    const colHeights = new Map<number, number>();
    for (const n of payload.nodes) {
      const col = n.column;
      const w = flowWeight(n.id);
      const bar = w > 0 ? w * LINK_HEIGHT : ORPHAN_BAR_HEIGHT;
      colHeights.set(col, (colHeights.get(col) ?? 0) + bar);
    }
    const colNodeCount = new Map<number, { connected: number; orphan: number }>();
    for (const n of payload.nodes) {
      const col = n.column;
      const slot = colNodeCount.get(col) ?? { connected: 0, orphan: 0 };
      if (flowWeight(n.id) > 0) slot.connected += 1;
      else slot.orphan += 1;
      colNodeCount.set(col, slot);
    }
    let maxColHeight = 0;
    for (const [col, h] of colHeights) {
      const slot = colNodeCount.get(col) ?? { connected: 0, orphan: 0 };
      const total = h + Math.max(0, slot.connected + slot.orphan - 1) * NODE_PADDING +
        (slot.connected > 0 && slot.orphan > 0 ? ORPHAN_GROUP_GAP : 0);
      if (total > maxColHeight) maxColHeight = total;
    }
    const viewH = Math.max(MIN_CANVAS_HEIGHT_PX, maxColHeight + 2 * MARGIN);

    const generator = sankey<SankeyNode, SankeyLink>()
      .nodeId((d: SankeyNode) => d.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeSort((a, b) => {
        const ad = (a.sourceLinks?.length ?? 0) + (a.targetLinks?.length ?? 0);
        const bd = (b.sourceLinks?.length ?? 0) + (b.targetLinks?.length ?? 0);
        if (ad !== bd) return bd - ad;
        return a.id.localeCompare(b.id);
      })
      .extent([
        [LABEL_GUTTER + MARGIN, MARGIN],
        [viewW - LABEL_GUTTER - MARGIN, viewH - MARGIN]
      ]);
    const graph: SankeyGraph<SankeyNode, SankeyLink> = generator({
      nodes: payload.nodes.map((n) => ({ ...n })),
      links: payload.links.map((l) => ({ ...l }))
    });

    // Override d3-sankey's x positions with the fixed type-tier grid.
    for (const n of graph.nodes) {
      const col = n.column ?? 0;
      const x0 = LABEL_GUTTER + MARGIN + col * (NODE_WIDTH + LAYER_GAP);
      n.x0 = x0;
      n.x1 = x0 + NODE_WIDTH;
    }

    // Restack each column so connected bars share LINK_HEIGHT scale and
    // orphans fall below them with ORPHAN_GROUP_GAP. This keeps bar
    // height proportional to flow (image #8 spec) and groups disconnected
    // nodes visually.
    const byColumn = new Map<number, SankeyNode[]>();
    for (const n of graph.nodes) {
      const col = n.column ?? 0;
      const bucket = byColumn.get(col) ?? [];
      bucket.push(n);
      byColumn.set(col, bucket);
    }
    const isOrphan = (n: SankeyNode) => flowWeight(n.id) === 0;
    for (const bucket of byColumn.values()) {
      const connected = bucket.filter((n) => !isOrphan(n)).sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
      const orphans = bucket.filter(isOrphan).sort((a, b) => a.id.localeCompare(b.id));
      let y = MARGIN;
      for (const n of connected) {
        const h = flowWeight(n.id) * LINK_HEIGHT;
        n.y0 = y;
        n.y1 = y + h;
        y += h + NODE_PADDING;
      }
      if (connected.length > 0 && orphans.length > 0) y += ORPHAN_GROUP_GAP;
      for (const n of orphans) {
        n.y0 = y;
        n.y1 = y + ORPHAN_BAR_HEIGHT;
        y += ORPHAN_BAR_HEIGHT + NODE_PADDING;
      }
    }

    // Re-anchor link endpoints — distribute each node's outgoing links
    // across its bar by value, then incoming. With bar_h = total_flow *
    // LINK_HEIGHT, every link slot lands at exactly LINK_HEIGHT pixels.
    for (const n of graph.nodes) {
      const totalOut = (n.sourceLinks ?? []).reduce((s, l) => s + (l.value ?? 0), 0);
      const totalIn = (n.targetLinks ?? []).reduce((s, l) => s + (l.value ?? 0), 0);
      const h = (n.y1 ?? 0) - (n.y0 ?? 0);
      let oy = n.y0 ?? 0;
      const outScale = totalOut > 0 ? h / totalOut : 0;
      for (const l of (n.sourceLinks ?? [])) {
        const w = (l.value ?? 0) * outScale;
        l.y0 = oy + w / 2;
        oy += w;
      }
      let iy = n.y0 ?? 0;
      const inScale = totalIn > 0 ? h / totalIn : 0;
      for (const l of (n.targetLinks ?? [])) {
        const w = (l.value ?? 0) * inScale;
        l.y1 = iy + w / 2;
        iy += w;
      }
    }
    const droppedLabels = dropCollidingLabels(
      graph.nodes.map((n) => ({ id: n.id, column: n.column, x0: n.x0, y0: n.y0, y1: n.y1 })),
      LABEL_LINE_HEIGHT_PX
    );
    return { nodes: graph.nodes, links: graph.links, viewW, viewH, droppedLabels };
  });

  const linkPath = $derived.by(() => sankeyLinkHorizontal<SankeyNode, SankeyLink>());

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewportW = rect.width;
    viewportH = rect.height;
  }

  function fitToView(animated = true) {
    if (!svgEl || !zoomBehavior) return;
    // Width-driven fit: bars keep MIN_NODE_HEIGHT chrome at any density.
    // For dense workspaces the canvas is taller than the viewport — user
    // pans vertically with mouse-drag. Centring vertically when the
    // layout is short prevents top-pinned dead space on small workspaces.
    const fitW = (viewportW - 40) / layout.viewW;
    const k = Math.max(0.3, Math.min(1.5, fitW));
    const tx = (viewportW - layout.viewW * k) / 2;
    const fitsHeight = layout.viewH * k <= viewportH - 40;
    const ty = fitsHeight ? (viewportH - layout.viewH * k) / 2 : 20;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  // Reset didFit when the layout shape changes substantially (node count
  // or column-driven viewW). Without this, clearing a filter chip leaves
  // the previous fit transform in place and the diagram paints
  // microscopic on the unchanged zoom. Coarse-grained signature avoids
  // re-fitting on every micro tick.
  let lastLayoutShape = '';
  $effect(() => {
    const shape = `${layout.nodes.length}:${layout.viewW | 0}:${layout.viewH | 0}`;
    if (shape !== lastLayoutShape) {
      lastLayoutShape = shape;
      didFit = false;
    }
  });

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

  export function panTo(canvasX: number, canvasY: number, k = transform.k) {
    if (!svgEl || !zoomBehavior) return;
    const tx = viewportW / 2 - canvasX * k;
    const ty = viewportH / 2 - canvasY * k;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    select(svgEl)
      .transition()
      .duration(motionDuration(180))
      .call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (!onViewState) return;
    const ns = layout.nodes;
    const t = transform;
    const w = viewportW;
    const h = viewportH;
    onViewState({
      nodes: ns.map((n) => ({
        id: n.id,
        x: ((n.x0 ?? 0) + (n.x1 ?? 0)) / 2,
        y: ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2,
        kind: n.kind
      })),
      transform: { x: t.x, y: t.y, k: t.k },
      viewport: { w, h }
    });
  });

  function selectId(id: string, event?: Event) {
    onSelect?.({ id, event });
  }

  function linkPair(l: SankeyLink): { from: string; to: string } {
    const src = l.source as SankeyNode | string;
    const tgt = l.target as SankeyNode | string;
    const from = typeof src === 'string' ? src : src.id;
    const to = typeof tgt === 'string' ? tgt : tgt.id;
    return { from, to };
  }

  function tierHeaderX(col: number): number {
    return LABEL_GUTTER + MARGIN + col * (NODE_WIDTH + LAYER_GAP) + NODE_WIDTH / 2;
  }
</script>

<svg
  bind:this={svgEl}
  class="graph"
  class:focus-soft={highlight.hoveredId === null && selectedId !== null}
  role="img"
  aria-label="Sankey flow diagram by artifact type tier"
>
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    <!-- Tier headers across the top — capitalised kind name per column. -->
    {#each columnLabels as label, col (label + ':' + col)}
      <text
        class="tier-header"
        x={tierHeaderX(col)}
        y={MARGIN - 12}
        text-anchor="middle"
      >{label.toUpperCase()}</text>
      <line
        class="tier-divider"
        x1={tierHeaderX(col)}
        x2={tierHeaderX(col)}
        y1={MARGIN - 6}
        y2={layout.viewH - MARGIN + 6}
      />
    {/each}

    {#each layout.links as l (`${linkPair(l).from}>${linkPair(l).to}:${l.relation}`)}
      {@const pair = linkPair(l)}
      <path
        class="link {edgeClass(pair.from, pair.to, focusId, openedIds)}"
        d={linkPath(l) ?? ''}
        style:stroke={relationStroke(l.relation)}
        stroke-width={(l.value ?? 1) * LINK_HEIGHT}
        fill="none"
      >
        <title>{pair.from} → {pair.to} ({l.relation})</title>
      </path>
    {/each}

    {#each layout.nodes as n (n.id)}
      {@const x0 = n.x0 ?? 0}
      {@const x1 = n.x1 ?? 0}
      {@const y0 = n.y0 ?? 0}
      {@const y1 = n.y1 ?? 0}
      {@const isFirstCol = (n.column ?? 0) === 0}
      <g
        class="node {nodeClass(n.id, focusId, hoverDistances, openedIds, visibleIds)}"
        class:selected={n.id === selectedId}
        class:opened={openedIds.has(n.id) && n.id !== selectedId}
        class:hovered={n.id === highlight.hoveredId}
        data-id={n.id}
        onclick={(e) => { e.stopPropagation(); selectId(n.id, e); }}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectId(n.id, e)}
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
          style:fill={kindBorder(n.kind)}
        />
        <text
          class="label"
          class:label-hidden={layout.droppedLabels.has(n.id)}
          x={isFirstCol ? x0 - 8 : x1 + 8}
          y={(y0 + y1) / 2}
          dy="0.32em"
          text-anchor={isFirstCol ? 'end' : 'start'}
        >
          {n.id}
        </text>
        <circle
          class="status-dot"
          cx={isFirstCol ? x0 - 4 : x1 + 4}
          cy={y0 - 4}
          r="2.6"
          style:fill={statusRing(n.status)}
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

  .tier-header {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    fill: var(--fg-2);
    pointer-events: none;
  }
  .tier-divider {
    stroke: var(--canvas-stroke-faint);
    stroke-width: 1;
    stroke-dasharray: 2 6;
    pointer-events: none;
  }

  .link {
    transition: stroke-opacity 180ms ease-out, stroke-width 120ms;
    stroke-opacity: 0.36;
  }
  .link.edge-active { stroke-opacity: 0.92 !important; }
  .link.edge-dim { stroke-opacity: 0.12 !important; }

  .node { cursor: pointer; transition: opacity 180ms ease-out; }
  .node-active { opacity: 1; }
  .node-near { opacity: 0.92; }
  .node-mid { opacity: 0.7; }
  .node-far { opacity: 0.5; }
  .node-outside { opacity: 0.32; }
  .graph.focus-soft .node-near { opacity: 0.95; }
  .graph.focus-soft .node-mid { opacity: 0.78; }
  .graph.focus-soft .node-far { opacity: 0.66; }
  .graph.focus-soft .node-outside { opacity: 0.55; }

  .bar {
    transition: fill 120ms, stroke 120ms, filter 120ms;
    stroke: transparent;
    stroke-width: 0;
    fill-opacity: 0.78;
  }
  .label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.02em;
    pointer-events: auto;
    fill: var(--canvas-label);
    opacity: 1;
    transition: fill 120ms, opacity 120ms;
  }
  .label.label-hidden { opacity: 0; pointer-events: none; }
  .node:hover .label.label-hidden,
  .node:focus-visible .label.label-hidden,
  .node.hovered .label.label-hidden,
  .node.selected .label.label-hidden { opacity: 1; }
  .status-dot { pointer-events: none; opacity: 0.85; }

  /* Hover / focus: bar pops to full opacity + accent stroke; label
     turns white for max contrast against the dim background. */
  .node:hover .bar,
  .node:focus-visible .bar,
  .node.hovered .bar {
    fill-opacity: 1;
    stroke: var(--accent);
    stroke-width: 1.4;
    filter: drop-shadow(0 0 8px var(--accent));
    outline: none;
  }
  .node:hover .label,
  .node:focus-visible .label,
  .node.hovered .label {
    fill: var(--canvas-label-strong);
  }
  /* Selected: same accent stroke as hover but persistent; text
     switches to accent so user can find the active node visually
     even after moving the mouse away. */
  .node.selected .bar {
    fill-opacity: 1;
    stroke: var(--accent);
    stroke-width: 2;
    filter: drop-shadow(0 0 8px var(--accent));
  }
  .node.selected .label {
    fill: var(--accent);
  }
</style>
