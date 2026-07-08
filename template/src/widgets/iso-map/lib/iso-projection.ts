// Pure geometry/projection helpers for the iso-spike 3D layered map. No
// Svelte, no THREE materials — only math + plain data (THREE.Vector3 is a
// math primitive, not a material). Stage 2 (RFC-031-style generalization):
// every function here now operates over an ARBITRARY-length chain of
// already-resolved MapDocuments (one per altitude) instead of Stage 1's
// hardcoded root/layer/derived triple — drill-derivation itself
// (deriveSubDocument / emitted-layer preference) lives entirely in
// model/iso-view-state.svelte.ts's `docsForRoot`; this file only turns a
// resolved `MapDocument[]` + its focus-id chain into 3D layout data.
import * as THREE from "three";
import { computeComposedLayout } from "@/entities/map/lib/composed-layout";
import type { MapDocument } from "@/entities/map";
import {
  classifyIcom,
  icomToSide,
  isCanonicalRelation,
} from "@/shared/lib/idef0";
import type { IcomSide } from "@/shared/lib/idef0";

export const SCALE = 0.06;
export const PLANE_GAP = 26;
// IDEF0 read: a zone is a thin outlined FRAME (a region boundary), not a
// filled volume — ZONE_FRAME_H is just enough height to give <Edges> a box
// to outline. NODE_BOX_H is the readable content and stays much taller.
export const ZONE_FRAME_H = 0.5;
export const NODE_BOX_H = 1.2;
export const NODE_FOOTPRINT = 0.82;
export const ICOM_ARROW_LEN = 1.4;

// Stage 2 — accordion collapse: how tightly collapsed ancestor "sliver"
// planes stack above the expanded window (much smaller than PLANE_GAP, so
// a long drill history still compresses into a small visual footprint
// "near the focus" instead of receding to infinity).
export const SLIVER_GAP = 1.6;

export interface BoxSpec {
  id: string;
  label: string;
  kind: "zone" | "node";
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface PlaneSpec {
  /** Stable identity across renders (keyed {#each}) — "root", or the
   * dot-free join of the focus chain up to and including this depth. */
  id: string;
  /** The focusId that produced this plane (the zone/mega clicked into the
   * PARENT plane to reveal this one). null for the root plane. */
  focusId: string | null;
  label: string;
  y: number;
  /** World (x,z) of the parent zone-box this plane funnels under — (0,0)
   * for the root plane. See `computePlanesForDocs` below (FIX R1). */
  originX: number;
  originZ: number;
  boxes: BoxSpec[];
  plateW: number;
  plateD: number;
}

export interface WindowedPlane extends PlaneSpec {
  /** "expanded" = fully rendered (plate + boxes, clickable if deepest);
   * "sliver" = collapsed ancestor, rendered as a thin bare plate only. */
  mode: "expanded" | "sliver";
  /** Absolute index into the full (unwindowed) docsByDepth/planes chain —
   * 0 is always the root, regardless of how the window is currently sized. */
  depthIndex: number;
}

export function boxesForDoc(doc: MapDocument): {
  boxes: BoxSpec[];
  plateW: number;
  plateD: number;
} {
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
      kind: "zone",
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
      kind: "node",
      x: (pos.x + doc.canvas.cell.card_w / 2 - cx) * SCALE,
      z: (pos.y + doc.canvas.cell.card_h / 2 - cz) * SCALE,
      w: doc.canvas.cell.card_w * SCALE,
      d: doc.canvas.cell.card_h * SCALE,
    });
  }
  return {
    boxes,
    plateW: Math.max(layout.width * SCALE, 1),
    plateD: Math.max(layout.height * SCALE, 1),
  };
}

// IDEF0 explosion (FIPS PUB 183 §3.3.1.2-3 Fig.6): each deeper plane must
// sit UNDER the specific parent zone-box it details, not at world (0,0) —
// otherwise every plane stacks dead-center and the scene reads as a
// centered stack, never an explosion. Generalized (Stage 2) to fold over
// however many `docs` the drill history has accumulated: `docs[i]` is the
// document revealed by descending into `focusChain[i-1]` (docs[0] is
// always the root, with no corresponding focusChain entry).
export function computePlanesForDocs(
  docs: readonly MapDocument[],
  focusChain: readonly string[],
): PlaneSpec[] {
  const planes: PlaneSpec[] = [];
  let originX = 0;
  let originZ = 0;
  for (let i = 0; i < docs.length; i++) {
    const shape = boxesForDoc(docs[i]!);
    let label = "WHOLE SYSTEM";
    let focusId: string | null = null;
    if (i > 0) {
      focusId = focusChain[i - 1]!;
      const parent = planes[i - 1]!;
      const box = parent.boxes.find((b) => b.id === focusId);
      originX = parent.originX + (box?.x ?? 0);
      originZ = parent.originZ + (box?.z ?? 0);
      label = box?.label ?? focusId;
    }
    planes.push({
      id: i === 0 ? "root" : focusChain.slice(0, i).join(">"),
      focusId,
      label,
      y: -PLANE_GAP * i,
      originX,
      originZ,
      ...shape,
    });
  }
  return planes;
}

