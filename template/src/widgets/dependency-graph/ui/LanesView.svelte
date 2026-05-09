<script lang="ts">
  import { zoom, zoomIdentity, select, type ZoomBehavior } from '@/widgets/dependency-graph/lib/d3';
  import {
    type ArtifactSummary,
    kindBorder,
    kindLabel,
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

  const ROW_GAP = 14;
  const LANE_PAD = 16;
  const LANE_HEADER = 36;
  const MARGIN = 24;

  // Canonical kind order for Forgeplan; unknown kinds are appended at end.
  const KIND_ORDER = ['epic', 'prd', 'spec', 'rfc', 'adr', 'evidence', 'evid', 'problem', 'solution', 'note'];

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
    w: number;
    h: number;
    x: number;
    y: number;
  };

  type Lane = { kind: string; x: number; width: number; count: number };
  type Layout = { placed: Placed[]; lanes: Lane[]; width: number; height: number };

  const layout = $derived(computeLayout(filteredNodes));

  function computeLayout(ns: ArtifactSummary[]): Layout {
    if (ns.length === 0) return { placed: [], lanes: [], width: 0, height: 0 };

    const byKind = new Map<string, ArtifactSummary[]>();
    for (const n of ns) {
      const k = n.kind.toLowerCase();
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(n);
    }

    const presentKinds = [...byKind.keys()].sort((a, b) => {
      const ia = KIND_ORDER.indexOf(a);
      const ib = KIND_ORDER.indexOf(b);
      const ra = ia < 0 ? KIND_ORDER.length + a.charCodeAt(0) : ia;
      const rb = ib < 0 ? KIND_ORDER.length + b.charCodeAt(0) : ib;
      return ra - rb;
    });

    const STATUS_ORDER = ['active', 'draft', 'stale', 'superseded', 'deprecated'];
    for (const arr of byKind.values()) {
      arr.sort((a, b) => {
        const ia = STATUS_ORDER.indexOf(a.status.toLowerCase());
        const ib = STATUS_ORDER.indexOf(b.status.toLowerCase());
        const ra = ia < 0 ? STATUS_ORDER.length : ia;
        const rb = ib < 0 ? STATUS_ORDER.length : ib;
        if (ra !== rb) return ra - rb;
        return a.id.localeCompare(b.id);
      });
    }

    const laneWidths = new Map<string, number>();
    for (const k of presentKinds) {
      const items = byKind.get(k)!;
      const widest = items.reduce((m, n) => Math.max(m, nodeWidth(n.id)), 0);
      laneWidths.set(k, Math.max(140, widest + LANE_PAD * 2));
    }

    const lanes: Lane[] = [];
    const placed: Placed[] = [];
    let cx = MARGIN;
    let maxRows = 0;
    for (const k of presentKinds) {
      const items = byKind.get(k)!;
      const lw = laneWidths.get(k)!;
      lanes.push({ kind: k, x: cx, width: lw, count: items.length });
      const innerCenter = cx + lw / 2;
      let rowY = MARGIN + LANE_HEADER + LANE_PAD;
      for (const n of items) {
        const w = nodeWidth(n.id);
        placed.push({
          id: n.id,
          kind: n.kind,
          status: n.status,
          title: n.title,
          w,
          h: NODE_H,
          x: innerCenter,
          y: rowY + NODE_H / 2
        });
        rowY += NODE_H + ROW_GAP;
      }
      if (items.length > maxRows) maxRows = items.length;
      cx += lw;
    }

    const totalW = cx + MARGIN;
    const totalH = MARGIN + LANE_HEADER + LANE_PAD * 2 + maxRows * (NODE_H + ROW_GAP) - ROW_GAP + MARGIN;
    return { placed, lanes, width: totalW, height: totalH };
  }

  type EdgePath = { d: string; relation: string; from: string; to: string; key: string };

  const edgePaths = $derived(computePaths(filteredEdges, layout));

  function computePaths(es: GraphEdge[], lay: Layout): EdgePath[] {
    const byId = new Map(lay.placed.map((p) => [p.id, p]));
    const out: EdgePath[] = [];
    for (const e of es) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const sameLane = a.kind.toLowerCase() === b.kind.toLowerCase();
      const x1 = a.x + a.w / 2;
      const y1 = a.y;
      const x2 = b.x - b.w / 2;
      const y2 = b.y;
      let d: string;
      if (sameLane) {
        const bend = 26;
        d = `M ${a.x + a.w / 2} ${y1} C ${a.x + a.w / 2 + bend} ${y1}, ${b.x + b.w / 2 + bend} ${y2}, ${b.x + b.w / 2} ${y2}`;
      } else if (x2 > x1) {
        const dx = (x2 - x1) * 0.5;
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      } else {
        const dx = (x1 - x2) * 0.5;
        d = `M ${a.x - a.w / 2} ${y1} C ${a.x - a.w / 2 - dx} ${y1}, ${b.x + b.w / 2 + dx} ${y2}, ${b.x + b.w / 2} ${y2}`;
      }
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
    if (layout.width === 0) return;
    const k = Math.max(0.05, Math.min(2, (viewportW - 40) / layout.width, (viewportH - 40) / Math.max(1, layout.height)));
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

<svg bind:this={svgEl} class="graph" class:focus-soft={highlight.hoveredId === null && selectedId !== null} class:impact-mode={highlight.impactRoot !== null} role="img" aria-label="Lanes view: artifacts grouped by lifecycle status">
  <defs>
    <pattern id="dot-grid-lanes" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" style:fill="var(--dot-grid-color)" />
    </pattern>
  </defs>
  <rect class="bg" x="0" y="0" width="100%" height="100%" fill="url(#dot-grid-lanes)" />
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    {#each layout.lanes as lane (lane.kind)}
      <rect
        class="lane"
        x={lane.x}
        y={MARGIN}
        width={lane.width}
        height={layout.height - MARGIN * 2}
      />
      <rect
        class="lane-header"
        x={lane.x}
        y={MARGIN}
        width={lane.width}
        height={LANE_HEADER}
      />
      <text
        class="lane-title"
        x={lane.x + lane.width / 2}
        y={MARGIN + LANE_HEADER / 2 + 4}
        text-anchor="middle"
      >
        {kindLabel(lane.kind)} <tspan class="lane-count">· {lane.count}</tspan>
      </text>
    {/each}

    {#each edgePaths as p (p.key)}
      <path class="{relationClass(p.relation)} {edgeClass(p.from, p.to, focusId, openedIds)}" d={p.d} />
    {/each}

    {#each layout.placed as node (node.id)}
      <g
        class="node {nodeClass(node.id, focusId, hoverDistances, visibleIds)} {impactedClass(node.id, impactedMap)}"
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
        <text class="label" x={node.w / 2} y={node.h / 2 + 4} text-anchor="middle" style:fill={kindLabelColor(node.kind)}>
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
        <circle class="status-dot" cx={node.w + 8} cy={node.h / 2} r="3.2" style:fill={statusRing(node.status)} />
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
  .graph:active { cursor: grabbing; }
  .lane {
    fill: var(--canvas-stroke-faint);
    stroke: var(--line);
    stroke-width: 1;
  }
  .lane-header {
    fill: var(--bg-1);
    stroke: var(--line);
    stroke-width: 1;
  }
  .lane-title {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    fill: var(--fg-2);
    pointer-events: none;
  }
  .lane-count { fill: var(--fg-3); }
  .edge {
    stroke: var(--canvas-stroke);
    stroke-width: 1;
    fill: none;
    transition: stroke 180ms ease-out, stroke-width 180ms ease-out, opacity 180ms ease-out;
  }
  .edge.informs { stroke: var(--canvas-stroke-2); stroke-dasharray: 4 4; }
  .edge.risk { stroke: var(--accent); stroke-dasharray: 3 3; }
  .node {
    cursor: pointer;
    transition: opacity 180ms ease-out;
  }
  .node-active { opacity: 1; }
  .node-near { opacity: 0.88; }
  .node-mid { opacity: 0.62; }
  .node-far { opacity: 0.46; }
  .node-outside { opacity: 0.34; }
  .graph.focus-soft .node-near { opacity: 0.92; }
  .graph.focus-soft .node-mid { opacity: 0.75; }
  .graph.focus-soft .node-far { opacity: 0.64; }
  .graph.focus-soft .node-outside { opacity: 0.56; }
  .graph.focus-soft .edge-dim { opacity: 0.62; }
  .node .box { fill: var(--bg-1); stroke-width: 1; transition: stroke-width 120ms; }
  .node:hover .box { stroke-width: 1.6; outline: none; }
  .node:focus-visible .box { stroke: var(--accent); stroke-width: 1.6; outline: none; }
  .node.selected .box { stroke-width: 2; filter: drop-shadow(0 0 8px currentColor); }
  .node.selected .label { fill: var(--accent); }
  .selection-ring {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    pointer-events: none;
    filter: drop-shadow(0 0 8px currentColor);
  }
  .label { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.02em; pointer-events: none; }
  .status-dot { pointer-events: none; opacity: 0.85; }
  .reff-bar { pointer-events: none; opacity: 0.85; }
  .edge-active {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .edge-dim {
    opacity: 0.44;
  }
</style>
