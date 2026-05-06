import type { GraphView } from "@/shared/config";
import {
  MAX_LEAVES,
  MAX_SPLIT_PCT,
  MIN_SPLIT_PCT,
  type DropEdge,
  type Layout,
  type Leaf,
  type MosaicNode,
  type Split,
} from "./types";

export function emptyLayout(): Layout {
  return { root: null, nextId: 1 };
}

export function singletonLayout(view: GraphView): Layout {
  return { root: { kind: "leaf", id: "leaf-1", view }, nextId: 2 };
}

export function countLeaves(node: MosaicNode | null): number {
  if (!node) return 0;
  if (node.kind === "leaf") return 1;
  return countLeaves(node.children[0]) + countLeaves(node.children[1]);
}

export function leaves(node: MosaicNode | null): Leaf[] {
  if (!node) return [];
  if (node.kind === "leaf") return [node];
  return [...leaves(node.children[0]), ...leaves(node.children[1])];
}

export function findLeaf(node: MosaicNode | null, id: string): Leaf | null {
  if (!node) return null;
  if (node.kind === "leaf") return node.id === id ? node : null;
  return findLeaf(node.children[0], id) ?? findLeaf(node.children[1], id);
}

function mintLeafId(layout: Layout): { id: string; nextId: number } {
  return { id: `leaf-${layout.nextId}`, nextId: layout.nextId + 1 };
}

function makeSplitForEdge(
  existing: MosaicNode,
  newLeaf: Leaf,
  edge: DropEdge,
): Split {
  // edge is the side of `existing` where the new leaf lands.
  const isHoriz = edge === "left" || edge === "right";
  const orientation = isHoriz ? "row" : "col";
  const newFirst = edge === "left" || edge === "top";
  const children: [MosaicNode, MosaicNode] = newFirst
    ? [newLeaf, existing]
    : [existing, newLeaf];
  return { kind: "split", orientation, sizes: [50, 50], children };
}

function replaceNode(
  root: MosaicNode,
  targetId: string,
  replacement: MosaicNode,
): MosaicNode {
  if (root.kind === "leaf") {
    return root.id === targetId ? replacement : root;
  }
  return {
    ...root,
    children: [
      replaceNode(root.children[0], targetId, replacement),
      replaceNode(root.children[1], targetId, replacement),
    ],
  };
}

export function addLeaf(
  layout: Layout,
  view: GraphView,
  target?: { leafId: string; edge: DropEdge },
): Layout {
  if (countLeaves(layout.root) >= MAX_LEAVES) return layout;
  const { id, nextId } = mintLeafId(layout);
  const newLeaf: Leaf = { kind: "leaf", id, view };

  if (!layout.root) {
    return { root: newLeaf, nextId };
  }

  if (target) {
    const found = findLeaf(layout.root, target.leafId);
    if (!found) return layout;
    if (target.edge === "center") {
      // Replace the leaf's view (rare; treat as add-by-replace) — we
      // don't get here from drag because center = swap, not add.
      const replaced: Leaf = { ...found, view };
      return {
        root: replaceNode(layout.root, target.leafId, replaced),
        nextId: layout.nextId,
      };
    }
    const split = makeSplitForEdge(found, newLeaf, target.edge);
    return {
      root: replaceNode(layout.root, target.leafId, split),
      nextId,
    };
  }

  // Default: append to the right of the right-most leaf, splitting
  // the root into a horizontal split with autolayout (1/N share).
  const totalLeaves = countLeaves(layout.root) + 1;
  const newShare = Math.round((100 / totalLeaves) * 10) / 10;
  const split: Split = {
    kind: "split",
    orientation: "row",
    sizes: [round1(100 - newShare), newShare],
    children: [layout.root, newLeaf],
  };
  return { root: split, nextId };
}

export function removeLeaf(layout: Layout, leafId: string): Layout {
  if (!layout.root) return layout;
  if (layout.root.kind === "leaf") {
    return layout.root.id === leafId
      ? { root: null, nextId: layout.nextId }
      : layout;
  }
  const next = stripLeaf(layout.root, leafId);
  return { root: next, nextId: layout.nextId };
}

