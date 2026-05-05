<script lang="ts">
  import { untrack } from 'svelte';
  import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCenter,
    forceCollide,
    forceX,
    forceY,
    type Force,
    type Simulation,
    type SimulationNodeDatum,
    type SimulationLinkDatum
  } from 'd3-force';
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
  import { highlight, setHovered, clearHovered, edgeClass, bfsDistances, nodeClass } from '../lib/highlight.svelte';
  import {
    detectClusters,
    type ClusterInfo
  } from '../lib/cluster.svelte';
  import { forceClusterRepel } from '../lib/force-cluster-repel';

  interface Node extends SimulationNodeDatum {
    id: string;
    kind: string;
    status: string;
    title: string;
    r_eff: number;
    w: number;
    h: number;
  }

  interface Link extends SimulationLinkDatum<Node> {
    source: string | Node;
    target: string | Node;
    relation: string;
  }

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

  function nodeWidth(id: string): number {
    return Math.max(80, Math.round(id.length * CHAR_W + NODE_PAD_X * 2));
  }

  let svgEl = $state<SVGSVGElement | undefined>();
  let width = $state(800);
  let height = $state(600);

  // Sim arrays are $state.raw (plain objects, no proxy) so d3-force can mutate
  // node.x/y/vx/vy hot-path without per-write reactive tracking. Render is
  // re-triggered once per d3 tick via tickGen — d3 already rAF-throttles, so
  // one bump per tick is correct cadence. Earlier proxy version caused lag
  // when switching to Force because sim.tick(60) pre-settle alone ran ~2.6k
  // proxy writes through Svelte's reactive system before first paint.
  let simNodes = $state.raw<Node[]>([]);
  let simLinks = $state.raw<Link[]>([]);
  let tickGen = $state(0);
  let sim: Simulation<Node, Link> | null = null;
  let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let transform = $state({ x: 0, y: 0, k: 1 });

  function bumpTick() {
    tickGen++;
  }

  // The `_invalidationTick` parameter exists solely so call sites can pass
  // `tickGen` from the template. Reading tickGen at the call site is what
  // makes Svelte invalidate the surrounding {@const} when the d3 tick
  // listener bumps it — d3 mutates n.x/n.y in-place on a $state.raw array,
  // so without this dependency the template would render stale positions.
  function nodePos(n: Node, _invalidationTick: number): [number, number] {
    return [n.x ?? 0, n.y ?? 0];
  }

  function clipEndAt(
    fx: number,
    fy: number,
    cx: number,
    cy: number,
    hw: number,
    hh: number
  ): { x: number; y: number } {
    const dx = cx - fx;
    const dy = cy - fy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const sx = hw / (ax || 1);
    const sy = hh / (ay || 1);
    const t = Math.min(sx, sy);
    return { x: cx - dx * t, y: cy - dy * t };
  }

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
  const nodesSig = $derived(
    nodes.map((n) => `${n.id}:${n.kind}:${n.status}`).join('|') +
      '||' +
      Array.from(kindFilter).sort().join(',') +
      '||' +
      Array.from(statusFilter).sort().join(',')
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
  const edgesSig = $derived(
    edges.map((e) => `${e.from}>${e.to}:${e.relation}`).join('|') +
      '||' +
      Array.from(filteredIds).sort().join(',')
  );
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

  type Layout = {
    clusters: ClusterInfo[];
    nodeToCluster: Record<string, string>;
    clusterById: Map<string, ClusterInfo>;
    signature: string;
  };

  const layout: Layout = $derived.by(() => {
    const ns = filteredNodes;
    const es = filteredEdges;
    const viewport = { width: Math.max(1, width), height: Math.max(1, height) };
    const { clusters, nodeToCluster } = detectClusters(ns, es, viewport);

    const clusterById = new Map<string, ClusterInfo>();
    for (const cluster of clusters) clusterById.set(cluster.id, cluster);

    // Signature for re-bind detection: cluster set changed OR membership
    // changed. Cheap to compute and stable across rerenders that don't
    // structurally change layout.
    const signature = clusters
      .map((c) => `${c.id}:${c.members.slice().sort().join(',')}`)
      .join('|');

    return { clusters, nodeToCluster, clusterById, signature };
  });

  function nodeStructureKey(items: { id: string }[]): string {
    return items
      .map((n) => n.id)
      .sort()
      .join('|');
  }

  function edgeStructureKey(items: { from: string; to: string; relation: string }[]): string {
    return items
      .map((e) => `${e.from}>${e.to}:${e.relation}`)
      .sort()
      .join('|');
  }

  function currentEdgeKey(links: Link[]): string {
    return links
      .map((l) => {
        const s = typeof l.source === 'string' ? l.source : (l.source as Node)?.id ?? '';
        const t = typeof l.target === 'string' ? l.target : (l.target as Node)?.id ?? '';
        return `${s}>${t}:${l.relation}`;
      })
      .sort()
      .join('|');
  }

  // d3-force's built-in `forceRadial` accepts a single fixed center per
  // instance, which doesn't fit a multi-cluster layout. We need each node
  // pulled toward _its_ cluster centroid by _its_ ring radius. This custom
  // force does per-node radial pull using `getCenter` + `getTargetRadius`
  // closures bound to the current layout.
  function forceClusterOrbital<NodeT extends SimulationNodeDatum>(opts: {
    strength: number;
    getCenter: (n: NodeT) => { x: number; y: number };
    getTargetRadius: (n: NodeT) => number;
  }): Force<NodeT, undefined> {
    let cached: NodeT[] = [];
    const force: Force<NodeT, undefined> = (alpha: number) => {
      const k = opts.strength * alpha;
      for (const n of cached) {
        const c = opts.getCenter(n);
        const r = opts.getTargetRadius(n);
        const nx = (n.x ?? 0) - c.x;
        const ny = (n.y ?? 0) - c.y;
        const dist = Math.hypot(nx, ny) || 1e-6;
        const delta = (r - dist) * k;
        // FIXME(radial-zero): when dist≈0 (node spawned at centroid), nx/ny
        // give an arbitrary direction. Acceptable: collide + clusterRepel
        // perturb it within the first few ticks.
        n.vx = (n.vx ?? 0) + (nx / dist) * delta;
        n.vy = (n.vy ?? 0) + (ny / dist) * delta;
      }
    };
    force.initialize = (nodes: NodeT[]) => {
      cached = nodes;
    };
    return force;
  }

  function getCentroid(id: string): { x: number; y: number } {
    const c = layout.clusterById.get(layout.nodeToCluster[id] ?? '');
    return c?.centroid ?? { x: width / 2, y: height / 2 };
  }

  function getRingRadius(id: string): number {
    const cid = layout.nodeToCluster[id];
    if (!cid) return 0;
    const cluster = layout.clusterById.get(cid);
    if (!cluster) return 0;
    const ring = cluster.orbits[id] ?? 0;
    return (cluster.radii[ring] ?? 0) * (cluster.radiusScale ?? 1);
  }

  function rebuild(
    nextNodes: ArtifactSummary[],
    nextEdges: GraphEdge[],
    scoreMap: Map<string, number>
  ) {
    if (!svgEl) return;

    const prev = new Map(simNodes.map((n) => [n.id, n]));
    const nodesChanged = nodeStructureKey(nextNodes) !== nodeStructureKey(simNodes);
    const edgesChanged = edgeStructureKey(nextEdges) !== currentEdgeKey(simLinks);

    if (nodesChanged) {
      const cx = width / 2;
      const cy = height / 2;
      simNodes = nextNodes.map((n) => {
        const p = prev.get(n.id);
        // FR-005 + radial-zero guard: seed new nodes around their cluster
        // centroid (not viewport centre) with a small random offset so
        // forceCollide has a non-degenerate gradient. Two coincident
        // nodes produce NaN unit vectors and let the sim drift.
        const c = getCentroid(n.id);
        const seedX = (c.x ?? cx) + (Math.random() - 0.5) * 20;
        const seedY = (c.y ?? cy) + (Math.random() - 0.5) * 20;
        return {
          id: n.id,
          kind: n.kind,
          status: n.status,
          title: n.title,
          r_eff: scoreMap.get(n.id) ?? 0,
          w: nodeWidth(n.id),
          h: NODE_H,
          x: p?.x ?? seedX,
          y: p?.y ?? seedY,
          vx: p?.vx,
          vy: p?.vy,
          fx: p?.fx ?? null,
          fy: p?.fy ?? null
        } as Node;
      });
    } else {
      const nextById = new Map(nextNodes.map((n) => [n.id, n]));
      for (const n of simNodes) {
        const meta = nextById.get(n.id);
        if (!meta) continue;
        n.kind = meta.kind;
        n.status = meta.status;
        n.title = meta.title;
        n.r_eff = scoreMap.get(n.id) ?? 0;
        n.w = nodeWidth(n.id);
        n.h = NODE_H;
      }
      // simNodes is $state.raw; in-place metadata mutations are not tracked.
      // Bump tickGen so the template re-evaluates label / fill / width.
      bumpTick();
    }

    // forceLink mutates link.source/target from string IDs into Node refs.
    // When simNodes is rebuilt, those refs point to detached objects, so we
    // must reset simLinks to string-ID form for D3 to re-resolve against the
    // new simNodes — otherwise edges visually disconnect from their nodes.
    if (nodesChanged || edgesChanged) {
      simLinks = nextEdges.map((e) => ({
        source: e.from,
        target: e.to,
        relation: e.relation
      }));
    }

    if (!sim) {
      startSim();
      return;
    }

    if (nodesChanged || edgesChanged) {
      sim.nodes(simNodes);
      const lf = sim.force('link') as ReturnType<typeof forceLink<Node, Link>> | undefined;
      lf?.links(simLinks);
      // TODO(graph-layout): tune alpha kick if growing graphs feel too sluggish to settle.
      sim.alpha(0.3).restart();
    }
  }

  // Tuning per RFC-004 §"Tuning constants". clusterX/Y strength 0.25 group;
  // orbital strength 0.15 sits between link (0.4) and centre pull;
  // clusterRepel strength 800/minDistance 250 keeps centroids apart;
  // collide iterations(2) for accuracy; charge -150 (weaker than current
  // -380) so clusters stay cohesive.
  function startSim() {
    sim = forceSimulation<Node>(simNodes)
      .force(
        'link',
        forceLink<Node, Link>(simLinks)
          .id((n) => n.id)
          .distance(80)
          .strength(0.4)
      )
      .force('charge', forceManyBody<Node>().strength(-150))
      .force('center', forceCenter(width / 2, height / 2))
      .force('clusterX', forceX<Node>((d) => getCentroid(d.id).x).strength(0.25))
      .force('clusterY', forceY<Node>((d) => getCentroid(d.id).y).strength(0.25))
      .force(
        'orbital',
        forceClusterOrbital<Node>({
          strength: 0.15,
          getCenter: (d) => getCentroid(d.id),
          getTargetRadius: (d) => getRingRadius(d.id)
        })
      )
      .force(
        'clusterRepel',
        forceClusterRepel<Node>({
          strength: 800,
          minDistance: 250,
          getClusterId: (d) => layout.nodeToCluster[d.id]
        })
      )
      .force(
        'collide',
        forceCollide<Node>()
          .radius((n) => Math.max(n.w, n.h) * 0.6 + 12)
          .iterations(2)
      )
      .alphaDecay(0.025)
      .on('tick', bumpTick);

    // Reduced-motion (RFC-004 §"Reduced-motion compat"): pre-tick 80 then
    // stop, no animation. Otherwise pre-settle 60 ticks for a stable first
    // paint before live ticks take over.
    if (motionDuration(300) === 0) {
      sim.tick(80);
      sim.stop();
      bumpTick();
    } else {
      sim.tick(60);
      bumpTick();
    }
  }

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (sim) {
      sim.force('center', forceCenter(width / 2, height / 2));
    }
  }

  // Mount-time setup. Runs first so handleResize() updates width/height
  // from the actual viewport BEFORE the rebuild effect below uses them
  // to seed initial node positions around (cx, cy).
  $effect(() => {
    if (!svgEl) return;
    handleResize();
    window.addEventListener('resize', handleResize);

    zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 4])
      .on('zoom', (event) => {
        transform = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k
        };
      });
    select(svgEl).call(zoomBehavior);

    return () => {
      window.removeEventListener('resize', handleResize);
      sim?.stop();
      if (svgEl) select(svgEl).on('.zoom', null);
    };
  });

  // rebuild reads simNodes/simLinks for diffing AND writes them back; without
  // untrack that would form an effect-feedback loop. We track only the
  // upstream deps (filtered* + scoreById) and untrack rebuild's internal
  // sim-state reads. d3-force mutations of node.x/y mutate the raw backing
  // objects (simNodes is $state.raw); template re-render is driven by
  // tickGen, bumped from the d3 'tick' listener in startSim.
  $effect(() => {
    const fn = filteredNodes;
    const fe = filteredEdges;
    const sb = scoreById;
    untrack(() => rebuild(fn, fe, sb));
  });

  // Re-bind ONLY clusterRepel + perturb the simulation when the layout
  // signature changes (cluster set or membership). The other cluster-aware
  // forces (clusterX/clusterY/orbital) use accessor closures that already
  // read `layout` fresh on every tick via getCentroid/getRingRadius —
  // re-binding them would just rerun d3's internal initialize() walk for
  // no behavioural gain. clusterRepel, by contrast, caches per-node
  // cluster ids inside the force at .initialize() time, so when
  // nodeToCluster changes we must either swap the instance or call
  // .initialize(simNodes) on the existing one. Re-binding triggers the
  // initialize call automatically.
  $effect(() => {
    const sig = layout.signature;
    if (!sim) return;
    untrack(() => {
      const repel = forceClusterRepel<Node>({
        strength: 800,
        minDistance: 250,
        getClusterId: (d) => layout.nodeToCluster[d.id]
      });
      sim!.force('clusterRepel', repel);
      // d3 calls force.initialize(simNodes) when sim.force() is reassigned,
      // but only if the simulation has nodes set. Call it explicitly so the
      // cached cluster-id array inside repel is rebuilt against the current
      // simNodes — relying on d3's implicit path made the cache go stale
      // when only nodeToCluster changed without simNodes turnover.
      const installed = sim!.force('clusterRepel') as
        | { initialize?: (nodes: Node[]) => void }
        | undefined;
      installed?.initialize?.(simNodes);
      if (motionDuration(300) === 0) {
        sim!.alpha(0.3);
        sim!.tick(40);
        sim!.stop();
        bumpTick();
      } else {
        sim!.alpha(0.3).restart();
      }
    });
    void sig;
  });

  export function resetZoom() {
    if (!svgEl || !zoomBehavior) return;
    select(svgEl).transition().duration(motionDuration(300)).call(zoomBehavior.transform, zoomIdentity);
  }

  function endpoint(p: Node | string | undefined): Node | null {
    if (!p || typeof p === 'string') return null;
    return p;
  }

  function onNodeClick(id: string) {
    onSelect?.({ id });
  }
