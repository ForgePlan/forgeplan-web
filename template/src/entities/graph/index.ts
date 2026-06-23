export type { GraphEdge, GraphResponse } from "./model/types";
export { graphPoller } from "./api/store";

export {
  highlight,
  setHovered,
  clearHovered,
  setImpactRoot,
  impactedClass,
  edgeClass,
  bfsDistances,
  nodeClass,
  adjacentToSet,
  type HighlightEdge,
} from "./lib/highlight.svelte";
export { nodeHover } from "./lib/node-hover";