function stripLeaf(node: MosaicNode, leafId: string): MosaicNode | null {
  if (node.kind === "leaf") return node.id === leafId ? null : node;
  const left = stripLeaf(node.children[0], leafId);
  const right = stripLeaf(node.children[1], leafId);
  if (left === null && right === null) return null;
  if (left === null) return right;
  if (right === null) return left;
  return { ...node, children: [left, right] };
}

export function swapViews(layout: Layout, aId: string, bId: string): Layout {
  if (aId === bId || !layout.root) return layout;
  const a = findLeaf(layout.root, aId);
  const b = findLeaf(layout.root, bId);
  if (!a || !b) return layout;
  const root = swapInTree(layout.root, aId, bId, a.view, b.view);
  return { root, nextId: layout.nextId };
}

function swapInTree(
  node: MosaicNode,
  aId: string,
  bId: string,
  aView: GraphView,
  bView: GraphView,
): MosaicNode {
  if (node.kind === "leaf") {
    if (node.id === aId) return { ...node, view: bView };
    if (node.id === bId) return { ...node, view: aView };
    return node;
  }
  return {
    ...node,
    children: [
      swapInTree(node.children[0], aId, bId, aView, bView),
      swapInTree(node.children[1], aId, bId, aView, bView),
    ],
  };
}

export function setSplitSize(
  layout: Layout,
  path: number[],
  newFirstPct: number,
): Layout {
  if (!layout.root) return layout;
  const clamped = clampSplit(newFirstPct);
  const next = updateSplitAt(layout.root, path, clamped);
  return { root: next, nextId: layout.nextId };
}

function updateSplitAt(
  node: MosaicNode,
  path: number[],
  newFirstPct: number,
): MosaicNode {
  if (node.kind === "leaf") return node;
  if (path.length === 0) {
    return {
      ...node,
      sizes: [round1(newFirstPct), round1(100 - newFirstPct)],
    };
  }
  const head = path[0];
  if (head !== 0 && head !== 1) return node;
  const rest = path.slice(1);
  const child = node.children[head];
  const updatedChild = updateSplitAt(child, rest, newFirstPct);
  const children: [MosaicNode, MosaicNode] =
    head === 0
      ? [updatedChild, node.children[1]]
      : [node.children[0], updatedChild];
  return { ...node, children };
}

export function changeView(
  layout: Layout,
  leafId: string,
  view: GraphView,
): Layout {
  if (!layout.root) return layout;
  const root = mapLeaves(layout.root, (l) =>
    l.id === leafId ? { ...l, view } : l,
  );
  return { root, nextId: layout.nextId };
}

function mapLeaves(node: MosaicNode, fn: (l: Leaf) => Leaf): MosaicNode {
  if (node.kind === "leaf") return fn(node);
  return {
    ...node,
    children: [mapLeaves(node.children[0], fn), mapLeaves(node.children[1], fn)],
  };
}

export function clampSplit(pct: number): number {
  if (!Number.isFinite(pct)) return 50;
  if (pct < MIN_SPLIT_PCT) return MIN_SPLIT_PCT;
  if (pct > MAX_SPLIT_PCT) return MAX_SPLIT_PCT;
  return round1(pct);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function isValidLayout(layout: unknown): layout is Layout {
  if (!layout || typeof layout !== "object") return false;
  const l = layout as Partial<Layout>;
  if (typeof l.nextId !== "number" || l.nextId < 1) return false;
  if (l.root === null) return true;
  return isValidNode(l.root);
}

function isValidNode(node: unknown): node is MosaicNode {
  if (!node || typeof node !== "object") return false;
  const n = node as { kind?: string };
  if (n.kind === "leaf") {
    const leaf = node as Partial<Leaf>;
    return typeof leaf.id === "string" && typeof leaf.view === "string";
  }
  if (n.kind === "split") {
    const s = node as Partial<Split>;
    if (s.orientation !== "row" && s.orientation !== "col") return false;
    if (!Array.isArray(s.sizes) || s.sizes.length !== 2) return false;
    if (!s.sizes.every((v) => typeof v === "number" && Number.isFinite(v))) {
      return false;
    }
    if (Math.abs(s.sizes[0] + s.sizes[1] - 100) > 0.5) return false;
    if (!Array.isArray(s.children) || s.children.length !== 2) return false;
    return isValidNode(s.children[0]) && isValidNode(s.children[1]);
  }
  return false;
}
