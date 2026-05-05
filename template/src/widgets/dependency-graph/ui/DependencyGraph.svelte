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

  let inner = $state<{ resetZoom: () => void } | undefined>();

  export function resetZoom() {
    inner?.resetZoom();
  }

  function relay(detail: { id: string }) {
    onSelect?.(detail);
  }
</script>

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
  />
{/if}
