<script lang="ts">
  import { T } from '@threlte/core';
  import {
    OrbitControls,
    interactivity,
    Edges,
    MeshLineGeometry,
    MeshLineMaterial,
  } from '@threlte/extras';
  import * as THREE from 'three';
  import { computeComposedLayout } from '@/entities/map/lib/composed-layout';
  import { deriveSubDocument } from '@/entities/map/lib/derive-subdocument';
  import type { MapDocument } from '@/entities/map';
  import { classifyIcom, icomToSide, isCanonicalRelation } from '@/shared/lib/idef0';
  import type { IcomSide } from '@/shared/lib/idef0';

  // TODO(spike): de-risking prototype only (see /iso-spike +page.svelte).
  // Hardcodes real zone ids from THIS workspace's own map ('z.ui',
  // 'z.ui.app-shell') to pick a demo descend path — proving the render
  // pipeline (real MapDocument -> computeComposedLayout -> 3D boxes -> orbit
  // + raycast pick), not a reusable generic drill-down component. A
  // production version would reuse widgets/composed-map/model/drill-state.ts
  // instead of these constants.

  interactivity();

  let {
    rootDoc,
    layerDoc,
    onDescend,
  }: {
    rootDoc: MapDocument;
    layerDoc: MapDocument | null;
    onDescend?: (id: string, label: string) => void;
  } = $props();

  const SCALE = 0.06;
  const PLANE_GAP = 16;
  const DESCEND_ROOT_ZONE = 'z.ui';
  const DESCEND_LAYER_ZONE = 'z.ui.app-shell';
  // IDEF0 read: a zone is a thin outlined FRAME (a region boundary), not a
  // filled volume — ZONE_FRAME_H is just enough height to give <Edges> a box
  // to outline. NODE_BOX_H is the readable content and stays much taller.
  const ZONE_FRAME_H = 0.5;
  const ZONE_HIT_OPACITY = 0.02;
  const NODE_BOX_H = 1.2;
  const NODE_FOOTPRINT = 0.82;
  const ICOM_ARROW_LEN = 1.4;

  interface BoxSpec {
    id: string;
    label: string;
    kind: 'zone' | 'node';
    x: number;
    z: number;
    w: number;
    d: number;
  }

  interface PlaneSpec {
    label: string;
    y: number;
    /** World (x,z) of the parent zone-box this plane funnels under — (0,0)
     * for the root plane. See the `planes` derivation below (FIX R1). */
    originX: number;
    originZ: number;
    boxes: BoxSpec[];
    plateW: number;
    plateD: number;
  }

  function boxesForDoc(doc: MapDocument): { boxes: BoxSpec[]; plateW: number; plateD: number } {
    const layout = computeComposedLayout(doc);
    const cx = layout.width / 2;
    const cz = layout.height / 2;
    const boxes: BoxSpec[] = [];
    for (const zone of doc.zones) {
      const rect = layout.zoneRects.get(zone.id);
      if (!rect) continue;
      boxes.push({
        id: zone.id,
        label: zone.label,
        kind: 'zone',
        x: (rect.x + rect.w / 2 - cx) * SCALE,
        z: (rect.y + rect.h / 2 - cz) * SCALE,
        w: Math.max(rect.w * SCALE, 1),
        d: Math.max(rect.h * SCALE, 1),
      });
    }
    for (const node of doc.nodes) {
      const pos = layout.nodePositions.get(node.id);
      if (!pos) continue;
      boxes.push({
        id: node.id,
        label: node.label,
        kind: 'node',
        x: (pos.x + doc.canvas.cell.card_w / 2 - cx) * SCALE,
        z: (pos.y + doc.canvas.cell.card_h / 2 - cz) * SCALE,
        w: doc.canvas.cell.card_w * SCALE,
        d: doc.canvas.cell.card_h * SCALE,
      });
    }
    return { boxes, plateW: Math.max(layout.width * SCALE, 1), plateD: Math.max(layout.height * SCALE, 1) };
  }

  // IDEF0 explosion (FIPS PUB 183 §3.3.1.2-3 Fig.6): each deeper plane must
  // sit UNDER the specific parent zone-box it details, not at world (0,0) —
  // otherwise every plane stacks dead-center and the scene reads as a
  // centered stack, never an explosion. `originX`/`originZ` carry the WORLD
  // position of the parent box being exploded; boxesForDoc still returns
  // LOCAL coordinates (centered on that document's own layout) — every box
  // drawn on a plane composes its local x/z with the plane's origin at
  // render time (and at connector/arrow time below).
  const planes = $derived.by((): PlaneSpec[] => {
    const list: PlaneSpec[] = [];
    const rootShape = boxesForDoc(rootDoc);
    list.push({ label: 'WHOLE SYSTEM', y: 0, originX: 0, originZ: 0, ...rootShape });

    if (layerDoc) {
      const rootZoneBox = rootShape.boxes.find(
        (b) => b.id === DESCEND_ROOT_ZONE && b.kind === 'zone',
      );
      const layerOriginX = rootZoneBox?.x ?? 0;
      const layerOriginZ = rootZoneBox?.z ?? 0;
      const layerShape = boxesForDoc(layerDoc);
      list.push({
        label: `${DESCEND_ROOT_ZONE} (emitted layer)`,
        y: -PLANE_GAP,
        originX: layerOriginX,
        originZ: layerOriginZ,
        ...layerShape,
      });

      const deriveZone = layerDoc.zones.find((z) => z.id === DESCEND_LAYER_ZONE);
      if (deriveZone) {
        const derived = deriveSubDocument(layerDoc, deriveZone.id);
        if (derived !== layerDoc) {
          const layerZoneBox = layerShape.boxes.find(
            (b) => b.id === DESCEND_LAYER_ZONE && b.kind === 'zone',
          );
          const derivedShape = boxesForDoc(derived);
          list.push({
            label: `${DESCEND_LAYER_ZONE} (derived)`,
            y: -PLANE_GAP * 2,
            originX: layerOriginX + (layerZoneBox?.x ?? 0),
            originZ: layerOriginZ + (layerZoneBox?.z ?? 0),
            ...derivedShape,
          });
        }
      }
    }
    return list;
  });

  // IDEF0 exploded pyramid: 4 lines from a parent zone's 4 top corners down
  // to the 4 corners of the child level's floor frame (a truncated-pyramid /
  // frustum wireframe), the signature "explosion" connector look. Each
  // corner is its own <MeshLineGeometry> segment (not one combined
  // THREE.LineSegments buffer) so every segment can carry
  // MeshLineMaterial's dashArray/dashRatio — FIPS Fig.6 draws correspondence
  // lines dashed, not solid. `attenuate={false}` is load-bearing: MeshLine's
  // default world-unit width attenuation is what produced huge misshapen
  // kite polygons under this scene's OrthographicCamera in an earlier pass;
  // pixel-space width (attenuate off) sidesteps that entirely.
  function rectCorners(
    cx: number,
    cz: number,
    w: number,
    d: number,
    y: number,
  ): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    const hw = w / 2;
    const hd = d / 2;
    return [
      new THREE.Vector3(cx - hw, y, cz - hd),
      new THREE.Vector3(cx + hw, y, cz - hd),
      new THREE.Vector3(cx + hw, y, cz + hd),
      new THREE.Vector3(cx - hw, y, cz + hd),
    ];
  }

  interface CornerSegment {
    id: string;
    points: [THREE.Vector3, THREE.Vector3];
  }

  interface PyramidGroup {
    id: string;
    segments: CornerSegment[];
  }

  function pyramidSegments(
    idPrefix: string,
    parent: { x: number; z: number; w: number; d: number; y: number },
    child: { x: number; z: number; plateW: number; plateD: number; y: number },
  ): CornerSegment[] {
    const parentCorners = rectCorners(parent.x, parent.z, parent.w, parent.d, parent.y);
    const childCorners = rectCorners(child.x, child.z, child.plateW, child.plateD, child.y);
    return parentCorners.map((corner, i) => ({
      id: `${idPrefix}-corner-${i}`,
      points: [corner, childCorners[i]!] as [THREE.Vector3, THREE.Vector3],
    }));
  }

  const connectorGroups = $derived.by((): PyramidGroup[] => {
    const list: PyramidGroup[] = [];
    if (planes.length < 2) return list;
    const rootPlane = planes[0]!;
    const layerPlane = planes[1]!;
    const rootZoneBox = rootPlane.boxes.find((b) => b.id === DESCEND_ROOT_ZONE && b.kind === 'zone');
    if (rootZoneBox) {
      list.push({
        id: 'root-layer',
        segments: pyramidSegments(
          'root-layer',
          {
            x: rootPlane.originX + rootZoneBox.x,
            z: rootPlane.originZ + rootZoneBox.z,
            w: rootZoneBox.w,
            d: rootZoneBox.d,
            y: rootPlane.y + ZONE_FRAME_H,
          },
          {
            x: layerPlane.originX,
            z: layerPlane.originZ,
            plateW: layerPlane.plateW,
            plateD: layerPlane.plateD,
            y: layerPlane.y,
          },
        ),
      });
    }
    if (planes.length >= 3) {
      const derivedPlane = planes[2]!;
      const layerZoneBox = layerPlane.boxes.find((b) => b.id === DESCEND_LAYER_ZONE && b.kind === 'zone');
      if (layerZoneBox) {
        list.push({
          id: 'layer-derived',
          segments: pyramidSegments(
            'layer-derived',
            {
              x: layerPlane.originX + layerZoneBox.x,
              z: layerPlane.originZ + layerZoneBox.z,
              w: layerZoneBox.w,
              d: layerZoneBox.d,
              y: layerPlane.y + ZONE_FRAME_H,
            },
            {
              x: derivedPlane.originX,
              z: derivedPlane.originZ,
              plateW: derivedPlane.plateW,
              plateD: derivedPlane.plateD,
              y: derivedPlane.y,
            },
          ),
        });
      }
    }
    return list;
  });

  // ICOM boundary arrows (FIPS Fig.6's signature feature, §3.3.2.7-8
  // Figs.14-15). For each zone being exploded, find the OWN document's edges
  // that cross the zone's node-membership boundary (one endpoint inside,
  // one outside), classify each via the real ADR-007 `classifyIcom` (never
  // reinvented here), and draw one representative arrow per ICOM side
  // (input/control/output/mechanism) — capped at one per side so a dense
  // real graph doesn't turn into visual noise (FIPS tunneling escape
  // hatch; v1 does not continue arrows into the child's own internal
  // arrows either). `decomposition` (the `refines` relation) is excluded:
  // it IS the exploded pyramid connector itself, not a boundary face —
  // counting it again as an arrow would double-represent the same edge.
  // Provenance (SPEC-004 honesty): a canonical forgeplan relation is real
  // (solid line); anything else — e.g. this workspace's own `imports`
  // code-dep edges — is classifyIcom's honest E-UNKNOWN fallback and
  // renders dashed, same as the frustum's derived/inferred convention.
  interface IcomArrowSpec {
    id: string;
    side: IcomSide;
    provenance: 'real' | 'derived';
  }

  function classifyZoneBoundaryEdges(doc: MapDocument, zoneId: string): IcomArrowSpec[] {
    const inZoneIds = new Set(doc.nodes.filter((n) => n.zone === zoneId).map((n) => n.id));
    if (inZoneIds.size === 0) return [];
    const seenSide = new Set<IcomSide>();
    const specs: IcomArrowSpec[] = [];
    for (const edge of doc.edges) {
      const fromIn = inZoneIds.has(edge.from);
      const toIn = inZoneIds.has(edge.to);
      if (fromIn === toIn) continue; // not a boundary edge — both in or both out
      const icom = classifyIcom(edge.relation);
      if (icom === 'decomposition') continue; // structural tree edge, not an ICOM face
      const side = icomToSide(icom);
      if (seenSide.has(side)) continue; // TODO(spike-icom): capped to 1 arrow/side, see comment above
      seenSide.add(side);
      specs.push({
        id: `${zoneId}-${side}`,
        side,
        provenance: isCanonicalRelation(edge.relation) ? 'real' : 'derived',
      });
    }
    return specs;
  }

  function faceAnchor(
    cx: number,
    cz: number,
    w: number,
    d: number,
    side: IcomSide,
  ): { x: number; z: number; nx: number; nz: number } {
    switch (side) {
      case 'left':
        return { x: cx - w / 2, z: cz, nx: -1, nz: 0 };
      case 'right':
        return { x: cx + w / 2, z: cz, nx: 1, nz: 0 };
      case 'top':
        return { x: cx, z: cz - d / 2, nx: 0, nz: -1 };
      case 'bottom':
      default:
        return { x: cx, z: cz + d / 2, nx: 0, nz: 1 };
    }
  }

  interface IcomArrowGeom {
    id: string;
    points: [THREE.Vector3, THREE.Vector3];
    provenance: 'real' | 'derived';
  }

  function icomArrowSegment(
    id: string,
    anchor: { x: number; z: number; nx: number; nz: number },
    y: number,
    provenance: 'real' | 'derived',
  ): IcomArrowGeom {
    const inner = new THREE.Vector3(anchor.x, y, anchor.z);
    const outer = new THREE.Vector3(
      anchor.x + anchor.nx * ICOM_ARROW_LEN,
      y,
      anchor.z + anchor.nz * ICOM_ARROW_LEN,
    );
    return { id, points: [inner, outer], provenance };
  }

  interface IcomArrowPair {
    id: string;
    parent: IcomArrowGeom;
    child: IcomArrowGeom;
  }

  const icomArrows = $derived.by((): IcomArrowPair[] => {
    const list: IcomArrowPair[] = [];
    if (planes.length < 2) return list;
    const rootPlane = planes[0]!;
    const layerPlane = planes[1]!;
    const rootZoneBox = rootPlane.boxes.find((b) => b.id === DESCEND_ROOT_ZONE && b.kind === 'zone');
    if (rootZoneBox) {
      const parentCx = rootPlane.originX + rootZoneBox.x;
      const parentCz = rootPlane.originZ + rootZoneBox.z;
      for (const spec of classifyZoneBoundaryEdges(rootDoc, DESCEND_ROOT_ZONE)) {
        const parentAnchor = faceAnchor(parentCx, parentCz, rootZoneBox.w, rootZoneBox.d, spec.side);
        const childAnchor = faceAnchor(
          layerPlane.originX,
          layerPlane.originZ,
          layerPlane.plateW,
          layerPlane.plateD,
          spec.side,
        );
        list.push({
          id: spec.id,
          parent: icomArrowSegment(`${spec.id}-parent`, parentAnchor, rootPlane.y + ZONE_FRAME_H, spec.provenance),
          child: icomArrowSegment(`${spec.id}-child`, childAnchor, layerPlane.y, spec.provenance),
        });
      }
    }

    if (layerDoc && planes.length >= 3) {
      const derivedPlane = planes[2]!;
      const layerZoneBox = layerPlane.boxes.find((b) => b.id === DESCEND_LAYER_ZONE && b.kind === 'zone');
      if (layerZoneBox) {
        const parentCx = layerPlane.originX + layerZoneBox.x;
        const parentCz = layerPlane.originZ + layerZoneBox.z;
        for (const spec of classifyZoneBoundaryEdges(layerDoc, DESCEND_LAYER_ZONE)) {
          const parentAnchor = faceAnchor(parentCx, parentCz, layerZoneBox.w, layerZoneBox.d, spec.side);
          const childAnchor = faceAnchor(
            derivedPlane.originX,
            derivedPlane.originZ,
            derivedPlane.plateW,
            derivedPlane.plateD,
            spec.side,
          );
          list.push({
            id: `layer-${spec.id}`,
            parent: icomArrowSegment(
              `layer-${spec.id}-parent`,
              parentAnchor,
              layerPlane.y + ZONE_FRAME_H,
              spec.provenance,
            ),
            child: icomArrowSegment(`layer-${spec.id}-child`, childAnchor, derivedPlane.y, spec.provenance),
          });
        }
      }
    }
    return list;
  });

  function readCssColor(varName: string, fallback: string): THREE.Color {
    // TODO(spike): read once at mount, not reactive to a live theme toggle —
    // fine for a de-risking spike proving tokens CAN drive three.js colors.
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return new THREE.Color(val || fallback);
  }

  const accentColor = readCssColor('--accent', '#ff5a1f');
  const plateColor = readCssColor('--bg-2', '#141414');
  const nodeColor = readCssColor('--fg-2', '#a3a3a3');
  const lineColor = readCssColor('--accent-soft', '#ff8a5b');

  let selectedId = $state<string | null>(null);

  function handleClick(box: BoxSpec): void {
    selectedId = box.id;
    console.log('[iso-spike] descended into', box.kind, box.id, box.label);
    onDescend?.(box.id, box.label);
  }
