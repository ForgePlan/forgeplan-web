<script lang="ts">
  import type { MapNode, Point } from "@/entities/map";
  import { kindColor, KIND_COLORS } from "@/entities/artifact/lib/theme";

  let {
    node,
    pos,
    dims,
    highlightedIds = null,
    drillable = false,
  }: {
    node: MapNode;
    pos: Point;
    dims: { card_w: number; card_h: number };
    highlightedIds?: ReadonlySet<string> | null;
    drillable?: boolean;
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

  // SVG <text> has no CSS ellipsis, and real generated maps put long
  // descriptions in `meta` (measured: up to 146 chars in a 190px card —
  // 5x overflow), so cards spill across zones. Truncate to a char budget
  // derived from card width (mono ~6px/char at 10px, sans ~6.6px/char at
  // 12px) with an ellipsis; the full text lives in the <title> tooltip.
  const labelMax = $derived(Math.max(6, Math.floor((dims.card_w - 20) / 6.6)));
  const subMax = $derived(Math.max(6, Math.floor((dims.card_w - 20) / 6.0)));
  function truncate(s: string, maxChars: number): string {
    return s.length > maxChars ? s.slice(0, Math.max(1, maxChars - 1)) + "…" : s;
  }
  const displayLabel = $derived(truncate(node.label, labelMax));
  const displaySub = $derived(truncate(subLine, subMax));
  const fullText = $derived(node.label + (node.meta ? ` — ${node.meta}` : ""));

  // Flow highlight (RFC-030:109; EVID-089 1.B): a node dims when a flow is
  // active and it is NOT in the flow, and lights (clay stroke) when it IS.
  const flowing = $derived(!!highlightedIds && highlightedIds.size > 0);
  const isDimmed = $derived(flowing && !highlightedIds!.has(node.id));
  const isLit = $derived(flowing && highlightedIds!.has(node.id));
</script>

<g
  class="node-card"
  class:dimmed={isDimmed}
  class:lit={isLit}
  class:drillable
  transform="translate({pos.x},{pos.y})"
>
  <title>{fullText}</title>
  <rect
    class="card-bg"
    width={dims.card_w}
    height={dims.card_h}
    rx="4"
    style:stroke={isLit ? "var(--map-clay)" : borderColor}
  />
  <text class="card-label" x="10" y="20">{displayLabel}</text>
  <text class="card-sub" x="10" y="37">{displaySub}</text>
  {#if drillable}
    <text
      class="expand-glyph"
      x={dims.card_w - 8}
      y="14"
      text-anchor="end"
      aria-hidden="true">⊕</text
    >
  {/if}
</g>

<style>
  .node-card {
    transition: opacity 160ms ease-out;
  }

  .node-card.dimmed {
    opacity: 0.24;
  }

  .card-bg {
    fill: var(--bg-2);
    stroke-width: 1.5;
    transition: stroke 160ms ease-out;
  }

  .node-card.lit .card-bg {
    stroke-width: 2.4;
  }

  /* Drillable (mega/collapsed) affordance — clicking the card itself
     descends, same as an empty-zone click; the dashed border echoes the
     dashed treatment already used for zone containers. */
  .node-card.drillable {
    cursor: pointer;
  }

  .node-card.drillable .card-bg {
    stroke-dasharray: 5 3;
  }

  .node-card.drillable:hover .card-bg {
    stroke: var(--accent);
    stroke-width: 2.4;
  }

  .expand-glyph {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--fg-3);
    pointer-events: none;
    transition: fill 160ms ease-out;
  }

  .node-card.drillable:hover .expand-glyph {
    fill: var(--accent);
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
