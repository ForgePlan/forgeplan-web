<script module lang="ts">
  // Module context (not instance): `shared/ui/index.ts` re-exports this as
  // `export { FloatingWindow, type FloatingWindowMode } from "./floating-window"`,
  // and a type re-exported by a barrel file must originate from a
  // module-level export — an instance-script export is invisible to
  // consumers importing only the type.
  export type FloatingWindowMode = "docked" | "floating";
</script>

<script lang="ts">
  /**
   * FloatingWindow — RFC-035 Wave 1. A generic dockable / floatable /
   * resizable window shell.
   *
   * rule-24-bits-ui: bits-ui/shadcn-svelte ship no draggable+resizable
   * floating-window primitive — `Dialog` is a blocking modal overlay,
   * paneforge/`Resizable` is for split panes inside a fixed layout, neither
   * is a free-floating, dockable window. RFC-035 Alternative A2: this is a
   * hand-rolled `shared/ui` primitive for exactly that reason.
   *
   * Reuse (per RFC-035's reuse-first directive):
   * - MOVE: `@neodrag/svelte`'s `draggable` attachment, restricted to the
   *   `.fw-header` zone via the `controls` plugin, clamped to the viewport
   *   via `bounds`, two-way bound to `{x,y}` via the `position` plugin
   *   (Compartment-reactive, per neodrag's documented Svelte pattern).
   * - RESIZE: the pointer-capture pattern already reviewed in
   *   `widgets/mosaic/ui/Splitter.svelte` (pointerdown → setPointerCapture →
   *   pointermove/up/cancel + keyboard arrow-key nudge) — neodrag itself is
   *   a move library with no resize primitive, so this is the RFC's
   *   pre-approved second reuse path, not a hand-roll.
   *
   * Positioning model: the root is always `position: fixed; top:0; left:0`
   * and is moved entirely via neodrag's CSS transform from `{x, y}` — so
   * "docked" is just a viewport-derived `{x, y, width, height}` rather than
   * a different CSS layout. That is what makes dragging the header while
   * docked detach into floating with no visual jump (see `handleDrag`): the
   * docked position IS the floating seed the moment the gesture starts.
   *
   * Persistence: one versioned localStorage key per `storageKey` prop.
   * Floating geometry is always clamped to the current viewport on restore
   * and on live resize (invariant I4 — never end up off-screen).
   */
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import {
    draggable,
    controls,
    ControlFrom,
    bounds,
    BoundsFrom,
    position,
    events,
    Compartment,
  } from "@neodrag/svelte";
  import Pin from "@lucide/svelte/icons/pin";
  import PinOff from "@lucide/svelte/icons/pin-off";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    /** localStorage key suffix — final key is
     * `forgeplan-web:floating-window:<storageKey>:v1`. Give every mounted
     * instance a distinct value. */
    storageKey: string;
    ariaLabel: string;
    closeAriaLabel?: string;
    defaultWidth?: number;
    defaultHeight?: number;
    minWidth?: number;
    minHeight?: number;
    /** Gap (px) between the window and the viewport edge in docked mode,
     * and the margin floating geometry's max size is clamped against. */
    dockMargin?: number;
    /** Distance (px) from the right edge within which releasing a dragged
     * floating window snaps it back to docked. */
    dockSnapPx?: number;
    onClose?: () => void;
    header?: Snippet;
    children?: Snippet;
    class?: string;
  }

  let {
    storageKey,
    ariaLabel,
    closeAriaLabel = "Close",
    defaultWidth = 420,
    defaultHeight = 560,
    minWidth = 320,
    minHeight = 320,
    dockMargin = 16,
    dockSnapPx = 24,
    onClose,
    header,
    children,
    class: className,
  }: Props = $props();

  const STORAGE_VERSION = 1;
  const storageKeyFull = `forgeplan-web:floating-window:${storageKey}:v1`;
  const RESIZE_KEY_STEP_PX = 8;

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function readViewport(): { w: number; h: number } {
    if (typeof window === "undefined") return { w: 1280, h: 800 };
    return { w: window.innerWidth, h: window.innerHeight };
  }

  const initialViewport = readViewport();

  let mode = $state<FloatingWindowMode>("docked");
  let dockedWidth = $state(defaultWidth);
  let floatX = $state(0);
  let floatY = $state(dockMargin);
  let floatWidth = $state(defaultWidth);
  let floatHeight = $state(defaultHeight);
  let viewportW = $state(initialViewport.w);
  let viewportH = $state(initialViewport.h);
  let isDragging = $state(false);
  let isResizing = $state(false);
  let reducedMotion = $state(false);

  interface PersistedGeometry {
    v: number;
    mode: FloatingWindowMode;
    dockedWidth: number;
    floatX: number;
    floatY: number;
    floatWidth: number;
    floatHeight: number;
  }

  function isPersistedGeometry(value: unknown): value is PersistedGeometry {
    if (typeof value !== "object" || value === null) return false;
    const g = value as Record<string, unknown>;
    return (
      g.v === STORAGE_VERSION &&
      (g.mode === "docked" || g.mode === "floating") &&
      typeof g.dockedWidth === "number" &&
      typeof g.floatX === "number" &&
      typeof g.floatY === "number" &&
      typeof g.floatWidth === "number" &&
      typeof g.floatHeight === "number"
    );
  }

  function maxWidth(): number {
    return Math.max(minWidth, viewportW - dockMargin * 2);
  }
  function maxHeight(): number {
    return Math.max(minHeight, viewportH - dockMargin * 2);
  }

  /** Clamps floating geometry so the window is always fully on-screen when
   * it fits (invariant I4). Called on restore and on every live viewport
   * resize. */
  function clampFloating(): void {
    floatWidth = clamp(floatWidth, minWidth, maxWidth());
    floatHeight = clamp(floatHeight, minHeight, maxHeight());
    floatX = clamp(floatX, 0, Math.max(0, viewportW - floatWidth));
    floatY = clamp(floatY, 0, Math.max(0, viewportH - floatHeight));
  }

  /** Best-effort, never throws — a missing/corrupted/blocked localStorage
   * degrades to the default docked geometry. A version mismatch (or
   * unparsable payload) clears the stale key rather than fighting it on
   * every future mount (rollback plan: "a stale window-geometry key is
   * ignored by a version guard, or cleared"). */
  function loadPersisted(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKeyFull);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedGeometry(parsed)) {
        localStorage.removeItem(storageKeyFull);
        return;
      }
      mode = parsed.mode;
      dockedWidth = clamp(parsed.dockedWidth, minWidth, maxWidth());
      floatX = parsed.floatX;
      floatY = parsed.floatY;
      floatWidth = parsed.floatWidth;
      floatHeight = parsed.floatHeight;
      clampFloating();
    } catch {
      // Corrupted/unavailable storage — defaults already in place.
    }
  }

  /** Best-effort, never throws (private browsing / full storage). */
  function persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const payload: PersistedGeometry = {
        v: STORAGE_VERSION,
        mode,
        dockedWidth,
        floatX,
        floatY,
        floatWidth,
        floatHeight,
      };
      localStorage.setItem(storageKeyFull, JSON.stringify(payload));
    } catch {
      // Storage full/blocked — geometry won't survive reload, chat still
      // works for the rest of this page session.
    }
  }

  // The single value neodrag's `position` plugin forces the root to —
  // derived from the viewport while docked, freely set while floating.
  const x = $derived(
    mode === "docked" ? viewportW - dockedWidth - dockMargin : floatX,
  );
  const y = $derived(mode === "docked" ? dockMargin : floatY);
  const width = $derived(mode === "docked" ? dockedWidth : floatWidth);
  const height = $derived(
    mode === "docked" ? viewportH - dockMargin * 2 : floatHeight,
  );

  function handleDragStart(): void {
    isDragging = true;
  }

  /** Any header-drag movement — including the very first pixel while
   * docked — detaches into floating, seeded from wherever the window
   * currently is (`x`/`y` above), so the gesture continues with no visual
   * jump (FR-1: "dragging the header detaches it into a free-floating
   * window"). */
  function handleDrag(data: { offset: { x: number; y: number } }): void {
    if (mode === "docked") {
      floatWidth = dockedWidth;
      floatHeight = viewportH - dockMargin * 2;
      mode = "floating";
    }
    floatX = data.offset.x;
    floatY = data.offset.y;
  }

  /** FR-1 re-dock: releasing within `dockSnapPx` of the right edge snaps
   * back to docked, carrying the user's chosen width across. */
  function handleDragEnd(data: { offset: { x: number; y: number } }): void {
    isDragging = false;
    if (mode === "floating") {
      floatX = data.offset.x;
      floatY = data.offset.y;
      if (floatX + floatWidth >= viewportW - dockSnapPx) {
        dockedWidth = clamp(floatWidth, minWidth, maxWidth());
        mode = "docked";
      }
    }
    persist();
  }

  /** FR-2's explicit header dock/undock toggle — the non-drag path for
   * both directions. */
  function toggleDock(): void {
    if (mode === "docked") {
      floatX = x;
      floatY = y;
      floatWidth = dockedWidth;
      floatHeight = height;
      mode = "floating";
    } else {
      dockedWidth = clamp(floatWidth, minWidth, maxWidth());
      mode = "docked";
    }
    persist();
  }

  type ResizeEdge =
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";

  function edgeWantsLeft(edge: ResizeEdge): boolean {
    return edge === "left" || edge === "top-left" || edge === "bottom-left";
  }
  function edgeWantsRight(edge: ResizeEdge): boolean {
    return edge === "right" || edge === "top-right" || edge === "bottom-right";
  }
  function edgeWantsTop(edge: ResizeEdge): boolean {
    return edge === "top" || edge === "top-left" || edge === "top-right";
  }
  function edgeWantsBottom(edge: ResizeEdge): boolean {
    return edge === "bottom" || edge === "bottom-left" || edge === "bottom-right";
  }

  /** Splitter.svelte's pointer-capture pattern, generalised to 4 edges + 4
   * corners. Docked mode only ever wires up the `left` edge (see markup) —
   * width only, right edge pinned, height untouched (docked height is
   * viewport-derived full-height by design, see `height` above). Floating
   * wires all edges + all four corners; a corner combines its two edges'
   * axes (e.g. `bottom-right` grows width via `right`-style dx and height
   * via `bottom`-style dy simultaneously). A `left`/`top` component moves
   * the origin as it resizes so the opposite (right/bottom) edge stays
   * fixed in place — the same "moving edge" trick the plain `left` edge
   * already used before this generalisation. */
  function startResize(edge: ResizeEdge) {
    return (e: PointerEvent): void => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      isResizing = true;
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const startWidth = width;
      const startHeight = height;
      const startFloatX = floatX;
      const startFloatY = floatY;
      const wantsLeft = edgeWantsLeft(edge);
      const wantsRight = edgeWantsRight(edge);
      const wantsTop = edgeWantsTop(edge);
      const wantsBottom = edgeWantsBottom(edge);

      function move(ev: PointerEvent): void {
        const dx = ev.clientX - startClientX;
        const dy = ev.clientY - startClientY;

        if (wantsLeft) {
          const next = clamp(startWidth - dx, minWidth, maxWidth());
          if (mode === "docked") {
            dockedWidth = next;
          } else {
            floatWidth = next;
            floatX = startFloatX + startWidth - next;
          }
        } else if (wantsRight) {
          floatWidth = clamp(startWidth + dx, minWidth, maxWidth());
        }

        if (wantsTop) {
          const next = clamp(startHeight - dy, minHeight, maxHeight());
          floatHeight = next;
          floatY = startFloatY + startHeight - next;
        } else if (wantsBottom) {
          floatHeight = clamp(startHeight + dy, minHeight, maxHeight());
        }
      }
      function up(): void {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
        isResizing = false;
        persist();
      }
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    };
  }

  /** Keyboard-operable resize (a11y) — mirrors Splitter.svelte's arrow-key
   * nudge, generalised to 4 edges + 4 corners. Only the `left` edge is
   * reachable in docked mode; every other value is floating-only (see
   * markup). Horizontal arrows (Left/Right) drive the width axis when the
   * edge has a left/right component, vertical arrows (Up/Down) drive the
   * height axis when it has a top/bottom component — a corner responds to
   * both, matching the pointer-drag behaviour above. */
  function resizeKeydown(edge: ResizeEdge) {
    const wantsLeft = edgeWantsLeft(edge);
    const wantsRight = edgeWantsRight(edge);
    const wantsTop = edgeWantsTop(edge);
    const wantsBottom = edgeWantsBottom(edge);
    return (e: KeyboardEvent): void => {
      let handled = false;
      if (wantsLeft && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const delta = e.key === "ArrowLeft" ? RESIZE_KEY_STEP_PX : -RESIZE_KEY_STEP_PX;
        const next = clamp(width + delta, minWidth, maxWidth());
        if (mode === "docked") {
          dockedWidth = next;
        } else {
          floatX = floatX - (next - width);
          floatWidth = next;
        }
        handled = true;
      } else if (wantsRight && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const delta = e.key === "ArrowRight" ? RESIZE_KEY_STEP_PX : -RESIZE_KEY_STEP_PX;
        floatWidth = clamp(floatWidth + delta, minWidth, maxWidth());
        handled = true;
      }
      if (wantsTop && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const delta = e.key === "ArrowUp" ? RESIZE_KEY_STEP_PX : -RESIZE_KEY_STEP_PX;
        const next = clamp(height + delta, minHeight, maxHeight());
        floatY = floatY - (next - height);
        floatHeight = next;
        handled = true;
      } else if (wantsBottom && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const delta = e.key === "ArrowDown" ? RESIZE_KEY_STEP_PX : -RESIZE_KEY_STEP_PX;
        floatHeight = clamp(floatHeight + delta, minHeight, maxHeight());
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        persist();
      }
    };
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") onClose?.();
  }

  onMount(() => {
    loadPersisted();
  });

  $effect(() => {
    if (typeof window === "undefined") return;
    function onResize(): void {
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;
      clampFloating();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent): void => {
      reducedMotion = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  const controlsComp = Compartment.of(() =>
    controls({
      allow: ControlFrom.selector(".fw-header"),
      block: ControlFrom.selector("button, a, input, textarea, select"),
    }),
  );
  const boundsComp = Compartment.of(() => bounds(BoundsFrom.viewport()));
  const posComp = Compartment.of(() => position({ current: { x, y } }));
  const eventsComp = Compartment.of(() =>
    events({
      onDragStart: handleDragStart,
      onDrag: handleDrag,
      onDragEnd: handleDragEnd,
    }),
  );
</script>

<div
  class="fw-root {mode} {className ?? ''}"
  class:dragging={isDragging}
  class:resizing={isResizing}
  class:reduced-motion={reducedMotion}
  style="width:{width}px; height:{height}px;"
  role="dialog"
  aria-label={ariaLabel}
  tabindex="-1"
  onkeydown={handleKeydown}
  {@attach draggable(() => [controlsComp, boundsComp, posComp, eventsComp])}
>
  <div
    class="fw-header"
    tabindex="0"
    role="toolbar"
    aria-label={`${ariaLabel} header`}
  >
    <div class="fw-header-content">
      {@render header?.()}
    </div>
    <div class="fw-header-controls">
      <button
        type="button"
        class="fw-icon-btn"
        aria-label={mode === "docked" ? "Undock (float)" : "Dock to edge"}
        aria-pressed={mode === "floating"}
        onclick={toggleDock}
      >
        {#if mode === "docked"}
          <PinOff size={13} />
        {:else}
          <Pin size={13} />
        {/if}
      </button>
      {#if onClose}
        <button
          type="button"
          class="fw-icon-btn"
          aria-label={closeAriaLabel}
          onclick={onClose}
        >
          <X size={13} />
        </button>
      {/if}
    </div>
  </div>

  <div class="fw-body">
    {@render children?.()}
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fw-resize fw-resize-left"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize width"
    aria-valuenow={Math.round(width)}
    tabindex="0"
    onpointerdown={startResize("left")}
    onkeydown={resizeKeydown("left")}
  ></div>
  {#if mode === "floating"}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="fw-resize fw-resize-right"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize width"
      aria-valuenow={Math.round(width)}
      tabindex="0"
      onpointerdown={startResize("right")}
      onkeydown={resizeKeydown("right")}
    ></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="fw-resize fw-resize-top"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize height"
      aria-valuenow={Math.round(height)}
      tabindex="0"
      onpointerdown={startResize("top")}
      onkeydown={resizeKeydown("top")}
    ></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="fw-resize fw-resize-bottom"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize height"
      aria-valuenow={Math.round(height)}
      tabindex="0"
      onpointerdown={startResize("bottom")}
      onkeydown={resizeKeydown("bottom")}
    ></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="fw-resize fw-resize-top-left"
      role="separator"
      aria-label="Resize"
      tabindex="0"
      onpointerdown={startResize("top-left")}
      onkeydown={resizeKeydown("top-left")}
    ></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="fw-resize fw-resize-top-right"
      role="separator"
      aria-label="Resize"
      tabindex="0"
      onpointerdown={startResize("top-right")}
      onkeydown={resizeKeydown("top-right")}
    ></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="fw-resize fw-resize-bottom-left"
      role="separator"
      aria-label="Resize"
      tabindex="0"
      onpointerdown={startResize("bottom-left")}
      onkeydown={resizeKeydown("bottom-left")}
    ></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="fw-resize fw-resize-bottom-right"
      role="separator"
      aria-label="Resize"
      tabindex="0"
      onpointerdown={startResize("bottom-right")}
      onkeydown={resizeKeydown("bottom-right")}
    ></div>
  {/if}
</div>

<style>
  /* Rule 24: this file OWNS its markup — no other layer may :global()
     re-skin `.fw-*` class names (see rule 24's PRIMITIVE_CLASSES roster). */
  :global(.fw-root) {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 10px;
    box-shadow: var(--shadow-card);
    overflow: hidden;
    touch-action: none;
  }
  :global(.fw-root:not(.dragging):not(.resizing)) {
    transition:
      transform 120ms ease,
      width 120ms ease,
      height 120ms ease;
  }
  :global(.fw-root.reduced-motion) {
    transition: none;
  }
  :global(.fw-root:focus-visible) {
    outline: none;
  }

  .fw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
    flex: none;
    cursor: grab;
    touch-action: none;
  }
  :global(.fw-root.dragging) .fw-header {
    cursor: grabbing;
  }
  .fw-header:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .fw-header-content {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }
  .fw-header-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }
  .fw-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--fg-3);
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  .fw-icon-btn:hover {
    background: var(--bg-2);
    color: var(--fg-1);
  }
  .fw-icon-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .fw-body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .fw-resize {
    position: absolute;
    z-index: 5;
    background: transparent;
    transition: background 120ms;
  }
  :global(.fw-root.reduced-motion) .fw-resize {
    transition: none;
  }
  .fw-resize:hover,
  .fw-resize:focus-visible {
    background: var(--accent-dim);
    outline: none;
  }
  .fw-resize:active {
    background: var(--accent);
  }
  .fw-resize-left {
    top: 0;
    bottom: 0;
    left: -3px;
    width: 6px;
    cursor: ew-resize;
  }
  .fw-resize-right {
    top: 0;
    bottom: 0;
    right: -3px;
    width: 6px;
    cursor: ew-resize;
  }
  .fw-resize-top {
    left: 0;
    right: 0;
    top: -3px;
    height: 6px;
    cursor: ns-resize;
  }
  .fw-resize-bottom {
    left: 0;
    right: 0;
    bottom: -3px;
    height: 6px;
    cursor: ns-resize;
  }
  /* Corners sit above the edge grips (later in DOM order, same z-index) so
     they win pointer priority in the shared corner pixels. Diagonal cursor
     matches the axis the corner travels along: nwse for the NW-SE diagonal
     (top-left / bottom-right), nesw for the NE-SW diagonal (top-right /
     bottom-left). */
  .fw-resize-top-left {
    left: -4px;
    top: -4px;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    cursor: nwse-resize;
  }
  .fw-resize-top-right {
    right: -4px;
    top: -4px;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    cursor: nesw-resize;
  }
  .fw-resize-bottom-left {
    left: -4px;
    bottom: -4px;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    cursor: nesw-resize;
  }
  .fw-resize-bottom-right {
    right: -4px;
    bottom: -4px;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    cursor: nwse-resize;
  }
</style>
