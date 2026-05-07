<script lang="ts">
  import { listPoller, stalePoller } from '@/entities/artifact';
  import { graphPoller } from '@/entities/graph';
  import { healthPoller } from '@/entities/health';
  import {
    detectBreaches,
    emptySnapshot,
    fire,
    focusArtifact,
    notifyBus,
    snapshotFromHealth,
    type HealthSnapshot,
  } from '@/entities/health/lib/notify.svelte';
  import { scorePoller } from '@/entities/score';
  import { claimsPoller } from '@/entities/claim';
  import { blockedPoller } from '@/entities/blocked';
  import { logPoller } from '@/entities/activity';
  import { HealthBar } from '@/widgets/health-bar';
  import { Filters } from '@/widgets/artifact-filters';
  import { DependencyGraph } from '@/widgets/dependency-graph';
  import { ArtifactPanel } from '@/widgets/artifact-panel';
  import { InsightsRail } from '@/widgets/insights-rail';
  import { Timeline, snapshotStore } from '@/widgets/timeline';
  import { VersionFooter } from '@/widgets/version-footer';
  import {
    MosaicCanvas,
    changeView,
    leaves,
    loadLayout,
    saveLayout,
    singletonLayout,
    type Layout
  } from '@/widgets/mosaic';
  import { type GraphView, type InsightTab } from '@/shared/config';
  import { loadSettings, saveSettings } from '../lib/settings';

  let view = $state<GraphView>('force');
  let layout = $state<Layout>(singletonLayout('force'));
  let layoutHydrated = $state(false);
  let kindFilter = $state(new Set<string>());
  let statusFilter = $state(new Set<string>());
  let activeTab = $state<InsightTab>('agents');
  let selectedId = $state<string | null>(null);
  type GraphRef = { resetZoom: () => void };
  let graphRefs = $state<Record<string, GraphRef | undefined>>({});
  let settingsHydrated = $state(false);
  let notifyEnabled = $state(false);
  let liveText = $state('');

  const PANEL_MIN = 320;
  const PANEL_MAX_RATIO = 0.7;
  const PANEL_DEFAULT = 658;
  const PANEL_STORAGE_KEY = 'forgeplan-web.panelWidth';

  let panelWidth = $state(PANEL_DEFAULT);
  // Plain `let`, not $state: this is the "previous tick" memo for the
  // breach-detection effect below, not a value the template renders.
  // Making it $state caused effect_update_depth_exceeded — the effect
  // both reads (in detectBreaches) and writes (assignment at end) the
  // same reactive signal, which Svelte (correctly) flags as a cycle.
  let prevHealthSnapshot: HealthSnapshot = emptySnapshot();
  let lastNotifyEnabled = false;
  let liveSeq = 0;

  const liveNodes = $derived(listPoller.state.data ?? []);
  const liveEdges = $derived(graphPoller.state.data?.edges ?? []);
  const snapshotting = $derived(
    snapshotStore.mode === 'single' && snapshotStore.current !== null
  );
  const nodes = $derived(
    snapshotting && snapshotStore.current
      ? (snapshotStore.current.artifacts as typeof liveNodes)
      : liveNodes
  );
  const edges = $derived(
    snapshotting && snapshotStore.current
      ? (snapshotStore.current.edges as typeof liveEdges)
      : liveEdges
  );
  const scores = $derived(scorePoller.state.data?.results ?? []);
  const globalError = $derived(listPoller.state.error ?? graphPoller.state.error ?? null);

  function selectNode(detail: { id: string }) {
    selectedId = detail.id;
  }

  function closePanel() {
    selectedId = null;
  }

  function navigate(detail: { id: string }) {
    selectedId = detail.id;
  }

  function resetZoomFor(leafId: string) {
    graphRefs[leafId]?.resetZoom();
  }

  $effect(() => {
    const initial = loadSettings();
    view = initial.view;
    kindFilter = initial.kindFilter;
    statusFilter = initial.statusFilter;
    activeTab = initial.activeTab;
    notifyEnabled = initial.notify;
    settingsHydrated = true;
    layout = loadLayout(initial.view);
    layoutHydrated = true;

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
      activeTab,
      notify: notifyEnabled
    };
    const timer = setTimeout(() => saveSettings(snapshot), 250);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (!layoutHydrated) return;
    const snapshot = layout;
    const timer = setTimeout(() => saveLayout(snapshot), 250);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const health = healthPoller.state.data;
    if (!health) return;
    const blindSpots = health.blind_spots.map((s) => ({ id: s.id, title: s.title ?? '' }));
    const next = snapshotFromHealth({
      blind_spots: blindSpots,
      stale_count: health.stale_count,
      orphan_count: health.orphans.length
    });
    if (notifyEnabled && !lastNotifyEnabled) {
      // Prime: don't fire notifications for pre-existing breaches when user opts in.
      prevHealthSnapshot = next;
      lastNotifyEnabled = true;
      return;
    }
    lastNotifyEnabled = notifyEnabled;
    if (notifyEnabled) {
      const breaches = detectBreaches(prevHealthSnapshot, next, { blind_spots: blindSpots });
      for (const b of breaches) {
        fire(b, (br) => {
          if ('id' in br) focusArtifact(br.id);
        });
      }
      if (breaches.length > 0) {
        liveText = '​' + (++liveSeq) + ' ' + breaches
          .map((b) => {
            if (b.kind === 'blind_spot') return `Blind spot: ${b.id}`;
            if (b.kind === 'stale') return `${b.delta} new stale`;
            return `${b.delta} new orphan`;
          })
          .join(', ');
      }
    }
    prevHealthSnapshot = next;
  });

  $effect(() => {
    const id = notifyBus.pendingFocus;
    if (id) {
      selectNode({ id });
      notifyBus.pendingFocus = null;
    }
  });

  $effect(() => {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(PANEL_STORAGE_KEY);
    if (saved === null) return;
    const n = Number(saved);
    if (Number.isFinite(n) && n >= PANEL_MIN) panelWidth = clampWidth(n);
  });

  function clampWidth(w: number): number {
    const max = typeof window !== 'undefined'
      ? window.innerWidth * PANEL_MAX_RATIO
      : Number.POSITIVE_INFINITY;
    return Math.max(PANEL_MIN, Math.min(max, w));
  }

  function persistWidth() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PANEL_STORAGE_KEY, String(Math.round(panelWidth)));
  }

  function onResizeStart(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    function move(ev: PointerEvent) {
      const dx = startX - ev.clientX;
      panelWidth = clampWidth(startWidth + dx);
    }
    function up() {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      persistWidth();
    }
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  function onResizeKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      panelWidth = clampWidth(panelWidth + 24);
      persistWidth();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      panelWidth = clampWidth(panelWidth - 24);
      persistWidth();
    }
  }
