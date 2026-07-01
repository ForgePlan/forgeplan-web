<script lang="ts">
  /**
   * Idef0View — first host renderer over the frozen TADD/ICOM core (RFC-029,
   * SPEC-005). A2 hybrid render: positioned DOM boxes + one SVG arrow overlay.
   * B3 drill: keyboard/click drill-down + breadcrumb drill-up.
   *
   * rule 22 (read-only): no mutation, no new endpoint, no spawn.
   * rule 24 (shared/ui): composes Badge for the ICOM legend; no :global() re-skin.
   * rule 10 (comments): TODO markers for cut corners only.
   */
  import { deriveIdef0, serialiseKey } from "@/shared/lib/idef0";
  import type { IcomClass, CompositeKey } from "@/shared/lib/idef0";
  import type { ArtifactSummary } from "@/entities/artifact";
  import type { GraphEdge } from "@/entities/graph";
  import type { ScoreEntry } from "@/entities/score";
  import { Badge } from "@/shared/ui";
  import {
    layoutIdef0Diagram,
    layoutTierBands,
    resolveFocusKey,
  } from "../lib/idef0-layout";
  import type { PlacedBox, Idef0Layout } from "../lib/idef0-layout";
  import { motionDuration } from "../lib/reduced-motion";

  // ── constants ──────────────────────────────────────────────────────────────
  const THRESHOLD = 0.3;
  const OUTLINE_LIMIT = 50;
  const ICOM_SIDE_LABELS: Record<string, string> = {
    input: "I",
    control: "C",
    output: "O",
    mechanism: "M",
    decomposition: "D",
  };

  // ── props (mirror the sibling views' $props() shape) ───────────────────────
  let {
    nodes = [],
    edges = [],
    scores = [],
    selectedId = null,
    openedIds = new Set<string>(),
    kindFilter = new Set<string>(),
    statusFilter = new Set<string>(),
    onSelect,
    onViewState,
  }: {
    nodes?: ArtifactSummary[];
    edges?: GraphEdge[];
    scores?: ScoreEntry[];
    selectedId?: string | null;
    openedIds?: ReadonlySet<string>;
    kindFilter?: Set<string>;
    statusFilter?: Set<string>;
    onSelect?: (detail: { id: string; event?: Event }) => void;
    onViewState?: (state: {
      nodes: Array<{ id: string; x: number; y: number; kind: string }>;
      transform: { x: number; y: number; k: number };
      viewport: { w: number; h: number };
    }) => void;
  } = $props();

  // TODO(t2-accepted-and-ignored): openedIds/kindFilter/statusFilter/scores
  // forwarded by the registration branch for API parity (EVID-061 F5).
  // They will be wired in T3/T4. Suppress unused-var warnings.
  $effect(() => {
    void openedIds;
    void kindFilter;
    void statusFilter;
    void scores;
  });

  // onViewState: emit nothing — minimap gates itself off on nodes.length.
  // TODO(t2-minimap): wire a real onViewState emit for minimap in a follow-up
  // once the DOM-based coordinate mapping is stable.

  // ── view-local state ───────────────────────────────────────────────────────
  let focus = $state<CompositeKey | null>(null);
  let breadcrumb = $state<CompositeKey[]>([]);
  let outlineOffset = $state(0);
  /** Tracks last selectedId so we only re-seed on external changes. */
  let _lastSeedId = $state<string | null | undefined>(undefined);

  // Seed focus from host selectedId when it changes (B3 initial seed).
  $effect(() => {
    const id = selectedId ?? null;
    if (id !== _lastSeedId) {
      _lastSeedId = id;
      const seed = resolveFocusKey(id, nodes);
      focus = seed;
      breadcrumb = seed ? [seed] : [];
      outlineOffset = 0;
    }
  });

  // ── host adapter (pure, inline) ────────────────────────────────────────────
  const raw = $derived({
    nodes: nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind })),
    edges: edges.map((e) => ({
      from: e.from,
      to: e.to,
      relation: e.relation,
    })),
  });

  // ── core call: once per (raw, focus, window) (synchronous, pure) ───────────
  const result = $derived(
    deriveIdef0(raw, {
      threshold: THRESHOLD,
      focus: focus ?? undefined,
      window: { offset: outlineOffset, limit: OUTLINE_LIMIT },
    }),
  );

  // ── layout: A2 hybrid — boxes from core, geometry from layout helper ───────
  const diagramLayout = $derived<Idef0Layout>(
    result.verdict.mode === "idef0"
      ? layoutIdef0Diagram(result.diagram)
      : layoutTierBands(result.diagram, result.tierStack),
  );

  const isEmpty = $derived(
    result.outline.length === 0 && result.diagram.boxes.length === 0,
  );

  const hasPrevPage = $derived(outlineOffset > 0);
  const hasNextPage = $derived(
    result.outline.length >= OUTLINE_LIMIT,
  );

  // ── drill interaction (B3) ─────────────────────────────────────────────────

  /** True iff a placed box is a valid drill target (real, not rollup, not off-page). */
  function isDrillable(box: PlacedBox): boolean {
    // EVID-060 E-2: rollup and off-page anchors must NOT be drill targets.
    return box.role !== "rollup" && box.provenance === "real";
  }

  function drillInto(key: CompositeKey, event?: Event) {
    focus = key;
    breadcrumb = [...breadcrumb, key];
    outlineOffset = 0;
    onSelect?.({ id: key.id, event });
  }

  function drillUpTo(index: number) {
    if (index < 0) {
      focus = null;
      breadcrumb = [];
    } else {
      focus = breadcrumb[index] ?? null;
      breadcrumb = breadcrumb.slice(0, index + 1);
    }
    outlineOffset = 0;
  }

  function handleBoxKey(e: KeyboardEvent, box: PlacedBox) {
    if ((e.key === "Enter" || e.key === " ") && isDrillable(box)) {
      e.preventDefault();
      drillInto(box.key, e);
    } else if (e.key === "Backspace" || e.key === "Escape") {
      e.preventDefault();
      drillUpTo(breadcrumb.length - 2);
    }
  }

  function handleOutlineRowKey(
    e: KeyboardEvent,
    key: CompositeKey,
  ) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      drillInto(key, e);
    }
  }

  // ── animation gate ─────────────────────────────────────────────────────────
  const transitionDur = $derived(motionDuration(180));

  // ── export: satisfies host bind:this contract (resetZoom per every sibling view) ──
  export function resetZoom(): void {
    // no-op: this view is DOM-scroll based; there is no D3 zoom transform to
    // reset. Satisfies the host bind:this={inner} interface without side-effects.
  }
