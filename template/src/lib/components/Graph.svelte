<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
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
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { select } from 'd3-selection';
  import 'd3-transition';
  import type { ArtifactSummary, GraphEdge, ScoreEntry } from '$lib/types';
  import { kindBorder, kindLabelColor, statusRing, reffTone } from '$lib/theme';

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

  export let nodes: ArtifactSummary[] = [];
  export let edges: GraphEdge[] = [];
  export let scores: ScoreEntry[] = [];
  export let selectedId: string | null = null;
  export let kindFilter: Set<string> = new Set();
  export let statusFilter: Set<string> = new Set();

  const dispatch = createEventDispatcher<{ select: { id: string } }>();

  const NODE_H = 28;
  const NODE_PAD_X = 14;
  const CHAR_W = 7.7; // ui-monospace 12px

  function nodeWidth(id: string): number {
    return Math.max(80, Math.round(id.length * CHAR_W + NODE_PAD_X * 2));
  }

  let svgEl: SVGSVGElement;
  let width = 800;
  let height = 600;

  let simNodes: Node[] = [];
  let simLinks: Link[] = [];
  let sim: Simulation<Node, Link> | null = null;
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

  $: rebuild(filteredNodes, filteredEdges, scoreById);

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
    scores: Map<string, number>
  ) {
    if (!svgEl) return;

    const prev = new Map(simNodes.map((n) => [n.id, n]));
    const nodesChanged = nodeStructureKey(nextNodes) !== nodeStructureKey(simNodes);
    const edgesChanged = edgeStructureKey(nextEdges) !== currentEdgeKey(simLinks);

    if (nodesChanged) {
      simNodes = nextNodes.map((n) => {
        const p = prev.get(n.id);
        return {
          id: n.id,
          kind: n.kind,
          status: n.status,
          title: n.title,
          r_eff: scores.get(n.id) ?? 0,
          w: nodeWidth(n.id),
          h: NODE_H,
          x: p?.x,
          y: p?.y,
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
        n.r_eff = scores.get(n.id) ?? 0;
        n.w = nodeWidth(n.id);
        n.h = NODE_H;
      }
      simNodes = simNodes;
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
    } else {
      simNodes = simNodes;
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
      .on('tick', () => {
        simNodes = simNodes;
        simLinks = simLinks;
      });
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

    return () => {
      window.removeEventListener('resize', handleResize);
      sim?.stop();
    };
  });

  onDestroy(() => {
    sim?.stop();
  });

  function resetZoom() {
    if (!svgEl || !zoomBehavior) return;
    select(svgEl).transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
  }

  export { resetZoom };

  function endpoint(p: Node | string | undefined): Node | null {
    if (!p || typeof p === 'string') return null;
    return p;
  }

  function onNodeClick(id: string) {
    dispatch('select', { id });
  }

  /**
   * Compute the line endpoint clipped to the rectangle of node `n`,
   * so that edges terminate at the box border instead of the centre.
   */
  function clipEnd(from: Node, to: Node): { x: number; y: number } {
    const cx = to.x ?? 0;
    const cy = to.y ?? 0;
    const fx = from.x ?? 0;
    const fy = from.y ?? 0;
    const dx = cx - fx;
    const dy = cy - fy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const hw = to.w / 2;
    const hh = to.h / 2;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const sx = hw / (ax || 1);
    const sy = hh / (ay || 1);
    const t = Math.min(sx, sy);
    return { x: cx - dx * t, y: cy - dy * t };
  }

  function relationClass(relation: string): string {
    const r = relation?.toLowerCase() ?? '';
    if (r === 'informs') return 'edge informs';
    if (r === 'risks' || r === 'risk') return 'edge risk';
    return 'edge';
  }
</script>

<svg
  bind:this={svgEl}
  class="graph"
  role="application"
  aria-label="Forgeplan dependency graph"
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
        {@const start = clipEnd(b, a)}
        {@const end = clipEnd(a, b)}
        <line
          class={relationClass(link.relation)}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />
      {/if}
    {/each}
    {#each simNodes as node (node.id)}
      <g
        class="node"
        class:selected={node.id === selectedId}
        transform="translate({(node.x ?? 0) - node.w / 2},{(node.y ?? 0) - node.h / 2})"
        on:click|stopPropagation={() => onNodeClick(node.id)}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick(node.id)}
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
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1;
    fill: none;
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
