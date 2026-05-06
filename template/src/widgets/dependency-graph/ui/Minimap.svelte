<script lang="ts">
  import {
    computeBBox,
    bboxScale,
    canvasToMini,
    miniToCanvas,
    viewportRectInMini,
  } from '../lib/minimap-math';
  import { kindBorder } from '@/entities/artifact';

  const MINI_W = 180;
  const MINI_H = 120;
  const TELEPORT_K = 1;

  let {
    nodes = [],
    transform = { x: 0, y: 0, k: 1 },
    viewportSize = { w: 800, h: 600 },
    onTeleport,
    enabled = true,
  }: {
    nodes?: Array<{ id: string; x: number; y: number; kind: string }>;
    transform?: { x: number; y: number; k: number };
    viewportSize?: { w: number; h: number };
    onTeleport?: (canvasX: number, canvasY: number, k: number) => void;
    enabled?: boolean;
  } = $props();

  const bbox = $derived(computeBBox(nodes));
  const scale = $derived(bboxScale(bbox, MINI_W, MINI_H));
  const rect = $derived(
    viewportRectInMini(transform, viewportSize, bbox, scale, MINI_W, MINI_H)
  );

  function teleportFromEvent(e: PointerEvent) {
    if (!onTeleport) return;
    const target = e.currentTarget as HTMLElement;
    const r = target.getBoundingClientRect();
    const localX = ((e.clientX - r.left) / r.width) * MINI_W;
    const localY = ((e.clientY - r.top) / r.height) * MINI_H;
    const canvasPt = miniToCanvas(
      { x: localX, y: localY },
      bbox,
      scale,
      MINI_W,
      MINI_H
    );
    onTeleport(canvasPt.x, canvasPt.y, TELEPORT_K);
  }

  let dragging = $state(false);

  function onPointerDown(e: PointerEvent) {
    if (!enabled || !onTeleport) return;
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    teleportFromEvent(e);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    teleportFromEvent(e);
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }
</script>

{#if enabled && nodes.length > 0}
  <div
    class="minimap"
    role="region"
    aria-label="Mini-map: click or drag to teleport viewport"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <svg viewBox="0 0 {MINI_W} {MINI_H}" width={MINI_W} height={MINI_H}>
      <rect class="bg" width={MINI_W} height={MINI_H} />
      {#each nodes as n (n.id)}
        {@const p = canvasToMini({ x: n.x, y: n.y }, bbox, scale, MINI_W, MINI_H)}
        <circle
          cx={p.x}
          cy={p.y}
          r="1.6"
          fill={kindBorder(n.kind)}
          fill-opacity="0.85"
        />
      {/each}
      <rect
        class="viewport-rect"
        x={rect.x}
        y={rect.y}
        width={Math.max(2, rect.w)}
        height={Math.max(2, rect.h)}
      />
    </svg>
  </div>
{:else if !enabled}
  <div class="minimap minimap-stub" role="status" aria-live="polite">
    <span>Minimap n/a</span>
  </div>
{/if}

<style>
  .minimap {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 180px;
    height: 120px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 2px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    z-index: 5;
    overflow: hidden;
    user-select: none;
    touch-action: none;
  }
  .minimap:hover {
    border-color: var(--accent-soft);
  }
  .minimap svg {
    display: block;
  }
  .bg {
    fill: var(--bg);
  }
  .viewport-rect {
    fill: var(--accent-dim);
    stroke: var(--accent);
    stroke-width: 1;
    pointer-events: none;
  }
  .minimap-stub {
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
</style>
