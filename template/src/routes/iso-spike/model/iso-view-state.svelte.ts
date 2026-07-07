// TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
// entities on graduation (see .claude/rules/10-comments-policy.md).
//
// Stage 2 — dynamic re-layering + collapse/animate + accordion depthWindow.
// ALL new interaction/animation state for the iso-spike route lives here
// (SRP): the levelStack (RFC-031's own LevelFrame, reused verbatim — 3D
// pushLevel/popLevel/climbTo pass a dummy {x:0,y:0,k:1} transform since
// OrbitControls owns its own camera state independently of drill altitude),
// the depthWindow accordion setting, the on-demand emitted-layer cache
// (PRD-038 FR-002, the same fetch-once-per-zone gate ComposedMapView uses),
// and the enter/exit presence tweens driving a plane's grow-in / collapse-
// out animation. IsoScene.svelte CONSUMES this module (calls the exported
// functions, reads plane presence) — every other component (IsoPlane,
// IsoZoneFrame, IsoNodeBox, IsoFrustum, IsoIcomArrows, IsoSliverPlane,
// IsoDeeperMarker, IsoControls) stays a dumb, prop-only renderer
// (SRP/ISP/DIP) and never imports this module directly except IsoScene and
// +page.svelte (the two composition roots — 3D scene and page shell).
//
// Mirrors the module-level $state store shape used by
// widgets/composed-map/model/camera-bus.svelte.ts (no class, one shared
// instance per page) — same pattern the Stage-1 skeleton already used for
// hovered/focused below.

import { Tween } from "svelte/motion";
import {
  validateMapDocument,
  type MapDocument,
  type MapNode,
} from "@/entities/map";
import { isDrillable } from "@/entities/map/lib/derive-subdocument";
import {
  buildLevelDocuments,
  isRootZoneDescend,
} from "@/widgets/composed-map/model/level-documents";
import {
  pushLevel,
  popLevel,
  climbTo as climbToFrame,
  focusChain,
  rootFrame,
  type LevelFrame,
} from "@/widgets/composed-map/model/drill-state";
import {
  buildNodeConnections,
  type NodeConnection,
} from "@/widgets/composed-map/model/node-tabs.svelte";
import {
  computePlanesForDocs,
  windowPlanes,
  NODE_BOX_H,
} from "../lib/iso-projection";
import { motionDuration } from "../lib/motion";

export interface IsoViewTarget {
  kind: "zone" | "node";
  id: string;
}

// ---- pointer focus/hover ---------------------------------------------
// Stage-1 skeleton, now wired as the real "selected box" store, closing
// that stage's own TODO ("replace the local selectedId state in
// IsoScene.svelte with this focus store"). The former hover stub
// (setHovered/currentHovered) is retired in favor of the Stage-3 dwell
// system at the bottom of this file — a plane/sheet hover target isn't an
// IsoViewTarget (it has no zone/node id), so it needed its own shape
// rather than overloading this one.
let focused = $state<IsoViewTarget | null>(null);

export function setFocused(target: IsoViewTarget | null): void {
  focused = target;
}

export function currentFocused(): IsoViewTarget | null {
  return focused;
}

// ---- drill-down level stack (generalized, arbitrary depth) -----------
const DUMMY_TRANSFORM = { x: 0, y: 0, k: 1 };
const ENTER_MS = 320;
const EXIT_MS = 260;

let levelStack = $state<LevelFrame[]>([rootFrame(1)]);

// ACCORDION — how many of the DEEPEST levels render fully expanded (plate
// + boxes); anything shallower collapses to a thin sliver (see
// lib/iso-projection.ts#windowPlanes).
let depthWindow = $state<1 | 2 | 3>(2);

// PRD-038 FR-002 (E3 seam) — identical on-demand per-zone-layer cache/fetch
// gate as ComposedMapView.maybeFetchLayer: fetched at most once per zoneId,
// `null` cached on absent/invalid (client-derived deriveSubDocument fold
// applies, via buildLevelDocuments). This 3D scene has only one root, so
// "first descent from root" is whatever depth the user is currently
// drilling from — buildLevelDocuments already encodes that rule (it only
// ever consults the cache for focusChain index 0).
let layerCache = $state<Map<string, MapDocument | null>>(new Map());
const pendingLayerFetches = new Set<string>();

