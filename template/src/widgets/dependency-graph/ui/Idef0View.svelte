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
  // TODO(fsd-barrel): import from sub-module to avoid pulling SvelteKit-only
  // pollers (listPoller/stalePoller → $app/environment) into the test env.
  // The barrel re-exports everything; theme.ts itself has zero browser deps.
  import {
    kindBorder,
    kindLabelColor,
    kindColor,
    kindLabel,
    kindIsAccent,
  } from "@/entities/artifact/lib/theme";
  import type { GraphEdge } from "@/entities/graph";
  import type { ScoreEntry } from "@/entities/score";
  import { Badge } from "@/shared/ui";
  import {
    layoutIdef0Diagram,
    layoutTierBands,
    resolveFocusKey,
    BAND_HEADER_H,
  } from "../lib/idef0-layout";
  import type { PlacedBox, Idef0Layout, BoxGeom } from "../lib/idef0-layout";
  import { motionDuration } from "../lib/reduced-motion";

  // ── constants ──────────────────────────────────────────────────────────────
  const THRESHOLD = 0.3;
  const OUTLINE_LIMIT = 50;
  const ICOM_SIDE_LABELS: Record<string, string> = {
    input: "I",
    control: "C",
    output: "O",
    mechanism: "M",
    // TODO(t3-decomp): "D" reserved; decomposition renders as box nesting,
    // not an ICOM arrow — the legend (below) currently excludes it.
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
  /** Container width (px) for adaptive box geometry. */
  let containerW = $state(800);
  /** Hovered artifact key for cross-pane bridge. */
  let hoveredKey = $state<string | null>(null);

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

  // ── adaptive box geometry (responsive to pane width) ──────────────────────
  const adaptiveGeom = $derived.by<Partial<BoxGeom>>(() => {
    const usable = Math.max(360, containerW - 2 * 32 - 2 * 80);
    const cols = containerW >= 1100 ? 4 : containerW >= 720 ? 3 : 2;
    const boxW = Math.max(
      160,
      Math.min(220, Math.floor((usable - (cols - 1) * 24) / cols)),
    );
    return { boxW, cols };
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

  // ── core call: once per (raw, focus, window). Peek one row past the page
  // (limit+1) so hasNextPage is exact and Next never lands on a ghost empty
  // page when the page is exactly full (EVID-065 #1). (synchronous, pure) ─────
  const result = $derived(
    deriveIdef0(raw, {
      threshold: THRESHOLD,
      focus: focus ?? undefined,
      window: { offset: outlineOffset, limit: OUTLINE_LIMIT + 1 },
    }),
  );

  // Displayed rows = the page; the peeked +1 row is only a has-next signal.
  const outlineRows = $derived(result.outline.slice(0, OUTLINE_LIMIT));

  // ── layout: A2 hybrid — boxes from core, geometry from layout helper ───────
  const diagramLayout = $derived<Idef0Layout>(
    result.verdict.mode === "idef0"
      ? layoutIdef0Diagram(result.diagram, adaptiveGeom)
      : layoutTierBands(result.diagram, result.tierStack, adaptiveGeom),
  );

  // ── status lookup: nodes carry status; DiagramBox / OutlineRow do not ──────
  const statusById = $derived(new Map(nodes.map((n) => [n.id, n.status])));

  const isEmpty = $derived(
    outlineRows.length === 0 && result.diagram.boxes.length === 0,
  );

  const hasPrevPage = $derived(outlineOffset > 0);
  const hasNextPage = $derived(result.outline.length > OUTLINE_LIMIT);

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

  function handleOutlineRowKey(e: KeyboardEvent, key: CompositeKey) {
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
          {outlineOffset + 1}–{outlineOffset + outlineRows.length}
          {#if result.outline.length > OUTLINE_LIMIT}
            of {outlineOffset + result.outline.length}
          {/if}
        </span>
      {/if}
    </div>

    {#if outlineRows.length === 0}
      <div class="outline-empty">No nodes</div>
    {:else}
      <ul class="outline-list" role="list">
        {#each outlineRows as row (serialiseKey(row.key))}
          <li>
            <button
              class="outline-row"
              class:row-selected={focus !== null &&
                serialiseKey(row.key) === serialiseKey(focus)}
              class:row-cross-hovered={hoveredKey !== null &&
                serialiseKey(row.key) === hoveredKey}
              style:padding-left="{focus !== null &&
              serialiseKey(row.key) === serialiseKey(focus)
                ? row.depth * 14 + 6
                : row.depth * 14 + 8}px"
              onclick={(e) => drillInto(row.key, e)}
              onkeydown={(e) => handleOutlineRowKey(e, row.key)}
              onmouseenter={() => {
                hoveredKey = serialiseKey(row.key);
              }}
              onmouseleave={() => {
                hoveredKey = null;
              }}
              aria-label="{row.number ?? ''} {row.kind} {row.key.title}"
              aria-pressed={focus !== null &&
                serialiseKey(row.key) === serialiseKey(focus)}
            >
              <span
                class="row-kind-dot"
                style:--dot-c={kindColor(row.kind)}
                aria-hidden="true"
              ></span>
              <span class="row-number">{row.number ?? "—"}</span>
              <span class="row-kind">{kindLabel(row.kind)}</span>
              <span
                class="row-status-dot"
                class:status-active={statusById.get(row.key.id) === "active"}
                class:status-draft={!statusById.has(row.key.id) ||
                  statusById.get(row.key.id) === "draft"}
                class:status-stale={statusById.get(row.key.id) === "stale"}
                class:status-terminal={["superseded", "deprecated"].includes(
                  statusById.get(row.key.id) ?? "",
                )}
                aria-label={statusById.get(row.key.id) ?? "draft"}
              ></span>
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
  <div class="diagram-pane" bind:clientWidth={containerW}>
    <!-- mode indicator (honest fallback banner — always visible per RC-4) -->
    <div class="mode-indicator" role="status" aria-live="polite" title={result.verdict.reason}>
      {#if result.verdict.mode === "tier-stack"}
        <span class="mode-glyph" aria-hidden="true">≈</span>
        <span class="mode-label">Sparse workspace</span>
        <span class="mode-sep" aria-hidden="true">·</span>
        <span class="mode-detail">tier bands active · IDEF0 activates at depth ≥ 3</span>
      {:else}
        <span class="mode-glyph" aria-hidden="true">⬡</span>
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
          <span class="empty-glyph" aria-hidden="true">⬡</span>
          <span class="empty-title">No artifacts in this workspace</span>
          <span class="empty-hint"
            >Run <code>forgeplan new prd</code> to create your first artifact.</span
          >
        </div>
      {:else}
        <div
          class="diagram-canvas"
          style:width="{diagramLayout.width}px"
          style:height="{diagramLayout.height}px"
          style:position="relative"
        >
          <!-- DOM band headers (tier-stack mode only; replaces SVG text labels) -->
          {#if result.verdict.mode === "tier-stack"}
            {#each diagramLayout.bands as band (band.tierIdx)}
              <div
                class="band-header"
                style:top="{band.y - BAND_HEADER_H - 8}px"
                aria-label="Tier {band.tierIdx}: {kindLabel(band.kind)}, {band.count} {band.count === 1 ? 'item' : 'items'}"
              >
                <span class="band-tier-label">T{band.tierIdx}</span>
                <span class="band-kind-label">{kindLabel(band.kind)}</span>
                <span class="band-count-label"
                  >{band.count}
                  {band.count === 1 ? "item" : "items"}</span
                >
              </div>
            {/each}
          {/if}

          <!-- DOM boxes (positioned absolute) -->
          {#each diagramLayout.boxes as box (serialiseKey(box.key))}
            {#if isDrillable(box)}
              <!-- Real, drillable box: interactive button -->
              <button
                class="idef0-box box-real"
                class:box-focus-role={box.role === "focus"}
                class:box-cross-hovered={hoveredKey !== null &&
                  serialiseKey(box.key) === hoveredKey}
                style:--kind-accent={kindBorder(box.kind)}
                style:--kind-num={kindIsAccent(box.kind)
                  ? kindLabelColor(box.kind)
                  : "var(--fg-2)"}
                style:left="{box.x}px"
                style:top="{box.y}px"
                style:width="{box.w}px"
                style:height="{box.h}px"
                style:transition={transitionDur > 0
                  ? `box-shadow ${transitionDur}ms ease-out`
                  : "none"}
                onclick={(e) => drillInto(box.key, e)}
                onkeydown={(e) => handleBoxKey(e, box)}
                onmouseenter={() => {
                  hoveredKey = serialiseKey(box.key);
                }}
                onmouseleave={() => {
                  hoveredKey = null;
                }}
                onfocus={() => {
                  hoveredKey = serialiseKey(box.key);
                }}
                onblur={() => {
                  hoveredKey = null;
                }}
                aria-label="{box.number} {box.kind}: {box.key.title}. Press Enter to drill in."
                title="{box.key.title} ({box.number})"
              >
                <div class="box-header">
                  <span class="box-number">{box.number}</span>
                  <span class="box-kind-abbr">{kindLabel(box.kind)}</span>
                  <span
                    class="box-status-dot"
                    class:status-active={statusById.get(box.key.id) ===
                      "active"}
                    class:status-draft={!statusById.has(box.key.id) ||
                      statusById.get(box.key.id) === "draft"}
                    class:status-stale={statusById.get(box.key.id) === "stale"}
                    class:status-terminal={["superseded", "deprecated"].includes(
                      statusById.get(box.key.id) ?? "",
                    )}
                    aria-label={statusById.get(box.key.id) ?? "draft"}
                  ></span>
                </div>
                <span class="box-title">{box.key.title}</span>
              </button>
            {:else if box.role === "rollup"}
              <!-- Rollup: terminal indicator — NOT drillable (EVID-060 E-2) -->
              <div
                class="idef0-box box-derived box-rollup"
                style:--kind-accent={"var(--fg-4)"}
                style:left="{box.x}px"
                style:top="{box.y}px"
                style:width="{box.w}px"
                style:height="{box.h}px"
                role="status"
                aria-label="+{box.rollupCount} more items (not shown)"
              >
                <span class="rollup-count">+{box.rollupCount}</span>
                <span class="rollup-hint">↑ outline</span>
              </div>
            {:else}
              <!-- Derived box (tier-stack band-member): non-interactive display -->
              <div
                class="idef0-box box-derived"
                class:box-band-member={box.role === "band-member"}
                class:box-cross-hovered={hoveredKey !== null &&
                  serialiseKey(box.key) === hoveredKey}
                role="img"
                style:--kind-accent={kindBorder(box.kind)}
                style:--kind-num={kindIsAccent(box.kind)
                  ? kindLabelColor(box.kind)
                  : "var(--fg-2)"}
                style:left="{box.x}px"
                style:top="{box.y}px"
                style:width="{box.w}px"
                style:height="{box.h}px"
                onmouseenter={() => {
                  hoveredKey = serialiseKey(box.key);
                }}
                onmouseleave={() => {
                  hoveredKey = null;
                }}
                aria-label="≈ {box.number} {box.kind}: {box.key.title} (derived)"
              >
                <div class="box-header">
                  <span class="box-number">{box.number}</span>
                  <span class="box-kind-abbr">{kindLabel(box.kind)}</span>
                  <span
                    class="box-status-dot"
                    class:status-active={statusById.get(box.key.id) ===
                      "active"}
                    class:status-draft={!statusById.has(box.key.id) ||
                      statusById.get(box.key.id) === "draft"}
                    class:status-stale={statusById.get(box.key.id) === "stale"}
                    class:status-terminal={["superseded", "deprecated"].includes(
                      statusById.get(box.key.id) ?? "",
                    )}
                    aria-label={statusById.get(box.key.id) ?? "draft"}
                  ></span>
                </div>
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
    align-items: center;
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
    border-left: 2px solid var(--accent);
  }

  .outline-row.row-cross-hovered {
    background: var(--bg-2);
  }

  /* kind dot — decorative, communicates kind via accent/good/neutral */
  .row-kind-dot {
    width: 6px;
    height: 6px;
    border-radius: 2px;
    flex-shrink: 0;
    background: var(--dot-c, var(--fg-3));
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

  /* status dot — 5px circle, class-driven */
  .row-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .row-status-dot.status-active {
    background: var(--good);
  }

  .row-status-dot.status-draft {
    background: transparent;
    border: 1.5px solid var(--accent);
  }

  .row-status-dot.status-stale {
    background: transparent;
    border: 1.5px solid var(--fg-3);
  }

  .row-status-dot.status-terminal {
    background: var(--fg-4);
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
    gap: 6px;
    padding: 8px;
    border-top: 1px solid var(--line);
    flex-shrink: 0;
  }

  .nav-btn {
    flex: 1;
    font-size: 12px;
    padding: 10px 12px;
    min-height: 36px;
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: 4px;
    color: var(--fg-2);
    cursor: pointer;
    font-weight: 500;
    text-align: center;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--line-3);
    color: var(--fg);
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

  /* mode indicator — neutral informational bar in both modes (no alarm tone) */
  .mode-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    height: 28px;
    min-height: 28px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-1);
    flex-shrink: 0;
    font-size: 11px;
    color: var(--fg-3);
    overflow: hidden;
  }

  .mode-glyph {
    font-size: 13px;
    color: var(--fg-4);
    flex-shrink: 0;
    line-height: 1;
    font-family: var(--font-mono);
  }

  .mode-label {
    font-weight: 500;
    color: var(--fg-2);
    white-space: nowrap;
  }

  .mode-sep {
    color: var(--fg-4);
    user-select: none;
  }

  .mode-detail {
    font-size: 10px;
    color: var(--fg-4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  /* canvas scroll area — flex+center so narrow canvases don't hug left */
  .canvas-scroll {
    flex: 1;
    overflow: auto;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-start;
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
    font-size: 13px;
    color: var(--fg-3);
  }

  .empty-hint {
    font-size: 11px;
    color: var(--fg-4);
    font-style: italic;
  }

  .empty-hint code {
    font-family: var(--font-mono);
    font-style: normal;
    color: var(--accent);
  }

  /* diagram canvas (sized by layout) */
  .diagram-canvas {
    position: relative;
    flex-shrink: 0;
  }

  /* ── DOM band headers (tier-stack mode) ──────────────────────────────── */
  .band-header {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 12px;
    background: var(--bg-1);
    border-top: 1px solid var(--line-2);
    border-bottom: 1px solid var(--line);
    pointer-events: none;
  }

  .band-tier-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--accent);
    flex-shrink: 0;
  }

  .band-kind-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-3);
    flex-shrink: 0;
  }

  .band-count-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-4);
  }

  /* ── ICOM boxes ─────────────────────────────────────────────────────── */
  .idef0-box {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    /* 11px = 3px accent bar + 8px inner gap */
    padding: 4px 8px 4px 11px;
    box-sizing: border-box;
    border-radius: 4px;
    overflow: hidden;
    font-size: 11px;
  }

  /* Kind accent bar — always solid, separate from border provenance style */
  .idef0-box::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--kind-accent, var(--fg-4));
    border-radius: 3px 0 0 3px;
  }

  /* Rollup suppresses the accent bar — no kind identity for a count placeholder */
  .box-rollup::before {
    display: none;
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
    border-color: var(--kind-accent, var(--line-3));
    box-shadow:
      var(--shadow-mini),
      0 0 0 1px var(--kind-accent, var(--line-3));
    transform: translateY(-1px);
    z-index: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .box-real:hover {
      transform: none;
    }
  }

  .box-real:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
  }

  /* focus/context box: emphatic treatment */
  .box-focus-role {
    border-color: var(--accent);
    border-width: 2px;
    background: var(--accent-dim);
    color: var(--fg-1);
    box-shadow: 0 0 0 3px var(--accent-dim), var(--shadow-mini);
  }

  .box-focus-role:focus-visible {
    outline: 2px solid var(--accent);
  }

  /* Hover must not de-emphasise the focus box: .box-real:hover (0,2,0) would
     otherwise override .box-focus-role (0,1,0) and swap the accent halo for
     the neutral kind ring (EVID-071 #2). */
  .box-real.box-focus-role:hover {
    border-color: var(--accent);
    box-shadow:
      0 0 0 3px var(--accent-dim),
      var(--shadow-mini);
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

  /* cross-pane hover bridge */
  .box-real.box-cross-hovered,
  .box-derived.box-cross-hovered {
    box-shadow: 0 0 0 2px var(--accent-soft);
    z-index: 1;
  }

  /* rollup terminal box */
  .box-rollup {
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: default;
    border-style: dashed;
    background: transparent;
    border-color: var(--line-2);
  }

  .rollup-count {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--fg-3);
  }

  .rollup-hint {
    font-size: 9px;
    color: var(--fg-4);
    margin-top: 1px;
  }

  /* box card anatomy */
  .box-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    margin-bottom: 3px;
    flex-shrink: 0;
  }

  .box-number {
    font-family: var(--font-mono);
    font-size: 9px;
    line-height: 1;
    flex-shrink: 0;
    /* color driven by --kind-num CSS custom property set inline on the box */
    color: var(--kind-num, var(--fg-2));
  }

  /* Derived boxes show number at reduced opacity (honesty supplement to dashed border) */
  .box-derived .box-number {
    opacity: 0.65;
  }

  .box-kind-abbr {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--fg-4);
    flex-shrink: 0;
  }

  /* box status dot — pushed to far right of header row */
  .box-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    margin-left: auto;
    flex-shrink: 0;
  }

  .box-status-dot.status-active {
    background: var(--good);
  }

  .box-status-dot.status-draft {
    background: transparent;
    border: 1px solid var(--accent);
  }

  .box-status-dot.status-stale {
    background: transparent;
    border: 1px solid var(--fg-3);
  }

  .box-status-dot.status-terminal {
    background: var(--fg-4);
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
