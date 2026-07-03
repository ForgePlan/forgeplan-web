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
    type ComposedLayout,
  } from "@/entities/map";
  import type { ArtifactSummary } from "@/entities/artifact";
  import type { GraphEdge } from "@/entities/graph";
  import type { ScoreEntry } from "@/entities/score";
  import { Alert, Badge } from "@/shared/ui";
  import ZoneSlab from "./ZoneSlab.svelte";
  import NodeCard from "./NodeCard.svelte";
  import EdgeLayer from "./EdgeLayer.svelte";
  import FlowChips from "./FlowChips.svelte";

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

  const layout = $derived.by(() => (okDoc ? computeComposedLayout(okDoc) : null));

  const activeHighlight = $derived.by((): ReadonlySet<string> | null => {
    if (!okDoc || !activeFlow) return null;
    const flow = okDoc.flows?.find((f) => f.id === activeFlow);
    return flow ? new Set(flow.node_ids) : null;
  });

  // Ref-counted acquisition tied to isLive: acquire while live, release on
  // isLive -> false and on destroy (the effect's own cleanup covers both).
  $effect(() => {
    if (!isLive) return;
    const release = acquireMapPolling();
    return () => release();
  });

  function fitToView(animated = true, layoutOverride?: ComposedLayout | null) {
    const target_layout = layoutOverride ?? layout;
    if (!svgEl || !zoomBehavior || !target_layout) return;
    const fitW = (viewportW - 40) / Math.max(1, target_layout.width);
    const fitH = (viewportH - 40) / Math.max(1, target_layout.height);
    const k = Math.max(0.1, Math.min(1.5, Math.min(fitW, fitH)));
    const tx = (viewportW - target_layout.width * k) / 2;
    const ty = (viewportH - target_layout.height * k) / 2;
    const target = zoomIdentity.translate(tx, ty).scale(k);
    const sel = animated
      ? select(svgEl).transition().duration(200)
      : select(svgEl);
    sel.call(zoomBehavior.transform, target);
  }

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
        if (!destroyed) fitToView(false, capturedLayout);
      });
      return () => {
        destroyed = true;
      };
    }
  });

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

  function handleCanvasClick() {
    if (justDragged) return;
    clearHighlight();
    resetZoom();
    onClearSelection?.();
  }

  function handleNodeClick(node: MapNode, event: Event) {
    event.stopPropagation();
    if (justDragged) return;
    if (node.artifact_id) onSelect?.({ id: node.artifact_id, event });
  }

  function handleNodeKeydown(node: MapNode, event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (node.artifact_id) onSelect?.({ id: node.artifact_id, event });
  }

  // §15 Esc → full reset: same reset the empty-canvas click affordance
  // triggers (clear local highlight state, re-fit to the layout).
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      clearHighlight();
      resetZoom();
      onClearSelection?.();
    }
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
        transform = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        };
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
    const doc = okDoc;
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
        <span class="empty-hint"
          >Waiting for <code>.forgeplan/map/map.json</code>.</span
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
    {:else if okDoc}
      <svg
        bind:this={svgEl}
        class="map-canvas"
        role="img"
        aria-label="Composed map"
        onclick={handleCanvasClick}
        onpointerdown={handlePointerDown}
        onpointerup={handlePointerUp}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <!-- Zones paint first (background), then edges (visible against the
               zone fill, not hidden under it), then node cards on top — see
               EVID-088: zone-slab fills were previously sandwiched ABOVE
               edge-layer in paint order, hiding any edge segment that passed
               under a zone's rect. -->
          {#each okDoc.zones as zone (zone.id)}
            {@const rect = layout?.zoneRects.get(zone.id)}
            {#if rect}
              <ZoneSlab {zone} {rect} />
            {/if}
          {/each}
          <EdgeLayer
            edgePaths={layout?.edgePaths ?? []}
            connectorPaths={layout?.connectorPaths ?? []}
            highlightedIds={activeHighlight}
          />
          {#each okDoc.nodes as node (node.id)}
            {@const pos = layout?.nodePositions.get(node.id)}
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
                  dims={okDoc.canvas.cell}
                  highlightedIds={activeHighlight}
                />
              </g>
            {/if}
          {/each}
        </g>
      </svg>
      <FlowChips
        flows={okDoc.flows ?? []}
        activeFlowId={activeFlow}
        onToggle={(id) => (activeFlow = id)}
      />
    {/if}
  </div>
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
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-4);
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
