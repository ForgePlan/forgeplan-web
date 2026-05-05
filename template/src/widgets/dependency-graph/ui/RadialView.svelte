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
  import { highlight, setHovered, clearHovered, edgeClass } from '../lib/highlight.svelte';
  import {
    detectClusters,
    computeOrbitRing,
    computeRingRadius,
    computeAnchoredAngles,
    ringCounts,
    MIN_NODE_SPACING,
    type ClusterInfo,
    type RingDepthMap
  } from '../lib/cluster.svelte';

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

  const MARGIN = 60;

  // TODO(cluster-lib-export): mirror of cluster.svelte.ts internal
  // HIERARCHY_RELATIONS — kept in sync manually because the lib does not
  // export adjacency from detectClusters. Promote to an export when
  // RFC-004 stabilises.
  const HIERARCHY_RELATIONS: ReadonlySet<string> = new Set([
    'informs',
    'refines',
    'belongs-to',
    'contains',
    'supersedes'
  ]);

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

  type ClusterLayout = {
    cluster: ClusterInfo;
    rings: number[];
    radii: number[];
  };

  type Layout = {
    placed: Placed[];
    clusters: ClusterLayout[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
  };

  const layout = $derived(computeLayout(filteredNodes, filteredEdges));

  function buildAdjacency(
    es: GraphEdge[],
    knownIds: ReadonlySet<string>
  ): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const id of knownIds) adj.set(id, []);
    for (const e of es) {
      if (!HIERARCHY_RELATIONS.has(e.relation)) continue;
      if (!adj.has(e.from) || !adj.has(e.to)) continue;
      adj.get(e.from)!.push(e.to);
      adj.get(e.to)!.push(e.from);
    }
    return adj;
  }

  function computeLayout(ns: ArtifactSummary[], es: GraphEdge[]): Layout {
    if (ns.length === 0) {
      return {
        placed: [],
        clusters: [],
        bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
      };
    }

    const viewport = {
      width: Math.max(1, viewportW),
      height: Math.max(1, viewportH)
    };
    const { clusters, nodeToCluster } = detectClusters(ns, es, viewport);

    if (clusters.length === 0) {
      return {
        placed: [],
        clusters: [],
        bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
      };
    }

    const meta = new Map(ns.map((n) => [n.id, n] as const));
    const knownIds = new Set(ns.map((n) => n.id));
    const adjacency = buildAdjacency(es, knownIds);

    const membersByCluster = new Map<string, ArtifactSummary[]>();
    for (const c of clusters) membersByCluster.set(c.id, []);
    for (const n of ns) {
      const cid = nodeToCluster[n.id];
      if (cid && membersByCluster.has(cid)) {
        membersByCluster.get(cid)!.push(n);
      }
    }

    const placed: Placed[] = [];
    const clusterLayouts: ClusterLayout[] = [];

    for (const cluster of clusters) {
      const members = membersByCluster.get(cluster.id) ?? [];
      if (members.length === 0) continue;

      const isFallback = cluster.id === '__single__';
      const orbits: RingDepthMap = isFallback
        ? Object.fromEntries(members.map((m) => [m.id, m.id === members[0]!.id ? 0 : 1]))
        : computeOrbitRing(cluster.id, members, adjacency);

      const counts = ringCounts(orbits);
      const radius = computeRingRadius((ring) => counts.get(ring) ?? 0);

      const byRing = new Map<number, string[]>();
      for (const m of members) {
        const r = orbits[m.id] ?? 0;
        if (!byRing.has(r)) byRing.set(r, []);
        byRing.get(r)!.push(m.id);
      }

      const ringIndices = [...byRing.keys()].sort((a, b) => a - b);
      const scale = cluster.radiusScale ?? 1;
      const radii: number[] = ringIndices.map((ri) => radius(ri) * scale);

      const cx = cluster.centroid.x;
      const cy = cluster.centroid.y;

      const angleMap = isFallback
        ? new Map<string, number>()
        : computeAnchoredAngles(cluster.id, members, orbits, adjacency);

      for (const ri of ringIndices) {
        const ids = byRing.get(ri)!;
        const N = ids.length;
        const r = radius(ri) * scale;
        ids.forEach((id, i) => {
          const m = meta.get(id)!;
          const w = nodeWidth(id);
          let x: number;
          let y: number;
          if (ri === 0 && (N === 1 || id === cluster.id)) {
            x = cx;
            y = cy;
          } else {
            const baseAngle = angleMap.has(id)
              ? angleMap.get(id)!
              : (i / Math.max(1, N)) * Math.PI * 2;
            const angle = -Math.PI / 2 + baseAngle;
            x = cx + Math.cos(angle) * r;
            y = cy + Math.sin(angle) * r;
          }
          placed.push({ id, kind: m.kind, status: m.status, title: m.title, w, h: NODE_H, x, y });
        });
      }

      clusterLayouts.push({ cluster, rings: ringIndices, radii });
    }

    // No anti-collision sweep: computeRingRadius enforces both same-ring
    // chord (2r·sin(π/N) ≥ MIN_CHORD) and adjacent-ring radial gap
    // (≥ RING_GAP), so every card centre stays exactly on its orbit
    // and bboxes cannot overlap. Sweep would only push nodes off the
    // ring without geometric justification. Cluster centroids are also
    // spaced so neighbouring clusters' outer rings don't collide.

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of placed) {
      const halfW = p.w / 2;
      const halfH = p.h / 2;
      if (p.x - halfW < minX) minX = p.x - halfW;
      if (p.y - halfH < minY) minY = p.y - halfH;
      if (p.x + halfW > maxX) maxX = p.x + halfW;
      if (p.y + halfH > maxY) maxY = p.y + halfH;
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 0;
      maxY = 0;
    }

    return {
      placed,
      clusters: clusterLayouts,
      bbox: { minX, minY, maxX, maxY }
    };
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
        from: e.from,
        to: e.to,
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
    const w = layout.bbox.maxX - layout.bbox.minX + MARGIN * 2;
    const h = layout.bbox.maxY - layout.bbox.minY + MARGIN * 2;
    if (w <= 0 || h <= 0) return;
    const k = Math.max(0.2, Math.min(1, (viewportW - 40) / w, (viewportH - 40) / h));
    const tx = (viewportW - w * k) / 2 - (layout.bbox.minX - MARGIN) * k;
    const ty = (viewportH - h * k) / 2 - (layout.bbox.minY - MARGIN) * k;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (svgEl && zoomBehavior && layout.placed.length > 0 && !didFit) {
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
    {#each layout.clusters as cl (cl.cluster.id)}
      {#each cl.radii as r, idx (`${cl.cluster.id}:${cl.rings[idx]}`)}
        {#if r > 0}
          <circle class="ring" cx={cl.cluster.centroid.x} cy={cl.cluster.centroid.y} {r} />
        {/if}
      {/each}
    {/each}
    {#each edgePaths as p (p.key)}
      <path class="{relationClass(p.relation)} {edgeClass(p.from, p.to, highlight.hoveredId)}" d={p.d} />
    {/each}
    {#each layout.placed as node (node.id)}
      <g
        class="node"
        class:selected={node.id === selectedId}
        transform="translate({node.x - node.w / 2},{node.y - node.h / 2})"
        onclick={(e) => { e.stopPropagation(); onNodeClick(node.id); }}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick(node.id)}
        onmouseenter={() => setHovered(node.id)}
        onmouseleave={clearHovered}
        onfocus={() => setHovered(node.id)}
        onblur={clearHovered}
        role="button"
        tabindex="0"
        aria-label={`${node.id}: ${node.title}`}
      >
        <rect class="box" width={node.w} height={node.h} rx="3" ry="3" stroke={kindBorder(node.kind)} />
        <text class="label" x={node.w / 2} y={node.h / 2 + 4} text-anchor="middle" fill={kindLabelColor(node.kind)}>
          {node.id}
        </text>
        {#if node.id === selectedId}
          <rect
            class="selection-ring"
            width={node.w}
            height={node.h}
            rx="3"
            ry="3"
            stroke={kindBorder(node.kind)}
          />
        {/if}
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
    stroke: rgba(255, 255, 255, 0.16);
    stroke-width: 1;
    stroke-dasharray: 3 5;
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
  .selection-ring {
    fill: none;
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
    opacity: 0.25;
  }
</style>
