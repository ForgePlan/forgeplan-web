<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls, interactivity } from '@threlte/extras';
  import type { MapDocument } from '@/entities/map';
  import { isDrillable } from '@/entities/map/lib/derive-subdocument';
  import { themeStore } from '@/shared/lib';
  import IsoPlane from './ui/IsoPlane.svelte';
  import IsoSliverPlane from './ui/IsoSliverPlane.svelte';
  import IsoFrustum from './ui/IsoFrustum.svelte';
  import IsoIcomArrows from './ui/IsoIcomArrows.svelte';
  import IsoDeeperMarker from './ui/IsoDeeperMarker.svelte';
  import {
    PLANE_GAP,
    computePlanesForDocs,
    windowPlanes,
    computeConnectorGroups,
    computeIcomArrows,
    type BoxSpec,
  } from './lib/iso-projection';
  import { readIsoColors } from './lib/iso-materials';
  import {
    docsForRoot,
    currentFocusChain,
    currentDepthWindow,
    currentDepthWindowAnimIndex,
    currentAnimationKind,
    currentEnterProgress,
    currentExitProgress,
    currentFocused,
    setFocused,
    descend,
    currentDwellTarget,
    armDwell,
    disarmDwell,
  } from './model/iso-view-state.svelte';

  // TODO(spike): de-risking prototype for a future 3D isometric layered map
  // view (IDEF0 exploded pyramid). Throwaway route, not linked from any nav —
  // proves Threlte renders our real composed-map data as an orbit-able,
  // click-to-descend 3D stack. Not the production composed-map (untouched).
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // COMPOSITION ROOT (3D-only): camera + lights + interactivity() live
  // here; all geometry math is in lib/iso-projection.ts, all material/
  // color tuning is in lib/iso-materials.ts, all interaction/animation
  // STATE is in model/iso-view-state.svelte.ts (DIP — this component
  // consumes that pure model + the rootDoc prop injected from +page.svelte;
  // it never fetches data itself), and every visible thing is a mounted
  // <IsoPlane> / <IsoSliverPlane> / <IsoFrustum> / <IsoIcomArrows> /
  // <IsoDeeperMarker> — no inline geometry, no inline THREE material tuning
  // (SRP/OCP).

  interactivity();

  let {
    rootDoc,
    onDescend,
  }: {
    rootDoc: MapDocument;
    onDescend?: (id: string, label: string) => void;
  } = $props();

  // Stage 2 — generalized, arbitrary-depth chain (replaces Stage 1's
  // hardcoded root/layer/derived triple). `docsByDepth` folds
  // deriveSubDocument (or a cached emitted layer) over the ENTIRE current
  // focus chain; `rawPlanes` turns that into world-positioned layout data;
  // `windowedPlanes` applies the depthWindow accordion (expanded vs. thin
  // collapsed sliver) on top.
  const docsByDepth = $derived(docsForRoot(rootDoc));
  const focusChain = $derived(currentFocusChain());
  const rawPlanes = $derived(computePlanesForDocs(docsByDepth, focusChain));
  const windowedPlanes = $derived(windowPlanes(rawPlanes, currentDepthWindow()));
  const deepestDepthIndex = $derived(docsByDepth.length - 1);

  // The absolute depthIndex currently being animated — either a
  // depthWindow-triggered reveal/collapse (setDepthWindow), or, when none
  // is in flight, the chain's own deepest index (a descend()/ascend()
  // drill). Both animation sources share the SAME enter/exit tween pair
  // (model/iso-view-state.svelte.ts), so exactly one of them is ever
  // "the" animating index at a time.
  const animIndex = $derived(currentDepthWindowAnimIndex() ?? deepestDepthIndex);

  const connectorGroups = $derived(computeConnectorGroups(windowedPlanes));
  const icomArrowPairs = $derived(computeIcomArrows(windowedPlanes, docsByDepth));
  const settledArrowPairs = $derived(
    icomArrowPairs.filter((p) => p.childDepthIndex !== animIndex),
  );
  const newestArrowPairs = $derived(
    icomArrowPairs.filter((p) => p.childDepthIndex === animIndex),
  );

  // The single value driving the CURRENTLY animating plane's grow-in
  // (descend / depthWindow reveal) / collapse-out (ascend / depthWindow
  // shrink) animation — every other, already-settled plane/connector/arrow
  // renders at presence 1 (see model/iso-view-state.svelte.ts#
  // collapseThenApply for why the underlying state itself only mutates
  // AFTER this settles on collapse).
  const animPresence = $derived.by(() => {
    const kind = currentAnimationKind();
    if (kind === 'enter') return currentEnterProgress();
    if (kind === 'exit') return currentExitProgress();
    return 1;
  });

  function presenceFor(depthIndex: number): number {
    return depthIndex === animIndex ? animPresence : 1;
  }

  // "...deeper" affordance — the deepest doc still has drillable content
  // the user hasn't descended into yet (depthWindow only renders what's
  // ALREADY been drilled into, never a preview of what's below it).
  const deepestDoc = $derived(docsByDepth[docsByDepth.length - 1] ?? null);
  const hasDeeper = $derived.by(() => {
    if (!deepestDoc) return false;
    for (const zone of deepestDoc.zones) {
      if (isDrillable(deepestDoc, zone.id)) return true;
    }
    for (const node of deepestDoc.nodes) {
      if (node.is_mega && isDrillable(deepestDoc, node.id)) return true;
    }
    return false;
  });
  const deepestPlane = $derived(windowedPlanes[windowedPlanes.length - 1] ?? null);

  // Theme-reactive colors: `themeStore.tick` is read so this recomputes on
  // every theme toggle instead of freezing the palette at first paint.
  const colors = $derived.by(() => {
    themeStore.tick;
    return readIsoColors();
  });

  $effect(() => {
    themeStore.start();
    return () => themeStore.stop();
  });

  const selectedId = $derived(currentFocused()?.id ?? null);

  // Stage 3 — the current hover-dwell target (zone, node, OR plane), read
  // once here and threaded down as a plain typed VALUE so every rendered
  // <IsoPlane> below can cheaply check "is it ME" per-box without each
  // plane re-deriving dwell state itself (ISP: IsoPlane never calls the
  // model, it only compares the value it was handed).
  const dwellTarget = $derived(currentDwellTarget());

  // CLICK GATE (Stage-2 FR-1) — a drillable zone/mega descends one level;
  // a leaf node only selects (setFocused above already ran either way).
  // No double-click: a single `onclick` is all either path needs.
  function handleBoxClick(box: BoxSpec): void {
    setFocused({ kind: box.kind, id: box.id });
    const didDescend = descend(rootDoc, box.id);
    if (didDescend) onDescend?.(box.id, box.label);
  }
