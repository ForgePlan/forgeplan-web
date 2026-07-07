<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // ICOM boundary arrows (FIPS Fig.6 §3.3.2.7-8 Figs.14-15) for all
  // parent-zone -> child-plane pairs. Split out of the frustum connector
  // (IsoFrustum.svelte) for SRP — a future toggle/filter on ICOM arrows can
  // be added here without touching the frustum lines (OCP).
  //
  // Stage 2: `presence` (0..1), same purpose as IsoFrustum's — IsoScene
  // mounts this component TWICE (once for already-settled pairs at
  // presence=1, once for the currently-animating deepest transition's
  // pairs) rather than adding per-pair presence plumbing here.
  import { T } from '@threlte/core';
  import { MeshLineGeometry, MeshLineMaterial } from '@threlte/extras';
  import type * as THREE from 'three';
  import type { IcomArrowGeom, IcomArrowPair } from '../lib/iso-projection';
  import {
    ICOM_ARROW_WIDTH,
    ICOM_ARROW_OPACITY,
    ICOM_ARROW_DASH_ARRAY,
    ICOM_ARROW_DASH_RATIO,
  } from '../lib/iso-materials';

  let {
    pairs,
    color,
    presence = 1,
  }: { pairs: IcomArrowPair[]; color: THREE.Color; presence?: number } = $props();

  function dashArrayFor(geom: IcomArrowGeom): number {
    return geom.provenance === 'derived' ? ICOM_ARROW_DASH_ARRAY : 0;
  }
</script>

{#each pairs as pair (pair.id)}
  <T.Mesh>
    <MeshLineGeometry points={pair.parent.points} shape="custom" shapeFunction={(p) => 1 - p} />
    <MeshLineMaterial
      {color}
      width={ICOM_ARROW_WIDTH}
      attenuate={false}
      transparent
      opacity={ICOM_ARROW_OPACITY * presence}
      dashArray={dashArrayFor(pair.parent)}
      dashRatio={ICOM_ARROW_DASH_RATIO}
    />
  </T.Mesh>
  <T.Mesh>
    <MeshLineGeometry points={pair.child.points} shape="custom" shapeFunction={(p) => 1 - p} />
    <MeshLineMaterial
      {color}
      width={ICOM_ARROW_WIDTH}
      attenuate={false}
      transparent
      opacity={ICOM_ARROW_OPACITY * presence}
      dashArray={dashArrayFor(pair.child)}
      dashRatio={ICOM_ARROW_DASH_RATIO}
    />
  </T.Mesh>
{/each}
