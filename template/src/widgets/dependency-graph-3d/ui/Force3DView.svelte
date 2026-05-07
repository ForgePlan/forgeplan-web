<script lang="ts">
  import { browser } from '$app/environment';
  import { Canvas } from '@threlte/core';
  import { onMount } from 'svelte';
  import type { Force3DProps } from '../model/types';
  import Scene3D from './Scene3D.svelte';
  import { readTheme3D } from '../lib/theme-3d';

  let {
    nodes = [],
    edges = [],
    scores = [],
    selectedId = null,
    kindFilter = new Set<string>(),
    statusFilter = new Set<string>(),
    onSelect,
  }: Force3DProps = $props();

  const filteredNodes = $derived.by(() => {
    if (kindFilter.size === 0 && statusFilter.size === 0) return nodes;
    return nodes.filter((n) => {
      if (kindFilter.size > 0 && !kindFilter.has(n.kind)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(n.status)) return false;
      return true;
    });
  });

  const filteredEdges = $derived.by(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  });

  let webglAvailable = $state(true);

  onMount(() => {
    if (!browser) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx =
        canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      webglAvailable = ctx != null;
    } catch {
      webglAvailable = false;
    }
  });

  let bgColor = $state('#0a0a0f');

  function syncBg() {
    if (!browser) return;
    bgColor = `#${readTheme3D().bg.getHexString()}`;
  }

  onMount(() => {
    syncBg();
    const obs = new MutationObserver(syncBg);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  });

  // TODO(force-3d-reset-zoom): expose a resetZoom() the way 2D views do, so
  // the pane's "↻" button works for Force 3D. Threlte's OrbitControls instance
  // is not yet bridged to a parent ref; defer until the in-Force-mode 2D ↔ 3D
  // switch lands.
  export function resetZoom() {
    /* no-op for MVP */
  }
</script>

<div class="canvas-host" style="--graph3d-bg: {bgColor}">
  {#if !browser}
    <div class="placeholder">Loading 3D scene…</div>
  {:else if !webglAvailable}
    <div class="placeholder">
      Force 3D requires WebGL — falling back is not yet wired.
    </div>
  {:else}
    <Canvas renderMode="always">
      <Scene3D
        nodes={filteredNodes}
        edges={filteredEdges}
        {scores}
        {selectedId}
        {onSelect}
      />
    </Canvas>
  {/if}
  <div class="hud">
    <span class="hud-key">drag</span>
    <span class="hud-val">orbit</span>
    <span class="hud-sep">·</span>
    <span class="hud-key">scroll</span>
    <span class="hud-val">zoom</span>
    <span class="hud-sep">·</span>
    <span class="hud-key">click</span>
    <span class="hud-val">select</span>
  </div>
</div>

<style>
  .canvas-host {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background:
      radial-gradient(
        circle at 50% 50%,
        color-mix(in srgb, var(--accent) 5%, var(--graph3d-bg)) 0%,
        var(--graph3d-bg) 70%
      );
    overflow: hidden;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .hud {
    position: absolute;
    left: 12px;
    bottom: 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--line-2);
    border-radius: 3px;
    background: color-mix(in srgb, var(--bg) 60%, transparent);
    backdrop-filter: blur(6px);
    color: var(--fg-2);
    font-family: var(--font-mono);
    font-size: 10px;
    pointer-events: none;
    user-select: none;
  }
  .hud-key {
    color: var(--fg-3);
  }
  .hud-val {
    color: var(--fg-1);
  }
  .hud-sep {
    color: var(--line-3);
  }
</style>
