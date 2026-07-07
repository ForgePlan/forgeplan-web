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
  import { T } from '@threlte/core';
  import { Edges } from '@threlte/extras';
  import type * as THREE from 'three';
  import type { BoxSpec } from '../lib/iso-projection';
  import { ZONE_FRAME_H } from '../lib/iso-projection';
  import { ZONE_POLYGON_OFFSET_FACTOR, ZONE_POLYGON_OFFSET_UNITS } from '../lib/iso-materials';

  let {
    box,
    color,
    fillOpacity,
    renderOrder = 0,
    onClick,
  }: {
    box: BoxSpec;
    /** Drives BOTH the matte fill and the <Edges> outline. */
    color: THREE.Color;
    fillOpacity: number;
    renderOrder?: number;
    onClick?: (box: BoxSpec) => void;
  } = $props();
</script>

<T.Mesh
  position={[box.x, ZONE_FRAME_H / 2, box.z]}
  {renderOrder}
  onclick={() => onClick?.(box)}
>
  <T.BoxGeometry args={[box.w, ZONE_FRAME_H, box.d]} />
  <T.MeshBasicMaterial
    {color}
    transparent
    opacity={fillOpacity}
    depthWrite={false}
    polygonOffset={true}
    polygonOffsetFactor={ZONE_POLYGON_OFFSET_FACTOR}
    polygonOffsetUnits={ZONE_POLYGON_OFFSET_UNITS}
  />
  <Edges {color} />
</T.Mesh>
