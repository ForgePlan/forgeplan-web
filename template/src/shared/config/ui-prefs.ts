export interface GraphViewMeta {
  id: GraphView;
  label: string;
  hint: string;
}

export const GRAPH_VIEWS: GraphViewMeta[] = [
  { id: "force", label: "Force", hint: "Physics-driven exploration" },
  { id: "tree", label: "Tree", hint: "Top-down dependency hierarchy" },
  { id: "radial", label: "Radial", hint: "Concentric rings by depth" },
  { id: "matrix", label: "Matrix", hint: "Adjacency matrix sorted by kind" },
  { id: "lanes", label: "Lanes", hint: "Swimlanes by artifact kind" },
  { id: "sankey", label: "Sankey", hint: "Directed flow by hierarchy depth" },
  {
    id: "sunburst",
    label: "Sunburst",
    hint: "Nested radial hierarchy partition",
  },
];

export type GraphView =
  | "force"
  | "tree"
  | "radial"
  | "matrix"
  | "lanes"
  | "sankey"
  | "sunburst";

export const GRAPH_VIEW_IDS = new Set<GraphView>(GRAPH_VIEWS.map((v) => v.id));

export type InsightTab = "recent" | "agents" | "blocked" | "drafts" | "health";

export const INSIGHT_TAB_IDS = new Set<InsightTab>([
  "recent",
  "agents",
  "blocked",
  "drafts",
  "health",
]);
