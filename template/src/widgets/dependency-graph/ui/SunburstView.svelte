<script lang="ts">
  import { arc as d3Arc } from 'd3-shape';
  import { zoom, zoomIdentity, select, type ZoomBehavior } from '@/widgets/dependency-graph/lib/d3';
  import {
    type ArtifactSummary,
    kindBorder
  } from '@/entities/artifact';
  import { displayId } from '@/entities/artifact/lib/identity';
  import type { GraphEdge } from '@/entities/graph';
  import type { ScoreEntry } from '@/entities/score';
  import { filterArtifacts, filterEdges } from '../lib/filter';
  import { nodesContentSignature, edgesContentSignature } from '../lib/filter-memo.svelte';
  import { motionDuration } from '../lib/reduced-motion';
  import {
    highlight,
    setHovered,
    clearHovered
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

  // Ancestor map: every artifact id → set of ancestor ids (inclusive
  // of self). Used to highlight the parent chain when a sector is
  // hovered or selected — gives the user a quick read of "what is
  // this thing rolled up to?".
  const ancestorsById = $derived.by(() => {
    const map = new Map<string, Set<string>>();
    if (!partition) return map;
    partition.each((d) => {
      const chain = new Set<string>();
      let cur: HierarchyRectangularNode<SunburstNode> | null = d;
      while (cur) {
        if (cur.depth > 0) chain.add(cur.data.id);
        cur = cur.parent;
      }
      map.set(d.data.id, chain);
    });
    return map;
  });

  const focusChain = $derived.by(() => {
    if (!focusId) return new Set<string>();
    return ancestorsById.get(focusId) ?? new Set<string>();
  });

  function sectorClass(d: HierarchyRectangularNode<SunburstNode>): string {
    const id = d.data.id;
    if (id === focusId) return 'sector active';
    if (focusChain.has(id)) return 'sector ancestor';
    if (focusId) return 'sector dim';
    return 'sector';
  }

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
    const k = Math.max(0.05, Math.min(2, (viewportW - 40) / VIEW_W, (viewportH - 40) / VIEW_H));
    const tx = (viewportW - VIEW_W * k) / 2;
    const ty = (viewportH - VIEW_H * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated ? select(svgEl).transition().duration(motionDuration(300)) : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  // Reset didFit when the partition shape changes substantially (sector
  // count or max depth). Without this, clearing a filter chip leaves the
  // previous fit transform in place and the sunburst paints microscopic
  // on the unchanged zoom. Coarse-grained signature — only structural
  // transitions trigger a re-fit, not every micro tick.
  let lastLayoutShape = '';
  $effect(() => {
    let maxDepth = 0;
    for (const s of sectors) if (s.depth > maxDepth) maxDepth = s.depth;
    const shape = `${sectors.length}:${maxDepth}`;
    if (shape !== lastLayoutShape) {
      lastLayoutShape = shape;
      didFit = false;
    }
  });

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

  // The sunburst inner <g> is translated by (VIEW_W/2, VIEW_H/2). To project
  // each sector centroid into the same canvas-space the minimap math expects,
  // apply that translate explicitly. The polar baseline matches d3's arc
  // generator: angle 0 points up, so xy is (cos(angle - PI/2), sin(angle - PI/2)).
  $effect(() => {
    if (!onViewState) return;
    const sx = sectors;
    const t = transform;
    const w = viewportW;
    const h = viewportH;
    const stateNodes = sx.map((d) => {
      const angle = (d.x0 + d.x1) / 2;
      const radius = (d.y0 + d.y1) / 2;
      const x = VIEW_W / 2 + radius * Math.cos(angle - Math.PI / 2);
      const y = VIEW_H / 2 + radius * Math.sin(angle - Math.PI / 2);
      return { id: d.data.id, x, y, kind: d.data.kind };
    });
    onViewState({
      nodes: stateNodes,
      transform: { x: t.x, y: t.y, k: t.k },
      viewport: { w, h }
    });
  });

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
    if (d.depth >= 4 && transform.k < 0.5) return false;
    const arcLen = (d.x1 - d.x0) * ((d.y0 + d.y1) / 2);
    return arcLen > 40 / Math.max(0.5, transform.k);
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
          class={sectorClass(d)}
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
          aria-label={`${displayId(d.data)}: ${d.data.title} (ring ${d.depth}${d.parent && d.parent.depth > 0 ? `, parent ${displayId(d.parent.data)}` : ''})`}
        >
          <path
            class="arc"
            d={arcGen(d) ?? ''}
            style:fill={kindBorder(d.data.kind)}
          />
          {#if shouldShowLabel(d)}
            <text
              class="label"
              transform={labelTransform(d)}
              text-anchor="middle"
              dy="0.32em"
            >
              {displayId(d.data)}
            </text>
          {/if}
          <title>{displayId(d.data)} ({d.data.kind}) — {d.data.title}</title>
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
  .sector {
    cursor: pointer;
    transition: opacity 180ms ease-out;
  }
  .arc {
    fill-opacity: 0.55;
    stroke: var(--canvas-stroke-on-fill);
    stroke-width: 0.6;
    transition: fill-opacity 180ms, stroke 180ms, stroke-width 180ms, filter 180ms;
  }
  .label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.02em;
    pointer-events: none;
    fill: var(--canvas-label);
    transition: fill 180ms, font-size 120ms;
  }

  /* Hover/focus chain — `.active` is the focused sector itself,
     `.ancestor` are its parents in the hierarchy, `.dim` is the rest
     (so the user reads the full ancestor path at a glance). */
  .sector.active .arc {
    fill-opacity: 1;
    stroke: var(--accent);
    stroke-width: 2;
    filter: drop-shadow(0 0 10px var(--accent));
  }
  .sector.active .label {
    fill: var(--canvas-label-strong);
    font-size: 11px;
  }
  .sector.ancestor .arc {
    fill-opacity: 0.85;
    stroke: var(--canvas-stroke);
    stroke-width: 1.2;
  }
  .sector.ancestor .label {
    fill: var(--canvas-label-strong);
  }
  .sector.dim .arc {
    fill-opacity: 0.18;
  }
  .sector.dim .label {
    fill: var(--canvas-label-faded);
  }

  /* Selected (persistent) — same accent stroke as `.active` but stays
     on after mouse leaves; label switches to accent so user can find
     the active node visually. */
  .sector.selected .arc {
    fill-opacity: 1;
    stroke: var(--accent);
    stroke-width: 2;
    filter: drop-shadow(0 0 8px var(--accent));
  }
  .sector.selected .label {
    fill: var(--accent);
  }
</style>
