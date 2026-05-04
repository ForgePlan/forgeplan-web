<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { select } from 'd3-selection';
  import 'd3-transition';
  import type { ArtifactSummary, GraphEdge, ScoreEntry } from '$lib/types';
  import { kindBorder, kindLabelColor, kindLabel, statusRing, reffTone } from '$lib/theme';

  export let nodes: ArtifactSummary[] = [];
  export let edges: GraphEdge[] = [];
  export let scores: ScoreEntry[] = [];
  export let selectedId: string | null = null;
  export let kindFilter: Set<string> = new Set();
  export let statusFilter: Set<string> = new Set();

  const dispatch = createEventDispatcher<{ select: { id: string } }>();

  const NODE_H = 28;
  const NODE_PAD_X = 14;
  const CHAR_W = 7.7;
  const ROW_GAP = 14;
  const LANE_PAD = 16;
  const LANE_HEADER = 36;
  const MARGIN = 24;

  // Canonical kind order for Forgeplan; unknown kinds are appended at end.
  const KIND_ORDER = ['epic', 'prd', 'spec', 'rfc', 'adr', 'evidence', 'evid', 'problem', 'solution', 'note'];

  function nodeWidth(id: string): number {
    return Math.max(96, Math.round(id.length * CHAR_W + NODE_PAD_X * 2));
  }

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
  $: filteredIds = new Set(filteredNodes.map((n) => n.id));
  $: filteredEdges = edges.filter((e) => filteredIds.has(e.from) && filteredIds.has(e.to));

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

  $: layout = computeLayout(filteredNodes);

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

  type EdgePath = { d: string; relation: string; key: string };

  $: edgePaths = computePaths(filteredEdges, layout);

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
      out.push({ d, relation: e.relation, key: `${e.from}>${e.to}:${e.relation}` });
    }
    return out;
  }

  function relationClass(relation: string): string {
    const r = relation?.toLowerCase() ?? '';
    if (r === 'informs') return 'edge informs';
    if (r === 'risks' || r === 'risk') return 'edge risk';
    return 'edge';
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
    const k = Math.max(0.2, Math.min(1, (viewportW - 40) / layout.width, (viewportH - 40) / Math.max(1, layout.height)));
    const tx = (viewportW - layout.width * k) / 2;
    const ty = (viewportH - layout.height * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(300) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  $: if (svgEl && zoomBehavior && layout.width > 0 && !didFit) {
    didFit = true;
    queueMicrotask(() => fitToView(false));
  }

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
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

  function onNodeClick(id: string) {
    dispatch('select', { id });
  }
</script>

<svg bind:this={svgEl} class="graph" role="application" aria-label="Forgeplan kind swimlanes">
  <defs>
    <pattern id="dot-grid-lanes" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.10)" />
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
      <path class={relationClass(p.relation)} d={p.d} />
    {/each}

    {#each layout.placed as node (node.id)}
      <g
        class="node"
        class:selected={node.id === selectedId}
        transform="translate({node.x - node.w / 2},{node.y - node.h / 2})"
        on:click|stopPropagation={() => onNodeClick(node.id)}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick(node.id)}
        role="button"
        tabindex="0"
        aria-label={`${node.id}: ${node.title}`}
      >
        <rect class="box" width={node.w} height={node.h} rx="3" ry="3" stroke={kindBorder(node.kind)} />
        <text class="label" x={node.w / 2} y={node.h / 2 + 4} text-anchor="middle" fill={kindLabelColor(node.kind)}>
          {node.id}
        </text>
        <circle class="status-dot" cx={node.w + 8} cy={node.h / 2} r="3.2" fill={statusRing(node.status)} />
        {#if (scoreById.get(node.id) ?? 0) > 0}
          <rect
            class="reff-bar"
            x="0"
            y={node.h + 3}
            width={node.w * Math.min(1, scoreById.get(node.id) ?? 0)}
            height="2"
            fill={reffTone(scoreById.get(node.id)) === 'good'
              ? 'var(--good)'
              : reffTone(scoreById.get(node.id)) === 'warn'
              ? 'var(--accent)'
              : 'var(--bad)'}
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
    fill: rgba(255, 255, 255, 0.015);
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
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1;
    fill: none;
  }
  .edge.informs { stroke: rgba(255, 255, 255, 0.32); stroke-dasharray: 4 4; }
  .edge.risk { stroke: var(--accent); stroke-dasharray: 3 3; }
  .node { cursor: pointer; }
  .node .box { fill: var(--bg-1); stroke-width: 1; transition: stroke-width 120ms; }
  .node:hover .box, .node:focus-visible .box { stroke-width: 1.6; outline: none; }
  .node.selected .box { stroke-width: 2; filter: drop-shadow(0 0 8px currentColor); }
  .label { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.02em; pointer-events: none; }
  .status-dot { pointer-events: none; opacity: 0.85; }
  .reff-bar { pointer-events: none; opacity: 0.85; }
</style>
