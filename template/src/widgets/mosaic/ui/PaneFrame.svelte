<script lang="ts">
  import type { Snippet } from "svelte";
  import { GRAPH_VIEWS, type GraphView } from "@/shared/config";
  import { Select, type SelectItem } from "@/shared/ui";
  import { beginDrag, endDrag } from "../lib/drag";

  let {
    leafId,
    view,
    canClose,
    canAdd,
    onChangeView,
    onClose,
    onAdd,
    onResetZoom,
    children,
  }: {
    leafId: string;
    view: GraphView;
    canClose: boolean;
    canAdd: boolean;
    onChangeView: (next: GraphView) => void;
    onClose: () => void;
    onAdd: () => void;
    onResetZoom?: () => void;
    children: Snippet;
  } = $props();

  const items: SelectItem[] = GRAPH_VIEWS.map((v) => ({
    value: v.id,
    label: v.label,
    icon: v.icon,
    hint: v.hint,
  }));

  function onDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    // Don't start a drag if the user grabbed an interactive control — buttons,
    // the bits-ui Select trigger, or anything inside its portal-rendered menu.
    const tgt = e.target as HTMLElement;
    if (tgt.closest("button, [data-select-trigger], [role='listbox'], [role='option']")) {
      e.preventDefault();
      return;
    }
    const payload = { type: "swap" as const, leafId };
    beginDrag(payload);
    e.dataTransfer.setData("text/plain", leafId);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    endDrag();
  }

  function onChange(next: string) {
    onChangeView(next as GraphView);
  }
</script>

<div class="pane">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header
    class="pane-header"
    role="toolbar"
    aria-label="Pane controls"
    tabindex="-1"
    draggable="true"
    ondragstart={onDragStart}
    ondragend={onDragEnd}
    title="Drag (handle or empty area) to move/swap this pane"
  >
    <span class="pane-handle" aria-hidden="true">⋮⋮</span>
    <div class="pane-view">
      <Select
        value={view}
        {items}
        onValueChange={onChange}
        title="Change view"
        ariaLabel="Change graph view"
      />
    </div>
    {#if onResetZoom}
      <button
        type="button"
        class="pane-icon"
        aria-label="Reset view"
        title="Reset zoom and pan"
        onclick={onResetZoom}
      >↻</button>
    {/if}
    {#if canAdd}
      <button
        type="button"
        class="pane-icon"
        aria-label="Add pane"
        title="Add pane (next available view)"
        onclick={onAdd}
      >+</button>
    {/if}
    {#if canClose}
      <button
        type="button"
        class="pane-icon"
        aria-label="Close pane"
        title="Close this pane"
        onclick={onClose}
      >×</button>
    {/if}
  </header>
  <div class="pane-body">
    {@render children()}
  </div>
</div>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    background: var(--bg);
    border: 1px solid var(--line);
  }
  .pane-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-2);
    cursor: grab;
    user-select: none;
    flex: 0 0 auto;
  }
  .pane-header:active {
    cursor: grabbing;
  }
  .pane-handle {
    flex: 0 0 auto;
    color: var(--fg-3);
    font-size: 13px;
    line-height: 1;
    letter-spacing: -3px;
    padding: 0 4px 0 2px;
    user-select: none;
    cursor: grab;
  }
  .pane-header:active .pane-handle {
    cursor: grabbing;
    color: var(--accent);
  }
  .pane-view {
    flex: 1;
    min-width: 0;
    display: flex;
  }
  .pane-icon {
    background: transparent;
    border: 1px solid var(--line-2);
    color: var(--fg-3);
    width: 22px;
    height: 22px;
    line-height: 1;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 14px;
    transition: border-color 120ms, color 120ms;
    padding: 0;
    flex: 0 0 auto;
  }
  .pane-icon:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .pane-icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pane-body {
    flex: 1;
    min-height: 0;
    min-width: 0;
    position: relative;
  }
</style>