</script>

<div class="idef0-host">
  <!-- ── LEFT: OUTLINE PANE ─────────────────────────────────────────── -->
  <div class="outline-pane" role="navigation" aria-label="Altitude outline">
    <div class="pane-header">
      <span class="pane-title">Outline</span>
      {#if hasPrevPage || hasNextPage}
        <span class="pane-page-hint">
          row {outlineOffset + 1}–{outlineOffset + result.outline.length}
        </span>
      {/if}
    </div>

    {#if result.outline.length === 0}
      <div class="outline-empty">No nodes</div>
    {:else}
      <ul class="outline-list" role="list">
        {#each result.outline as row (serialiseKey(row.key))}
          <li>
            <button
              class="outline-row"
              class:row-selected={focus !== null &&
                serialiseKey(row.key) === serialiseKey(focus)}
              style:padding-left="{row.depth * 14 + 8}px"
              onclick={(e) => drillInto(row.key, e)}
              onkeydown={(e) => handleOutlineRowKey(e, row.key)}
              aria-label="{row.number ?? ''} {row.kind} {row.key.title}"
              aria-pressed={focus !== null &&
                serialiseKey(row.key) === serialiseKey(focus)}
            >
              <span class="row-number">{row.number ?? "—"}</span>
              <span class="row-kind">{row.kind}</span>
              <span class="row-title" title={row.key.title}>{row.key.title}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- outline window navigation -->
    {#if hasPrevPage || hasNextPage}
      <div class="outline-nav">
        <button
          class="nav-btn"
          disabled={!hasPrevPage}
          onclick={() => {
            outlineOffset = Math.max(0, outlineOffset - OUTLINE_LIMIT);
          }}
          aria-label="Previous outline page"
        >
          ‹ Prev
        </button>
        <button
          class="nav-btn"
          disabled={!hasNextPage}
          onclick={() => {
            outlineOffset = outlineOffset + OUTLINE_LIMIT;
          }}
          aria-label="Next outline page"
        >
          Next ›
        </button>
      </div>
    {/if}
  </div>

  <!-- ── RIGHT: DIAGRAM PANE ───────────────────────────────────────── -->
  <div class="diagram-pane">
    <!-- mode indicator (honest fallback banner — always visible per RC-4) -->
    <div
      class="mode-indicator"
      class:mode-fallback={result.verdict.mode === "tier-stack"}
      role="status"
      aria-live="polite"
    >
      {#if result.verdict.mode === "tier-stack"}
        <span class="mode-label">Tier-stack view</span>
        <span class="mode-reason" title={result.verdict.reason}>{result.verdict.reason}</span>
      {:else}
        <span class="mode-label">IDEF0 decomposition</span>
      {/if}
    </div>

    <!-- breadcrumb (B3 drill-up) -->
    {#if breadcrumb.length > 0}
      <nav class="breadcrumb" aria-label="Drill-down path">
        <button
          class="crumb crumb-root"
          onclick={() => drillUpTo(-1)}
          aria-label="Go to root level"
        >
          Root
        </button>
        {#each breadcrumb as crumb, i (serialiseKey(crumb))}
          <span class="crumb-sep" aria-hidden="true">/</span>
          <button
            class="crumb"
            class:crumb-active={i === breadcrumb.length - 1}
            onclick={() => drillUpTo(i)}
            aria-label="Go up to {crumb.title}"
            aria-current={i === breadcrumb.length - 1 ? "page" : undefined}
          >
            {crumb.title}
          </button>
        {/each}
      </nav>
    {/if}

    <!-- ICOM diagram canvas -->
    <div class="canvas-scroll">
      {#if isEmpty}
        <!-- V-EMPTY: explicit empty state — no throw, no blank screen (RC-4) -->
        <div class="empty-state" role="status">
          <span>No artifacts in this workspace</span>
        </div>
      {:else}
        <div
          class="diagram-canvas"
          style:width="{diagramLayout.width}px"
          style:height="{diagramLayout.height}px"
          style:position="relative"
        >
          <!-- DOM boxes (positioned absolute) -->
          {#each diagramLayout.boxes as box (serialiseKey(box.key))}
            {#if isDrillable(box)}
              <!-- Real, drillable box: interactive button -->
              <button
                class="idef0-box box-real"
                class:box-focus-role={box.role === "focus"}
                style:left="{box.x}px"
                style:top="{box.y}px"
                style:width="{box.w}px"
                style:height="{box.h}px"
                style:transition={transitionDur > 0
                  ? `box-shadow ${transitionDur}ms ease-out`
                  : "none"}
                onclick={(e) => drillInto(box.key, e)}
                onkeydown={(e) => handleBoxKey(e, box)}
                aria-label="{box.number} {box.kind}: {box.key.title}. Press Enter to drill in."
                title="{box.key.title} ({box.number})"
              >
                <span class="box-number">{box.number}</span>
                <span class="box-title">{box.key.title}</span>
              </button>
            {:else if box.role === "rollup"}
              <!-- Rollup: terminal indicator — NOT drillable (EVID-060 E-2) -->
              <div
                class="idef0-box box-derived box-rollup"
                style:left="{box.x}px"
                style:top="{box.y}px"
                style:width="{box.w}px"
                style:height="{box.h}px"
                role="status"
                aria-label="+{box.rollupCount} more items (not shown)"
              >
                <span class="rollup-count">+{box.rollupCount} more</span>
                <span class="rollup-hint">Use outline ←</span>
              </div>
            {:else}
              <!-- Derived box (tier-stack band-member): non-interactive display -->
              <div
                class="idef0-box box-derived"
                class:box-band-member={box.role === "band-member"}
                style:left="{box.x}px"
                style:top="{box.y}px"
                style:width="{box.w}px"
                style:height="{box.h}px"
                aria-label="≈ {box.number} {box.kind}: {box.key.title} (derived)"
              >
                <span class="box-number">≈ {box.number}</span>
                <span class="box-title">{box.key.title}</span>
              </div>
            {/if}
          {/each}

          <!-- SVG arrow overlay — same coordinate space as boxes -->
          <!-- pointer-events:none so clicks pass through to DOM boxes -->
          <svg
            class="arrow-overlay"
            viewBox="0 0 {diagramLayout.width} {diagramLayout.height}"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="idef0-arrow-real"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" class="arrow-marker-real" />
              </marker>
              <marker
                id="idef0-arrow-derived"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" class="arrow-marker-derived" />
              </marker>
            </defs>

            {#each diagramLayout.arrows as arrow (
              `${serialiseKey(arrow.edge.from)}>${serialiseKey(arrow.edge.to)}:${arrow.edge.relation}:${arrow.side}:${arrow.slot}`
            )}
              <line
                class="icom-arrow"
                class:arrow-real={arrow.edge.provenance === "real"}
                class:arrow-derived={arrow.edge.provenance === "derived"}
                x1={arrow.x1}
                y1={arrow.y1}
                x2={arrow.x2}
                y2={arrow.y2}
                marker-end={arrow.edge.provenance === "real"
                  ? "url(#idef0-arrow-real)"
                  : "url(#idef0-arrow-derived)"}
              />
            {/each}

            <!-- tier-stack band labels (left margin — tier-stack mode only) -->
            {#if result.verdict.mode === "tier-stack"}
              {#each diagramLayout.boxes.filter((b) => b.band !== undefined && diagramLayout.boxes.findIndex((bb) => bb.band === b.band) === diagramLayout.boxes.indexOf(b)) as bandFirst (bandFirst.band)}
                <text
                  class="band-label"
                  x={bandFirst.x - 12}
                  y={bandFirst.y + bandFirst.h / 2 + 4}
                  text-anchor="end"
                  aria-hidden="true"
                >
                  T{bandFirst.band}
                </text>
              {/each}
            {/if}
          </svg>
        </div>
      {/if}
    </div>

    <!-- ICOM legend — permanent in every state (RC-4): dense, fallback, empty -->
    <div class="icom-legend" role="complementary" aria-label="ICOM legend">
      <span class="legend-title">ICOM:</span>
      {#each result.diagram.legend.roles.filter( (r): r is IcomClass => r !== "decomposition", ) as role (role)}
        <Badge variant="secondary" size="sm">
          {ICOM_SIDE_LABELS[role] ?? role}={role}
        </Badge>
      {/each}
      <span class="legend-sep" aria-hidden="true">·</span>
      <span class="honesty-solid" aria-label="real elements are solid">
        — real
      </span>
      <span class="honesty-dashed" aria-label="derived elements are dashed">
        ⋯ derived ≈
      </span>
    </div>
  </div>
</div>

<style>
  /* ── host ──────────────────────────────────────────────────────────── */
  .idef0-host {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-sans);
    overflow: hidden;
  }

  /* ── outline pane ──────────────────────────────────────────────────── */
  .outline-pane {
    display: flex;
    flex-direction: column;
    width: 260px;
    min-width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--line-2);
    background: var(--bg-1);
    overflow: hidden;
  }

  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }

  .pane-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-3);
  }

  .pane-page-hint {
    font-size: 10px;
    color: var(--fg-4);
    font-family: var(--font-mono);
  }

  .outline-empty {
    padding: 20px 12px;
    font-size: 12px;
    color: var(--fg-3);
    font-style: italic;
  }

  .outline-list {
    flex: 1;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }

  /* outline rows are REAL (never dashed) — SPEC-005 honest-fallback scenario */
  .outline-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding-top: 6px;
    padding-bottom: 6px;
    padding-right: 8px;
    min-height: 28px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    text-align: left;
    color: var(--fg);
    transition: background 100ms;
  }

  .outline-row:hover {
    background: var(--bg-2);
  }

  .outline-row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .outline-row.row-selected {
    background: var(--accent-dim);
    color: var(--accent);
  }

  .row-number {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-3);
    flex-shrink: 0;
    min-width: 28px;
  }

  .row-kind {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-3);
    flex-shrink: 0;
  }

  .row-title {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .outline-nav {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    border-top: 1px solid var(--line);
    flex-shrink: 0;
  }

  .nav-btn {
    font-size: 11px;
    padding: 5px 10px;
    min-height: 28px;
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: 3px;
    color: var(--fg-2);
    cursor: pointer;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--bg-3);
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .nav-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* ── diagram pane ──────────────────────────────────────────────────── */
  .diagram-pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  /* mode indicator */
  .mode-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-1);
    flex-shrink: 0;
    font-size: 11px;
    color: var(--fg-2);
  }

  .mode-indicator.mode-fallback {
    background: var(--accent-dim);
    border-bottom-color: var(--accent);
    color: var(--fg-1);
  }

  .mode-label {
    font-weight: 600;
  }

  .mode-reason {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* breadcrumb */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
    flex-shrink: 0;
    overflow-x: auto;
  }

  .crumb {
    font-size: 11px;
    padding: 5px 8px;
    min-height: 28px;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: var(--fg-2);
    cursor: pointer;
    white-space: nowrap;
  }

  .crumb:hover {
    background: var(--bg-2);
    color: var(--fg);
  }

  .crumb:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .crumb-root {
    color: var(--fg-3);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .crumb-active {
    color: var(--accent);
    font-weight: 600;
  }

  .crumb-sep {
    color: var(--fg-4);
    user-select: none;
  }

  /* canvas scroll area */
  .canvas-scroll {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 120px;
    font-size: 13px;
    color: var(--fg-3);
    font-style: italic;
  }

  /* diagram canvas (sized by layout) */
  .diagram-canvas {
    position: relative;
  }

  /* ── ICOM boxes ─────────────────────────────────────────────────────── */
  .idef0-box {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding: 4px 8px;
    box-sizing: border-box;
    border-radius: 4px;
    overflow: hidden;
    font-size: 11px;
  }

  /* real boxes: solid border — RC-2 (provenance=real → solid) */
  .box-real {
    background: var(--bg-1);
    border: 1.5px solid var(--line-3);
    color: var(--fg);
    cursor: pointer;
    text-align: left;
  }

  .box-real:hover {
    border-color: var(--accent-soft);
    box-shadow: 0 0 0 2px var(--accent-dim);
  }

  .box-real:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
  }

  /* focus/context box: more prominent */
  .box-focus-role {
    border-color: var(--accent);
    background: var(--accent-dim);
    color: var(--fg-1);
  }

  .box-focus-role:focus-visible {
    outline: 2px solid var(--accent);
  }

  /* derived boxes: dashed border + ≈ marker — RC-2 (provenance=derived → dashed) */
  .box-derived {
    background: var(--bg-2);
    border: 1.5px dashed var(--line-3);
    color: var(--fg-3);
  }

  .box-band-member {
    border-color: var(--fg-4);
  }

  /* rollup terminal box */
  .box-rollup {
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: default;
    border-style: dashed;
  }

  .rollup-count {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-2);
  }

  .rollup-hint {
    font-size: 10px;
    color: var(--fg-2);
    margin-top: 2px;
  }

  .box-number {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--fg-3);
    line-height: 1;
    margin-bottom: 2px;
  }

  .box-title {
    font-size: 11px;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-word;
  }

  /* ── SVG arrow overlay ──────────────────────────────────────────────── */
  .arrow-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  /* real ICOM arrows: solid stroke — RC-2 */
  :global(.icom-arrow.arrow-real) {
    stroke: var(--line-3);
    stroke-width: 1.5;
    fill: none;
  }

  /* derived arrows: dashed stroke + ≈ — RC-2 */
  :global(.icom-arrow.arrow-derived) {
    stroke: var(--fg-4);
    stroke-width: 1.5;
    stroke-dasharray: 5 3;
    fill: none;
  }

  :global(.arrow-marker-real) {
    fill: var(--line-3);
  }

  :global(.arrow-marker-derived) {
    fill: var(--fg-4);
  }

  :global(.band-label) {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--fg-2);
    user-select: none;
  }

  /* ── ICOM legend — permanent, every state (RC-4) ────────────────────── */
  .icom-legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--line);
    background: var(--bg-1);
    flex-shrink: 0;
    font-size: 11px;
  }

  .legend-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-3);
  }

  .legend-sep {
    color: var(--fg-4);
    user-select: none;
    margin: 0 2px;
  }

  /* honesty key — conveyed by line-style + label, not colour alone (RC-8) */
  .honesty-solid {
    font-size: 10px;
    color: var(--fg-2);
    border-bottom: 1.5px solid var(--line-3);
    padding-bottom: 1px;
  }

  .honesty-dashed {
    font-size: 10px;
    color: var(--fg-3);
    border-bottom: 1.5px dashed var(--fg-4);
    padding-bottom: 1px;
  }
</style>
