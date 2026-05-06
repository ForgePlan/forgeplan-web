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
  import { highlight, setHovered, clearHovered, edgeClass, bfsDistances, nodeClass, impactedClass } from '../lib/highlight.svelte';
  import { computeDownstream, computeUpstream } from '../lib/impact-graph';
  import {
    detectClusters,
    computeAnchoredAngles,
    type ClusterInfo
  } from '../lib/cluster.svelte';
  import { pickNextNode, type Direction } from '../lib/keyboard-nav';

  let {
    nodes = [],
    edges = [],
    scores = [],
    selectedId = null,
    kindFilter = new Set<string>(),
    statusFilter = new Set<string>(),
    onSelect,
    onViewState
  }: {
    nodes?: ArtifactSummary[];
    edges?: GraphEdge[];
    scores?: ScoreEntry[];
    selectedId?: string | null;
    kindFilter?: Set<string>;
    statusFilter?: Set<string>;
    onSelect?: (detail: { id: string }) => void;
    onViewState?: (state: {
      nodes: Array<{ id: string; x: number; y: number; kind: string }>;
      transform: { x: number; y: number; k: number };
      viewport: { w: number; h: number };
    }) => void;
  } = $props();

  const MARGIN = 60;

  function nodeWidth(id: string): number {
    return Math.max(80, Math.round(id.length * CHAR_W + NODE_PAD_X * 2));
  }

  let svgEl = $state<SVGSVGElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = $state(false);
  // Per-cluster collapse: when a cluster id is in this set, the layout
  // hides ring ≥ 2 (keeps only root + ring 1 visible). Toggled by a "−/+"
  // button rendered at the cluster centroid for clusters with ≥ 3 rings.
  let collapsedClusters = $state(new Set<string>());

  // Score memoization: the 10s scores poll returns a fresh array even when
  // r_eff values are identical, which would rebuild the Map and invalidate
  // every $effect reading scoreById. Gate on a content signature.
  const scoresSig = $derived(scores.map((s) => `${s.id}:${s.r_eff}`).join('|'));
  let lastScoresSig = '';
  let cachedScoreById = new Map<string, number>();
  const scoreById = $derived.by(() => {
    if (scoresSig === lastScoresSig) return cachedScoreById;
    lastScoresSig = scoresSig;
    cachedScoreById = new Map<string, number>(scores.map((s) => [s.id, s.r_eff]));
    return cachedScoreById;
  });

  // Filter memoization: the 10s nodes/edges poll always returns fresh array
  // references even when the underlying payload is identical. A naive
  // `$derived(filterArtifacts(...))` would invalidate the entire layout
  // pipeline on every poll. Reduce the inputs to a content signature first;
  // recompute only when that signature actually changes.
  const collapsedSig = $derived(Array.from(collapsedClusters).sort().join(','));
  const nodesSig = $derived(
    `${nodesContentSignature(nodes, kindFilter, statusFilter)}|c:${collapsedSig}`
  );
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

  type ClusterLayout = {
    cluster: ClusterInfo;
    rings: number[];
    radii: number[];
    /** Total ring count BEFORE collapse — used to decide whether to
     * render the toggle button (only ≥ 3 rings → user can collapse). */
    totalRingCount: number;
    collapsed: boolean;
  };

  type Layout = {
    placed: Placed[];
    clusters: ClusterLayout[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
  };

  const layout = $derived(computeLayout(filteredNodes, filteredEdges));

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
    const { clusters, nodeToCluster, nodeAdjacency } = detectClusters(ns, es, viewport);

    if (clusters.length === 0) {
      return {
        placed: [],
        clusters: [],
        bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
      };
    }

    const meta = new Map(ns.map((n) => [n.id, n] as const));

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
      const orbits = cluster.orbits;
      const scale = cluster.radiusScale ?? 1;

      const isCollapsed = collapsedClusters.has(cluster.id);
      const byRing = new Map<number, string[]>();
      for (const m of members) {
        const r = orbits[m.id] ?? 0;
        if (isCollapsed && r >= 2) continue;
        if (!byRing.has(r)) byRing.set(r, []);
        byRing.get(r)!.push(m.id);
      }

      const ringIndices = [...byRing.keys()].sort((a, b) => a - b);
      const radii: number[] = ringIndices.map((ri) => (cluster.radii[ri] ?? 0) * scale);

      const cx = cluster.centroid.x;
      const cy = cluster.centroid.y;

      const angleMap = isFallback
        ? new Map<string, number>()
        : computeAnchoredAngles(cluster.id, members, orbits, nodeAdjacency);

      ringIndices.forEach((ri, ringIdx) => {
        const ids = byRing.get(ri)!;
        const N = ids.length;
        const r = radii[ringIdx]!;
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
      });

      // Total ring count from cluster.orbits (independent of collapse).
      const totalRingCount = new Set(Object.values(cluster.orbits)).size;
      clusterLayouts.push({
        cluster,
        rings: ringIndices,
        radii,
        totalRingCount,
        collapsed: isCollapsed,
      });
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
    const k = Math.max(0.05, Math.min(2, (viewportW - 40) / w, (viewportH - 40) / h));
    const tx = (viewportW - w * k) / 2 - (layout.bbox.minX - MARGIN) * k;
    const ty = (viewportH - h * k) / 2 - (layout.bbox.minY - MARGIN) * k;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  // Reset didFit when the layout shape changes substantially (node count or
  // bbox dimensions). Without this, a major filter change (e.g. clearing all
  // chips) repaints with the previous fit and the user sees an off-screen or
  // tiny graph. Signature is coarse-grained — only structural transitions
  // trigger a re-fit, not every micro tick.
  let lastLayoutShape = '';
  $effect(() => {
    const shape = `${layout.placed.length}:${(layout.bbox.maxX - layout.bbox.minX) | 0}x${(layout.bbox.maxY - layout.bbox.minY) | 0}`;
    if (shape !== lastLayoutShape) {
      lastLayoutShape = shape;
      didFit = false;
    }
  });

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

  function onNodeClick(id: string) {
    onSelect?.({ id });
  }

  function focusNodeById(id: string) {
    const target = svgEl?.querySelector<SVGGElement>(`g.node[data-id="${CSS.escape(id)}"]`);
    target?.focus();
  }

  function onNodeKeydown(e: KeyboardEvent, currentId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNodeClick(currentId);
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

  function toggleClusterCollapse(clusterId: string) {
    const next = new Set(collapsedClusters);
    if (next.has(clusterId)) next.delete(clusterId);
    else next.add(clusterId);
    collapsedClusters = next;
    didFit = false;
  }
</script>

<svg bind:this={svgEl} class="graph" class:focus-soft={highlight.hoveredId === null && selectedId !== null} class:impact-mode={highlight.impactRoot !== null} role="img" aria-label="Radial hierarchy of artifacts by parent epic">
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
      {#if cl.totalRingCount >= 3}
        <g
          class="cluster-toggle"
          transform="translate({cl.cluster.centroid.x + 12},{cl.cluster.centroid.y - 26})"
          role="button"
          tabindex="0"
          aria-label={cl.collapsed ? `Expand ${cl.cluster.id} cluster` : `Collapse ${cl.cluster.id} cluster`}
          onclick={(e) => { e.stopPropagation(); toggleClusterCollapse(cl.cluster.id); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleClusterCollapse(cl.cluster.id); } }}
        >
          <circle r="9" />
          <text class="toggle-glyph" text-anchor="middle" dominant-baseline="central">{cl.collapsed ? '+' : '−'}</text>
        </g>
      {/if}
    {/each}
    {#each edgePaths as p (p.key)}
      <path class="{relationClass(p.relation)} {edgeClass(p.from, p.to, focusId)}" d={p.d} />
    {/each}
    {#each layout.placed as node (node.id)}
      <g
        class="node {nodeClass(node.id, focusId, hoverDistances)} {impactedClass(node.id, impactedMap)}"
        class:selected={node.id === selectedId}
        data-id={node.id}
        transform="translate({node.x - node.w / 2},{node.y - node.h / 2})"
        onclick={(e) => { e.stopPropagation(); onNodeClick(node.id); }}
        onkeydown={(e) => onNodeKeydown(e, node.id)}
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
  .cluster-toggle { cursor: pointer; }
  .cluster-toggle circle {
    fill: var(--bg-1);
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1;
    transition: stroke-width 120ms, stroke 120ms;
  }
  .cluster-toggle:hover circle,
  .cluster-toggle:focus-visible circle {
    stroke: var(--accent);
    stroke-width: 1.5;
    outline: none;
    filter: drop-shadow(0 0 6px var(--accent));
  }
  .cluster-toggle .toggle-glyph {
    font-family: var(--font-mono);
    font-size: 14px;
    fill: rgba(255, 255, 255, 0.85);
    pointer-events: none;
  }
  .edge {
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1;
    fill: none;
    transition: stroke 180ms ease-out, stroke-width 180ms ease-out, opacity 180ms ease-out;
  }
  .edge.informs { stroke: rgba(255, 255, 255, 0.32); stroke-dasharray: 4 4; }
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
