<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // Stage 3 — a11y proxy. WebGL meshes are never focusable/tabbable, so a
  // keyboard user has no way to reach the hover-only IsoNodeCard /
  // IsoLayerCard affordance. This renders one visually-hidden, focusable
  // <button> per CURRENTLY visible dwellable target (one per rendered
  // expanded plane + one per node box on it —
  // model/iso-view-state.svelte.ts#currentDwellableTargets, recomputed
  // whenever the drill/window state changes, so the list never goes stale
  // or offers a target from a collapsed sliver). Focusing one opens the
  // SAME card the pointer-hover path opens (model#focusDwell — no
  // artificial dwell delay: a keyboard user tabbing to a specific button
  // has already committed to that exact target, unlike a mouse "just
  // passing through"); blurring closes it (model#blurDwell).
  //
  // ISP/DIP: this component receives the target list + callbacks as
  // narrow, typed props — it never imports the model itself (only
  // composition roots, +page.svelte and IsoScene, do that).
  import type { IsoDwellTarget, DwellTargetSummary } from '../model/iso-view-state.svelte';

  let {
    targets,
    onFocusTarget,
    onBlurTarget,
  }: {
    targets: readonly DwellTargetSummary[];
    onFocusTarget: (target: IsoDwellTarget) => void;
    onBlurTarget: (target: IsoDwellTarget) => void;
  } = $props();

  function keyFor(entry: DwellTargetSummary): string {
    return entry.target.kind === 'node'
      ? `node:${entry.target.id}`
      : `plane:${entry.target.planeId}`;
  }
</script>

<div class="iso-a11y-proxy">
  {#each targets as entry (keyFor(entry))}
    <button
      type="button"
      class="iso-a11y-btn"
      onfocus={() => onFocusTarget(entry.target)}
      onblur={() => onBlurTarget(entry.target)}
    >
      {entry.label}
    </button>
  {/each}
</div>

<style>
  .iso-a11y-proxy {
    position: absolute;
    inset: 0;
    /* Buttons inside are individually focusable; the wrapper itself must
       never intercept a pointer (it sits on top of the whole viewport). */
    pointer-events: none;
  }

  .iso-a11y-btn {
    /* Standard visually-hidden pattern: NOT display:none / visibility:
       hidden (both remove an element from the accessibility tree and
       from the tab order) — clipped to 1x1px instead, so screen readers
       and keyboard focus still reach it. */
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
    pointer-events: auto;
  }
</style>
