<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Leaf, MosaicNode } from "../model/types";
  import Splitter from "./Splitter.svelte";
  import Self from "./MosaicNodeView.svelte";

  let {
    node,
    path,
    onResize,
    leafSnippet,
  }: {
    node: MosaicNode;
    path: number[];
    onResize: (path: number[], pct: number) => void;
    leafSnippet: Snippet<[Leaf]>;
  } = $props();
</script>

{#if node.kind === "leaf"}
  {@render leafSnippet(node)}
{:else if node.orientation === "row"}
  <div
    class="split row"
    style:grid-template-columns={`${node.sizes[0]}% 0px ${node.sizes[1]}%`}
  >
    <div class="cell">
      <Self node={node.children[0]} path={[...path, 0]} {onResize} {leafSnippet} />
    </div>
    <Splitter
      orientation="row"
      pct={node.sizes[0]}
      onResize={(p) => onResize(path, p)}
    />
    <div class="cell">
      <Self node={node.children[1]} path={[...path, 1]} {onResize} {leafSnippet} />
    </div>
  </div>
{:else}
  <div
    class="split col"
    style:grid-template-rows={`${node.sizes[0]}% 0px ${node.sizes[1]}%`}
  >
    <div class="cell">
      <Self node={node.children[0]} path={[...path, 0]} {onResize} {leafSnippet} />
    </div>
    <Splitter
      orientation="col"
      pct={node.sizes[0]}
      onResize={(p) => onResize(path, p)}
    />
    <div class="cell">
      <Self node={node.children[1]} path={[...path, 1]} {onResize} {leafSnippet} />
    </div>
  </div>
{/if}

<style>
  .split {
    display: grid;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .split.row {
    grid-template-rows: 100%;
  }
  .split.col {
    grid-template-columns: 100%;
  }
  .cell {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
