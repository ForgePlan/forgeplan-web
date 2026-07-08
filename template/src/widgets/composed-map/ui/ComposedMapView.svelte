<script lang="ts">
  /**
   * ComposedMapView — the 9th view (RFC-030). Renders the hand-written
   * forgeplan.map/v1 checkpoint via computeComposedLayout. Data comes from
   * the widget-owned, ref-counted mapPoller (SD-1), never from the host's
   * artifact pollers.
   *
   * Invariant 8 (time-travel honesty): while isLive is false, polling is
   * released and the canvas freezes on the last successfully-validated
   * document instead of chasing whatever the shared poller keeps fetching
   * for other mounted panes.
   */
  import {
    zoom,
    zoomIdentity,
    select,
    type ZoomBehavior,
  } from "@/widgets/dependency-graph/lib/d3";
  import {
    acquireMapPolling,
    mapPoller,
    isEmptyMapResponse,
    validateMapDocument,
    computeComposedLayout,
    type MapDocument,
    type MapValidationError,
    type MapNode,
    type MapZone,
    type ComposedLayout,
    type Rect,
  } from "@/entities/map";
  import {
    deriveSubDocument,
    isDrillable,
  } from "@/entities/map/lib/derive-subdocument";
  import { rollupEdges, liftIds } from "@/entities/map/lib/edge-rollup";
  import { roomyCanvas } from "@/entities/map/lib/roomy-canvas";
  import {
    toLayoutPoint,
    hitTestZone,
  } from "@/widgets/composed-map/lib/hit-test";
  import {
    rootFrame,
    pushLevel,
    popLevel,
    climbTo as climbToFrame,
    focusChain,
    clampBelowDescend,
    R_DESCEND,
    R_ASCEND,
    COOLDOWN_MS,
    type LevelFrame,
  } from "@/widgets/composed-map/model/drill-state";
  import {
    buildLevelDocuments,
    isRootZoneDescend,
  } from "@/widgets/composed-map/model/level-documents";
  import {
    setNodeTab,
    buildNodeConnections,
  } from "@/widgets/composed-map/model/node-tabs.svelte";
  import {
    buildTourStops,
    startTour,
    nextStop,
    prevStop,
    exitTour,
    currentStop,
    type TourState,
    type TourStop,
  } from "@/widgets/composed-map/model/tour-state";
  import {
    currentCameraRequest,
    type CameraTarget,
  } from "@/widgets/composed-map/model/camera-bus.svelte";
  import type { ArtifactSummary } from "@/entities/artifact";
  import type { GraphEdge } from "@/entities/graph";
  import type { ScoreEntry } from "@/entities/score";
  import { Alert, Badge, Button, MagicStar } from "@/shared/ui";
  import ZoneSlab from "./ZoneSlab.svelte";
  import NodeCard from "./NodeCard.svelte";
  import EdgeLayer from "./EdgeLayer.svelte";
  import FlowChips from "./FlowChips.svelte";
  import LevelBreadcrumb from "./LevelBreadcrumb.svelte";
  import ZoneDetailCard from "./ZoneDetailCard.svelte";
  import OnboardTour from "./OnboardTour.svelte";
  import MapChat from "@/widgets/map-chat/ui/MapChat.svelte";

  let {
    selectedId = null,
    onSelect,
    onClearSelection,
    onViewState,
    isLive = true,
    nodes = [],
    edges = [],
    scores = [],
    openedIds = new Set<string>(),
    kindFilter = new Set<string>(),
    statusFilter = new Set<string>(),
  }: {
    selectedId?: string | null;
    onSelect?: (detail: { id: string; event?: Event }) => void;
    onClearSelection?: () => void;
    onViewState?: (state: {
      nodes: Array<{ id: string; x: number; y: number; kind: string }>;
      transform: { x: number; y: number; k: number };
      viewport: { w: number; h: number };
    }) => void;
    isLive?: boolean;
    // TODO(map-data-source): nodes/edges/scores/openedIds/kindFilter/statusFilter
    // mirror the sibling views' prop contract but are unused here — this
    // view's data comes from mapPoller (entities/map), not the host's
    // artifact pollers (RFC-030 SD-1).
    nodes?: ArtifactSummary[];
    edges?: GraphEdge[];
    scores?: ScoreEntry[];
    openedIds?: ReadonlySet<string>;
    kindFilter?: Set<string>;
    statusFilter?: Set<string>;
  } = $props();

  $effect(() => {
    void nodes;
    void edges;
    void scores;
    void openedIds;
    void kindFilter;
    void statusFilter;
  });

  let svgEl = $state<SVGSVGElement | undefined>();
  let containerEl = $state<HTMLDivElement | undefined>();
  let viewportW = $state(800);
  let viewportH = $state(600);
  let zoomBehavior = $state<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let didFit = $state(false);

  let lastDoc = $state<MapDocument | null>(null);
  let activeFlow = $state<string | null>(null);
  // RFC-034 (Pillar C, Phase 1b) — the chat drawer's open state. Now fully
  // internal: the launcher lives in the FlowChips `leading` slot (left of
  // "All") for every host, so no host needs to drive it externally anymore
  // (superseded the earlier host-driven-launcher prop pair from the
  // short-lived onboard-header launcher).
  let chatOpen = $state(false);

  // Zone hover ring (ZoneSlab visual only). Driven by the same geometry
  // test as click-descend (hitTestZone), not DOM :hover — a node card
  // visually on top of a zone still resolves to that zone by coordinates.
  // Clears on truly empty canvas, same as before — this is just the
  // transient ring, not the sticky detail card below.
  let hoveredZoneId = $state<string | null>(null);

  // Sticky zone detail card (floating panel, understanding-map reference's
  // #detail). Unlike hoveredZoneId, this is deliberately NOT cleared when
  // the pointer moves off the zone or onto the (now-interactive) card
  // itself — it only ever updates to a *different* zone, or is dismissed
  // explicitly (× button) / on a level change, so the user can scroll its
  // list and click "Провалиться →" without the card vanishing underneath
  // them.
  let detailZoneId = $state<string | null>(null);

  // Dwell delay (bottom-left corner UX polish) — hoveredZoneId above keeps
  // tracking the cursor immediately for the ring; detailZoneId only
  // updates once the cursor rests on a *different* zone for ZONE_DWELL_MS
  // with no intervening pointermove (handleCanvasPointerMove clears and
  // restarts this timer on every qualifying move, so a moving cursor
  // never lets it complete — only a genuine rest fires it). Cleared in
  // closeZoneDetail, on every level change (descend/ascend/climbTo), when
  // the map goes non-live, and on teardown so no stray timer fires after
  // unmount/navigation.
  let dwellTimer: ReturnType<typeof setTimeout> | null = null;
  const ZONE_DWELL_MS = 350;

  function clearDwellTimer() {
    if (dwellTimer !== null) {
      clearTimeout(dwellTimer);
      dwellTimer = null;
    }
  }

  // RFC-031 Phase 3 — drill-down level stack. View state only, never
  // document state: level 0 (empty focusChain) folds to the root doc
  // verbatim (FR-008 zero-regression).
  let levelStack = $state<LevelFrame[]>([rootFrame(1)]);
  let nothingDeeperLabel = $state<string | null>(null);
  // PRD-038 FR-002 (E3 seam) — cache of map-pack-emitted per-zone layers,
  // keyed by root-level zone id. Absent key = not yet fetched (falls back
  // to client-derived, same as `null`); `null` = fetched and absent/invalid
  // (client-derived fallback); a MapDocument = validated emitted layer,
  // preferred over deriveSubDocument for the first descent (FD-6).
  // TODO(e3-layer-cache-invalidation): entries never expire for the life of
  // the mounted view — freshness vs. `map.json`'s meta.version is PRD-038
  // Q6, owned by a later RFC.
  let layerCache = $state<Map<string, MapDocument | null>>(new Map());
  const pendingLayerFetches = new Set<string>();
  // Plain (non-reactive) bookkeeping for the threshold cross-once + cooldown
  // hysteresis (ADR-009) — read/written only from event handlers, never
  // rendered, so tracking them as $state would be pure overhead.
  let prevRatio = 1;
  let cooldownUntil = 0;

  let dragStartClient: { x: number; y: number } | null = null;
  let justDragged = false;

  type Branch =
    | { kind: "loading" }
    | { kind: "empty" }
    | { kind: "error"; errors: MapValidationError[] }
    | { kind: "ok"; doc: MapDocument };

  // Live branching per SPEC-006/EVID-078 F1: envelope emptiness is the ONLY
  // discriminant for the empty state — every non-empty payload (including a
  // wrong/missing schema tag) flows through validateMapDocument so it
  // surfaces as a structured error, never as "no map yet". Two cases must
  // be resolved BEFORE that check (EVID-083 F1/F2): a poller-reported
  // transport error (malformed JSON on the server) must not collapse into
  // "no map yet" just because its envelope's data is also `{}`; and the
  // pre-first-fetch `data === null` state must not be handed to the
  // validator (which correctly rejects `null`, producing a false "failed
  // validation" flash before the first real response ever arrives).
  const liveBranch = $derived.by((): Branch => {
    const { data: raw, error, lastFetched } = mapPoller.state;
    if (raw === null && lastFetched === null) return { kind: "loading" };
    if (error) {
      return {
        kind: "error",
        errors: [{ path: "", message: error, severity: "error" }],
      };
    }
    if (isEmptyMapResponse(raw)) return { kind: "empty" };
    const result = validateMapDocument(raw);
    if (!result.ok) return { kind: "error", errors: result.errors };
    return { kind: "ok", doc: result.doc };
  });

  // Commit into lastDoc only while live — this is the freeze point for
  // Invariant 8. Once isLive flips false this effect stops running its
  // body's assignment, so lastDoc holds whatever was last rendered live.
  $effect(() => {
    if (isLive && liveBranch.kind === "ok") {
      lastDoc = liveBranch.doc;
    }
  });

  const displayedKind = $derived.by((): "loading" | "empty" | "error" | "ok" => {
    if (isLive) return liveBranch.kind;
    return lastDoc ? "ok" : "empty";
  });

  const errorList = $derived.by((): MapValidationError[] =>
    isLive && liveBranch.kind === "error" ? liveBranch.errors : [],
  );

  const okDoc = $derived.by((): MapDocument | null => {
    if (isLive) return liveBranch.kind === "ok" ? liveBranch.doc : null;
    return lastDoc;
  });

  // RFC-031 / PRD-038 FR-002 (E3 seam) — per-altitude document chain.
  // buildLevelDocuments folds deriveSubDocument over the focus chain
  // exactly as before, except the FIRST descent prefers a cached,
  // validated map-pack-emitted layer over the derived fold when one
  // exists (FD-6). At level 0 focusChain(levelStack) is empty, so this
  // returns `[okDoc]` — docsByDepth[0] is `okDoc` itself (same reference,
  // the FR-008 zero-regression guarantee).
  const docsByDepth = $derived.by((): MapDocument[] =>
    okDoc ? buildLevelDocuments(okDoc, focusChain(levelStack), layerCache) : [],
  );

  // Independent re-derivation with intermediates retained, used only by
  // LevelBreadcrumb's labelFor to resolve a focus id's label at the
  // altitude where it was a valid drill target (sub-zone ids are
  // synthesized per descent, so a deeper level's own document — not the
  // root's — may be the one that actually names them).
  const activeDoc = $derived.by((): MapDocument | null =>
    docsByDepth.length > 0 ? docsByDepth[docsByDepth.length - 1]! : null,
  );

  // Edge rollup (RFC-031 follow-up) — a collapsed mega's children have no
  // computed position (composed-layout.ts excludes them), so any raw edge
  // touching one is otherwise silently dropped by computeComposedLayout's
  // own endpoint guard. rollupEdges remaps those endpoints onto their
  // covering mega BEFORE layout runs; it only ever changes `edges`, so
  // zoneRects/nodePositions stay byte-identical to computeComposedLayout(activeDoc).
  const rolledUpDoc = $derived.by((): MapDocument | null =>
    activeDoc ? rollupEdges(activeDoc) : null,
  );

  // Elegance polish (RFC-030 follow-up) — widens grid/card gaps AFTER
  // rollup (edge endpoints already resolved to visible ids) and BEFORE
  // layout (so computeComposedLayout, frozen, spreads cards using the
  // roomier tracks). Applies uniformly at every altitude: this sits in the
  // same reactive chain as activeDoc, so a descended/emitted layer's doc
  // gets the identical treatment as the root map.
  const roomyDoc = $derived.by((): MapDocument | null =>
    rolledUpDoc ? roomyCanvas(rolledUpDoc) : null,
  );

  const layout = $derived.by(() =>
    roomyDoc ? computeComposedLayout(roomyDoc) : null,
  );

  // Follow-up to RFC-031 D2 — a collapsed mega (or any drillable node) is an
  // additional descend entry point: clicking the card itself expands it in
  // place, same as an empty-zone click. Precomputed once per activeDoc
  // change so handleNodeClick/handleNodeKeydown and NodeCard's affordance
  // share one source of truth instead of calling isDrillable per click.
  const drillableIds = $derived.by((): ReadonlySet<string> => {
    if (!activeDoc) return new Set();
    const ids = new Set<string>();
    for (const node of activeDoc.nodes) {
      if (isDrillable(activeDoc, node.id)) ids.add(node.id);
    }
    return ids;
  });

  const detailZone = $derived.by((): MapZone | null => {
    if (!detailZoneId || !activeDoc) return null;
    return activeDoc.zones.find((z) => z.id === detailZoneId) ?? null;
  });

  // Excludes is_mega placeholder cards — the "what's inside" list mirrors the
  // zone's real member nodes (what a collapsed mega's children represent),
  // not the collapsed-card stand-in already rendered on the canvas for it.
  const detailZoneNodes = $derived.by((): MapNode[] => {
    if (!detailZoneId || !activeDoc) return [];
    return activeDoc.nodes.filter(
      (n) => n.zone === detailZoneId && !n.is_mega,
    );
  });

  // The descend button's disabled state mirrors descend()'s own guard so
  // the affordance is honest before the click, not just a no-op after it.
  const detailZoneDrillable = $derived.by((): boolean =>
    detailZoneId && activeDoc ? isDrillable(activeDoc, detailZoneId) : false,
  );

  const activeFlowObj = $derived.by(() =>
    activeDoc && activeFlow
      ? (activeDoc.flows?.find((f) => f.id === activeFlow) ?? null)
      : null,
  );

  // Flow members hidden inside a collapsed mega have no card of their own
  // (RFC-031 follow-up) — lift them to their covering mega so the mega card
  // (and its aggregated edges) lights up instead of nothing.
  const activeHighlight = $derived.by((): ReadonlySet<string> | null => {
    if (!activeFlowObj || !activeDoc) return null;
    return liftIds(activeDoc, activeFlowObj.node_ids);
  });

  // Ref-counted acquisition tied to isLive: acquire while live, release on
  // isLive -> false and on destroy (the effect's own cleanup covers both).
  $effect(() => {
    if (!isLive) return;
    const release = acquireMapPolling();
    return () => release();
  });

  // RFC-033 Invariant 3 — the shared fit-scale clamp, factored out of
  // computeFitTransform so fitToRect (below) reuses the EXACT same clamp —
  // there is exactly one fit-scale computation in this view, never forked.
  function fitScale(w: number, h: number): number {
    const fitW = (viewportW - 40) / Math.max(1, w);
    const fitH = (viewportH - 40) / Math.max(1, h);
    return Math.max(0.1, Math.min(1.5, Math.min(fitW, fitH)));
  }

  // RFC-031 — the fit-scale computation, factored out of fitToView so
  // descend() can compute a child level's kFit synchronously (§ADR-009
  // fit-relative thresholds) without waiting for a reactive re-render.
  function computeFitTransform(
    w: number,
    h: number,
  ): { k: number; tx: number; ty: number } {
    const k = fitScale(w, h);
    const tx = (viewportW - w * k) / 2;
    const ty = (viewportH - h * k) / 2;
    return { k, tx, ty };
  }

  function fitToView(animated = true, layoutOverride?: ComposedLayout | null) {
    const target_layout = layoutOverride ?? layout;
    if (!svgEl || !zoomBehavior || !target_layout) return;
    const { k, tx, ty } = computeFitTransform(
      target_layout.width,
      target_layout.height,
    );
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated
      ? select(svgEl).transition().duration(200)
      : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  function applyTransform(
    t: { x: number; y: number; k: number },
    animated = true,
  ) {
    if (!svgEl || !zoomBehavior) return;
    const target = zoomIdentity.translate(t.x, t.y).scale(t.k);
    const sel = animated
      ? select(svgEl).transition().duration(200)
      : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  // RFC-033 Invariant 3 — center + fit an arbitrary rect (a zone's
  // zoneRect) using the SAME fitScale clamp as fitToView/computeFitTransform
  // above. Invariant 2 (single camera owner): writes through the same
  // zoomBehavior.transform path as every other camera move in this view —
  // the tour never instantiates a second zoom controller. Exported (like
  // resetZoom/panTo below) so the fit-math unit test can call it directly.
  export function fitToRect(rect: Rect, animated = true): void {
    if (!svgEl || !zoomBehavior) return;
    const k = fitScale(rect.w, rect.h);
    const tx = viewportW / 2 - (rect.x + rect.w / 2) * k;
    const ty = viewportH / 2 - (rect.y + rect.h / 2) * k;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated
      ? select(svgEl).transition().duration(200)
      : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

  // RFC-033 (Pillar B) — deterministic zone-walk onboarding tour. Pure
  // stops/transitions live in tour-state.ts; this view only owns the
  // $state controller and wires it through fitToRect above (the ONE camera
  // this widget owns — Invariant 2).
  let tour = $state<TourState>({ active: false, index: 0 });
  let reducedMotion = $state(false);

  // RFC-034 (Pillar C, Phase 1b) — the Tier-0 chat drawer's open state.
  // Internal open/close state; the transcript itself lives in
  // chat-store.svelte.ts, surviving the panel being closed/reopened.
  function toggleChat() {
    chatOpen = !chatOpen;
  }

  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  // Deliberately `okDoc` (the ROOT document), not `activeDoc`: the tour
  // always pins to level 0 (startTourFromUi climbs first), so every stop's
  // zoneId must resolve against the root layout's zoneRects, never a
  // drilled-into sub-document's.
  const tourStops = $derived.by((): TourStop[] =>
    okDoc ? buildTourStops(okDoc) : [],
  );
  const currentTourStop = $derived.by((): TourStop | null =>
    currentStop(tourStops, tour),
  );

  function startTourFromUi() {
    if (!isLive || tourStops.length === 0) return;
    if (levelStack.length > 1) climbTo(0);
    tour = startTour(tour);
  }

  function tourNext() {
    tour = nextStop(tour, tourStops.length);
  }

  function tourPrev() {
    tour = prevStop(tour);
  }

  function tourExit() {
    tour = exitTour(tour);
  }

  // Each active step re-fits the camera to the current stop's zone rect.
  // Tracks `layout` too (not just tour.active/index) so a version bump that
  // reflows the layout mid-tour keeps the current stop centred.
  $effect(() => {
    if (!tour.active) return;
    const stop = currentTourStop;
    const rect = stop ? (layout?.zoneRects.get(stop.zoneId) ?? null) : null;
    if (rect) fitToRect(rect, !reducedMotion);
  });

  // RFC-034 (Pillar C, Phase 1a) — camera-bus consumption. The ONE seam a
  // chat (Tier 0 today, Tier 1 later) uses to drive this view's existing
  // camera; reuses fitToRect / onSelect / activeFlow verbatim (Invariant 2:
  // no second camera controller). A target that doesn't resolve against the
  // CURRENT level's document/layout (rect missing, node/flow not found) is a
  // silent no-op — the chat's grounding is best-effort (RFC-034 OQ4).
  function applyCameraTarget(target: CameraTarget): void {
    if (!activeDoc || !layout) return;
    if (target.kind === "zone") {
      const rect = layout.zoneRects.get(target.id);
      if (rect) fitToRect(rect, !reducedMotion);
      return;
    }
    if (target.kind === "node") {
      const node = activeDoc.nodes.find((n) => n.id === target.id);
      if (!node) return;
      // Mirrors handleNodeClick's non-descend branches: a real artifact
      // selects by artifact_id, a plain code node opens its detail tab.
      if (node.artifact_id) {
        onSelect?.({ id: node.artifact_id });
      } else {
        setNodeTab(node.id, {
          node,
          connections: buildNodeConnections(activeDoc, node.id),
        });
        onSelect?.({ id: `node:${node.id}` });
      }
      const rect = layout.zoneRects.get(node.zone);
      if (rect) fitToRect(rect, !reducedMotion);
      return;
    }
    const flowExists =
      activeDoc.flows?.some((f) => f.id === target.id) ?? false;
    if (flowExists) activeFlow = target.id;
  }

  // Plain (non-reactive) bookkeeping, same idiom as prevRatio/cooldownUntil
  // above — tracks the last-consumed request so a re-render that doesn't
  // touch camera-bus (e.g. a layout recompute) never re-applies a stale
  // target, while a genuinely new `showOnMap` (bumped `seq`) always does,
  // even when it targets the same zone/node/flow as before.
  let lastCameraSeq = 0;

  $effect(() => {
    const req = currentCameraRequest();
    if (req.seq === lastCameraSeq) return;
    lastCameraSeq = req.seq;
    if (req.target) applyCameraTarget(req.target);
  });

  // Zoom-to-fit only the FIRST non-empty layout (didFit latches); later
  // meta.version recomputes must not disturb the user's pan/zoom. The
  // queueMicrotask callback can outlive this effect (e.g. the view is
  // switched away before it fires) — reading `layout` at that point
  // triggers Svelte's derived_inert warning, so capture it by value now
  // and guard the callback with the effect's own destroyed flag.
  $effect(() => {
    if (svgEl && zoomBehavior && layout && !didFit) {
      didFit = true;
      let destroyed = false;
      const capturedLayout = layout;
      queueMicrotask(() => {
        if (!destroyed) {
          fitToView(false, capturedLayout);
          const { k } = computeFitTransform(
            capturedLayout.width,
            capturedLayout.height,
          );
          levelStack = levelStack.map((f, i) =>
            i === 0 ? { ...f, kFit: k } : f,
          );
        }
      });
      return () => {
        destroyed = true;
      };
    }
  });

  // RFC-031 — per-level d3 scaleExtent (ADR-009): both thresholds must sit
  // inside the reachable zoom range with headroom, or a fixed range would
  // clip them on small/large sub-maps and silently disable zoom-drill.
  $effect(() => {
    const zb = zoomBehavior;
    const top = levelStack[levelStack.length - 1];
    if (!zb || !top) return;
    zb.scaleExtent([top.kFit * R_ASCEND * 0.9, top.kFit * R_DESCEND * 1.1]);
  });

  // RFC-031 Q7 — time-travel suspension: a saved focusId may not exist in
  // the next live document, so reset to root the instant isLive drops.
  // Invariant 8's frozen `pointer-events:none` already blocks any gesture
  // that would otherwise re-descend while frozen.
  $effect(() => {
    if (!isLive && levelStack.length > 1) {
      levelStack = [levelStack[0]!];
      prevRatio = 1;
    }
  });

  // Frozen (time-travel) state stops receiving pointermove (CSS
  // pointer-events:none on .map-content.frozen), so a stale hover ring or
  // detail card would otherwise linger under the live-only overlay. The
  // tour is live-only too (RFC-033) — exit it rather than leave a dead,
  // unclickable overlay under the frozen dimming.
  $effect(() => {
    if (!isLive) {
      clearDwellTimer();
      hoveredZoneId = null;
      detailZoneId = null;
      tour = exitTour(tour);
      chatOpen = false;
    }
  });

  $effect(() => {
    if (nothingDeeperLabel === null) return;
    const timer = setTimeout(() => {
      nothingDeeperLabel = null;
    }, 1800);
    return () => clearTimeout(timer);
  });

  // Component teardown — a pending dwell timer must not fire after
  // unmount (e.g. navigating away from the composed-map view mid-dwell).
  $effect(() => {
    return () => clearDwellTimer();
  });

  // PRD-038 FR-002 (E3 seam) — fetches an emitted per-zone layer at most
  // once per zoneId and stores the validated result (or `null` on
  // absent/invalid) in layerCache. Fire-and-forget from descend(): the
  // client-derived fold renders immediately; when this resolves,
  // docsByDepth/activeDoc/layout recompute reactively and the canvas swaps
  // to the emitted layer (graceful — no explicit re-fit is triggered here).
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

  // RFC-031 FR-001/FR-006 — descend into a zone or mega-node one altitude.
  // Live-only (Invariant 8); an honest "nothing deeper" affordance replaces
  // a fabricated sub-map when the target has no further structure to reveal.
  function descend(focusId: string) {
    if (!isLive) return;
    if (!activeDoc || !isDrillable(activeDoc, focusId)) {
      const zone = activeDoc?.zones.find((z) => z.id === focusId);
      const node = activeDoc?.nodes.find((n) => n.id === focusId);
      nothingDeeperLabel = zone?.label ?? node?.label ?? focusId;
      return;
    }
    if (okDoc && isRootZoneDescend(okDoc, levelStack.length, focusId)) {
      void maybeFetchLayer(focusId);
    }
    const childDoc = deriveSubDocument(activeDoc, focusId);
    const childLayout = computeComposedLayout(childDoc);
    const { k } = computeFitTransform(childLayout.width, childLayout.height);
    const saved = { ...transform };
    let next = pushLevel(levelStack, focusId, saved);
    next = next.map((f, i) => (i === next.length - 1 ? { ...f, kFit: k } : f));
    levelStack = next;
    cooldownUntil = Date.now() + COOLDOWN_MS;
    prevRatio = 1;
    nothingDeeperLabel = null;
    clearDwellTimer();
    detailZoneId = null;
    // Bug #8 — deriveSubDocument zone ids are deterministic
    // (`sub:<focusId>:<layerToken>`), so re-descending into the same zone
    // without this would flash a stale hover ring until the next
    // pointermove recomputes it.
    hoveredZoneId = null;
    activeFlow = null;
    fitToView(true, childLayout);
  }

  // FR-003 — climb one level (Esc at depth>0, or a ratio crossing R_ASCEND).
  function ascend() {
    if (levelStack.length <= 1) return;
    const target = levelStack[levelStack.length - 2]!;
    const clamped = clampBelowDescend(target.transform, target.kFit);
    levelStack = popLevel(levelStack);
    cooldownUntil = Date.now() + COOLDOWN_MS;
    prevRatio = target.kFit > 0 ? clamped.k / target.kFit : 1;
    clearDwellTimer();
    detailZoneId = null;
    hoveredZoneId = null; // Bug #8 — see descend()'s comment.
    activeFlow = null;
    applyTransform(clamped, true);
  }

  // FR-003 — crumb click: climb directly to an ancestor level.
  function climbTo(index: number) {
    if (index < 0 || index >= levelStack.length - 1) return;
    const target = levelStack[index]!;
    const clamped = clampBelowDescend(target.transform, target.kFit);
    levelStack = climbToFrame(levelStack, index);
    cooldownUntil = Date.now() + COOLDOWN_MS;
    prevRatio = target.kFit > 0 ? clamped.k / target.kFit : 1;
    clearDwellTimer();
    detailZoneId = null;
    hoveredZoneId = null; // Bug #8 — see descend()'s comment.
    activeFlow = null;
    applyTransform(clamped, true);
  }

  // LevelBreadcrumb's labelFor — resolves a focusId to the zone/mega label
  // at the document altitude where it was a valid drill target.
  function labelFor(focusId: string | null): string {
    if (focusId === null) return "All";
    const idx = levelStack.findIndex((f) => f.focusId === focusId);
    const parentDoc = idx > 0 ? docsByDepth[idx - 1] : okDoc;
    if (!parentDoc) return focusId;
    const zone = parentDoc.zones.find((z) => z.id === focusId);
    if (zone) return zone.label;
    const node = parentDoc.nodes.find((n) => n.id === focusId);
    if (node) return node.label;
    return focusId;
  }

  function handleResize() {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    viewportW = rect.width;
    viewportH = rect.height;
  }

  // §15 wheel routing: plain wheel/trackpad pans; Ctrl/Cmd+wheel zooms at
  // the cursor via d3-zoom's own (filtered) handling.
  function handleWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (!svgEl || !zoomBehavior) return;
    const target = zoomIdentity
      .translate(transform.x - event.deltaX, transform.y - event.deltaY)
      .scale(transform.k);
    select(svgEl).call(zoomBehavior.transform, target);
  }

  // §15 drag suppression: a pan exceeding 3px suppresses the click that
  // follows on release, so panning never also fires select/reset.
  function handlePointerDown(event: PointerEvent) {
    dragStartClient = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: PointerEvent) {
    if (dragStartClient) {
      const dx = Math.abs(event.clientX - dragStartClient.x);
      const dy = Math.abs(event.clientY - dragStartClient.y);
      if (dx > 3 || dy > 3) {
        justDragged = true;
        queueMicrotask(() => {
          justDragged = false;
        });
      }
    }
    dragStartClient = null;
  }

  function clearHighlight() {
    activeFlow = null;
  }

  // Zone hover-to-preview — recomputed on every pointer move over the
  // canvas via the same hitTestZone geometry test click-descend uses, so
  // a node card sitting on top of a zone still resolves to that zone.
  // hoveredZoneId (the ZoneSlab ring) tracks the cursor exactly and clears
  // on empty canvas; detailZoneId (the sticky card) only advances to a
  // newly-hovered zone once the cursor has dwelt on it for ZONE_DWELL_MS
  // (see the dwell-timer block below) and is left alone otherwise —
  // moving the cursor onto the now-interactive card, or off the canvas
  // entirely, must not clear it (see closeZoneDetail for the explicit
  // dismissal path).
  function handleCanvasPointerMove(event: PointerEvent) {
    if (!svgEl || !activeDoc || !layout) return;
    const zoneId = hitTestZone(
      toLayoutPoint(
        event.clientX,
        event.clientY,
        svgEl.getBoundingClientRect(),
        transform,
      ),
      activeDoc.zones,
      layout.zoneRects,
    );
    hoveredZoneId = zoneId;

    // Cursor left every zone, or is already parked on the shown zone —
    // nothing to (re-)arm. A null zoneId here deliberately does NOT clear
    // an already-shown detailZoneId (sticky behaviour).
    if (!zoneId || zoneId === detailZoneId) {
      clearDwellTimer();
      return;
    }

    // A new hover target: (re)start the dwell timer. Every qualifying
    // pointermove clears+restarts it, so a cursor that keeps moving
    // (even within the same still-not-shown zone) never lets it
    // complete — only a genuine rest of ZONE_DWELL_MS with no
    // intervening move fires it. capturedZoneId is fixed by closure; the
    // hoveredZoneId check on fire guards against a stale timer applying
    // after the cursor has moved on by the time it fires.
    clearDwellTimer();
    const capturedZoneId = zoneId;
    dwellTimer = setTimeout(() => {
      dwellTimer = null;
      if (hoveredZoneId === capturedZoneId) {
        detailZoneId = capturedZoneId;
      }
    }, ZONE_DWELL_MS);
  }

  function closeZoneDetail() {
    clearDwellTimer();
    detailZoneId = null;
  }

  // §15/D2 — a drag-free click on empty zone area descends into that zone;
  // a click on truly empty canvas (no zone rect hit) falls through to the
  // existing Phase-1 reset. Hit-testing runs in the transformed (post-pan/
  // zoom) coordinate space (Q3).
  function handleCanvasClick(event: MouseEvent) {
    // RFC-033 Cycle 3 — any canvas click during the tour exits it (the
    // user drives); the click's own select/descend/reset behaviour does
    // not additionally run on the same click.
    if (tour.active) {
      tour = exitTour(tour);
      return;
    }
    if (justDragged) return;
    const zoneId =
      svgEl && activeDoc && layout
        ? hitTestZone(
            toLayoutPoint(
              event.clientX,
              event.clientY,
              svgEl.getBoundingClientRect(),
              transform,
            ),
            activeDoc.zones,
            layout.zoneRects,
          )
        : null;
    if (zoneId) {
      descend(zoneId);
      return;
    }
    clearHighlight();
    resetZoom();
    onClearSelection?.();
  }

  // PRD-038 — a leaf code-module card (no artifact_id, not drillable) opens
  // a node-detail tab instead of being an inert click: snapshot the node +
  // its auto-derived Connections into node-tabs.svelte so MapNodePanel can
  // render it, then route through onSelect with a `node:`-prefixed id so
  // the existing tabsStore (a plain string-id store) carries it unchanged.
  function openNodeDetail(node: MapNode, event: Event): void {
    if (!activeDoc) return;
    setNodeTab(node.id, {
      node,
      connections: buildNodeConnections(activeDoc, node.id),
    });
    onSelect?.({ id: `node:${node.id}`, event });
  }

  // §15/D2 follow-up — a mega/collapsed card is itself a descend target
  // (previously only the empty zone area around it was clickable): a
  // drillable card expands in place (descend() re-checks isLive, so a
  // frozen time-travel map still cannot descend); an artifact card opens
  // its tab (unchanged); a code card opens the node-detail tab.
  function handleNodeClick(node: MapNode, event: Event) {
    event.stopPropagation();
    // RFC-033 Cycle 3 — same tour-exits-on-click contract as the canvas.
    if (tour.active) {
      tour = exitTour(tour);
      return;
    }
    if (justDragged) return;
    if (drillableIds.has(node.id)) {
      descend(node.id);
      return;
    }
    if (node.artifact_id) {
      onSelect?.({ id: node.artifact_id, event });
      return;
    }
    openNodeDetail(node, event);
  }

  function handleNodeKeydown(node: MapNode, event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (drillableIds.has(node.id)) {
      descend(node.id);
      return;
    }
    if (node.artifact_id) {
      onSelect?.({ id: node.artifact_id, event });
      return;
    }
    openNodeDetail(node, event);
  }

  // §15 Esc → ascend one level at depth>0 (FR-003); at level 0, the
  // original full reset (clear local highlight state, re-fit to the
  // layout) — same reset the empty-canvas click affordance triggers.
  // RFC-033 Invariant 6 — while the tour is active it owns the keyboard:
  // Esc exits the tour and returns BEFORE the ascend/reset branches below
  // (exiting the tour never also ascends a level or resets the map);
  // ArrowRight/Space step forward, ArrowLeft steps back. Any other key is
  // a no-op during the tour (it does not fall through to the legacy nav).
  function handleKeydown(event: KeyboardEvent) {
    if (tour.active) {
      if (event.key === "Escape") {
        tourExit();
        return;
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        tourNext();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        tourPrev();
        return;
      }
      return;
    }
    // RFC-034 (Pillar C, Phase 1b) — the chat drawer owns Escape while open,
    // same "topmost overlay first" ordering as the tour branch above.
    if (chatOpen && event.key === "Escape") {
      chatOpen = false;
      return;
    }
    if (event.key !== "Escape") return;
    if (levelStack.length > 1) {
      ascend();
      return;
    }
    clearHighlight();
    resetZoom();
    onClearSelection?.();
  }

  $effect(() => {
    if (!svgEl) return;
    const el = svgEl;
    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeydown);
    el.addEventListener("wheel", handleWheel, { passive: false });

    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .filter((event: MouseEvent | WheelEvent) => {
        if (event.type === "wheel") {
          return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
        }
        return !event.button;
      })
      .on("zoom", (event) => {
        // RFC-031/ADR-009 — the threshold check rides on top of d3-zoom's
        // own continuous pan/magnify: d3's filter already restricts wheel
        // events reaching here to Ctrl/Cmd-wheel (drag-pan and the initial
        // fit/restore transforms carry a non-WheelEvent or null
        // sourceEvent), so `src instanceof WheelEvent` alone discriminates
        // the zoom-drill gesture from ordinary pan/programmatic transforms.
        const top = levelStack[levelStack.length - 1];
        const src = event.sourceEvent as
          | WheelEvent
          | MouseEvent
          | TouchEvent
          | null;
        const newRatio = top ? event.transform.k / top.kFit : 1;

        transform = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        };

        const isWheelDrill = src instanceof WheelEvent;
        if (
          top &&
          isWheelDrill &&
          Date.now() >= cooldownUntil &&
          activeDoc &&
          layout
        ) {
          if (prevRatio < R_DESCEND && newRatio >= R_DESCEND) {
            const svgRect = el.getBoundingClientRect();
            const p = toLayoutPoint(src.clientX, src.clientY, svgRect, transform);
            const zoneId = hitTestZone(p, activeDoc.zones, layout.zoneRects);
            if (zoneId) {
              descend(zoneId);
              return;
            }
          } else if (
            levelStack.length > 1 &&
            prevRatio > R_ASCEND &&
            newRatio <= R_ASCEND
          ) {
            ascend();
            return;
          }
        }
        prevRatio = newRatio;
      });
    zoomBehavior = zb;
    select(el).call(zb);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeydown);
      el.removeEventListener("wheel", handleWheel);
      select(el).on(".zoom", null);
    };
  });

  export function resetZoom() {
    fitToView();
  }

  export function panTo(x: number, y: number, k = transform.k) {
    if (!svgEl || !zoomBehavior) return;
    const tx = viewportW / 2 - x * k;
    const ty = viewportH / 2 - y * k;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    select(svgEl).transition().duration(180).call(zoomBehavior.transform, target);
  }

  $effect(() => {
    if (!onViewState) return;
    const t = transform;
    const doc = activeDoc;
    const lay = layout;
    const ns =
      doc && lay
        ? doc.nodes.map((n) => {
            const p = lay.nodePositions.get(n.id);
            return { id: n.id, x: p?.x ?? 0, y: p?.y ?? 0, kind: n.kind };
          })
        : [];
    onViewState({
      nodes: ns,
      transform: { x: t.x, y: t.y, k: t.k },
      viewport: {
        w: containerEl?.clientWidth ?? 0,
        h: containerEl?.clientHeight ?? 0,
      },
    });
  });
