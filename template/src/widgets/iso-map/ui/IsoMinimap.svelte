<script lang="ts">
  // Self-contained 3D minimap box — absorbs the working Canvas/overlay
  // wiring that used to live directly in routes/iso-spike/+page.svelte
  // (that route is now a thin `<IsoMinimap fullscreen />` host). Reuses the
  // SAME widget-owned mapPoller (RFC-030 SD-1) ComposedMapView uses — no
  // second poller.
  //
  // Two layouts, one component (OCP): `fullscreen` (the /iso-spike dev
  // route) gets the old fixed/inset:0 page chrome + breadcrumb; the default
  // corner mode sizes to 100%/100% of whatever box the caller gives it
  // (DependencyGraph's IsoMapCorner) and drops the breadcrumb — cramped at
  // ~320x240 alongside the bottom-right IsoControls cluster. IsoControls/
  // IsoA11yProxy are already `position: absolute` against their nearest
  // positioned ancestor, so mounting them here anchors correctly to THIS
  // box without any change to those components (this file is the
  // positioned ancestor in both modes).
  //
  // showInfoCards is intentionally NOT a prop here (unlike the old
  // +page.svelte): this component is always the compact minimap shape —
  // IsoLeaderLine/IsoNodeCard/IsoLayerCard stay unmounted. The per-element
  // hover highlight in IsoZoneFrame/IsoNodeBox is the primary feedback;
  // IsoA11yProxy still mounts unconditionally for keyboard reachability.
  import { Canvas } from "@threlte/core";
  import IsoScene from "../IsoScene.svelte";
  import IsoControls from "./IsoControls.svelte";
  import IsoA11yProxy from "./IsoA11yProxy.svelte";
  import LevelBreadcrumb from "@/widgets/composed-map/ui/LevelBreadcrumb.svelte";
  import {
    acquireMapPolling,
    isEmptyMapResponse,
    mapPoller,
    validateMapDocument,
    type MapDocument,
  } from "@/entities/map";
  import {
    currentLevelStack,
    currentDepthWindow,
    setDepthWindow,
    climbTo,
    ascend,
    labelForFocus,
    currentDwellableTargets,
    focusDwell,
    blurDwell,
  } from "../model/iso-view-state.svelte";

  let { fullscreen = false }: { fullscreen?: boolean } = $props();

  const levelStack = $derived(currentLevelStack());
  const depthWindow = $derived(currentDepthWindow());

  $effect(() => {
    const release = acquireMapPolling();
    return () => release();
  });

  type Branch =
    | { kind: "loading" }
    | { kind: "empty" }
    | { kind: "error"; message: string }
    | { kind: "ok"; doc: MapDocument };

  const rootBranch = $derived.by((): Branch => {
    const { data: raw, error, lastFetched } = mapPoller.state;
    if (raw === null && lastFetched === null) return { kind: "loading" };
    if (error) return { kind: "error", message: error };
    if (isEmptyMapResponse(raw)) return { kind: "empty" };
    const result = validateMapDocument(raw);
    if (!result.ok) {
      return {
        kind: "error",
        message: result.errors[0]?.message ?? "invalid map",
      };
    }
    return { kind: "ok", doc: result.doc };
  });

  const dwellableTargets = $derived.by(() =>
    rootBranch.kind === "ok" ? currentDwellableTargets(rootBranch.doc) : [],
  );

  function labelFor(focusId: string | null): string {
    return rootBranch.kind === "ok"
      ? labelForFocus(rootBranch.doc, focusId)
      : (focusId ?? "All");
  }
</script>

<div class="iso-minimap" class:fullscreen>
  {#if rootBranch.kind === "loading"}
    <p class="status-msg">Loading map…</p>
  {:else if rootBranch.kind === "empty"}
    <p class="status-msg">No map yet</p>
  {:else if rootBranch.kind === "error"}
    <p class="status-msg">Map error: {rootBranch.message}</p>
  {:else}
    <Canvas>
      <IsoScene rootDoc={rootBranch.doc} />
    </Canvas>
    {#if fullscreen}
      <LevelBreadcrumb stack={levelStack} onCrumb={climbTo} {labelFor} />
    {/if}
    <IsoControls
      {depthWindow}
      onDepthWindowChange={(n) => setDepthWindow(rootBranch.doc, n)}
      canAscend={levelStack.length > 1}
      onAscend={ascend}
    />
    <IsoA11yProxy
      targets={dwellableTargets}
      onFocusTarget={focusDwell}
      onBlurTarget={blurDwell}
    />
  {/if}
</div>

<style>
  .iso-minimap {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    overflow: hidden;
  }

  .iso-minimap.fullscreen {
    position: fixed;
    inset: 0;
  }

  .status-msg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 90%;
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--fg-3);
    text-align: center;
    pointer-events: none;
  }
</style>
