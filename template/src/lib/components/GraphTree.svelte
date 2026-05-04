<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { select } from 'd3-selection';
  import 'd3-transition';
  import type { ArtifactSummary, GraphEdge, ScoreEntry } from '$lib/types';
  import { kindBorder, kindLabelColor, statusRing, reffTone } from '$lib/theme';

  export let nodes: ArtifactSummary[] = [];
  export let edges: GraphEdge[] = [];
  export let scores: ScoreEntry[] = [];
  export let selectedId: string | null = null;
  export let kindFilter: Set<string> = new Set();
  export let statusFilter: Set<string> = new Set();

  const dispatch = createEventDispatcher<{ select: { id: string } }>();

  const NODE_H = 32;
  const NODE_PAD_X = 16;
  const CHAR_W = 7.7;
  const ROW_GAP = 70;
  const COL_GAP = 28;
  const MARGIN = 40;

  function nodeWidth(id: string): number {
    return Math.max(96, Math.round(id.length * CHAR_W + NODE_PAD_X * 2));
  }

  let svgEl: SVGSVGElement;
  let viewportW = 800;
  let viewportH = 600;
  let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let transform = { x: 0, y: 0, k: 1 };

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

  $: layout = computeLayout(filteredNodes, filteredEdges, scoreById);

  $: layoutPaths = computeEdgePaths(filteredEdges, layout);

  function computeLayout(
    ns: ArtifactSummary[],
    es: GraphEdge[],
    scoreMap: Map<string, number>
  ): Layout {
    if (ns.length === 0) {
      return { placed: [], width: 0, height: 0 };
    }

    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    for (const n of ns) {
      incoming.set(n.id, []);
      outgoing.set(n.id, []);
    }
    for (const e of es) {
      if (!incoming.has(e.to) || !outgoing.has(e.from)) continue;
      if (e.from === e.to) continue;
      incoming.get(e.to)!.push(e.from);
      outgoing.get(e.from)!.push(e.to);
    }

    const layer = new Map<string, number>();
    function dfs(id: string, stack: Set<string>): number {
      const cached = layer.get(id);
      if (cached !== undefined) return cached;
      if (stack.has(id)) return 0;
      stack.add(id);
      let max = 0;
      for (const p of incoming.get(id) ?? []) {
        max = Math.max(max, dfs(p, stack) + 1);
      }
      stack.delete(id);
      layer.set(id, max);
      return max;
    }
    for (const n of ns) dfs(n.id, new Set());

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
    let maxRowW = 0;
    const rowWidths = new Map<number, number>();
    for (const l of layerOrder) {
      const ids = byLayer.get(l)!;
      const w = ids.reduce((s, id) => s + widths.get(id)!, 0) + COL_GAP * Math.max(0, ids.length - 1);
      rowWidths.set(l, w);
      if (w > maxRowW) maxRowW = w;
    }

    const placed: Placed[] = [];
    layerOrder.forEach((l, li) => {
      const ids = byLayer.get(l)!;
      const rowW = rowWidths.get(l)!;
      let cx = (maxRowW - rowW) / 2 + MARGIN;
      const cy = MARGIN + li * (NODE_H + ROW_GAP);
      for (const id of ids) {
        const m = meta.get(id)!;
        const w = widths.get(id)!;
        placed.push({
          id,
          kind: m.kind,
          status: m.status,
          title: m.title,
          r_eff: scoreMap.get(id) ?? 0,
          w,
          h: NODE_H,
          x: cx + w / 2,
          y: cy + NODE_H / 2
        });
        cx += w + COL_GAP;
      }
    });

    return {
      placed,
      width: maxRowW + MARGIN * 2,
      height: layerOrder.length * (NODE_H + ROW_GAP) - ROW_GAP + MARGIN * 2
    };
  }

  type EdgePath = { d: string; relation: string; key: string };

  function computeEdgePaths(es: GraphEdge[], layout: Layout): EdgePath[] {
    const byId = new Map(layout.placed.map((p) => [p.id, p]));
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

  function fitToView() {
    if (!svgEl || !zoomBehavior) return;
    if (layout.width === 0 || layout.height === 0) return;
    const scale = Math.min(
      1,
      (viewportW - 40) / Math.max(1, layout.width),
      (viewportH - 40) / Math.max(1, layout.height)
    );
    const k = Math.max(0.2, scale);
    const tx = (viewportW - layout.width * k) / 2;
    const ty = (viewportH - layout.height * k) / 2;
    select(svgEl)
      .transition()
      .duration(300)
      .call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(k));
  }

  let didFit = false;
  $: if (svgEl && zoomBehavior && layout.width > 0 && !didFit) {
    didFit = true;
    queueMicrotask(fitToView);
  }

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        transform = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k
        };
      });
    select(svgEl).call(zoomBehavior);

    return () => window.removeEventListener('resize', handleResize);
  });

  onDestroy(() => {
    // no simulation to stop
  });

  function resetZoom() {
    fitToView();
  }

  export { resetZoom };

  function onNodeClick(id: string) {
    dispatch('select', { id });
  }
</script>

<svg
  bind:this={svgEl}
  class="graph"
  role="application"
  aria-label="Forgeplan dependency tree"
  preserveAspectRatio="xMidYMid meet"
>
  <defs>
    <pattern id="dot-grid-tree" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.10)" />
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
      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.55)" />
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
      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.4)" />
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
        class={relationClass(p.relation)}
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
        <text
          class="label"
          x={node.w / 2}
          y={node.h / 2 + 4}
          text-anchor="middle"
          fill={kindLabelColor(node.kind)}
        >
          {node.id}
        </text>
        <circle
          class="status-dot"
          cx={node.w + 8}
          cy={node.h / 2}
          r="3.2"
          fill={statusRing(node.status)}
        />
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
  .graph:active {
    cursor: grabbing;
  }
  .edge {
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1.2;
    fill: none;
  }
  .edge.informs {
    stroke: rgba(255, 255, 255, 0.4);
    stroke-dasharray: 4 4;
  }
  .edge.risk {
    stroke: var(--accent);
    stroke-dasharray: 3 3;
  }
  .node {
    cursor: pointer;
  }
  .node .box {
    fill: var(--bg-1);
    stroke-width: 1;
    transition: stroke-width 120ms;
  }
  .node:hover .box,
  .node:focus-visible .box {
    stroke-width: 1.6;
    outline: none;
  }
  .node.selected .box {
    stroke-width: 2;
    filter: drop-shadow(0 0 8px currentColor);
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
</style>