</script>

<T.OrthographicCamera
  makeDefault
  position={[46, 42, 46]}
  zoom={7}
  near={0.1}
  far={500}
  oncreate={(ref) => ref.lookAt(0, -PLANE_GAP, 0)}
>
  <OrbitControls enableDamping target={[0, -PLANE_GAP, 0]} />
</T.OrthographicCamera>

<T.AmbientLight intensity={0.7} />
<T.DirectionalLight position={[20, 30, 15]} intensity={0.9} />

{#each planes as plane (plane.label)}
  <T.Mesh position={[plane.originX, plane.y - 0.6, plane.originZ]}>
    <T.BoxGeometry args={[plane.plateW, 0.4, plane.plateD]} />
    <T.MeshStandardMaterial color={plateColor} transparent opacity={0.35} />
  </T.Mesh>

  <!-- TODO(spike): level label skipped — @threlte/extras <Text> (troika-three-text)
       fetches a default font at runtime; not worth the network-availability
       risk in a throwaway route. plane.label is still read by the HUD text
       overlay in +page.svelte instead. -->

  {#each plane.boxes as box (box.id)}
    {#if box.kind === 'zone'}
      <!-- Zone = a thin outlined FRAME, not a filled slab: a near-invisible
           box (kept solid only so raycast picking still works) with an
           <Edges> outline as the only visible part. Frames the nodes; never
           covers them. -->
      <T.Mesh
        position={[plane.originX + box.x, plane.y + ZONE_FRAME_H / 2, plane.originZ + box.z]}
        onclick={() => handleClick(box)}
      >
        <T.BoxGeometry args={[box.w, ZONE_FRAME_H, box.d]} />
        <T.MeshBasicMaterial transparent opacity={ZONE_HIT_OPACITY} depthWrite={false} />
        <Edges color={selectedId === box.id ? lineColor : accentColor} />
      </T.Mesh>
    {:else}
      <T.Mesh
        position={[plane.originX + box.x, plane.y + NODE_BOX_H / 2, plane.originZ + box.z]}
        onclick={() => handleClick(box)}
      >
        <T.BoxGeometry args={[box.w * NODE_FOOTPRINT, NODE_BOX_H, box.d * NODE_FOOTPRINT]} />
        <T.MeshStandardMaterial color={selectedId === box.id ? accentColor : nodeColor} />
      </T.Mesh>
    {/if}
  {/each}
{/each}

{#each connectorGroups as group (group.id)}
  {#each group.segments as seg (seg.id)}
    <T.Mesh>
      <MeshLineGeometry points={seg.points} />
      <MeshLineMaterial
        color={lineColor}
        width={1.4}
        attenuate={false}
        transparent
        opacity={0.85}
        dashArray={0.16}
        dashRatio={0.55}
      />
    </T.Mesh>
  {/each}
{/each}

{#each icomArrows as pair (pair.id)}
  <T.Mesh>
    <MeshLineGeometry points={pair.parent.points} shape="custom" shapeFunction={(p) => 1 - p} />
    <MeshLineMaterial
      color={accentColor}
      width={2.4}
      attenuate={false}
      transparent
      opacity={0.95}
      dashArray={pair.parent.provenance === 'derived' ? 0.32 : 0}
      dashRatio={0.5}
    />
  </T.Mesh>
  <T.Mesh>
    <MeshLineGeometry points={pair.child.points} shape="custom" shapeFunction={(p) => 1 - p} />
    <MeshLineMaterial
      color={accentColor}
      width={2.4}
      attenuate={false}
      transparent
      opacity={0.95}
      dashArray={pair.child.provenance === 'derived' ? 0.32 : 0}
      dashRatio={0.5}
    />
  </T.Mesh>
{/each}
