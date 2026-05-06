<script lang="ts">
  import type { Orientation } from "../model/types";

  let {
    orientation,
    pct,
    onResize,
  }: {
    orientation: Orientation;
    pct: number;
    onResize: (newPct: number) => void;
  } = $props();

  let host = $state<HTMLDivElement | undefined>();

  function onPointerDown(e: PointerEvent) {
    if (!host) return;
    e.preventDefault();
    const parent = host.parentElement;
    if (!parent) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const rect = parent.getBoundingClientRect();
    const isRow = orientation === "row";

    function move(ev: PointerEvent) {
      const total = isRow ? rect.width : rect.height;
      if (total <= 0) return;
      const offset = isRow ? ev.clientX - rect.left : ev.clientY - rect.top;
      const newPct = (offset / total) * 100;
      onResize(newPct);
    }
    function up() {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  function onKey(e: KeyboardEvent) {
    const isRow = orientation === "row";
    const decKey = isRow ? "ArrowLeft" : "ArrowUp";
    const incKey = isRow ? "ArrowRight" : "ArrowDown";
    if (e.key === decKey) {
      e.preventDefault();
      onResize(pct - 2);
    } else if (e.key === incKey) {
      e.preventDefault();
      onResize(pct + 2);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={host}
  class="splitter"
  data-orientation={orientation}
  role="separator"
  aria-orientation={orientation === "row" ? "vertical" : "horizontal"}
  aria-valuenow={Math.round(pct)}
  aria-valuemin={10}
  aria-valuemax={90}
  tabindex="0"
  onpointerdown={onPointerDown}
  onkeydown={onKey}
></div>

<style>
  .splitter {
    background: transparent;
    z-index: 5;
    transition: background 120ms;
    align-self: stretch;
    justify-self: stretch;
  }
  .splitter[data-orientation="row"] {
    width: 6px;
    margin-left: -3px;
    margin-right: -3px;
    cursor: ew-resize;
  }
  .splitter[data-orientation="col"] {
    height: 6px;
    margin-top: -3px;
    margin-bottom: -3px;
    cursor: ns-resize;
  }
  .splitter:hover,
  .splitter:focus-visible {
    background: var(--accent-dim);
    outline: none;
  }
  .splitter:active {
    background: var(--accent);
  }
  @media (prefers-reduced-motion: reduce) {
    .splitter {
      transition: none;
    }
  }
</style>
