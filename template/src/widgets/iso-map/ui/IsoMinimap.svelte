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
  import { untrack } from "svelte";
  import { Canvas } from "@threlte/core";
  import IsoScene from "../IsoScene.svelte";
  import IsoControls from "./IsoControls.svelte";
  import IsoA11yProxy from "./IsoA11yProxy.svelte";
  import LevelBreadcrumb from "@/widgets/composed-map/ui/LevelBreadcrumb.svelte";
  import { Button } from "@/shared/ui";
  import {
    acquireMapPolling,
    isEmptyMapResponse,
    mapPoller,
    validateMapDocument,
    type MapDocument,
  } from "@/entities/map";
  import {
    sharedFocusChain,
    focusTo,
    chainsEqual,
  } from "@/widgets/composed-map/model/shared-drill-bus.svelte";
  import {
    currentLevelStack,
    currentDepthWindow,
    currentFocusChain,
    setDepthWindow,
    climbTo,
    ascend,
    labelForFocus,
    currentDwellableTargets,
    focusDwell,
    blurDwell,
    applyExternalFocusChain,
  } from "../model/iso-view-state.svelte";

  let { fullscreen = false }: { fullscreen?: boolean } = $props();

  const levelStack = $derived(currentLevelStack());
  const depthWindow = $derived(currentDepthWindow());
  const focusChainNow = $derived(currentFocusChain());

  // Control-panel toggle (requirement: hideable/showable depth+ascend
  // cluster) — a small always-visible corner button; default visible.
  let controlsVisible = $state(true);

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

  // Shared drill-chain bus (2D <-> 3D corner) — OUTBOUND: mirror this
  // scene's own focus chain out whenever it changes, regardless of cause
  // (box click in IsoScene, ascend/climbTo below). focusTo no-ops on
  // unchanged content, so this can never fight the INBOUND effect below
  // into a loop.
  $effect(() => {
    focusTo(focusChainNow);
  });

  // INBOUND — replay an externally-driven chain (e.g. a descend in the 2D
  // map) onto this scene via applyExternalFocusChain, which drills the
  // EXACT ids given (never substituting a "primary child" the way a click
  // would). Skips its own very first run so opening the corner never
  // auto-explodes to a chain a previous session left behind. `untrack`
  // keeps this effect's ONLY dependency the shared chain itself — reading
  // rootBranch/local state inside the callback must not leak as
  // dependencies, or this scene's own box clicks would re-run it against
  // a not-yet-updated shared value. A chain update dropped here because a
  // local enter/exit animation is in flight is NOT lost:
  // applyExternalFocusChain itself records the pending target and a
  // module-level watcher inside iso-view-state.svelte.ts retries it the
  // instant that animation settles (EVID-100 Finding #1) — this effect
  // does not need to know about `animationKind` at all.
  let sharedChainPrimed = false;
  $effect(() => {
    const shared = sharedFocusChain();
    if (!sharedChainPrimed) {
      sharedChainPrimed = true;
      return;
    }
    untrack(() => {
      if (rootBranch.kind !== "ok") return;
      if (chainsEqual(currentFocusChain(), shared)) return;
      void applyExternalFocusChain(rootBranch.doc, shared);
    });
  });
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
    <Button
      variant="ghost"
      size="icon"
      class="iso-controls-toggle-pos"
      aria-label={controlsVisible ? "Hide 3D controls" : "Show 3D controls"}
      aria-expanded={controlsVisible}
      onclick={() => (controlsVisible = !controlsVisible)}
    >
      <span aria-hidden="true">⋯</span>
    </Button>
    {#if controlsVisible}
      <IsoControls
        {depthWindow}
        onDepthWindowChange={(n) => setDepthWindow(rootBranch.doc, n)}
        canAscend={levelStack.length > 1}
        onAscend={ascend}
      />
    {/if}
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

  /* Positioning only (rule 24) — the button itself is the shared/ui
     Button primitive, unmodified. Top-right corner, clear of the
     bottom-right IsoControls cluster and the (fullscreen-only) top-left
     breadcrumb. */
  :global(.iso-controls-toggle-pos) {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 6;
  }
</style>