// Guards re-entrant descend/ascend/climbTo while an enter/exit tween is in
// flight, and tells IsoScene which tween value currently applies to the
// deepest rendered plane (and its connectors/arrows).
let animationKind = $state<"enter" | "exit" | null>(null);
const enterProgress = new Tween(0, { duration: 0 });
const exitProgress = new Tween(1, { duration: 0 });

export function currentLevelStack(): LevelFrame[] {
  return levelStack;
}

export function currentFocusChain(): string[] {
  return focusChain(levelStack);
}

export function currentDepthWindow(): 1 | 2 | 3 {
  return depthWindow;
}

export function setDepthWindow(n: 1 | 2 | 3): void {
  depthWindow = n;
}

export function currentAnimationKind(): "enter" | "exit" | null {
  return animationKind;
}

export function currentEnterProgress(): number {
  return enterProgress.current;
}

export function currentExitProgress(): number {
  return exitProgress.current;
}

async function maybeFetchLayer(zoneId: string): Promise<void> {
  if (layerCache.has(zoneId) || pendingLayerFetches.has(zoneId)) return;
  pendingLayerFetches.add(zoneId);
  let resolved: MapDocument | null = null;
  try {
    const res = await fetch(`/api/map/layers/${encodeURIComponent(zoneId)}`);
    const body = (await res.json()) as { ok: boolean; data?: unknown };
    if (body.ok && body.data && Object.keys(body.data as object).length > 0) {
      const result = validateMapDocument(body.data);
      if (result.ok) resolved = result.doc;
    }
  } catch {
    resolved = null;
  } finally {
    pendingLayerFetches.delete(zoneId);
  }
  const next = new Map(layerCache);
  next.set(zoneId, resolved);
  layerCache = next;
}

// Generalized docsByDepth — folds deriveSubDocument (or a cached emitted
// layer for the first descent) over the ENTIRE current focus chain,
// however deep it has grown (Stage-2 generalization of Stage-1's hardcoded
// two-level demo pair).
export function docsForRoot(rootDoc: MapDocument): MapDocument[] {
  return buildLevelDocuments(rootDoc, focusChain(levelStack), layerCache);
}

// Resolves a breadcrumb frame's focusId to its human label, at the
// altitude where it was a valid drill target — for LevelBreadcrumb's
// `labelFor` prop (reused as-is, RFC-031 Phase 4).
export function labelForFocus(
  rootDoc: MapDocument,
  focusId: string | null,
): string {
  if (focusId === null) return "All";
  const docs = docsForRoot(rootDoc);
  const planes = computePlanesForDocs(docs, focusChain(levelStack));
  return planes.find((p) => p.focusId === focusId)?.label ?? focusId;
}

// CLICK GATE (Stage-2 FR-1) — descends one level ONLY when `focusId`
// resolves to a drillable zone/mega on the CURRENT deepest document; a
// leaf node click is a no-op here (the caller still calls setFocused for
// the select-only case — see IsoScene.svelte#handleBoxClick). Returns
// whether it actually descended, so the caller can decide whether to
// surface a "descended into" notice.
export function descend(rootDoc: MapDocument, focusId: string): boolean {
  if (animationKind !== null) return false;
  const docs = docsForRoot(rootDoc);
  const activeDoc = docs[docs.length - 1];
  if (!activeDoc || !isDrillable(activeDoc, focusId)) return false;

  if (isRootZoneDescend(rootDoc, levelStack.length, focusId)) {
    void maybeFetchLayer(focusId);
  }

  levelStack = pushLevel(levelStack, focusId, DUMMY_TRANSFORM);
  animationKind = "enter";
  enterProgress.set(0, { duration: 0 });
  void enterProgress.set(1, { duration: motionDuration(ENTER_MS) }).then(() => {
    animationKind = null;
  });
  return true;
}