// ACCORDION depthWindow (MINIMAP reframe — ROOT-ANCHORED): of the full
// (arbitrary-depth) `planes` chain, the FIRST `depthWindow` entries — root
// downward — render "expanded" (full plate + boxes); everything DEEPER
// collapses to a thin "sliver" stacked tightly BELOW the expanded block
// (SLIVER_GAP apart, not PLANE_GAP). depthWindow=1 is root only (no
// explosion); 2 is root + the first child level exploded below; 3 adds one
// more level below that. The window is always contiguous from the top —
// root (index 0) is never hidden while a deeper index is shown — so
// increasing depthWindow reveals exactly the next-deeper level and
// decreasing it collapses exactly the deepest-currently-visible level
// first. Root's own position never moves (still y=0, same as the
// unwindowed `planes` passed in); only planes past the window are
// repositioned into the sliver stack.
export function windowPlanes(
  planes: readonly PlaneSpec[],
  depthWindow: number,
): WindowedPlane[] {
  const total = planes.length;
  const windowSize = Math.max(1, Math.min(depthWindow, total));
  const expandedBottomY = -PLANE_GAP * (windowSize - 1);
  return planes.map((plane, i) => {
    if (i < windowSize) {
      return { ...plane, mode: "expanded" as const, depthIndex: i };
    }
    const sliverDepth = i - windowSize + 1;
    return {
      ...plane,
      y: expandedBottomY - SLIVER_GAP * sliverDepth,
      mode: "sliver" as const,
      depthIndex: i,
    };
  });
}

