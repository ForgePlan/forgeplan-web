<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // Subtle "...deeper" affordance: 4 dashed lines converging from the
  // deepest EXPANDED plane's plate corners down to a point below it —
  // a collapsing-pyramid stub hinting that this level has further
  // drillable content not yet rendered (depthWindow only shows what's been
  // descended into, not a preview of what's below). Mounted independently
  // in IsoScene (OCP) whenever the deepest doc has any drillable zone/mega;
  // reuses the same dashed MeshLine convention as IsoFrustum/IsoIcomArrows
  // (dashed = inferred/not-yet-real, same visual language).
  import { T } from '@threlte/core';
  import { MeshLineGeometry, MeshLineMaterial } from '@threlte/extras';
  import * as THREE from 'three';
  import { CONNECTOR_DASH_ARRAY, CONNECTOR_DASH_RATIO } from '../lib/iso-materials';

  const DROP = 2.2;
  const LINE_WIDTH = 0.6;
  const OPACITY = 0.5;

  let {
    x,
    y,
    z,
    w,
    d,
    color,
  }: { x: number; y: number; z: number; w: number; d: number; color: THREE.Color } = $props();

  const apex = $derived(new THREE.Vector3(x, y - DROP, z));
  const corners = $derived(
    [
      [x - w / 2, y, z - d / 2],
      [x + w / 2, y, z - d / 2],
      [x + w / 2, y, z + d / 2],
      [x - w / 2, y, z + d / 2],
    ] as const,
  );
</script>

{#each corners as corner, i (i)}
  <T.Mesh>
    <MeshLineGeometry points={[new THREE.Vector3(...corner), apex]} />
    <MeshLineMaterial
      {color}
      width={LINE_WIDTH}
      attenuate={false}
      transparent
      opacity={OPACITY}
      dashArray={CONNECTOR_DASH_ARRAY}
      dashRatio={CONNECTOR_DASH_RATIO}
    />
  </T.Mesh>
{/each}
