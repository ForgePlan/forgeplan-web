<script lang="ts">
  import type { MapNode, Point } from "@/entities/map";
  import { kindColor, KIND_COLORS } from "@/entities/artifact/lib/theme";

  let {
    node,
    pos,
    dims,
    highlightedIds = null,
  }: {
    node: MapNode;
    pos: Point;
    dims: { card_w: number; card_h: number };
    highlightedIds?: ReadonlySet<string> | null;
  } = $props();

  const borderColor = $derived.by(() => {
    if (node.kind === "gate") return "var(--map-clay)";
    if (node.kind === "truth") return "var(--map-olive)";
    const known = Object.prototype.hasOwnProperty.call(
      KIND_COLORS,
      node.kind.toLowerCase(),
    );
    return known ? kindColor(node.kind) : "var(--line)";
  });

  const subLine = $derived(node.meta ?? node.kind);

  // Mirrors EdgeLayer.svelte's dimmed-when-not-in-the-active-flow pattern
  // (RFC-030:109 names NodeCard as the second highlightedIds consumer,
  // alongside EdgeLayer — EVID-089 1.B): a node dims exactly when it is NOT
  // a member of the active flow's highlighted id set.
  const isDimmed = $derived(
    !!highlightedIds && highlightedIds.size > 0 && !highlightedIds.has(node.id),
  );
</script>

<g class="node-card" class:dimmed={isDimmed} transform="translate({pos.x},{pos.y})">
  <rect
    class="card-bg"
    width={dims.card_w}
    height={dims.card_h}
    rx="4"
    style:stroke={borderColor}
  />
  <text class="card-label" x="10" y="20">{node.label}</text>
  <text class="card-sub" x="10" y="37">{subLine}</text>
</g>

<style>
  .node-card {
    transition: opacity 160ms ease-out;
  }

  .node-card.dimmed {
    opacity: 0.2;
  }

  .card-bg {
    fill: var(--bg-2);
    stroke-width: 1.5;
  }

  .card-label {
    font-family: var(--font-sans);
    font-size: 12px;
    fill: var(--fg-1);
    pointer-events: none;
  }

  .card-sub {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--fg-3);
    pointer-events: none;
  }
</style>
