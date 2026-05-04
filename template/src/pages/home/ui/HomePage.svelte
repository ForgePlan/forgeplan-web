<script lang="ts">
  import { listPoller, stalePoller } from '@/entities/artifact';
  import { graphPoller } from '@/entities/graph';
  import { healthPoller } from '@/entities/health';
  import { scorePoller } from '@/entities/score';
  import { claimsPoller } from '@/entities/claim';
  import { blockedPoller } from '@/entities/blocked';
  import { logPoller } from '@/entities/activity';
  import { HealthBar } from '@/widgets/health-bar';
  import { Filters } from '@/widgets/artifact-filters';
  import { DependencyGraph } from '@/widgets/dependency-graph';
  import { ArtifactPanel } from '@/widgets/artifact-panel';
  import { InsightsRail } from '@/widgets/insights-rail';
  import { GRAPH_VIEWS, type GraphView, type InsightTab } from '@/shared/config';
  import { loadSettings, saveSettings } from '../lib/settings';

  let view = $state<GraphView>('force');
  let kindFilter = $state(new Set<string>());
  let statusFilter = $state(new Set<string>());
  let activeTab = $state<InsightTab>('agents');
  let selectedId = $state<string | null>(null);
  let graphRef = $state<{ resetZoom: () => void } | undefined>();
  let settingsHydrated = $state(false);

  const nodes = $derived(listPoller.state.data ?? []);
  const edges = $derived(graphPoller.state.data?.edges ?? []);
  const scores = $derived(scorePoller.state.data ?? []);
  const globalError = $derived(listPoller.state.error ?? graphPoller.state.error ?? null);

  function setView(next: GraphView) {
    view = next;
  }

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

  $effect(() => {
    const initial = loadSettings();
    view = initial.view;
    kindFilter = initial.kindFilter;
    statusFilter = initial.statusFilter;
    activeTab = initial.activeTab;
    settingsHydrated = true;

    listPoller.start();
    graphPoller.start();
    healthPoller.start();
    scorePoller.start();
    claimsPoller.start();
    stalePoller.start();
    blockedPoller.start();
    logPoller.start();

    return () => {
      listPoller.stop();
      graphPoller.stop();
      healthPoller.stop();
      scorePoller.stop();
      claimsPoller.stop();
      stalePoller.stop();
      blockedPoller.stop();
      logPoller.stop();
    };
  });

  $effect(() => {
    if (!settingsHydrated) return;
    const snapshot = {
      view,
      kindFilter: new Set(kindFilter),
      statusFilter: new Set(statusFilter),
      activeTab
    };
    const timer = setTimeout(() => saveSettings(snapshot), 250);
    return () => clearTimeout(timer);
  });
</script>

<div class="root">
  <HealthBar />
  {#if globalError}
    <div class="error-bar">
      <span class="muted">CLI error:</span>
      <code>{globalError}</code>
      <button type="button" class="retry" onclick={() => { listPoller.refresh(); graphPoller.refresh(); }}>retry</button>
    </div>
  {/if}
  <main class="layout" class:has-panel={selectedId !== null}>
    <Filters
      kinds={[...new Set(nodes.map((n) => n.kind.toLowerCase()))].sort()}
      statuses={[...new Set(nodes.map((n) => n.status.toLowerCase()))].sort()}
      bind:kindFilter
      bind:statusFilter
    />
    <section class="canvas">
      <div class="canvas-toolbar">
        <span class="muted">{nodes.length} ARTIFACTS &middot; {edges.length} EDGES</span>
        <div class="toolbar-right">
          <div class="view-toggle" role="tablist" aria-label="Graph view">
            {#each GRAPH_VIEWS as v (v.id)}
              <button
                type="button"
                class="seg"
                class:active={view === v.id}
                role="tab"
                aria-selected={view === v.id}
                title={v.hint}
                onclick={() => setView(v.id)}
              >
                {v.label}
              </button>
            {/each}
          </div>
          <button type="button" class="ghost" onclick={reset}>Reset view</button>
        </div>
      </div>
      <div class="canvas-body">
        <DependencyGraph
          bind:this={graphRef}
          {view}
          {nodes}
          {edges}
          {scores}
          {selectedId}
          {kindFilter}
          {statusFilter}
          onSelect={(detail) => selectNode(detail)}
        />
      </div>
    </section>
    <InsightsRail bind:activeTab onSelect={(detail) => selectNode(detail)} />
    {#if selectedId}
      <div class="panel">
        <ArtifactPanel
          id={selectedId}
          {edges}
          onClose={closePanel}
          onNavigate={(detail) => navigate(detail)}
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
