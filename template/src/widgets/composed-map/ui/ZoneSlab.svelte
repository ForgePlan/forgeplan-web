<script lang="ts">
  import type { MapZone, Rect } from "@/entities/map";

  let {
    zone,
    rect,
    selected = false,
    dimmed = false,
  }: {
    zone: MapZone;
    rect: Rect;
    selected?: boolean;
    dimmed?: boolean;
  } = $props();

  // §16 FINAL: zone.accent is a token NAME (e.g. "--map-accent-cyan"), used
  // only for a faint hover/selected stroke hint — never a fill tint, never a
  // rule bar. var()'s two-arg fallback covers accent names the current
  // palette hasn't defined yet.
  function accentVar(accent: string): string {
    const name = accent.startsWith("--") ? accent : `--${accent}`;
    return `var(${name}, var(--map-zone-line))`;
  }
</script>

<g
  class="zone-slab"
  class:selected
  class:dimmed
  style:--zone-accent={accentVar(zone.accent)}
>
  <rect
    class="zone-fill"
    x={rect.x}
    y={rect.y}
    width={rect.w}
    height={rect.h}
    rx="6"
  />
  <text class="zone-title" x={rect.x + 14} y={rect.y + 22}>{zone.label}</text>
  {#if zone.sub}
    <text class="zone-sub" x={rect.x + 14} y={rect.y + 38}>{zone.sub}</text>
  {/if}
</g>

<style>
  /* Dim whole zones while a flow is traced (spike .stage.flowing .zone). */
  .zone-slab {
    transition: opacity 160ms ease-out;
  }
  .zone-slab.dimmed {
    opacity: 0.45;
  }

  .zone-fill {
    fill: var(--map-zone);
    stroke: var(--map-zone-line);
    stroke-width: 1.5;
    stroke-dasharray: 7 4 2 4;
    transition:
      stroke 160ms ease-out,
      stroke-opacity 160ms ease-out;
  }

  .zone-slab:hover .zone-fill,
  .zone-slab.selected .zone-fill {
    stroke: var(--zone-accent);
    stroke-opacity: 0.85;
  }

  .zone-title {
    font-family: serif;
    font-size: 13px;
    fill: var(--fg-1);
    pointer-events: none;
  }

  .zone-sub {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--fg-3);
    pointer-events: none;
  }
</style>