// IDEF0 exploded pyramid: 4 lines from a parent zone's 4 top corners down
// to the 4 corners of the child level's floor frame (a truncated-pyramid /
// frustum wireframe), the signature "explosion" connector look. Each
// corner is its own <MeshLineGeometry> segment (not one combined
// THREE.LineSegments buffer) so every segment can carry
// MeshLineMaterial's dashArray/dashRatio — FIPS Fig.6 draws correspondence
// lines dashed, not solid. `attenuate={false}` (set by callers) is
// load-bearing: MeshLine's default world-unit width attenuation is what
// produced huge misshapen kite polygons under this scene's
// OrthographicCamera in an earlier pass; pixel-space width (attenuate off)
// sidesteps that entirely.
export function rectCorners(
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

export interface CornerSegment {
  id: string;
  points: [THREE.Vector3, THREE.Vector3];
}

export interface PyramidGroup {
  id: string;
  /** Absolute depth index of the CHILD plane this connector leads to — lets
   * IsoScene apply the child's enter/exit presence to this connector too. */
  childDepthIndex: number;
  segments: CornerSegment[];
}

export function pyramidSegments(
  idPrefix: string,
  parent: { x: number; z: number; w: number; d: number; y: number },
  child: { x: number; z: number; plateW: number; plateD: number; y: number },
): CornerSegment[] {
  const parentCorners = rectCorners(
    parent.x,
    parent.z,
    parent.w,
    parent.d,
    parent.y,
  );
  const childCorners = rectCorners(
    child.x,
    child.z,
    child.plateW,
    child.plateD,
    child.y,
  );
  return parentCorners.map((corner, i) => ({
    id: `${idPrefix}-corner-${i}`,
    points: [corner, childCorners[i]!] as [THREE.Vector3, THREE.Vector3],
  }));
}

// Generalized (Stage 2): one connector group per CONSECUTIVE pair of
// EXPANDED planes (a sliver ancestor carries no boxes, so there is no
// meaningful parent-box anchor to frustum from/to — collapsed history is
// conveyed by tight sliver-stack proximity alone, not by connector lines).
export function computeConnectorGroups(
  planes: readonly WindowedPlane[],
): PyramidGroup[] {
  const list: PyramidGroup[] = [];
  for (let i = 1; i < planes.length; i++) {
    const parent = planes[i - 1]!;
    const child = planes[i]!;
    if (parent.mode !== "expanded" || child.mode !== "expanded") continue;
    if (child.focusId === null) continue;
    const parentBox = parent.boxes.find((b) => b.id === child.focusId);
    if (!parentBox) continue;
    list.push({
      id: `${parent.id}->${child.id}`,
      childDepthIndex: child.depthIndex,
      segments: pyramidSegments(
        `${parent.id}-${child.id}`,
        {
          x: parent.originX + parentBox.x,
          z: parent.originZ + parentBox.z,
          w: parentBox.w,
          d: parentBox.d,
          y: parent.y + ZONE_FRAME_H,
        },
        {
          x: child.originX,
          z: child.originZ,
          plateW: child.plateW,
          plateD: child.plateD,
          y: child.y,
        },
      ),
    });
  }
  return list;
}

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
export interface IcomArrowSpec {
  id: string;
  side: IcomSide;
  provenance: "real" | "derived";
}

export function classifyZoneBoundaryEdges(
  doc: MapDocument,
  zoneId: string,
): IcomArrowSpec[] {
  const inZoneIds = new Set(
    doc.nodes.filter((n) => n.zone === zoneId).map((n) => n.id),
  );
  if (inZoneIds.size === 0) return [];
  const seenSide = new Set<IcomSide>();
  const specs: IcomArrowSpec[] = [];
  for (const edge of doc.edges) {
    const fromIn = inZoneIds.has(edge.from);
    const toIn = inZoneIds.has(edge.to);
    if (fromIn === toIn) continue; // not a boundary edge — both in or both out
    const icom = classifyIcom(edge.relation);
    if (icom === "decomposition") continue; // structural tree edge, not an ICOM face
    const side = icomToSide(icom);
    if (seenSide.has(side)) continue; // TODO(spike-icom): capped to 1 arrow/side, see comment above
    seenSide.add(side);
    specs.push({
      id: `${zoneId}-${side}`,
      side,
      provenance: isCanonicalRelation(edge.relation) ? "real" : "derived",
    });
  }
  return specs;
}

export function faceAnchor(
  cx: number,
  cz: number,
  w: number,
  d: number,
  side: IcomSide,
): { x: number; z: number; nx: number; nz: number } {
  switch (side) {
    case "left":
      return { x: cx - w / 2, z: cz, nx: -1, nz: 0 };
    case "right":
      return { x: cx + w / 2, z: cz, nx: 1, nz: 0 };
    case "top":
      return { x: cx, z: cz - d / 2, nx: 0, nz: -1 };
    case "bottom":
    default:
      return { x: cx, z: cz + d / 2, nx: 0, nz: 1 };
  }
}

export interface IcomArrowGeom {
  id: string;
  points: [THREE.Vector3, THREE.Vector3];
  provenance: "real" | "derived";
}

export function icomArrowSegment(
  id: string,
  anchor: { x: number; z: number; nx: number; nz: number },
  y: number,
  provenance: "real" | "derived",
): IcomArrowGeom {
  const inner = new THREE.Vector3(anchor.x, y, anchor.z);
  const outer = new THREE.Vector3(
    anchor.x + anchor.nx * ICOM_ARROW_LEN,
    y,
    anchor.z + anchor.nz * ICOM_ARROW_LEN,
  );
  return { id, points: [inner, outer], provenance };
}

export interface IcomArrowPair {
  id: string;
  /** Same purpose as PyramidGroup.childDepthIndex (see above). */
  childDepthIndex: number;
  parent: IcomArrowGeom;
  child: IcomArrowGeom;
}

// Generalized (Stage 2): loops every consecutive EXPANDED plane pair,
// reading boundary edges from `docs[i-1]` (the PARENT altitude's own
// document — same source Stage 1 used per hardcoded pair).
export function computeIcomArrows(
  planes: readonly WindowedPlane[],
  docs: readonly MapDocument[],
): IcomArrowPair[] {
  const list: IcomArrowPair[] = [];
  for (let i = 1; i < planes.length; i++) {
    const parent = planes[i - 1]!;
    const child = planes[i]!;
    if (parent.mode !== "expanded" || child.mode !== "expanded") continue;
    if (child.focusId === null) continue;
    const parentDoc = docs[i - 1];
    if (!parentDoc) continue;
    const parentBox = parent.boxes.find((b) => b.id === child.focusId);
    if (!parentBox) continue;
    const parentCx = parent.originX + parentBox.x;
    const parentCz = parent.originZ + parentBox.z;
    for (const spec of classifyZoneBoundaryEdges(parentDoc, child.focusId)) {
      const parentAnchor = faceAnchor(
        parentCx,
        parentCz,
        parentBox.w,
        parentBox.d,
        spec.side,
      );
      const childAnchor = faceAnchor(
        child.originX,
        child.originZ,
        child.plateW,
        child.plateD,
        spec.side,
      );
      list.push({
        id: `${parent.id}-${spec.id}`,
        childDepthIndex: child.depthIndex,
        parent: icomArrowSegment(
          `${parent.id}-${spec.id}-parent`,
          parentAnchor,
          parent.y + ZONE_FRAME_H,
          spec.provenance,
        ),
        child: icomArrowSegment(
          `${parent.id}-${spec.id}-child`,
          childAnchor,
          child.y,
          spec.provenance,
        ),
      });
    }
  }
  return list;
}
