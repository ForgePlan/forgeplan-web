<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import {
    BufferAttribute,
    BufferGeometry,
    Color,
    LineBasicMaterial,
    LineSegments,
    type Mesh,
    type PerspectiveCamera as PerspectiveCameraType,
  } from 'three';
  import { onMount, untrack } from 'svelte';
  import type { ArtifactSummary } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import type { ScoreEntry } from '@/entities/score';
  import { buildSimulation } from '../lib/sim-3d';
  import {
    nodeColor,
    nodeRadius,
    readTheme3D,
    statusGlow,
    type Theme3DPalette,
  } from '../lib/theme-3d';
  import type { Sim3DLink, Sim3DNode } from '../model/types';
  import NodeMesh from './NodeMesh.svelte';

  let {
    nodes,
    edges,
    scores,
    selectedId,
    onSelect,
  }: {
    nodes: ArtifactSummary[];
    edges: GraphEdge[];
    scores: ScoreEntry[];
    selectedId: string | null;
    onSelect?: (detail: { id: string }) => void;
  } = $props();

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const { invalidate } = useThrelte();

  let palette = $state<Theme3DPalette>(readTheme3D());

  onMount(() => {
    palette = readTheme3D();
    const obs = new MutationObserver(() => {
      palette = readTheme3D();
      invalidate();
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  });

  const scoreById = $derived.by(() => {
    const m = new Map<string, number>();
    for (const s of scores) m.set(s.id, s.r_eff ?? 0);
    return m;
  });

  const simNodes = $derived.by<Sim3DNode[]>(() => {
    void scoreById;
    const total = nodes.length;
    return nodes.map((n, idx) => {
      const phi = Math.acos(1 - (2 * (idx + 0.5)) / Math.max(1, total));
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
      const radius = 50;
      return {
        id: n.id,
        kind: n.kind,
        status: n.status,
        title: n.title ?? n.id,
        r_eff: scoreById.get(n.id) ?? 0,
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi),
      };
    });
  });

  const simLinks = $derived.by<Sim3DLink[]>(() => {
    const ids = new Set(simNodes.map((n) => n.id));
    return edges
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({
        source: e.from,
        target: e.to,
        relation: e.relation,
      }));
  });

  let nodeRefs: Array<Mesh | undefined> = $state([]);
  let nodeFlags: Array<{ hovered: boolean; selected: boolean }> = $state([]);

  let edgeGeometry = new BufferGeometry();
  let edgePositions: Float32Array | null = null;

  let hoveredId = $state<string | null>(null);
  const neighbours = $derived.by(() => {
    if (!hoveredId) return null;
    const set = new Set<string>([hoveredId]);
    for (const e of edges) {
      if (e.from === hoveredId) set.add(e.to);
      else if (e.to === hoveredId) set.add(e.from);
    }
    return set;
  });

  $effect(() => {
    void simNodes.length;
    nodeRefs = new Array(simNodes.length).fill(undefined);
    nodeFlags = simNodes.map(() => ({ hovered: false, selected: false }));
  });

  $effect(() => {
    void simNodes.length;
    void simLinks.length;
    if (edgePositions == null || edgePositions.length !== simLinks.length * 6) {
      edgePositions = new Float32Array(simLinks.length * 6);
      edgeGeometry.setAttribute(
        'position',
        new BufferAttribute(edgePositions, 3),
      );
    }
  });

  let sim = $derived.by(() => {
    void simNodes;
    void simLinks;
    return untrack(() =>
      buildSimulation(simNodes, simLinks, { reducedMotion }),
    );
  });

  $effect(() => {
    void sim;
    return () => {
      sim?.stop();
    };
  });

  useTask(() => {
    if (!sim) return;
    if (sim.alpha() > 0.005) {
      sim.tick(1);
      invalidate();
    }
    for (let i = 0; i < simNodes.length; i++) {
      const ref = nodeRefs[i];
      const n = simNodes[i];
      if (ref && n) ref.position.set(n.x, n.y, n.z);
    }
    if (edgePositions) {
      const nodeMap = new Map<string, Sim3DNode>();
      for (const n of simNodes) nodeMap.set(n.id, n);
      for (let i = 0; i < simLinks.length; i++) {
        const link = simLinks[i];
        if (!link) continue;
        const sId = typeof link.source === 'string' ? link.source : link.source.id;
        const tId = typeof link.target === 'string' ? link.target : link.target.id;
        const s = nodeMap.get(sId);
        const t = nodeMap.get(tId);
        const off = i * 6;
        edgePositions[off + 0] = s?.x ?? 0;
        edgePositions[off + 1] = s?.y ?? 0;
        edgePositions[off + 2] = s?.z ?? 0;
        edgePositions[off + 3] = t?.x ?? 0;
        edgePositions[off + 4] = t?.y ?? 0;
        edgePositions[off + 5] = t?.z ?? 0;
      }
      const attr = edgeGeometry.getAttribute('position') as BufferAttribute;
      attr.needsUpdate = true;
    }
  });

  function handlePointerOver(id: string) {
    hoveredId = id;
    invalidate();
  }
  function handlePointerOut() {
    hoveredId = null;
    invalidate();
  }
  function handleClick(id: string) {
    onSelect?.({ id });
  }

  function dimFor(id: string): number {
    if (!neighbours) return 1;
    return neighbours.has(id) ? 1 : 0.18;
  }
  function emissiveFor(id: string, status: string): number {
    if (id === selectedId) return 0.9;
    if (hoveredId === id) return 0.7;
    if (neighbours && neighbours.has(id)) return 0.45;
    if (status.toLowerCase() === 'active') return 0.25;
    return 0.08;
  }

  const edgeMaterial = new LineBasicMaterial({
    color: new Color(0xffffff),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  $effect(() => {
    edgeMaterial.color.copy(palette.line);
    edgeMaterial.opacity = hoveredId ? 0.08 : 0.18;
  });

  const segments = new LineSegments(edgeGeometry, edgeMaterial);
</script>

<T.PerspectiveCamera
  makeDefault
  position={[110, 70, 110]}
  fov={60}
  near={0.5}
  far={2000}
>
  <OrbitControls
    enableDamping
    dampingFactor={0.08}
    minDistance={10}
    maxDistance={400}
    rotateSpeed={0.65}
    zoomSpeed={0.9}
  />
</T.PerspectiveCamera>

<T.AmbientLight intensity={0.55} />
<T.DirectionalLight position={[60, 80, 40]} intensity={1.1} />
<T.DirectionalLight position={[-50, -30, -60]} intensity={0.45} />

<T is={segments} />

{#each simNodes as node, i (node.id)}
  <NodeMesh
    radius={nodeRadius(node.r_eff)}
    color={nodeColor(palette, node.kind)}
    emissive={statusGlow(palette, node.status)}
    emissiveIntensity={emissiveFor(node.id, node.status)}
    opacity={dimFor(node.id)}
    selected={node.id === selectedId}
    selectedHaloColor={palette.accent}
    onRef={(mesh) => {
      nodeRefs[i] = mesh;
    }}
    onPointerEnter={() => handlePointerOver(node.id)}
    onPointerLeave={handlePointerOut}
    onClick={() => handleClick(node.id)}
  />
{/each}
