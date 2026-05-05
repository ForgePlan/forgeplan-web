import "d3-transition";

export { select, type Selection } from "d3-selection";
export {
  zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";

export function isLinkResolved<N extends { id: string }>(l: {
  source: string | N;
  target: string | N;
}): l is { source: N; target: N } {
  return typeof l.source === "object" && typeof l.target === "object";
}
