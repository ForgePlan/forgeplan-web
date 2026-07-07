<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // The dashed corner-to-corner connector for ONE parent-box -> child-plane
  // (a truncated-pyramid / frustum wireframe). Fine-dash tuning (thinner,
  // higher dash frequency, shorter segments) lives in lib/iso-materials.ts.
  //
  // Stage 2: `presence` (0..1) fades this connector in step with the CHILD
  // plane's own enter/exit animation (IsoScene passes the child plane's
  // presence value here when this group's childDepthIndex is the current
  // deepest — 1 for every already-settled connector).
  import { T } from '@threlte/core';
  import { MeshLineGeometry, MeshLineMaterial } from '@threlte/extras';
  import type * as THREE from 'three';
  import type { PyramidGroup } from '../lib/iso-projection';
  import {
    CONNECTOR_LINE_WIDTH,
    CONNECTOR_LINE_OPACITY,
    CONNECTOR_DASH_ARRAY,
    CONNECTOR_DASH_RATIO,
    LINE_RENDER_ORDER,
  } from '../lib/iso-materials';

  let {
    group,
    color,
    presence = 1,
  }: { group: PyramidGroup; color: THREE.Color; presence?: number } = $props();
</script>

{#each group.segments as seg (seg.id)}
  <T.Mesh renderOrder={LINE_RENDER_ORDER}>
    <MeshLineGeometry points={seg.points} />
    <MeshLineMaterial
      {color}
      width={CONNECTOR_LINE_WIDTH}
      attenuate={false}
      transparent
      depthTest={false}
      opacity={CONNECTOR_LINE_OPACITY * presence}
      dashArray={CONNECTOR_DASH_ARRAY}
      dashRatio={CONNECTOR_DASH_RATIO}
    />
  </T.Mesh>
{/each}
