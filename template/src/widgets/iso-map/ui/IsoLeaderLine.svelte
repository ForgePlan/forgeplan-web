<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // Stage 3 — the leader line connecting the current hover-dwell target's
  // 3D world position (a node box or a plane's plate center — see
  // model/iso-view-state.svelte.ts#resolveDwellCardData) to the edge of
  // whichever 2D card is showing it (IsoNodeCard / IsoLayerCard, rendered
  // by +page.svelte, the SAME composition root that owns `cardEl`).
  //
  // Mounted as a SIBLING of <IsoScene> inside <Canvas> (composition root:
  // +page.svelte) — it needs Threlte context (useOrbitControls, <HTML>'s
  // camera projection) that only exists inside <Canvas>, but it is
  // otherwise fully decoupled from IsoScene itself (DIP/OCP: a pure
  // decoration, addable/removable without touching IsoScene's own tree).
  //
  // Two portalled pieces, both via @threlte/extras <HTML> — the ONLY
  // sanctioned way to get real, painted DOM out of <Canvas> (its ordinary
  // children render inside the actual <canvas> tag, which the browser
  // never paints):
  //   1. An invisible 1x1 anchor div — `center` + `transform={false}` so
  //      Threlte keeps it translated to the live screen projection of
  //      `anchorWorldPos` every render frame, automatically.
  //   2. A plain SVG <line>, nested INSIDE THE SAME centered/transformed
  //      wrapper as (1). Both are ordinary `position:absolute; top:0;
  //      left:0` children of that one already-translated parent, so they
  //      share the exact same local (0,0) origin — the line's start point
  //      is always local (0,0), no further transform math needed. Only
  //      the END point (the card's nearest edge, in real viewport pixels)
  //      needs converting into that same local frame, via ONE
  //      getBoundingClientRect() read of the anchor div itself.
  //      `overflow: visible` on the <svg> is required — its UA default
  //      clips at its own nominal 0x0 box otherwise.
  // Recomputed on OrbitControls 'change' (rAF-throttled — a damped
  // multi-frame orbit gesture reads the DOM at most once per paint) AND
  // whenever the dwell target / card itself changes.
  import { HTML, useOrbitControls } from '@threlte/extras';
  import { nearestRectEdgePoint } from '../lib/leader-line';

  let {
    anchorWorldPos,
    cardEl,
  }: {
    anchorWorldPos: [number, number, number] | null;
    cardEl: HTMLElement | null;
  } = $props();

  let anchorEl = $state<HTMLDivElement | undefined>();
  let line = $state<{ x2: number; y2: number } | null>(null);

  function recompute(): void {
    if (!anchorEl || !cardEl) {
      line = null;
      return;
    }
    const anchorRect = anchorEl.getBoundingClientRect();
    const originX = anchorRect.left + anchorRect.width / 2;
    const originY = anchorRect.top + anchorRect.height / 2;
    const edge = nearestRectEdgePoint(cardEl.getBoundingClientRect(), originX, originY);
    line = { x2: edge.x - originX, y2: edge.y - originY };
  }

  let rafId: number | null = null;
  function scheduleRecompute(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      recompute();
    });
  }

  // Target (or its card) changed — recompute right away rather than
  // waiting for the next orbit 'change' event, so the line appears the
  // moment a new card does.
  $effect(() => {
    void anchorWorldPos;
    void cardEl;
    scheduleRecompute();
  });

  const orbitControls = useOrbitControls();

  $effect(() => {
    const controls = orbitControls.current;
    if (!controls) return;
    controls.addEventListener('change', scheduleRecompute);
    return () => controls.removeEventListener('change', scheduleRecompute);
  });

  $effect(() => {
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  });
</script>

{#if anchorWorldPos}
  <HTML transform={false} center portal={document.body} pointerEvents="none" position={anchorWorldPos}>
    <div bind:this={anchorEl} class="iso-leader-anchor"></div>
    {#if line}
      <svg class="iso-leader-svg" aria-hidden="true" focusable="false">
        <line x1={0} y1={0} x2={line.x2} y2={line.y2} />
      </svg>
    {/if}
  </HTML>
{/if}

<style>
  .iso-leader-anchor {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
  }

  .iso-leader-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
  }

  .iso-leader-svg line {
    stroke: var(--accent, #ff5a1f);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
</style>
