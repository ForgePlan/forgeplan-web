<script lang="ts">
  import { zoom, zoomIdentity, select, type ZoomBehavior } from '@/widgets/dependency-graph/lib/d3';
  import {
    type ArtifactSummary,
    kindBorder,
    kindLabelColor,
    statusRing
  } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import { reffBarColor, type ScoreEntry } from '@/entities/score';
  import { CHAR_W, NODE_H, NODE_PAD_X } from '@/widgets/dependency-graph/lib/sizing';
  import { filterArtifacts, filterEdges } from '../lib/filter';
  import { nodesContentSignature, edgesContentSignature } from '../lib/filter-memo.svelte';
  import { relationClass } from '../lib/relation';
  import { motionDuration } from '../lib/reduced-motion';
  import { highlight, setHovered, clearHovered, edgeClass, bfsDistances, nodeClass, impactedClass, adjacentToSet } from '../lib/highlight.svelte';
  import { computeDownstream, computeUpstream } from '../lib/impact-graph';
  import { pickNextNode, type Direction } from '../lib/keyboard-nav';
  import { kindTierLayer, wrapColumns } from '../lib/tree-layout';

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

  const ROW_GAP = 70;
  const SUB_ROW_GAP = 12;
  const COL_GAP = 28;
  const MARGIN = 40;
  const WRAP_VIEWPORT_RATIO = 1.5;
  const MIN_WRAP_BUDGET_PX = 800;

  function nodeWidth(id: string): number {
    return Math.max(96, Math.round(id.length * CHAR_W + NODE_PAD_X * 2));
  }

  let svgEl = $state<SVGSVGElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = false;

  const scoreById = $derived(new Map<string, number>(scores.map((s) => [s.id, s.r_eff])));

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
  const impactedMap = $derived.by(() => {
    if (!highlight.impactRoot) return null;
    return highlight.impactDirection === 'up'
      ? computeUpstream(highlight.impactRoot, filteredEdges)
      : computeDownstream(highlight.impactRoot, filteredEdges);
  });

  type Placed = {
    id: string;
    kind: string;
    status: string;
    title: string;
    r_eff: number;
    w: number;
    h: number;
    x: number;
    y: number;
  };

  type Layout = {
    placed: Placed[];
    width: number;
    height: number;
  };

  const layout = $derived(computeLayout(filteredNodes, filteredEdges, scoreById, viewportW));

  const layoutPaths = $derived(computeEdgePaths(filteredEdges, layout));

  function computeLayout(
    ns: ArtifactSummary[],
    _es: GraphEdge[],
    scoreMap: Map<string, number>,
    vpW: number
  ): Layout {
    if (ns.length === 0) {
      return { placed: [], width: 0, height: 0 };
    }

    const allKinds = ns.map((n) => n.kind);
    const layer = new Map<string, number>();
    for (const n of ns) layer.set(n.id, kindTierLayer(n.kind, allKinds));

    const byLayer = new Map<number, string[]>();
    for (const [id, l] of layer) {
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l)!.push(id);
    }

    const meta = new Map(ns.map((n) => [n.id, n] as const));
    for (const arr of byLayer.values()) {
      arr.sort((a, b) => {
        const ma = meta.get(a)!;
        const mb = meta.get(b)!;
        if (ma.kind !== mb.kind) return ma.kind.localeCompare(mb.kind);
        return a.localeCompare(b);
      });
    }

    const widths = new Map<string, number>();
    for (const n of ns) widths.set(n.id, nodeWidth(n.id));

    const layerOrder = [...byLayer.keys()].sort((a, b) => a - b);
    const maxRowW = Math.max(MIN_WRAP_BUDGET_PX, vpW * WRAP_VIEWPORT_RATIO);

    type Wrapped = { layer: number; subRows: string[][]; rowWidths: number[] };
    const wrapped: Wrapped[] = layerOrder.map((l) => {
      const ids = byLayer.get(l)!;
      const subRows = wrapColumns(ids, widths, maxRowW, COL_GAP);
      const rowWidths = subRows.map(
        (sr) =>
          sr.reduce((s, id) => s + widths.get(id)!, 0) +
          COL_GAP * Math.max(0, sr.length - 1)
      );
      return { layer: l, subRows, rowWidths };
    });

    let canvasMaxRowW = 0;
    for (const w of wrapped) {
      for (const rw of w.rowWidths) if (rw > canvasMaxRowW) canvasMaxRowW = rw;
    }

    const placed: Placed[] = [];
    let cy = MARGIN;
    wrapped.forEach((w, li) => {
      w.subRows.forEach((subRow, sri) => {
        const rowW = w.rowWidths[sri] ?? 0;
        let cx = (canvasMaxRowW - rowW) / 2 + MARGIN;
        for (const id of subRow) {
          const m = meta.get(id)!;
          const nw = widths.get(id)!;
          placed.push({
            id,
            kind: m.kind,
            status: m.status,
            title: m.title,
            r_eff: scoreMap.get(id) ?? 0,
            w: nw,
            h: NODE_H,
            x: cx + nw / 2,
            y: cy + NODE_H / 2
          });
          cx += nw + COL_GAP;
        }
        cy += NODE_H;
        if (sri < w.subRows.length - 1) cy += SUB_ROW_GAP;
      });
      if (li < wrapped.length - 1) cy += ROW_GAP;
    });

    const totalHeight = cy - MARGIN + MARGIN * 2;
    return {
      placed,
      width: canvasMaxRowW + MARGIN * 2,
      height: totalHeight
    };
  }

  type EdgePath = { d: string; relation: string; from: string; to: string; key: string };

  function computeEdgePaths(es: GraphEdge[], lay: Layout): EdgePath[] {
    const byId = new Map(lay.placed.map((p) => [p.id, p]));
    const out: EdgePath[] = [];
    for (const e of es) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const x1 = a.x;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y - b.h / 2;
      const dy = y2 - y1;
      const c1y = y1 + dy * 0.5;
      const c2y = y2 - dy * 0.5;
      const d = `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
      out.push({ d, relation: e.relation, from: e.from, to: e.to, key: `${e.from}>${e.to}:${e.relation}` });
    }
    return out;
  }

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewportW = rect.width;
    viewportH = rect.height;
  }

  function fitToView(animated = true) {
    if (!svgEl || !zoomBehavior) return;
    if (layout.width === 0 || layout.height === 0) return;
    const scale = Math.min(
      2,
      (viewportW - 40) / Math.max(1, layout.width),
      (viewportH - 40) / Math.max(1, layout.height)
    );
    const k = Math.max(0.05, scale);
    const tx = (viewportW - layout.width * k) / 2;
    const ty = (viewportH - layout.height * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (svgEl && zoomBehavior && layout.width > 0 && !didFit) {
      didFit = true;
      queueMicrotask(() => fitToView(false));
    }
  });

  $effect(() => {
    if (!svgEl) return;
    handleResize();
    window.addEventListener('resize', handleResize);

    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 50])
      .on('zoom', (event) => {
        transform = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k
        };
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
    const placed = layout.placed;
    const t = transform;
    const w = viewportW;
    const h = viewportH;
    onViewState({
      nodes: placed.map((p) => ({ id: p.id, x: p.x, y: p.y, kind: p.kind })),
      transform: { x: t.x, y: t.y, k: t.k },
      viewport: { w, h }
    });
  });

  function onNodeClick(id: string, event?: Event) {
    onSelect?.({ id, event });
  }

  function focusNodeById(id: string) {
    const target = svgEl?.querySelector<SVGGElement>(`g.node[data-id="${CSS.escape(id)}"]`);
    target?.focus();
  }

  function onNodeKeydown(e: KeyboardEvent, currentId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNodeClick(currentId, e);
      return;
    }
    if (
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'ArrowDown'
    ) {
      return;
    }
    e.preventDefault();
    const current = layout.placed.find((p) => p.id === currentId);
    if (!current) return;
    const next = pickNextNode(
      { id: current.id, x: current.x, y: current.y },
      layout.placed.map((p) => ({ id: p.id, x: p.x, y: p.y })),
      e.key as Direction,
    );
    if (next) focusNodeById(next.id);
  }
</script>

<svg
  bind:this={svgEl}
  class="graph"
  class:focus-soft={highlight.hoveredId === null && selectedId !== null}
  class:impact-mode={highlight.impactRoot !== null}
  role="img"
  aria-label="Tree hierarchy of artifacts by parent epic"
  preserveAspectRatio="xMidYMid meet"
>
  <defs>
    <pattern id="dot-grid-tree" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" style:fill="var(--dot-grid-color)" />
    </pattern>
    <marker
      id="tree-arrow"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" style:fill="var(--canvas-stroke)" />
    </marker>
    <marker
      id="tree-arrow-informs"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" style:fill="var(--canvas-stroke-2)" />
    </marker>
    <marker
      id="tree-arrow-risk"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
    </marker>
  </defs>
  <rect class="bg" x="0" y="0" width="100%" height="100%" fill="url(#dot-grid-tree)" />
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    {#each layoutPaths as p (p.key)}
      <path
        class="{relationClass(p.relation)} {edgeClass(p.from, p.to, focusId, openedIds)}"
        d={p.d}
        marker-end={p.relation?.toLowerCase() === 'informs'
          ? 'url(#tree-arrow-informs)'
          : p.relation?.toLowerCase() === 'risks' || p.relation?.toLowerCase() === 'risk'
          ? 'url(#tree-arrow-risk)'
          : 'url(#tree-arrow)'}
      />
    {/each}
    {#each layout.placed as node (node.id)}
      <g
        class="node {nodeClass(node.id, focusId, hoverDistances, openedIds, visibleIds)} {impactedClass(node.id, impactedMap)}"
        class:selected={node.id === selectedId}
        class:opened={openedIds.has(node.id) && node.id !== selectedId}
        data-id={node.id}
        transform="translate({node.x - node.w / 2},{node.y - node.h / 2})"
        onclick={(e) => { e.stopPropagation(); onNodeClick(node.id, e); }}
        onkeydown={(e) => onNodeKeydown(e, node.id)}
        onmouseenter={() => setHovered(node.id)}
        onmouseleave={clearHovered}
        onfocus={() => setHovered(node.id)}
        onblur={clearHovered}
        role="button"
        tabindex="0"
        aria-label={`${node.id}: ${node.title}`}
      >
        <rect class="box" width={node.w} height={node.h} rx="3" ry="3" style:stroke={kindBorder(node.kind)} />
        <text
          class="label"
          x={node.w / 2}
          y={node.h / 2 + 4}
          text-anchor="middle"
          style:fill={kindLabelColor(node.kind)}
        >
          {node.id}
        </text>
        {#if node.id === selectedId}
          <rect
            class="selection-ring"
            width={node.w}
            height={node.h}
            rx="3"
            ry="3"
          />
        {/if}
        <circle
          class="status-dot"
          cx={node.w + 8}
          cy={node.h / 2}
          r="3.2"
          style:fill={statusRing(node.status)}
        />
        {#if (scoreById.get(node.id) ?? 0) > 0}
          <rect
            class="reff-bar"
            x="0"
            y={node.h + 3}
            width={node.w * Math.min(1, scoreById.get(node.id) ?? 0)}
            height="2"
            style:fill={reffBarColor(scoreById.get(node.id))}
          />
        {/if}
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
  .graph:active {
    cursor: grabbing;
  }
  .edge {
    stroke: var(--canvas-stroke);
    stroke-width: 1.2;
    fill: none;
    transition: stroke 180ms ease-out, stroke-width 180ms ease-out, opacity 180ms ease-out;
  }
  .edge.informs {
    stroke: var(--canvas-stroke-2);
    stroke-dasharray: 4 4;
  }
  .edge.risk {
    stroke: var(--accent);
    stroke-dasharray: 3 3;
  }
  .node {
    cursor: pointer;
    transition: opacity 180ms ease-out;
  }
  .node-active {
    opacity: 1;
  }
  .node-near {
    opacity: 0.88;
  }
  .node-mid {
    opacity: 0.62;
  }
  .node-far {
    opacity: 0.46;
  }
  .node-outside {
    opacity: 0.34;
  }
  .graph.focus-soft .node-near { opacity: 0.92; }
  .graph.focus-soft .node-mid { opacity: 0.75; }
  .graph.focus-soft .node-far { opacity: 0.64; }
  .graph.focus-soft .node-outside { opacity: 0.56; }
  .graph.focus-soft .edge-dim { opacity: 0.62; }
  .node .box {
    fill: var(--bg-1);
    stroke-width: 1;
    transition: stroke-width 120ms;
  }
  .node:hover .box {
    stroke-width: 1.6;
    outline: none;
  }
  .node:focus-visible .box {
    stroke: var(--accent);
    stroke-width: 1.6;
    outline: none;
  }
  .node.selected .box {
    stroke-width: 2;
    filter: drop-shadow(0 0 8px var(--accent));
  }
  .node.selected .label {
    fill: var(--accent);
  }
  .selection-ring {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    pointer-events: none;
    filter: drop-shadow(0 0 8px var(--accent));
  }
  .label {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.02em;
    pointer-events: none;
  }
  .status-dot {
    pointer-events: none;
    opacity: 0.85;
  }
  .reff-bar {
    pointer-events: none;
    opacity: 0.85;
  }
  .edge-active {
    stroke: var(--accent);
  }
  .edge-dim {
    opacity: 0.18;
  }
</style>
