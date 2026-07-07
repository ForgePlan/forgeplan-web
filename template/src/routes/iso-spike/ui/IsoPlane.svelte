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
  // whether boxes on this plane receive the click handler at all — only
  // the current deepest plane may be drilled into further (Stage-2 CLICK
  // GATE); ancestor/context planes in the depthWindow render but are inert.
  //
  // Stage 3: `emphasized` (whether THIS plane is the current hover-dwell
  // target) boosts the plate's own fill opacity and gates a bright <Edges>
  // outline — independent of `interactive`/`selectedId`, since hovering a
  // sheet for its info card is a read-only affordance available on every
  // rendered expanded plane, not just the deepest/drillable one.
  // onPlanePointerEnter/Leave fire from the plate mesh itself (stopping
  // propagation so a lower-stacked plane along the same ray doesn't also
  // register as hovered); onNodePointerEnter/Leave are forwarded straight
  // through to each IsoNodeBox (ISP — this component doesn't know what a
  // "dwell" is, it just relays box-level pointer events up).
  import { T } from '@threlte/core';
  import { Edges } from '@threlte/extras';
  import type { BoxSpec, PlaneSpec } from '../lib/iso-projection';
  import {
    type IsoColorTokens,
    PLATE_THICKNESS,
    PLATE_Y_OFFSET,
    PLATE_OPACITY,
    PLATE_EMPHASIS_OPACITY_MULT,
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
    emphasized = false,
    onBoxClick,
    onPlanePointerEnter,
    onPlanePointerLeave,
    onNodePointerEnter,
    onNodePointerLeave,
  }: {
    plane: PlaneSpec;
    planeIndex: number;
    selectedId: string | null;
    colors: IsoColorTokens;
    presence?: number;
    interactive?: boolean;
    emphasized?: boolean;
    onBoxClick?: (box: BoxSpec) => void;
    onPlanePointerEnter?: () => void;
    onPlanePointerLeave?: () => void;
    onNodePointerEnter?: (box: BoxSpec) => void;
    onNodePointerLeave?: (box: BoxSpec) => void;
  } = $props();

  const falloff = $derived(planeFalloff(planeIndex));
  const plateColor = $derived(desaturateForDepth(colors.plate, planeIndex));
  const plateOpacity = $derived(
    PLATE_OPACITY * falloff * (emphasized ? PLATE_EMPHASIS_OPACITY_MULT : 1),
  );
  const clickHandler = $derived(interactive ? onBoxClick : undefined);
</script>

<T.Group position={[plane.originX, plane.y, plane.originZ]} scale={presence}>
  <T.Mesh
    position={[0, -PLATE_Y_OFFSET, 0]}
    renderOrder={planeIndex}
    onpointerenter={(event) => {
      event.stopPropagation();
      onPlanePointerEnter?.();
    }}
    onpointerleave={(event) => {
      event.stopPropagation();
      onPlanePointerLeave?.();
    }}
  >
    <T.BoxGeometry args={[plane.plateW, PLATE_THICKNESS, plane.plateD]} />
    <T.MeshStandardMaterial color={plateColor} transparent opacity={plateOpacity} />
    {#if emphasized}
      <Edges color={colors.accent} />
    {/if}
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
        onClick={clickHandler}
      />
    {:else}
      <IsoNodeBox
        {box}
        color={selectedId === box.id ? colors.accent : colors.node}
        onClick={clickHandler}
        onPointerEnter={onNodePointerEnter}
        onPointerLeave={onNodePointerLeave}
      />
    {/if}
  {/each}
</T.Group>
