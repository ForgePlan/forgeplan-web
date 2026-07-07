<script lang="ts">
  import { Canvas } from '@threlte/core';
  import IsoScene from './IsoScene.svelte';
  import IsoControls from './ui/IsoControls.svelte';
  import IsoLeaderLine from './ui/IsoLeaderLine.svelte';
  import IsoNodeCard from './ui/IsoNodeCard.svelte';
  import IsoLayerCard from './ui/IsoLayerCard.svelte';
  import IsoA11yProxy from './ui/IsoA11yProxy.svelte';
  import LevelBreadcrumb from '@/widgets/composed-map/ui/LevelBreadcrumb.svelte';
  import {
    acquireMapPolling,
    isEmptyMapResponse,
    mapPoller,
    validateMapDocument,
    type MapDocument,
  } from '@/entities/map';
  import {
    currentLevelStack,
    currentDepthWindow,
    setDepthWindow,
    climbTo,
    ascend,
    labelForFocus,
    resolveDwellCardData,
    currentDwellableTargets,
    focusDwell,
    blurDwell,
  } from './model/iso-view-state.svelte';

  // TODO(spike): de-risking prototype for a future 3D isometric layered map
  // view (IDEF0 exploded pyramid). Throwaway route, not linked from any nav —
  // proves Threlte renders our real composed-map data as an orbit-able,
  // click-to-descend 3D stack. Not the production composed-map (untouched).
  // Reuses the widget-owned mapPoller (RFC-030 SD-1) for the root document.
  // Stage 2: per-zone emitted-layer fetching moved into
  // model/iso-view-state.svelte.ts (on-demand, same gate as
  // ComposedMapView.maybeFetchLayer) — this page no longer runs its own
  // hardcoded single-zone layer poller.
  //
  // COMPOSITION ROOT (page-level): the 3D <Canvas>/<IsoScene> and the 2D DOM
  // overlays (HUD, breadcrumb, controls) are siblings here — Threlte's
  // Canvas owns a WebGL context, so 2D controls can't live inside it. Both
  // overlay components below read/drive the SAME module-level
  // model/iso-view-state.svelte.ts singleton IsoScene consumes for the 3D
  // side (no prop drilling needed — see that module's header comment).
  //
  // Stage 3: hover-dwell cards (IsoNodeCard/IsoLayerCard) + the a11y proxy
  // are ALSO mounted here, as plain 2D siblings — this page is the ONLY
  // place that resolves `resolveDwellCardData`/`currentDwellableTargets`
  // into actual card content, so IsoNodeCard/IsoLayerCard/IsoA11yProxy
  // stay dumb, prop-only renderers (DIP). <IsoLeaderLine> is the one
  // exception mounted INSIDE <Canvas> (it needs Threlte's camera/orbit
  // context to project `anchorWorldPos` onto the screen) — see its own
  // header comment for why that's still just a sibling decoration, not a
  // change to IsoScene's own tree (OCP).

  const levelStack = $derived(currentLevelStack());
  const depthWindow = $derived(currentDepthWindow());

  let cardEl = $state<HTMLElement | null>(null);
  const dwellData = $derived.by(() =>
    rootBranch.kind === 'ok' ? resolveDwellCardData(rootBranch.doc) : null,
  );
  const dwellableTargets = $derived.by(() =>
    rootBranch.kind === 'ok' ? currentDwellableTargets(rootBranch.doc) : [],
  );

  $effect(() => {
    const release = acquireMapPolling();
    return () => release();
  });

  type Branch =
    | { kind: 'loading' }
    | { kind: 'empty' }
    | { kind: 'error'; message: string }
    | { kind: 'ok'; doc: MapDocument };

  const rootBranch = $derived.by((): Branch => {
    const { data: raw, error, lastFetched } = mapPoller.state;
    if (raw === null && lastFetched === null) return { kind: 'loading' };
    if (error) return { kind: 'error', message: error };
    if (isEmptyMapResponse(raw)) return { kind: 'empty' };
    const result = validateMapDocument(raw);
    if (!result.ok) return { kind: 'error', message: result.errors[0]?.message ?? 'invalid map' };
    return { kind: 'ok', doc: result.doc };
  });

  let lastDescend = $state<{ id: string; label: string } | null>(null);

  function handleDescend(id: string, label: string): void {
    lastDescend = { id, label };
  }

  function labelFor(focusId: string | null): string {
    return rootBranch.kind === 'ok' ? labelForFocus(rootBranch.doc, focusId) : (focusId ?? 'All');
  }
</script>

<div class="iso-spike-page">
  {#if rootBranch.kind === 'loading'}
    <p class="status-msg">Loading map…</p>
  {:else if rootBranch.kind === 'empty'}
    <p class="status-msg">
      No .forgeplan/map/map.json found — run the forgeplan-map-pack pipeline first.
    </p>
  {:else if rootBranch.kind === 'error'}
    <p class="status-msg">Failed to load map: {rootBranch.message}</p>
  {:else}
    <Canvas>
      <IsoScene rootDoc={rootBranch.doc} onDescend={handleDescend} />
    </Canvas>
    <div class="hud">
      <div class="hud-title">iso-spike — 3D layered map (throwaway)</div>
      <div class="hud-row">drag to orbit · scroll to zoom · click a drillable box to descend</div>
      {#if lastDescend}
        <div class="hud-row hud-descend">descended into: {lastDescend.id} — {lastDescend.label}</div>
      {/if}
    </div>
    <LevelBreadcrumb stack={levelStack} onCrumb={climbTo} {labelFor} />
    <IsoControls
      {depthWindow}
      onDepthWindowChange={setDepthWindow}
      canAscend={levelStack.length > 1}
      onAscend={ascend}
    />
  {/if}
</div>

<style>
  .iso-spike-page {
    position: fixed;
    inset: 0;
    background: var(--bg);
    color: var(--fg);
  }

  .status-msg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 14px;
    color: var(--fg-2);
  }

  .hud {
    /* top-RIGHT (not left): LevelBreadcrumb owns top-left (RFC-031 Phase 4
       default position) — this avoids the two overlays overlapping once a
       descend makes the breadcrumb appear. */
    position: absolute;
    top: 16px;
    right: 16px;
    padding: 10px 14px;
    background: var(--bg-1);
    border: 1px solid var(--line, var(--fg-4));
    border-radius: 8px;
    font-size: 12px;
    color: var(--fg-2);
    pointer-events: none;
    max-width: 380px;
  }

  .hud-title {
    color: var(--fg);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .hud-row {
    margin-top: 2px;
  }

  .hud-descend {
    color: var(--accent);
  }
</style>
