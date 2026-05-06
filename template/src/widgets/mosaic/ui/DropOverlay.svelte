<script lang="ts">
  import type { DropEdge } from "../model/types";
  import { highlightStyle } from "../lib/drag";

  let {
    edge,
    label,
  }: {
    edge: DropEdge;
    label: string;
  } = $props();

  const style = $derived(highlightStyle(edge));
</script>

<div
  class="overlay"
  class:swap={edge === "center"}
  style:left={style.left}
  style:top={style.top}
  style:width={style.width}
  style:height={style.height}
>
  <span class="hint">{label}</span>
</div>

<style>
  .overlay {
    position: absolute;
    pointer-events: none;
    background: var(--accent-dim);
    border: 2px dashed var(--accent);
    box-sizing: border-box;
    transition: all 80ms ease-out;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }
  .overlay.swap {
    border-style: solid;
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    background: var(--bg);
    padding: 2px 8px;
    border: 1px solid var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  @media (prefers-reduced-motion: reduce) {
    .overlay {
      transition: none;
    }
  }
</style>