</script>

<div class="root">
  <HealthBar bind:notify={notifyEnabled} liveText={liveText} />
  {#if globalError}
    <div class="error-bar">
      <span class="muted">CLI error:</span>
      <code>{globalError}</code>
      <button type="button" class="retry" onclick={() => { listPoller.refresh(); graphPoller.refresh(); }}>retry</button>
    </div>
  {/if}
  <main
    class="layout"
    class:has-panel={selectedId !== null}
    style:--panel-w={`${panelWidth}px`}
  >
    <Filters
      kinds={[...new Set(nodes.map((n) => n.kind.toLowerCase()))].sort()}
      statuses={[...new Set(nodes.map((n) => n.status.toLowerCase()))].sort()}
      bind:kindFilter
      bind:statusFilter
    />
    <section class="canvas">
      <div class="canvas-toolbar">
        <span class="muted">{nodes.length} ARTIFACTS &middot; {edges.length} EDGES</span>
      </div>
      <div class="canvas-body">
        <MosaicCanvas bind:layout onResetZoom={resetZoomFor}>
          {#snippet leafSnippet(paneView: GraphView, leafId: string)}
            <DependencyGraph
              bind:this={graphRefs[leafId]}
              view={paneView}
              {nodes}
              {edges}
              {scores}
              {selectedId}
              {kindFilter}
              {statusFilter}
              onSelect={(detail) => selectNode(detail)}
            />
          {/snippet}
        </MosaicCanvas>
      </div>
      <Timeline />
    </section>
    <InsightsRail bind:activeTab onSelect={(detail) => selectNode(detail)} />
    {#if selectedId}
      <div class="panel">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize artifact panel"
          tabindex="0"
          onpointerdown={onResizeStart}
          onkeydown={onResizeKey}
        ></div>
        <ArtifactPanel
          id={selectedId}
          {edges}
          onClose={closePanel}
          onNavigate={(detail) => navigate(detail)}
        />
      </div>
    {/if}
  </main>
  <VersionFooter />
</div>

<style>
  .root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: var(--bg);
    color: var(--fg-1);
    overflow: hidden;
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
    grid-template-columns: 200px 1fr 320px var(--panel-w, 658px);
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
  .canvas-body {
    flex: 1;
    min-height: 0;
  }
  .muted {
    color: var(--fg-3);
  }
  .panel {
    position: relative;
    min-width: 0;
    min-height: 0;
  }
  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    margin-left: -3px;
    cursor: ew-resize;
    background: transparent;
    z-index: 10;
    transition: background 120ms;
  }
  .resize-handle:hover,
  .resize-handle:focus-visible {
    background: var(--accent-dim);
    outline: none;
  }
  .resize-handle:active {
    background: var(--accent);
  }
  @media (prefers-reduced-motion: reduce) {
    .resize-handle {
      transition: none;
    }
  }
  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 200px 1fr;
    }
    .layout.has-panel {
      grid-template-columns: 200px 1fr var(--panel-w, 658px);
    }
    .layout :global(aside.rail),
    .layout.has-panel :global(aside.rail) {
      display: none;
    }
  }
</style>
