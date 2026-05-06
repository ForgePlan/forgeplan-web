import type { GraphView } from "@/shared/config";

export type Orientation = "row" | "col";
export type DropEdge = "left" | "right" | "top" | "bottom" | "center";

export interface Leaf {
  kind: "leaf";
  id: string;
  view: GraphView;
}

export interface Split {
  kind: "split";
  orientation: Orientation;
  sizes: [number, number];
  children: [MosaicNode, MosaicNode];
}

export type MosaicNode = Leaf | Split;

export interface Layout {
  root: MosaicNode | null;
  nextId: number;
}

export const MAX_LEAVES = 4;
export const MIN_SPLIT_PCT = 10;
export const MAX_SPLIT_PCT = 90;
