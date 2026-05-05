// TODO(fsd-cleanup): consumers should import from '@/entities/graph' directly;
// this re-export keeps existing graph-view imports stable while the store
// has moved down to the entities layer so widgets/insights-rail and
// widgets/artifact-panel can drive hover too.
export {
  highlight,
  setHovered,
  clearHovered,
  setImpactRoot,
  impactedClass,
  edgeClass,
  bfsDistances,
  nodeClass,
  type HighlightEdge,
} from "@/entities/graph";