</script>

<svg
  bind:this={svgEl}
  class="graph"
  class:focus-soft={highlight.hoveredId === null && selectedId !== null}
  role="img"
  aria-label="Force-directed dependency graph of Forgeplan artifacts"
  preserveAspectRatio="xMidYMid meet"
>
  <defs>
    <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.10)" />
    </pattern>
  </defs>
  <rect class="bg" x="0" y="0" width="100%" height="100%" fill="url(#dot-grid)" />
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    {#each simLinks as link (`${typeof link.source === 'string' ? link.source : (link.source as Node).id}>${typeof link.target === 'string' ? link.target : (link.target as Node).id}:${link.relation}`)}
      {@const a = endpoint(link.source as Node | string | undefined)}
      {@const b = endpoint(link.target as Node | string | undefined)}
      {#if a && b}
        {@const [ax, ay] = nodePos(a, tickGen)}
        {@const [bx, by] = nodePos(b, tickGen)}
        {@const start = clipEndAt(bx, by, ax, ay, a.w / 2, a.h / 2)}
        {@const end = clipEndAt(ax, ay, bx, by, b.w / 2, b.h / 2)}
        <line
          class="{relationClass(link.relation)} {edgeClass(a.id, b.id, focusId)}"
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />
      {/if}
    {/each}
    {#each simNodes as node (node.id)}
      {@const [nx, ny] = nodePos(node, tickGen)}
      {@const reff = scoreById.get(node.id) ?? 0}
      <g
        class="node {nodeClass(node.id, focusId, hoverDistances)}"
        class:selected={node.id === selectedId}
        transform="translate({nx - node.w / 2},{ny - node.h / 2})"
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
        <rect
          class="box"
          width={node.w}
          height={node.h}
          stroke={kindBorder(node.kind)}
        />
        <text
          class="label"
          x={node.w / 2}
          y={node.h / 2 + 4}
          text-anchor="middle"
          fill={kindLabelColor(node.kind)}
        >
          {node.id}
        </text>
        {#if node.id === selectedId}
          <rect
            class="selection-ring"
            width={node.w}
            height={node.h}
            stroke={kindBorder(node.kind)}
          />
        {/if}
        <circle
          class="status-dot"
          cx={node.w + 8}
          cy={node.h / 2}
          r="3.2"
          fill={statusRing(node.status)}
        />
        {#if reff > 0}
          <rect
            class="reff-bar"
            x="0"
            y={node.h + 3}
            width={node.w * Math.min(1, reff)}
            height="2"
            fill={reffBarColor(reff)}
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
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1;
    fill: none;
    transition: stroke 180ms ease-out, stroke-width 180ms ease-out, opacity 180ms ease-out;
  }
  .edge.informs {
    stroke: rgba(255, 255, 255, 0.32);
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
  .node:hover .box,
  .node:focus-visible .box {
    stroke-width: 1.6;
    outline: none;
  }
  .selection-ring {
    fill: none;
    stroke-width: 2;
    pointer-events: none;
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
  .edge-active {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .edge-dim {
    opacity: 0.44;
  }
</style>
