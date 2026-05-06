<script lang="ts">
  import type { Snippet } from "svelte";
  import { GRAPH_VIEWS, type GraphView } from "@/shared/config";
  import type { DropEdge, Layout, Leaf } from "../model/types";
  import {
    addLeaf,
    changeView,
    countLeaves,
    leaves,
    removeLeaf,
    setSplitSize,
    swapViews,
  } from "../model/tree";
  import {
    endDrag,
    getActiveDrag,
    hasDragPayload,
    quadrant,
    type DragPayload,
  } from "../lib/drag";
  import { MAX_LEAVES } from "../model/types";
  import MosaicNodeView from "./MosaicNodeView.svelte";
  import PaneFrame from "./PaneFrame.svelte";
  import DropOverlay from "./DropOverlay.svelte";

  let {
    layout = $bindable(),
    leafSnippet,
    onResetZoom,
  }: {
    layout: Layout;
    leafSnippet: Snippet<[GraphView, string]>;
    onResetZoom?: (leafId: string) => void;
  } = $props();

  let host = $state<HTMLDivElement | undefined>();
  let dropTarget = $state<{ leafId: string; edge: DropEdge } | null>(null);
  let dragLabel = $state("");

  const total = $derived(countLeaves(layout.root));
  const usedViews = $derived(new Set(leaves(layout.root).map((l) => l.view)));

  function nextAvailableView(): GraphView | null {
    for (const v of GRAPH_VIEWS) {
      if (!usedViews.has(v.id)) return v.id;
    }
    return null;
  }

  function onResize(path: number[], pct: number) {
    layout = setSplitSize(layout, path, pct);
  }

  function onChangeView(leafId: string, view: GraphView) {
    layout = changeView(layout, leafId, view);
  }

  function onClose(leafId: string) {
    if (total <= 1) return;
    layout = removeLeaf(layout, leafId);
  }

  function onAddPane() {
    if (total >= MAX_LEAVES) return;
    const next = nextAvailableView() ?? GRAPH_VIEWS[0]?.id ?? "force";
    layout = addLeaf(layout, next);
  }

  function readPayload(e: DragEvent): DragPayload | null {
    const inflight = getActiveDrag();
    if (inflight) return inflight;
    if (e.dataTransfer && hasDragPayload(e.dataTransfer)) {
      // Custom MIME present — drag is from us; data unreadable until drop,
      // but presence alone is enough to allow drop to fire.
      return { type: "swap", leafId: "" };
    }
    return null;
  }

  function paneRectFor(leafId: string): { rect: DOMRect; el: HTMLElement } | null {
    if (!host) return null;
    const el = host.querySelector<HTMLElement>(
      `[data-pane-id="${CSS.escape(leafId)}"]`,
    );
    if (!el) return null;
    return { rect: el.getBoundingClientRect(), el };
  }

  function leafIdAt(x: number, y: number): string | null {
    if (!host) return null;
    const els = host.querySelectorAll<HTMLElement>("[data-pane-id]");
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return el.dataset.paneId ?? null;
      }
    }
    return null;
  }

  function onDragOver(e: DragEvent) {
    const payload = readPayload(e);
    if (!payload) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const leafId = leafIdAt(e.clientX, e.clientY);
    if (!leafId) {
      dropTarget = null;
      dragLabel = "";
      return;
    }
    if (payload.type === "swap" && payload.leafId === leafId) {
      dropTarget = null;
      dragLabel = "";
      return;
    }
    if (payload.type === "add" && total >= MAX_LEAVES) {
      dropTarget = null;
      dragLabel = "";
      return;
    }
    const found = paneRectFor(leafId);
    if (!found) return;
    const edge = quadrant(found.rect, e.clientX, e.clientY);
    dropTarget = { leafId, edge };
    if (payload.type === "swap") {
      dragLabel = edge === "center" ? "Swap" : "Move here";
    } else {
      dragLabel = edge === "center" ? "Replace" : "Add here";
    }
  }

  function onDragLeave(e: DragEvent) {
    if (!host) return;
    const related = e.relatedTarget as Node | null;
    if (related && host.contains(related)) return;
    dropTarget = null;
    dragLabel = "";
  }

  function onDrop(e: DragEvent) {
    const payload = getActiveDrag();
    if (!payload || !dropTarget) {
      dropTarget = null;
      dragLabel = "";
      endDrag();
      return;
    }
    e.preventDefault();
    const { leafId, edge } = dropTarget;
    dropTarget = null;
    dragLabel = "";

    if (payload.type === "swap") {
      if (edge === "center") {
        layout = swapViews(layout, payload.leafId, leafId);
      } else {
        // Move semantics: drop on edge = remove source + insert at target's edge
        // with the source's view. Keeps total count identical.
        const source = leaves(layout.root).find((l) => l.id === payload.leafId);
        if (source && source.id !== leafId) {
          let next = removeLeaf(layout, source.id);
          next = addLeaf(next, source.view, { leafId, edge });
          layout = next;
        }
      }
    } else if (edge === "center") {
      layout = changeView(layout, leafId, payload.view as GraphView);
    } else {
      layout = addLeaf(layout, payload.view as GraphView, { leafId, edge });
    }
    endDrag();
  }

  function onDragEnd() {
    dropTarget = null;
    dragLabel = "";
    endDrag();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={host}
  class="mosaic"
  role="region"
  aria-label="Graph mosaic"
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  ondragend={onDragEnd}
>
  {#if !layout.root}
    <div class="empty">No panes — pick a graph view from the toolbar.</div>
  {:else}
    {#snippet leafContent(leaf: Leaf)}
      <div class="pane-host" data-pane-id={leaf.id}>
        <PaneFrame
          leafId={leaf.id}
          view={leaf.view}
          canClose={total > 1}
          canAdd={total < MAX_LEAVES}
          onChangeView={(v) => onChangeView(leaf.id, v)}
          onClose={() => onClose(leaf.id)}
          onAdd={onAddPane}
          onResetZoom={onResetZoom ? () => onResetZoom(leaf.id) : undefined}
        >
          {@render leafSnippet(leaf.view, leaf.id)}
        </PaneFrame>
        {#if dropTarget?.leafId === leaf.id}
          <DropOverlay edge={dropTarget.edge} label={dragLabel} />
        {/if}
      </div>
    {/snippet}
    <MosaicNodeView
      node={layout.root}
      path={[]}
      {onResize}
      leafSnippet={leafContent}
    />
  {/if}
</div>

<style>
  .mosaic {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .mosaic > :global(*) {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  .pane-host {
    position: relative;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 12px;
  }
</style>
