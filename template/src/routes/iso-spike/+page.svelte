<script lang="ts">
  // TODO(spike): de-risking prototype for a future 3D isometric layered map
  // view (IDEF0 exploded pyramid). Throwaway route, not linked from any nav —
  // proves Threlte renders our real composed-map data as an orbit-able,
  // click-to-descend 3D stack. Not the production composed-map (untouched).
  //
  // Thin dev/full-screen host: all Canvas/overlay/poller logic now lives in
  // the graduated widgets/iso-map/ui/IsoMinimap.svelte (the same component
  // DependencyGraph's corner mount uses in its default, container-sized
  // mode) — this route just asks for the `fullscreen` layout.
  //
  // `browser`-guarded dynamic import (not a static import): three/@threlte
  // are heavy, and this file's compiled output is still reachable from the
  // adapter-node server manifest (every route node is referenced there
  // regardless of its own ssr flag — see +page.ts). Guarding with `browser`
  // lets Vite's SSR build tree-shake the import out of the server bundle
  // entirely; the client build (where this code actually runs) is unaffected.
  import { browser } from '$app/environment';

  const isoMapModule = browser ? import('@/widgets/iso-map') : null;
</script>

{#if isoMapModule}
  {#await isoMapModule then mod}
    <mod.IsoMinimap fullscreen />
  {/await}
{/if}
