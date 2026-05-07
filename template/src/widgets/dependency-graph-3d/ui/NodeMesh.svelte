<script lang="ts">
  import { T } from '@threlte/core';
  import type { Mesh } from 'three';
  import type { Color } from 'three';

  let {
    radius,
    color,
    emissive,
    emissiveIntensity,
    opacity,
    selected,
    selectedHaloColor,
    onRef,
    onPointerEnter,
    onPointerLeave,
    onClick,
  }: {
    radius: number;
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    opacity: number;
    selected: boolean;
    selectedHaloColor: Color;
    onRef: (mesh: Mesh | undefined) => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onClick: () => void;
  } = $props();

  let meshRef = $state<Mesh | undefined>(undefined);

  $effect(() => {
    onRef(meshRef);
  });
</script>

<T.Mesh
  bind:ref={meshRef}
  onpointerenter={onPointerEnter}
  onpointerleave={onPointerLeave}
  onclick={(ev: { stopPropagation?: () => void }) => {
    ev.stopPropagation?.();
    onClick();
  }}
>
  <T.SphereGeometry args={[radius, 24, 16]} />
  <T.MeshStandardMaterial
    {color}
    {emissive}
    {emissiveIntensity}
    transparent
    {opacity}
    metalness={0.15}
    roughness={0.45}
  />
  {#if selected}
    <T.Mesh>
      <T.SphereGeometry args={[radius * 1.35, 18, 12]} />
      <T.MeshBasicMaterial
        color={selectedHaloColor}
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </T.Mesh>
  {/if}
</T.Mesh>
