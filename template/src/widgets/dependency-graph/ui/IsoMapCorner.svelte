<script lang="ts">
  // Map-view-only replacement for the 2D <Minimap> corner (same bottom-right
  // slot, same chrome shape) — mounts the 3D IsoMinimap widget. `three` +
  // `@threlte/*` are heavy (WebGL scene graph) and every OTHER view never
  // touches them, so this component dynamic-imports widgets/iso-map instead
  // of a static import: the dependency-graph entry chunk (loaded for every
  // view) stays free of three/threlte, which only load once the user opens
  // the Map view and this corner actually mounts. Threlte's Canvas defaults
  // to `renderMode: 'on-demand'` (no prop override needed) — the corner
  // canvas only re-renders on scene invalidation, not every frame.
  //
  // `browser`-guarded: this component itself is reachable from the
  // adapter-node server manifest (DependencyGraph is part of the main page,
  // which is always in the server-side route graph regardless of its own
  // ssr flag). Guarding with `browser` lets Vite's SSR build tree-shake the
  // dynamic import out of the server bundle entirely — otherwise the
  // single-file esbuild bundling step (no code-splitting) inlines it and
  // three/@threlte blow past the dist/ size cap. The client build (where
  // this corner actually mounts) is unaffected.
  import { browser } from '$app/environment';

  const isoMapModule = browser ? import('@/widgets/iso-map') : null;
</script>

<div class="iso-map-corner">
  {#if isoMapModule}
    {#await isoMapModule}
      <div class="iso-map-corner-status">loading 3D…</div>
    {:then mod}
      <mod.IsoMinimap />
    {:catch}
      <div class="iso-map-corner-status">3D minimap unavailable</div>
    {/await}
  {:else}
    <div class="iso-map-corner-status">3D minimap unavailable</div>
  {/if}
</div>

<style>
  .iso-map-corner {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 320px;
    height: 240px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 2px;
    box-shadow: var(--shadow-mini);
    z-index: 5;
    overflow: hidden;
  }

  .iso-map-corner-status {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-align: center;
    padding: 0 12px;
  }
</style>
