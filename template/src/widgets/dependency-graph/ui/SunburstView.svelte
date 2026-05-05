<script lang="ts">
  import { arc as d3Arc } from 'd3-shape';
  import { zoom, zoomIdentity, select, type ZoomBehavior } from '@/widgets/dependency-graph/lib/d3';
  import {
    type ArtifactSummary,
    kindBorder,
    kindLabelColor
  } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import type { ScoreEntry } from '@/entities/score';
  import { filterArtifacts, filterEdges } from '../lib/filter';
  import { motionDuration } from '../lib/reduced-motion';
  import {
    highlight,
    setHovered,
    clearHovered,
    bfsDistances,
    nodeClass
  } from '../lib/highlight.svelte';
  import {
    buildSunburstTree,
    computeSunburstPartition,
    type SunburstNode
  } from '../lib/sunburst-layout';
  import type { HierarchyRectangularNode } from 'd3-hierarchy';

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

  $effect(() => { void scores; });

  const VIEW_W = 800;
  const VIEW_H = 800;
  const RADIUS = 360;

  let svgEl = $state<SVGSVGElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = $state(false);

  const filteredNodes = $derived(filterArtifacts(nodes, kindFilter, statusFilter));
  const filteredIds = $derived(new Set(filteredNodes.map((n) => n.id)));
  const filteredEdges = $derived(filterEdges(edges, filteredIds));
  const focusId = $derived(highlight.hoveredId ?? selectedId);
  const hoverDistances = $derived(bfsDistances(focusId, filteredEdges));

  const partition = $derived.by(() => {
    if (filteredNodes.length === 0) return null;
    const tree = buildSunburstTree(filteredNodes, filteredEdges);
    return computeSunburstPartition(tree, RADIUS);
  });

  const sectors = $derived.by(() => {
    if (!partition) return [];
    // skip the synthetic root (depth 0)
    const out: HierarchyRectangularNode<SunburstNode>[] = [];
    partition.each((d) => {
      if (d.depth === 0) return;
      out.push(d);
    });
    return out;
  });

  const arcGen = $derived(
    d3Arc<HierarchyRectangularNode<SunburstNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1)
      .padAngle(0.005)
      .padRadius(RADIUS / 2)
  );

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewportW = rect.width;
    viewportH = rect.height;
  }

  function fitToView(animated = true) {
    if (!svgEl || !zoomBehavior) return;
    const k = Math.max(0.3, Math.min(1, (viewportW - 40) / VIEW_W, (viewportH - 40) / VIEW_H));
    const tx = (viewportW - VIEW_W * k) / 2;
    const ty = (viewportH - VIEW_H * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (svgEl && zoomBehavior && sectors.length > 0 && !didFit) {
      didFit = true;
      queueMicrotask(() => fitToView(false));
    }
  });

  $effect(() => {
    if (!svgEl) return;
    handleResize();
    window.addEventListener('resize', handleResize);
    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
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

  function selectId(id: string) {
    onSelect?.({ id });
  }

  function labelTransform(d: HierarchyRectangularNode<SunburstNode>): string {
    const angle = (d.x0 + d.x1) / 2;
    const radius = (d.y0 + d.y1) / 2;
    const rotate = (angle * 180) / Math.PI - 90;
    const flip = angle > Math.PI;
    return `rotate(${rotate}) translate(${radius},0) ${flip ? 'rotate(180)' : ''}`;
  }

  function shouldShowLabel(d: HierarchyRectangularNode<SunburstNode>): boolean {
    return (d.x1 - d.x0) * ((d.y0 + d.y1) / 2) > 24;
  }
</script>

<svg
  bind:this={svgEl}
  class="graph"
  class:focus-soft={highlight.hoveredId === null && selectedId !== null}
  role="img"
  aria-label="Sunburst hierarchy partition of the workspace"
>
  <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
    <g transform="translate({VIEW_W / 2},{VIEW_H / 2})">
      {#each sectors as d (d.data.id + ':' + d.depth)}
        <g
          class="sector {nodeClass(d.data.id, focusId, hoverDistances)}"
          class:selected={d.data.id === selectedId}
          data-id={d.data.id}
          onclick={(e) => { e.stopPropagation(); selectId(d.data.id); }}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectId(d.data.id)}
          onmouseenter={() => setHovered(d.data.id)}
          onmouseleave={clearHovered}
          onfocus={() => setHovered(d.data.id)}
          onblur={clearHovered}
          role="button"
          tabindex="0"
          aria-label={`${d.data.id}: ${d.data.title}`}
        >
          <path
            class="arc"
            d={arcGen(d) ?? ''}
            fill={kindBorder(d.data.kind)}
            fill-opacity="0.66"
            stroke="rgba(0, 0, 0, 0.4)"
            stroke-width="0.6"
          />
          {#if shouldShowLabel(d)}
            <text
              class="label"
              transform={labelTransform(d)}
              text-anchor="middle"
              dy="0.32em"
              fill={kindLabelColor(d.data.kind)}
            >
              {d.data.id}
            </text>
          {/if}
          <title>{d.data.id} ({d.data.kind}) — {d.data.title}</title>
        </g>
      {/each}
    </g>
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
  .sector { cursor: pointer; transition: opacity 180ms ease-out; }
  .sector:hover .arc, .sector:focus-visible .arc {
    fill-opacity: 0.95;
    filter: drop-shadow(0 0 4px currentColor);
    outline: none;
  }
  .sector.selected .arc {
    fill-opacity: 1;
    stroke: var(--accent);
    stroke-width: 2;
    filter: drop-shadow(0 0 8px var(--accent));
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
  .arc { transition: fill-opacity 120ms; }
  .label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.02em;
    pointer-events: none;
  }
</style>