</script>

<div class="map-shell" bind:this={containerEl}>
  <div class="map-content" class:frozen={!isLive}>
    {#if displayedKind === "loading"}
      <div class="empty-state" role="status">
        <span class="empty-glyph" aria-hidden="true">⬡</span>
        <span class="empty-title">Loading map…</span>
      </div>
    {:else if displayedKind === "empty"}
      <div class="empty-state" role="status">
        <span class="empty-glyph" aria-hidden="true">⬡</span>
        <span class="empty-title">No map yet</span>
        <span class="empty-hint">
          This view renders <code>.forgeplan/map/map.json</code> — a
          <em>generated</em> file, not hand-written. Create it by running the
          map-build agents in this repo:
        </span>
        <ol class="empty-steps">
          <li><code>/plugin install forgeplan-map-pack@ForgePlan-marketplace</code></li>
          <li><code>/map-build</code></li>
        </ol>
        <a
          class="empty-link"
          href="https://github.com/ForgePlan/marketplace/tree/main/plugins/forgeplan-map-pack"
          target="_blank"
          rel="noopener noreferrer">How map generation works ↗</a
        >
      </div>
    {:else if displayedKind === "error"}
      <div class="error-state">
        <Alert variant="danger" title="Map document failed validation" />
        <ul class="error-list">
          {#each errorList as err (err.path + ":" + err.message)}
            <li class="error-item">
              <Badge
                variant={err.severity === "error" ? "danger" : "secondary"}
                size="sm">{err.severity}</Badge
              >
              <code class="error-path">{err.path}</code>
              <span class="error-message">{err.message}</span>
            </li>
          {/each}
        </ul>
      </div>
    {:else if activeDoc}
      <svg
        bind:this={svgEl}
        class="map-canvas"
        role="img"
        aria-label="Composed map"
        onclick={handleCanvasClick}
        onpointerdown={handlePointerDown}
        onpointerup={handlePointerUp}
        onpointermove={handleCanvasPointerMove}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <!-- Zones paint first (background), then edges (visible against the
               zone fill, not hidden under it), then node cards on top — see
               EVID-088: zone-slab fills were previously sandwiched ABOVE
               edge-layer in paint order, hiding any edge segment that passed
               under a zone's rect. -->
          {#each activeDoc.zones as zone (zone.id)}
            {@const rect = layout?.zoneRects.get(zone.id)}
            {#if rect}
              <ZoneSlab
                {zone}
                {rect}
                dimmed={activeHighlight !== null}
                hovered={hoveredZoneId === zone.id}
              />
            {/if}
          {/each}
          <EdgeLayer
            edgePaths={layout?.edgePaths ?? []}
            connectorPaths={layout?.connectorPaths ?? []}
            highlightedIds={activeHighlight}
          />
          {#each activeDoc.nodes as node (node.id)}
            {@const pos = layout?.nodePositions.get(node.id)}
            {@const drillable = drillableIds.has(node.id)}
            {#if pos}
              <g
                class="node-hit"
                class:selected={node.artifact_id != null &&
                  node.artifact_id === selectedId}
                role="button"
                tabindex="0"
                onclick={(e) => handleNodeClick(node, e)}
                onkeydown={(e) => handleNodeKeydown(node, e)}
              >
                <NodeCard
                  {node}
                  {pos}
                  dims={activeDoc.canvas.cell}
                  highlightedIds={activeHighlight}
                  {drillable}
                />
              </g>
            {/if}
          {/each}
        </g>
      </svg>
      <LevelBreadcrumb stack={levelStack} onCrumb={climbTo} {labelFor} />
      {#if levelStack.length === 1 && !tour.active && tourStops.length > 0}
        <!-- RFC-033 — level-0 only (mirrors the breadcrumb's own slot; the
             two never render together, so there is no top-left collision). -->
        <div class="start-tour-pos">
          <Button
            variant="secondary"
            size="sm"
            disabled={!isLive}
            onclick={startTourFromUi}
          >
            Start tour
          </Button>
        </div>
      {/if}
      <FlowChips
        flows={activeDoc.flows ?? []}
        activeFlowId={activeFlow}
        onToggle={(id) => (activeFlow = id)}
      >
        {#snippet leading()}
          <!-- RFC-034/RFC-035 — the star launcher now lives left of "All" in
               the top chips toolbar (not the bottom-right canvas footer),
               for both hosts (dashboard + /onboard). -->
          <Button
            variant="ghost"
            size="icon"
            disabled={!isLive}
            aria-label={chatOpen ? "Close chat" : "Ask the map"}
            aria-expanded={chatOpen}
            aria-controls="map-chat-panel"
            onclick={toggleChat}
          >
            <MagicStar />
          </Button>
        {/snippet}
      </FlowChips>
      {#if chatOpen && okDoc}
        <div id="map-chat-panel">
          <MapChat doc={okDoc} onClose={() => (chatOpen = false)} />
        </div>
      {/if}
      {#if detailZone}
        {@const zone = detailZone}
        <ZoneDetailCard
          {zone}
          nodes={detailZoneNodes}
          {isLive}
          drillable={detailZoneDrillable}
          onClose={closeZoneDetail}
          onDescend={() => descend(zone.id)}
          onNodeSelect={(id, event) => onSelect?.({ id, event })}
        />
      {/if}
      {#if nothingDeeperLabel !== null}
        <div class="nothing-deeper" role="status">
          <Alert variant="info"
            >Nothing deeper here — {nothingDeeperLabel} has no further structure
            to reveal.</Alert
          >
        </div>
      {/if}
      {#if activeFlowObj?.steps && activeFlowObj.steps.length > 0}
        <!-- Numbered step narration for the active flow (§22 flowcap;
             spike .flowcap). Consumes MapFlow.steps, which was carried but
             never rendered before (EVID-089 finding 8d). -->
        <div class="flowcap" role="note" aria-label="Flow steps">
          <span class="flowcap-name">{activeFlowObj.name}</span>
          <ol class="flowcap-steps">
            {#each activeFlowObj.steps as step, i (i)}
              <li>{step}</li>
            {/each}
          </ol>
        </div>
      {/if}
    {/if}
  </div>
  {#if tour.active}
    <OnboardTour
      stop={currentTourStop}
      index={tour.index}
      total={tourStops.length}
      projectTitle={okDoc?.meta.map_id ?? "Project map"}
      {reducedMotion}
      onNext={tourNext}
      onPrev={tourPrev}
      onExit={tourExit}
    />
  {/if}
  {#if !isLive}
    <div class="live-only-overlay">
      <Alert variant="warning" class="live-only-alert"
        >Map is live-only — not part of time-travel</Alert
      >
    </div>
  {/if}
</div>

<style>
  .map-shell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .map-content {
    width: 100%;
    height: 100%;
    min-height: 0;
    transition: opacity 160ms ease-out;
  }

  .map-content.frozen {
    opacity: 0.4;
    pointer-events: none;
  }

  .map-canvas {
    width: 100%;
    height: 100%;
    display: block;
    background: var(--bg);
    cursor: grab;
    user-select: none;
  }
  .map-canvas:active {
    cursor: grabbing;
  }

  /* Flow step narration card (understanding-map reference's #flowcap) —
     floating bottom-left, shown while a flow is active. */
  .flowcap {
    position: absolute;
    left: 16px;
    bottom: 16px;
    max-width: 480px;
    padding: 12px 16px;
    border: 1px solid var(--line-2);
    border-radius: 12px;
    background: var(--bg-1);
    box-shadow: var(--shadow-mini);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 3;
  }
  .flowcap-name {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--map-clay);
  }
  .flowcap-steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    counter-reset: s;
  }
  .flowcap-steps li {
    counter-increment: s;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--fg-2);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .flowcap-steps li::before {
    content: counter(s);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    background: var(--map-clay);
    color: #fff;
    border-radius: 50%;
    font-size: 9px;
    flex: none;
  }

  /* RFC-033 — positioning only (rule 24); the button itself is the shared/ui
     Button primitive, unmodified. Shares the breadcrumb's top-left slot —
     mutually exclusive render conditions (level 0 vs depth > 0). */
  .start-tour-pos {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 3;
  }

  /* The MapChat mount point (`#map-chat-panel` above) used to be a sized
     position:absolute box matching a pre-RFC-035 fixed drawer. MapChat's own
     FloatingWindow root is `position: fixed` and owns 100% of its geometry
     (drag/resize/dock/viewport-clamp), so this mount point now carries NO
     layout/positioning of its own — it exists purely as the DOM anchor for
     `id="map-chat-panel"` (the launcher's `aria-controls` target). Giving it
     `position` + a numeric `z-index` would establish a stacking context that
     traps FloatingWindow's fixed-positioned root inside it (a `position:
     fixed` descendant of a stacking-context-establishing ancestor is still
     painted within that ancestor's local stacking order), defeating the
     "escapes to the viewport" behaviour MapChat.svelte's own header comment
     describes — so this box is deliberately un-styled (default `display:
     block`, no position, no z-index). */

  .node-hit {
    cursor: pointer;
  }
  .node-hit.selected {
    filter: drop-shadow(0 0 6px var(--accent));
  }
  .node-hit:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 160px;
    gap: 8px;
    text-align: center;
    padding: 24px;
    max-width: 420px;
    margin-inline: auto;
  }
  .empty-glyph {
    font-size: 28px;
    color: var(--fg-4);
    line-height: 1;
  }
  .empty-title {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--fg-2);
  }
  .empty-hint {
    font-family: var(--font-sans);
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--fg-3);
  }
  .empty-hint code {
    font-family: var(--font-mono);
    color: var(--fg-2);
  }
  .empty-steps {
    list-style: decimal;
    margin: 0;
    padding-left: 20px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .empty-steps li {
    font-size: 11px;
    color: var(--fg-4);
  }
  .empty-steps code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-2);
  }
  .empty-link {
    font-family: var(--font-sans);
    font-size: 11.5px;
    color: var(--accent);
    text-decoration: none;
    margin-top: 2px;
  }
  .empty-link:hover {
    text-decoration: underline;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
    box-sizing: border-box;
  }
  .error-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .error-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: var(--font-sans);
    font-size: 12px;
  }
  .error-path {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-2);
    flex-shrink: 0;
  }
  .error-message {
    color: var(--fg-2);
  }

  /* FR-006 honesty affordance — transient, auto-clearing (nothing-deeper
     click/wheel attempt). Positioned clear of the top-left breadcrumb and
     the top-right flow chips. */
  .nothing-deeper {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 60%;
    z-index: 4;
    transition: opacity 160ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .nothing-deeper {
      transition: none;
    }
  }

  .live-only-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 16px;
    pointer-events: none;
    z-index: 30;
  }
  :global(.live-only-alert) {
    pointer-events: auto;
    max-width: 420px;
  }
</style>
