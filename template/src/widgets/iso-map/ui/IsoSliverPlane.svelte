<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // ACCORDION collapse — a collapsed ANCESTOR level (shallower than the
  // current depthWindow), rendered as a bare thin plate only: no zone
  // frames, no node boxes, no click handling. This is deliberate
  // decluttering (OCP: a NEW component, mounted alongside <IsoPlane> in
  // IsoScene, not a variant bolted onto it) — the collapsed history reads
  // as "there's more above" via tight sliver-stack proximity
  // (lib/iso-projection.ts#windowPlanes), not via full detail nobody asked
  // to see. Inert by design (ISP: a sliver knows nothing about controls or
  // selection) — climbing back to one of these levels goes through the
  // reused LevelBreadcrumb (+page.svelte), not by clicking the sliver
  // itself.
  import { T } from '@threlte/core';
  import type * as THREE from 'three';
  import type { WindowedPlane } from '../lib/iso-projection';

  const SLIVER_THICKNESS = 0.06;
  const SLIVER_OPACITY = 0.35;

  let { plane, color }: { plane: WindowedPlane; color: THREE.Color } = $props();
</script>

<T.Mesh position={[plane.originX, plane.y, plane.originZ]}>
  <T.BoxGeometry args={[plane.plateW, SLIVER_THICKNESS, plane.plateD]} />
  <T.MeshBasicMaterial {color} transparent opacity={SLIVER_OPACITY} />
</T.Mesh>