// Shared collapse-then-mutate shape for ascend()/climbTo(): the deepest
// plane visually shrinks to 0 FIRST; the level stack itself is only
// mutated once the tween settles (the real pop/truncate happens inside
// `apply()`, called from `.then()` — never before the animation finishes).
function collapseThenApply(apply: () => void): void {
  animationKind = "exit";
  exitProgress.set(1, { duration: 0 });
  void exitProgress.set(0, { duration: motionDuration(EXIT_MS) }).then(() => {
    apply();
    exitProgress.set(1, { duration: 0 });
    animationKind = null;
  });
}

// FR-003 equivalent — ascend one level (the current deepest level
// collapses away, revealing its parent as the new deepest).
export function ascend(): void {
  if (animationKind !== null || levelStack.length <= 1) return;
  collapseThenApply(() => {
    levelStack = popLevel(levelStack);
  });
}

// Breadcrumb crumb click — climb directly to an ancestor level.
// TODO(iso-multi-collapse): only the single deepest plane animates its
// collapse even when this truncates more than one level at once (e.g.
// depth 4 -> depth 1 via a breadcrumb click); the intermediate levels
// vanish instantly. A fully-animated multi-level collapse is out of scope
// for this spike stage.
export function climbTo(index: number): void {
  if (animationKind !== null || index < 0 || index >= levelStack.length - 1) {
    return;
  }
  collapseThenApply(() => {
    levelStack = climbToFrame(levelStack, index);
  });
}

// ---- Stage 3: hover-dwell (nodes AND planes/sheets) -------------------
// Unified dwell mechanism for BOTH hover targets this stage introduces —
// a node box's info card and a plane/sheet's info card + highlight are
// gated by the EXACT SAME timing rule (ZONE_DWELL_MS parity with
// ComposedMapView, restart-on-move), so one small state machine covers
// both instead of two near-duplicate ones (SRP: this IS "hover state",
// all of it, in one place, per this stage's own mandate).
export type IsoDwellTarget =
  | { kind: "node"; id: string }
  | { kind: "plane"; planeId: string; depthIndex: number };

function sameDwellTarget(a: IsoDwellTarget, b: IsoDwellTarget): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "node" && b.kind === "node"
    ? a.id === b.id
    : a.kind === "plane" && b.kind === "plane" && a.planeId === b.planeId;
}

const DWELL_MS = 350;

// The raw target currently under the pointer (or keyboard focus) — armed
// on enter, cleared on leave. `dwellCard` only advances to it once it has
// survived DWELL_MS untouched (see armDwell) — mirrors ComposedMapView's
// hoveredZoneId/detailZoneId split exactly (parity requested by this
// stage), just generalized to two target KINDS instead of one.
let pointerDwellTarget = $state<IsoDwellTarget | null>(null);
let dwellCard = $state<IsoDwellTarget | null>(null);
let dwellTimer: ReturnType<typeof setTimeout> | null = null;

function clearDwellTimer(): void {
  if (dwellTimer !== null) {
    clearTimeout(dwellTimer);
    dwellTimer = null;
  }
}

export function currentDwellTarget(): IsoDwellTarget | null {
  return dwellCard;
}

// Pointer ENTERED (or keyboard focus landed on) a target — (re)arms the
// dwell timer. A target switch before DWELL_MS elapses restarts the clock
// from zero: every call clears the previous timer before starting a new
// one, so only a genuine DWELL_MS rest on ONE target ever fires it.
export function armDwell(target: IsoDwellTarget): void {
  pointerDwellTarget = target;
  clearDwellTimer();
  const captured = target;
  dwellTimer = setTimeout(() => {
    dwellTimer = null;
    if (pointerDwellTarget && sameDwellTarget(pointerDwellTarget, captured)) {
      dwellCard = captured;
    }
  }, DWELL_MS);
}

// Pointer LEFT (or keyboard focus left) a target — cancels a still-
// pending arm and, if THIS target's card is the one currently shown,
// closes it. The sameDwellTarget guard stops a stale leave (fired after
// the pointer already moved on to a new target) from clearing that NEW
// target's card out from under it.
export function disarmDwell(target: IsoDwellTarget): void {
  if (pointerDwellTarget && sameDwellTarget(pointerDwellTarget, target)) {
    pointerDwellTarget = null;
    clearDwellTimer();
  }
  if (dwellCard && sameDwellTarget(dwellCard, target)) {
    dwellCard = null;
  }
}

