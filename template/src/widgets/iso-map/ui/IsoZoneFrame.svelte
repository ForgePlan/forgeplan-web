<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // ONE zone: a thin outlined FRAME (a region boundary), not a filled volume —
  // a near-invisible box (kept solid only so raycast picking still works)
  // topped with an <Edges> outline. Scout-1 matte paper-sheet pass: the fill
  // now shares the SAME `color` prop as the outline (tinted matte sheet)
  // instead of being colorless/invisible.
  //
  // Stage 2: position is now RELATIVE to the parent <IsoPlane>'s own
  // <T.Group> (which carries plane.originX/y/originZ) instead of taking
  // originX/originZ/y props and re-adding them here — this makes the
  // group's own `scale` (the enter/exit presence animation) pivot around
  // the plane's own origin, not world (0,0,0).
  //
  // Stage 3 (redesigned): onPointerEnter/onPointerLeave feed model/iso-
  // view-state's per-ELEMENT hover-dwell (armDwell/disarmDwell with
  // kind:'zone', wired by IsoPlane -> IsoScene — mirrors IsoNodeBox's own
  // wiring). `emphasized` brightens THIS zone's own fill + outline only —
  // the former whole-plane emphasis is retired (see IsoPlane.svelte).
  // stopPropagation is load-bearing for the same reason as IsoNodeBox: the
  // same ray also intersects the plate mesh directly below this frame.
  import { T } from '@threlte/core';
  import { Edges } from '@threlte/extras';
  import type * as THREE from 'three';
  import type { BoxSpec } from '../lib/iso-projection';
  import { ZONE_FRAME_H } from '../lib/iso-projection';
  import {
    ZONE_POLYGON_OFFSET_FACTOR,
    ZONE_POLYGON_OFFSET_UNITS,
    ELEMENT_EMPHASIS_FILL_MULT,
    brightenForEmphasis,
  } from '../lib/iso-materials';

  let {
    box,
    color,
    fillOpacity,
    renderOrder = 0,
    emphasized = false,
    onClick,
    onPointerEnter,
    onPointerLeave,
  }: {
    box: BoxSpec;
    /** Drives BOTH the matte fill and the <Edges> outline. */
    color: THREE.Color;
    fillOpacity: number;
    renderOrder?: number;
    emphasized?: boolean;
    onClick?: (box: BoxSpec) => void;
    onPointerEnter?: (box: BoxSpec) => void;
    onPointerLeave?: (box: BoxSpec) => void;
  } = $props();

  const edgeColor = $derived(emphasized ? brightenForEmphasis(color) : color);
  const fill = $derived(emphasized ? fillOpacity * ELEMENT_EMPHASIS_FILL_MULT : fillOpacity);
</script>

<T.Mesh
  position={[box.x, ZONE_FRAME_H / 2, box.z]}
  {renderOrder}
  onclick={() => onClick?.(box)}
  onpointerenter={(event: PointerEvent) => {
    event.stopPropagation();
    onPointerEnter?.(box);
  }}
  onpointerleave={(event: PointerEvent) => {
    event.stopPropagation();
    onPointerLeave?.(box);
  }}
>
  <T.BoxGeometry args={[box.w, ZONE_FRAME_H, box.d]} />
  <T.MeshBasicMaterial
    color={edgeColor}
    transparent
    opacity={fill}
    depthWrite={false}
    polygonOffset={true}
    polygonOffsetFactor={ZONE_POLYGON_OFFSET_FACTOR}
    polygonOffsetUnits={ZONE_POLYGON_OFFSET_UNITS}
  />
  <Edges color={edgeColor} />
</T.Mesh>
