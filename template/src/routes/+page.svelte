<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import HealthBar from '$lib/components/HealthBar.svelte';
  import Filters from '$lib/components/Filters.svelte';
  import Graph from '$lib/components/Graph.svelte';
  import GraphTree from '$lib/components/GraphTree.svelte';
  import GraphRadial from '$lib/components/GraphRadial.svelte';
  import GraphMatrix from '$lib/components/GraphMatrix.svelte';
  import GraphLanes from '$lib/components/GraphLanes.svelte';
  import ArtifactPanel from '$lib/components/ArtifactPanel.svelte';
  import InsightTabs from '$lib/components/InsightTabs.svelte';
  import {
    listPoller,
    graphPoller,
    healthPoller,
    scorePoller,
    claimsPoller,
    stalePoller,
    blockedPoller,
    logPoller
  } from '$lib/stores/forgeplan';

  const list = listPoller.store;
  const graph = graphPoller.store;
  const score = scorePoller.store;

  let kindFilter = new Set<string>();
  let statusFilter = new Set<string>();
  let selectedId: string | null = null;
  let graphRef: { resetZoom: () => void } | undefined;
  type GraphView = 'force' | 'tree' | 'radial' | 'matrix' | 'lanes';
  let view: GraphView = 'force';

  const VIEWS: { id: GraphView; label: string; hint: string }[] = [
    { id: 'force', label: 'Force', hint: 'Physics-driven exploration' },
    { id: 'tree', label: 'Tree', hint: 'Top-down dependency hierarchy' },
    { id: 'radial', label: 'Radial', hint: 'Concentric rings by depth' },
    { id: 'matrix', label: 'Matrix', hint: 'Adjacency matrix sorted by kind' },
    { id: 'lanes', label: 'Lanes', hint: 'Swimlanes by artifact kind' }
  ];

  function setView(next: GraphView) {
    view = next;
  }

  $: nodes = $list.data ?? [];
  $: edges = $graph.data?.edges ?? [];
  $: scores = $score.data ?? [];

  $: kinds = [...new Set(nodes.map((n) => n.kind.toLowerCase()))].sort();
  $: statuses = [...new Set(nodes.map((n) => n.status.toLowerCase()))].sort();

  $: globalError =
    $list.error ?? $graph.error ?? null;

  function selectNode(detail: { id: string }) {
    selectedId = detail.id;
  }

  function closePanel() {
    selectedId = null;
  }

  function navigate(detail: { id: string }) {
    selectedId = detail.id;
  }

  function reset() {
    graphRef?.resetZoom();
  }

  onMount(() => {
    listPoller.start();
    graphPoller.start();
    healthPoller.start();
    scorePoller.start();
    claimsPoller.start();
    stalePoller.start();
    blockedPoller.start();
    logPoller.start();
  });

  onDestroy(() => {
    listPoller.stop();
    graphPoller.stop();
    healthPoller.stop();
    scorePoller.stop();
    claimsPoller.stop();
    stalePoller.stop();
    blockedPoller.stop();
    logPoller.stop();
  });
</script>

<div class="root">
  <HealthBar />
  {#if globalError}
    <div class="error-bar">
      <span class="muted">CLI error:</span>
      <code>{globalError}</code>
      <button type="button" class="retry" on:click={() => { listPoller.refresh(); graphPoller.refresh(); }}>retry</button>
    </div>
  {/if}
  <main class="layout" class:has-panel={selectedId !== null}>
    <Filters {kinds} {statuses} bind:kindFilter bind:statusFilter />
    <section class="canvas">
      <div class="canvas-toolbar">
        <span class="muted">{nodes.length} ARTIFACTS &middot; {edges.length} EDGES</span>
        <div class="toolbar-right">
          <div class="view-toggle" role="tablist" aria-label="Graph view">
            {#each VIEWS as v (v.id)}
              <button
                type="button"
                class="seg"
                class:active={view === v.id}
                role="tab"
                aria-selected={view === v.id}
                title={v.hint}
                on:click={() => setView(v.id)}
              >
                {v.label}
              </button>
            {/each}
          </div>
          <button type="button" class="ghost" on:click={reset}>Reset view</button>
        </div>
      </div>
      <div class="canvas-body">
        {#if view === 'force'}
          <Graph
            bind:this={graphRef}
            {nodes}
            {edges}
            {scores}
            {selectedId}
            {kindFilter}
            {statusFilter}
            on:select={(e) => selectNode(e.detail)}
          />
        {:else if view === 'tree'}
          <GraphTree
            bind:this={graphRef}
            {nodes}
            {edges}
            {scores}
            {selectedId}
            {kindFilter}
            {statusFilter}
            on:select={(e) => selectNode(e.detail)}
          />
        {:else if view === 'radial'}
          <GraphRadial
            bind:this={graphRef}
            {nodes}
            {edges}
            {scores}
            {selectedId}
            {kindFilter}
            {statusFilter}
            on:select={(e) => selectNode(e.detail)}
          />
        {:else if view === 'matrix'}
          <GraphMatrix
            bind:this={graphRef}
            {nodes}
            {edges}
            {scores}
            {selectedId}
            {kindFilter}
            {statusFilter}
            on:select={(e) => selectNode(e.detail)}
          />
        {:else}
          <GraphLanes
            bind:this={graphRef}
            {nodes}
            {edges}
            {scores}
            {selectedId}
            {kindFilter}
            {statusFilter}
            on:select={(e) => selectNode(e.detail)}
          />
        {/if}
      </div>
    </section>
    <InsightTabs on:select={(e) => selectNode(e.detail)} />
    {#if selectedId}
      <div class="panel">
        <ArtifactPanel
          id={selectedId}
          {edges}
          on:close={closePanel}
          on:navigate={(e) => navigate(e.detail)}
        />
      </div>
    {/if}
  </main>
</div>

<style>
  .root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: var(--bg);
    color: var(--fg-1);
  }
  .error-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 18px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--accent);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .error-bar code {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fg-2);
  }
  .retry {
    background: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 2px 10px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .retry:hover {
    background: var(--accent-dim);
  }
  .layout {
    flex: 1;
    display: grid;
    grid-template-columns: 200px 1fr 320px;
    min-height: 0;
  }
  .layout.has-panel {
    grid-template-columns: 200px 1fr 320px 380px;
  }
  .canvas {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--line);
  }
  .canvas-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-3);
    letter-spacing: 0.04em;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--line-2);
    color: var(--fg-2);
    padding: 3px 12px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    transition: border-color 120ms, color 120ms;
  }
  .ghost:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .view-toggle {
    display: inline-flex;
    border: 1px solid var(--line-2);
  }
  .seg {
    background: transparent;
    border: none;
    color: var(--fg-3);
    padding: 3px 12px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: color 120ms, background 120ms;
  }
  .seg + .seg {
    border-left: 1px solid var(--line-2);
  }
  .seg:hover {
    color: var(--fg-1);
  }
  .seg.active {
    background: var(--accent-dim);
    color: var(--accent);
  }
  .canvas-body {
    flex: 1;
    min-height: 0;
  }
  .muted {
    color: var(--fg-3);
  }
  .panel {
    min-width: 0;
    min-height: 0;
  }
  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 180px 1fr;
    }
    .layout.has-panel {
      grid-template-columns: 180px 1fr 360px;
    }
    .layout :global(aside.rail) {
      display: none;
    }
    .layout.has-panel :global(aside.rail) {
      display: none;
    }
  }
</style>
