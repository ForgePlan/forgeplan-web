<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // ONE node: a lit MeshStandard box. Stays lit (never desaturated/faded by
  // plane depth) per Scout-1 — only zone frames + plates carry the matte
  // paper-sheet falloff.
  //
  // Stage 2: position is now RELATIVE to the parent <IsoPlane>'s own
  // <T.Group> (see IsoZoneFrame.svelte's header comment — same reason).
  //
  // Stage 3: onPointerEnter/onPointerLeave feed model/iso-view-state's
  // hover-dwell (armDwell/disarmDwell, wired by IsoPlane -> IsoScene, this
  // box stays ISP-narrow and knows nothing about dwell timing itself).
  // stopPropagation on both is load-bearing: without it, the SAME ray also
  // intersects the plate mesh sitting directly below this box, and the
  // plate would ALSO fire its own pointerenter/leave for every hover here
  // — two simultaneous, conflicting dwell targets (node AND its parent
  // plane) instead of the node one taking precedence while hovered.
  import { T } from '@threlte/core';
  import type * as THREE from 'three';
  import type { BoxSpec } from '../lib/iso-projection';
  import { NODE_BOX_H, NODE_FOOTPRINT } from '../lib/iso-projection';

  let {
    box,
    color,
    onClick,
    onPointerEnter,
    onPointerLeave,
  }: {
    box: BoxSpec;
    color: THREE.Color;
    onClick?: (box: BoxSpec) => void;
    onPointerEnter?: (box: BoxSpec) => void;
    onPointerLeave?: (box: BoxSpec) => void;
  } = $props();
</script>

<T.Mesh
  position={[box.x, NODE_BOX_H / 2, box.z]}
  onclick={() => onClick?.(box)}
  onpointerenter={(event) => {
    event.stopPropagation();
    onPointerEnter?.(box);
  }}
  onpointerleave={(event) => {
    event.stopPropagation();
    onPointerLeave?.(box);
  }}
>
  <T.BoxGeometry args={[box.w * NODE_FOOTPRINT, NODE_BOX_H, box.d * NODE_FOOTPRINT]} />
  <T.MeshStandardMaterial {color} />
</T.Mesh>