// IsoA11yProxy's keyboard path — a Tab landing on a specific hidden proxy
// button has already committed to that exact target (no "just passing
// through" ambiguity a mouse has), so it opens immediately, no DWELL_MS.
export function focusDwell(target: IsoDwellTarget): void {
  clearDwellTimer();
  pointerDwellTarget = target;
  dwellCard = target;
}

export function blurDwell(target: IsoDwellTarget): void {
  disarmDwell(target);
}

export interface DwellNodeCardData {
  kind: "node";
  node: MapNode;
  connections: NodeConnection[];
  worldPos: [number, number, number];
}

export interface DwellLayerCardData {
  kind: "plane";
  label: string;
  zoneCount: number;
  nodeCount: number;
  descriptionRu?: string;
  worldPos: [number, number, number];
}

function currentWindowedPlanes(rootDoc: MapDocument) {
  const docs = docsForRoot(rootDoc);
  const planes = computePlanesForDocs(docs, focusChain(levelStack));
  return { docs, planes: windowPlanes(planes, depthWindow) };
}

// Resolves the CURRENTLY dwelt target (if any) into the exact data its
// card needs — the single source both IsoNodeCard's and IsoLayerCard's
// caller (+page.svelte) reads from, so neither card component ever
// derives its own content (DIP: they stay dumb prop renderers).
export function resolveDwellCardData(
  rootDoc: MapDocument,
): DwellNodeCardData | DwellLayerCardData | null {
  const target = dwellCard;
  if (!target) return null;
  const { docs, planes } = currentWindowedPlanes(rootDoc);

  if (target.kind === "plane") {
    const plane = planes.find(
      (p) => p.mode === "expanded" && p.id === target.planeId,
    );
    if (!plane) return null;
    const doc = docs[plane.depthIndex];
    if (!doc) return null;
    const parentDoc = plane.depthIndex > 0 ? docs[plane.depthIndex - 1] : null;
    const descriptionRu = parentDoc?.zones.find(
      (z) => z.id === plane.focusId,
    )?.description_ru;
    return {
      kind: "plane",
      label: plane.label,
      zoneCount: doc.zones.length,
      nodeCount: doc.nodes.length,
      descriptionRu,
      worldPos: [plane.originX, plane.y, plane.originZ],
    };
  }

  for (const plane of planes) {
    if (plane.mode !== "expanded") continue;
    const box = plane.boxes.find(
      (b) => b.kind === "node" && b.id === target.id,
    );
    if (!box) continue;
    const doc = docs[plane.depthIndex];
    const node = doc?.nodes.find((n) => n.id === target.id);
    if (!doc || !node) return null;
    return {
      kind: "node",
      node,
      connections: buildNodeConnections(doc, target.id),
      worldPos: [
        plane.originX + box.x,
        plane.y + NODE_BOX_H / 2,
        plane.originZ + box.z,
      ],
    };
  }
  return null;
}

export interface DwellTargetSummary {
  target: IsoDwellTarget;
  label: string;
}

// IsoA11yProxy's data source — every CURRENTLY rendered dwellable target
// (one entry per visible expanded plane + one per node box on it), so the
// visually-hidden proxy button list always matches what a mouse could
// actually reach right now (never stale, never includes a collapsed
// sliver's contents).
export function currentDwellableTargets(
  rootDoc: MapDocument,
): DwellTargetSummary[] {
  const { planes } = currentWindowedPlanes(rootDoc);
  const list: DwellTargetSummary[] = [];
  for (const plane of planes) {
    if (plane.mode !== "expanded") continue;
    list.push({
      target: {
        kind: "plane",
        planeId: plane.id,
        depthIndex: plane.depthIndex,
      },
      label: `Layer: ${plane.label}`,
    });
    for (const box of plane.boxes) {
      if (box.kind !== "node") continue;
      list.push({ target: { kind: "node", id: box.id }, label: box.label });
    }
  }
  return list;
}
