import type { Component } from "svelte";
import Share2 from "@lucide/svelte/icons/share-2";
import ListTree from "@lucide/svelte/icons/list-tree";
import Target from "@lucide/svelte/icons/target";
import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
import Columns3 from "@lucide/svelte/icons/columns-3";
import Spline from "@lucide/svelte/icons/spline";
import Donut from "@lucide/svelte/icons/donut";

type IconComponent = Component<{ size?: number | string; class?: string }>;

export interface GraphViewMeta {
  id: GraphView;
  label: string;
  hint: string;
  icon: IconComponent;
}

export const GRAPH_VIEWS: GraphViewMeta[] = [
  { id: "force", label: "Force", hint: "Physics-driven exploration", icon: Share2 },
  { id: "tree", label: "Tree", hint: "Top-down dependency hierarchy", icon: ListTree },
  { id: "radial", label: "Radial", hint: "Concentric rings by depth", icon: Target },
  { id: "matrix", label: "Matrix", hint: "Adjacency matrix sorted by kind", icon: Grid3x3 },
  { id: "lanes", label: "Lanes", hint: "Swimlanes by artifact kind", icon: Columns3 },
  { id: "sankey", label: "Sankey", hint: "Directed flow by hierarchy depth", icon: Spline },
  {
    id: "sunburst",
    label: "Sunburst",
    hint: "Nested radial hierarchy partition",
    icon: Donut,
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
