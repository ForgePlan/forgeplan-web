import { compareCanonical, serialiseKey } from "./keys";
import type { CompositeKey, DecompForest } from "./types";

/**
 * Assign IDEF0 A-numbers (A1, A1.1, …) in-place. Order-invariant (INV-7): the
 * number a node receives depends only on tree structure + the canonical sort
 * `[typeTier(kind), serialiseKey]` applied at every level — never on input
 * array order. Identical node/edge sets ⇒ identical numbers across polls.
 */
export function assignNodeNumbers(forest: DecompForest): void {
  const kindOf = (k: CompositeKey): string =>
    forest.nodes.get(serialiseKey(k))?.kind ?? "";

  const sortedRoots = [...forest.roots].sort((a, b) =>
    compareCanonical(a, b, kindOf),
  );
  sortedRoots.forEach((rootKey, i) => {
    assignDFS(rootKey, "A" + (i + 1), forest, kindOf);
  });
}

function assignDFS(
  key: CompositeKey,
  num: string,
  forest: DecompForest,
  kindOf: (k: CompositeKey) => string,
): void {
  const node = forest.nodes.get(serialiseKey(key));
  if (!node) return;
  node.number = num;
  const sortedChildren = [...node.children].sort((a, b) =>
    compareCanonical(a, b, kindOf),
  );
  sortedChildren.forEach((childKey, j) => {
    assignDFS(childKey, num + "." + (j + 1), forest, kindOf);
  });
}
