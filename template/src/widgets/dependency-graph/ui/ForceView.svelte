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

  function nodePos(n: Node, _tick: number): [number, number] {
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

  const scoreById = $derived(new Map<string, number>(scores.map((s) => [s.id, s.r_eff])));

  const filteredNodes = $derived(filterArtifacts(nodes, kindFilter, statusFilter));
  const filteredIds = $derived(new Set(filteredNodes.map((n) => n.id)));
  const filteredEdges = $derived(filterEdges(edges, filteredIds));
  const focusId = $derived(highlight.hoveredId ?? selectedId);
  const hoverDistances = $derived(bfsDistances(focusId, filteredEdges));

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
        return {
          id: n.id,
          kind: n.kind,
          status: n.status,
          title: n.title,
          r_eff: scoreMap.get(n.id) ?? 0,
          w: nodeWidth(n.id),
          h: NODE_H,
          x: p?.x ?? cx + (Math.random() - 0.5) * 80,
          y: p?.y ?? cy + (Math.random() - 0.5) * 80,
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

  function startSim() {
    sim = forceSimulation<Node>(simNodes)
      .force(
        'link',
        forceLink<Node, Link>(simLinks)
          .id((n) => n.id)
          .distance(140)
          .strength(0.5)
      )
      .force('charge', forceManyBody<Node>().strength(-380))
      .force('center', forceCenter(width / 2, height / 2))
      // Gentle pull toward centre — keeps disconnected components from
      // sailing off the canvas after a filter change.
      .force('x', forceX<Node>(width / 2).strength(0.05))
      .force('y', forceY<Node>(height / 2).strength(0.05))
      .force(
        'collide',
        forceCollide<Node>().radius((n) => Math.max(n.w, n.h) * 0.6 + 12)
      )
      .alphaDecay(0.025)
      .on('tick', bumpTick);

    // FR-004 (PRD-003): respect prefers-reduced-motion — settle simulation fast
    // instead of long-running spring animation.
    if (motionDuration(300) === 0) {
      sim.alphaDecay(0.1).alphaMin(0.05);
    }

    // Pre-settle synchronously so the first paint already shows nodes
    // arranged near the canvas centre instead of the (0,0) phyllotaxis seed.
    // sim.tick(N) does NOT fire 'tick' listeners (by design in d3-force), so
    // pre-settle stays render-free; we bump once below for the initial paint.
    sim.tick(60);
    bumpTick();
  }

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (sim) {
      sim.force('center', forceCenter(width / 2, height / 2));
      sim.force('x', forceX<Node>(width / 2).strength(0.05));
      sim.force('y', forceY<Node>(height / 2).strength(0.05));
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
      .scaleExtent([0.2, 4])
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

  // FIXME(reactivity-loop): rebuild reads simNodes/simLinks for diffing AND
  // writes them back, which would create an effect-feedback loop. We track
  // only the upstream deps (filtered* + scoreById) and untrack rebuild's
  // internal sim-state reads. d3-force mutations of node.x/y mutate the raw
  // backing objects (simNodes is $state.raw); template re-render is driven
  // by tickGen, bumped from the d3 'tick' listener in startSim.
  $effect(() => {
    const fn = filteredNodes;
    const fe = filteredEdges;
    const sb = scoreById;
    untrack(() => rebuild(fn, fe, sb));
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
    {#each simLinks as link (link)}
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
