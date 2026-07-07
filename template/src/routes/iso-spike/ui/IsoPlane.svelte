<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // ONE level/sheet: the matte floor plate + its zone frames + node boxes.
  // Owns per-box color resolution (selected vs default) so IsoZoneFrame /
  // IsoNodeBox stay dumb/presentational (ISP) — they take final colors, not
  // selection state.
  //
  // Stage 2: wraps its content in a <T.Group> positioned at the plane's own
  // world origin (originX/y/originZ) and scaled by `presence` (0 -> 1 on
  // descend-in, 1 -> 0 on ascend/collapse-out, driven by
  // model/iso-view-state.svelte.ts — this component only reads the number,
  // it owns no Tween of its own). Children (IsoZoneFrame/IsoNodeBox) now
  // position themselves RELATIVE to this group, so scaling pivots around
  // the plane's own origin instead of world (0,0,0). `interactive` gates
  // whether boxes on this plane receive the click handler at all — the
  // unified layer-explosion model (model/iso-view-state.svelte.ts#focusZone)
  // makes every EXPANDED plane interactive (a click on any visible zone/
  // mega, not just the deepest, re-focuses the explosion or collapses it);
  // only collapsed sliver planes (rendered by IsoSliverPlane instead, never
  // this component) stay inert. The prop itself is kept as an extension
  // point, not removed.
  //
  // Stage 3 (redesigned): the plate itself no longer emphasizes as a
  // WHOLE on hover — MINIMAP reframe retired the whole-plate boost
  // (PLATE_EMPHASIS_OPACITY_MULT + bright plate <Edges>) in favor of
  // highlighting only the individual zone/node under the cursor (see
  // IsoZoneFrame.svelte / IsoNodeBox.svelte). `dwellTarget` is threaded
  // through as a plain typed VALUE (type-only import — same pattern
  // IsoA11yProxy.svelte already uses) purely so each box below can check
  // "is it ME"; this component still never CALLS the model (no armDwell/
  // disarmDwell here — ISP holds).
  // onPlanePointerEnter/Leave fire from the plate mesh itself (stopping
  // propagation so a lower-stacked plane along the same ray doesn't also
  // register as hovered) — kept for the optional plane-level info card
  // (+page.svelte, gated behind `showInfoCards`); onNodePointerEnter/Leave
  // and onZonePointerEnter/Leave are forwarded straight through to each
  // IsoNodeBox/IsoZoneFrame (ISP — this component doesn't know what a
  // "dwell" is, it just relays box-level pointer events up).
  import { T } from '@threlte/core';
  import type { BoxSpec, PlaneSpec } from '../lib/iso-projection';
  import type { IsoDwellTarget } from '../model/iso-view-state.svelte';
  import {
    type IsoColorTokens,
    PLATE_THICKNESS,
    PLATE_Y_OFFSET,
    PLATE_OPACITY,
    ZONE_FILL_OPACITY,
    planeFalloff,
    desaturateForDepth,
  } from '../lib/iso-materials';
  import IsoZoneFrame from './IsoZoneFrame.svelte';
  import IsoNodeBox from './IsoNodeBox.svelte';

  let {
    plane,
    planeIndex,
    selectedId,
    colors,
    presence = 1,
    interactive = true,
    dwellTarget = null,
    onBoxClick,
    onPlanePointerEnter,
    onPlanePointerLeave,
    onNodePointerEnter,
    onNodePointerLeave,
    onZonePointerEnter,
    onZonePointerLeave,
  }: {
    plane: PlaneSpec;
    planeIndex: number;
    selectedId: string | null;
    colors: IsoColorTokens;
    presence?: number;
    interactive?: boolean;
    dwellTarget?: IsoDwellTarget | null;
    onBoxClick?: (box: BoxSpec) => void;
    onPlanePointerEnter?: () => void;
    onPlanePointerLeave?: () => void;
    onNodePointerEnter?: (box: BoxSpec) => void;
    onNodePointerLeave?: (box: BoxSpec) => void;
    onZonePointerEnter?: (box: BoxSpec) => void;
    onZonePointerLeave?: (box: BoxSpec) => void;
  } = $props();

  const falloff = $derived(planeFalloff(planeIndex));
  const plateColor = $derived(desaturateForDepth(colors.plate, planeIndex));
  const plateOpacity = $derived(PLATE_OPACITY * falloff);
  const clickHandler = $derived(interactive ? onBoxClick : undefined);

  function isEmphasized(box: BoxSpec): boolean {
    if (!dwellTarget || dwellTarget.kind === 'plane') return false;
    return dwellTarget.kind === box.kind && dwellTarget.id === box.id;
  }
</script>

<T.Group position={[plane.originX, plane.y, plane.originZ]} scale={presence}>
  <T.Mesh
    position={[0, -PLATE_Y_OFFSET, 0]}
    renderOrder={planeIndex}
    onpointerenter={(event: PointerEvent) => {
      event.stopPropagation();
      onPlanePointerEnter?.();
    }}
    onpointerleave={(event: PointerEvent) => {
      event.stopPropagation();
      onPlanePointerLeave?.();
    }}
  >
    <T.BoxGeometry args={[plane.plateW, PLATE_THICKNESS, plane.plateD]} />
    <T.MeshStandardMaterial color={plateColor} transparent opacity={plateOpacity} />
  </T.Mesh>

  <!-- TODO(spike): level label skipped — @threlte/extras <Text> (troika-three-text)
       fetches a default font at runtime; not worth the network-availability
       risk in a throwaway route. plane.label is still read by the HUD text
       overlay in +page.svelte instead. -->

  {#each plane.boxes as box (box.id)}
    {#if box.kind === 'zone'}
      <IsoZoneFrame
        {box}
        renderOrder={planeIndex}
        color={desaturateForDepth(selectedId === box.id ? colors.accentSoft : colors.accent, planeIndex)}
        fillOpacity={ZONE_FILL_OPACITY * falloff}
        emphasized={isEmphasized(box)}
        onClick={clickHandler}
        onPointerEnter={onZonePointerEnter}
        onPointerLeave={onZonePointerLeave}
      />
    {:else}
      <IsoNodeBox
        {box}
        color={selectedId === box.id ? colors.accent : colors.node}
        emphasized={isEmphasized(box)}
        onClick={clickHandler}
        onPointerEnter={onNodePointerEnter}
        onPointerLeave={onNodePointerLeave}
      />
    {/if}
  {/each}
</T.Group>
