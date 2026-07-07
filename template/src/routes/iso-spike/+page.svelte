<script lang="ts">
  import { Canvas } from '@threlte/core';
  import IsoScene from './IsoScene.svelte';
  import {
    acquireMapPolling,
    isEmptyMapResponse,
    mapPoller,
    validateMapDocument,
    type MapDocument,
  } from '@/entities/map';
  import { createPoller } from '@/shared/api';

  // TODO(spike): de-risking prototype for a future 3D isometric layered map
  // view (IDEF0 exploded pyramid). Throwaway route, not linked from any nav —
  // proves Threlte renders our real composed-map data as an orbit-able,
  // click-to-descend 3D stack. Not the production composed-map (untouched).
  // Reuses the widget-owned mapPoller (RFC-030 SD-1) for the root document;
  // the per-zone layer doc has no shared poller yet, so this route owns a
  // private one-off poller scoped to its own lifetime.

  const layerPoller = createPoller<MapDocument>('/api/map/layers/z.ui');

  $effect(() => {
    const release = acquireMapPolling();
    layerPoller.start();
    return () => {
      release();
      layerPoller.stop();
    };
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

  const layerDoc = $derived.by((): MapDocument | null => {
    const raw = layerPoller.state.data;
    if (!raw || isEmptyMapResponse(raw)) return null;
    const result = validateMapDocument(raw);
    return result.ok ? result.doc : null;
  });

  let lastDescend = $state<{ id: string; label: string } | null>(null);

  function handleDescend(id: string, label: string): void {
    lastDescend = { id, label };
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
      <IsoScene rootDoc={rootBranch.doc} {layerDoc} onDescend={handleDescend} />
    </Canvas>
    <div class="hud">
      <div class="hud-title">iso-spike — 3D layered map (throwaway)</div>
      <div class="hud-row">drag to orbit · scroll to zoom · click a box to descend</div>
      {#if lastDescend}
        <div class="hud-row hud-descend">descended into: {lastDescend.id} — {lastDescend.label}</div>
      {/if}
    </div>
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
    position: absolute;
    top: 16px;
    left: 16px;
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
