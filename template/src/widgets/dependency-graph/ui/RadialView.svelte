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
  import { relationClass } from '../lib/relation';
  import { motionDuration } from '../lib/reduced-motion';

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

  const RING_GAP = 110;
  const INNER_R = 70;
  const MARGIN = 60;

  function nodeWidth(id: string): number {
    return Math.max(80, Math.round(id.length * CHAR_W + NODE_PAD_X * 2));
  }

  let svgEl = $state<SVGSVGElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = false;

  const scoreById = $derived(new Map<string, number>(scores.map((s) => [s.id, s.r_eff])));

  const filteredNodes = $derived(filterArtifacts(nodes, kindFilter, statusFilter));
  const filteredIds = $derived(new Set(filteredNodes.map((n) => n.id)));
  const filteredEdges = $derived(filterEdges(edges, filteredIds));

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

  type Layout = { placed: Placed[]; rings: number[]; cx: number; cy: number; radius: number };

  const layout = $derived(computeLayout(filteredNodes, filteredEdges));

  function computeLayout(ns: ArtifactSummary[], es: GraphEdge[]): Layout {
    if (ns.length === 0) return { placed: [], rings: [], cx: 0, cy: 0, radius: 0 };

    const incoming = new Map<string, string[]>();
    for (const n of ns) incoming.set(n.id, []);
    for (const e of es) {
      if (!incoming.has(e.to)) continue;
      if (e.from === e.to) continue;
      incoming.get(e.to)!.push(e.from);
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

    const layerOrder = [...byLayer.keys()].sort((a, b) => a - b);
    const rings = layerOrder.map((_, i) => INNER_R + i * RING_GAP);
    const radius = (rings[rings.length - 1] ?? INNER_R) + 60;
    const cx = radius + MARGIN;
    const cy = radius + MARGIN;

    const placed: Placed[] = [];
    layerOrder.forEach((l, li) => {
      const ids = byLayer.get(l)!;
      const r = rings[li];
      const count = ids.length;
      ids.forEach((id, i) => {
        const m = meta.get(id)!;
        const w = nodeWidth(id);
        let x: number;
        let y: number;
        if (li === 0 && count === 1) {
          x = cx;
          y = cy;
        } else {
          const angle = (-Math.PI / 2) + (i / count) * Math.PI * 2;
          x = cx + Math.cos(angle) * r;
          y = cy + Math.sin(angle) * r;
        }
        placed.push({ id, kind: m.kind, status: m.status, title: m.title, w, h: NODE_H, x, y });
      });
    });

    return { placed, rings, cx, cy, radius };
  }

  type EdgePath = { d: string; relation: string; key: string };

  const edgePaths = $derived(computePaths(filteredEdges, layout));

  function computePaths(es: GraphEdge[], lay: Layout): EdgePath[] {
    const byId = new Map(lay.placed.map((p) => [p.id, p]));
    const out: EdgePath[] = [];
    for (const e of es) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const bend = Math.min(60, dist * 0.15);
      const cxp = mx + nx * bend;
      const cyp = my + ny * bend;
      out.push({
        d: `M ${a.x} ${a.y} Q ${cxp} ${cyp}, ${b.x} ${b.y}`,
        relation: e.relation,
        key: `${e.from}>${e.to}:${e.relation}`
      });
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
    const w = layout.radius * 2 + MARGIN * 2;
    const h = layout.radius * 2 + MARGIN * 2;
    if (w === 0 || h === 0) return;
    const k = Math.max(0.2, Math.min(1, (viewportW - 40) / w, (viewportH - 40) / h));
    const tx = (viewportW - w * k) / 2;
    const ty = (viewportH - h * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (svgEl && zoomBehavior && layout.radius > 0 && !didFit) {
      didFit = true;
      queueMicrotask(() => fitToView(false));
    }
  });

  $effect(() => {
    if (!svgEl) return;
    handleResize();
    window.addEventListener('resize', handleResize);
    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
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

  function onNodeClick(id: string) {
    onSelect?.({ id });
  }
</script>

<svg bind:this={svgEl} class="graph" role="img" aria-label="Radial hierarchy of artifacts by parent epic">
  <defs>
    <pattern id="dot-grid-radial" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.10)" />
    </pattern>
  </defs>
  <rect class="bg" x="0" y="0" width="100%" height="100%" fill="url(#dot-grid-radial)" />
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    {#each layout.rings as r (r)}
      <circle class="ring" cx={layout.cx} cy={layout.cy} {r} />
    {/each}
    {#each edgePaths as p (p.key)}
      <path class={relationClass(p.relation)} d={p.d} />
    {/each}
    {#each layout.placed as node (node.id)}
      <g
        class="node"
        class:selected={node.id === selectedId}
        transform="translate({node.x - node.w / 2},{node.y - node.h / 2})"
        onclick={(e) => { e.stopPropagation(); onNodeClick(node.id); }}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick(node.id)}
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
            fill={reffBarColor(scoreById.get(node.id))}
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
  .ring {
    fill: none;
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1;
    stroke-dasharray: 2 4;
  }
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