</script>

<T.OrthographicCamera
  makeDefault
  position={[46, 42, 46]}
  zoom={7}
  near={0.1}
  far={500}
  oncreate={(ref) => ref.lookAt(0, -PLANE_GAP, 0)}
>
  <OrbitControls enableDamping target={[0, -PLANE_GAP, 0]} />
</T.OrthographicCamera>

<T.AmbientLight intensity={0.7} />
<T.DirectionalLight position={[20, 30, 15]} intensity={0.9} />

{#each windowedPlanes as plane (plane.id)}
  {#if plane.mode === 'expanded'}
    <IsoPlane
      {plane}
      planeIndex={plane.depthIndex}
      {selectedId}
      {colors}
      presence={presenceFor(plane.depthIndex)}
      interactive={plane.depthIndex === deepestDepthIndex}
      {dwellTarget}
      onBoxClick={handleBoxClick}
      onPlanePointerEnter={() =>
        armDwell({ kind: 'plane', planeId: plane.id, depthIndex: plane.depthIndex })}
      onPlanePointerLeave={() =>
        disarmDwell({ kind: 'plane', planeId: plane.id, depthIndex: plane.depthIndex })}
      onNodePointerEnter={(box) => armDwell({ kind: 'node', id: box.id })}
      onNodePointerLeave={(box) => disarmDwell({ kind: 'node', id: box.id })}
      onZonePointerEnter={(box) => armDwell({ kind: 'zone', id: box.id })}
      onZonePointerLeave={(box) => disarmDwell({ kind: 'zone', id: box.id })}
    />
  {:else}
    <IsoSliverPlane {plane} color={colors.plate} />
  {/if}
{/each}

{#each connectorGroups as group (group.id)}
  <IsoFrustum {group} color={colors.accentSoft} presence={presenceFor(group.childDepthIndex)} />
{/each}

<IsoIcomArrows pairs={settledArrowPairs} color={colors.accent} />
<IsoIcomArrows pairs={newestArrowPairs} color={colors.accent} presence={animPresence} />

{#if hasDeeper && deepestPlane}
  <IsoDeeperMarker
    x={deepestPlane.originX}
    y={deepestPlane.y}
    z={deepestPlane.originZ}
    w={deepestPlane.plateW * 0.3}
    d={deepestPlane.plateD * 0.3}
    color={colors.accentSoft}
  />
{/if}
