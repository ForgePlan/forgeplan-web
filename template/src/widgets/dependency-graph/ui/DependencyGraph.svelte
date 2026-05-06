<script lang="ts">
  import type { ArtifactSummary } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import type { ScoreEntry } from '@/entities/score';
  import type { GraphView } from '../model/types';
  import ForceView from './ForceView.svelte';
  import TreeView from './TreeView.svelte';
  import RadialView from './RadialView.svelte';
  import MatrixView from './MatrixView.svelte';
  import LanesView from './LanesView.svelte';
  import SankeyView from './SankeyView.svelte';
  import SunburstView from './SunburstView.svelte';
  import Minimap from './Minimap.svelte';

  let {
    view = 'force',
    nodes = [],
    edges = [],
    scores = [],
    selectedId = null,
    kindFilter = new Set<string>(),
    statusFilter = new Set<string>(),
    onSelect
  }: {
    view?: GraphView;
    nodes?: ArtifactSummary[];
    edges?: GraphEdge[];
    scores?: ScoreEntry[];
    selectedId?: string | null;
    kindFilter?: Set<string>;
    statusFilter?: Set<string>;
    onSelect?: (detail: { id: string }) => void;
  } = $props();

  let inner = $state<{ resetZoom: () => void; panTo?: (x: number, y: number, k?: number) => void } | undefined>();

  type MiniNode = { id: string; x: number; y: number; kind: string };
  let miniNodes = $state<MiniNode[]>([]);
  let miniTransform = $state({ x: 0, y: 0, k: 1 });
  let miniViewport = $state({ w: 800, h: 600 });

  // F17: minimap is now wired across all 7 views. The Minimap component
  // already gates render on `nodes.length > 0`, so the per-view `enabled`
  // gate is constant true; left as a $derived to keep the wiring shape
  // for future view-specific opt-outs.
  const minimapEnabled = $derived.by(() => {
    void view;
    return true;
  });

  // Reset state when view switches so a stale snapshot from the previous view
  // doesn't paint a wrong-shaped minimap during the cross-fade.
  $effect(() => {
    void view;
    miniNodes = [];
    miniTransform = { x: 0, y: 0, k: 1 };
  });

  export function resetZoom() {
    inner?.resetZoom();
  }

  function relay(detail: { id: string }) {
    onSelect?.(detail);
  }

  function onViewState(state: {
    nodes: MiniNode[];
    transform: { x: number; y: number; k: number };
    viewport: { w: number; h: number };
  }) {
    miniNodes = state.nodes;
    miniTransform = state.transform;
    miniViewport = state.viewport;
  }

  function onTeleport(canvasX: number, canvasY: number, k: number) {
    inner?.panTo?.(canvasX, canvasY, k);
  }
</script>

<div class="graph-host">
  {#if view === 'force'}
    <ForceView
      bind:this={inner}
      {nodes}
      {edges}
      {scores}
      {selectedId}
      {kindFilter}
      {statusFilter}
      onSelect={relay}
      {onViewState}
    />
  {:else if view === 'tree'}
    <TreeView
      bind:this={inner}
      {nodes}
      {edges}
      {scores}
      {selectedId}
      {kindFilter}
      {statusFilter}
      onSelect={relay}
      {onViewState}
    />
  {:else if view === 'radial'}
    <RadialView
      bind:this={inner}
      {nodes}
      {edges}
      {scores}
      {selectedId}
      {kindFilter}
      {statusFilter}
      onSelect={relay}
      {onViewState}
    />
  {:else if view === 'matrix'}
    <MatrixView
      bind:this={inner}
      {nodes}
      {edges}
      {scores}
      {selectedId}
      {kindFilter}
      {statusFilter}
      onSelect={relay}
      {onViewState}
    />
  {:else if view === 'sankey'}
    <SankeyView
      bind:this={inner}
      {nodes}
      {edges}
      {scores}
      {selectedId}
      {kindFilter}
      {statusFilter}
      onSelect={relay}
      {onViewState}
    />
  {:else if view === 'sunburst'}
    <SunburstView
      bind:this={inner}
      {nodes}
      {edges}
      {scores}
      {selectedId}
      {kindFilter}
      {statusFilter}
      onSelect={relay}
      {onViewState}
    />
  {:else}
    <LanesView
      bind:this={inner}
      {nodes}
      {edges}
      {scores}
      {selectedId}
      {kindFilter}
      {statusFilter}
      onSelect={relay}
      {onViewState}
    />
  {/if}

  <Minimap
    enabled={minimapEnabled}
    nodes={miniNodes}
    transform={miniTransform}
    viewportSize={miniViewport}
    {onTeleport}
  />
</div>

<style>
  .graph-host {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .graph-host :global(svg.graph) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
