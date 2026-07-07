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
  import { IsoMinimap } from "@/widgets/iso-map";
</script>

<IsoMinimap fullscreen />
