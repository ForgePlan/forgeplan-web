import { compareCanonical, serialiseKey } from "./keys";
import type { CompositeKey, DecompForest, OutlineRow, Window } from "./types";

/**
 * Pre-order, deterministic outline of the forest. With a `window` the DFS
 * emits at most `limit` rows (skipping `offset`) and stops early — so a
 * virtual-list host renders a bounded row set regardless of N (F2 / I-14,
 * the outline half of the O(1)-DOM contract).
 */
export function flattenOutline(
  forest: DecompForest,
  window?: Window,
): OutlineRow[] {
  const kindOf = (k: CompositeKey): string =>
    forest.nodes.get(serialiseKey(k))?.kind ?? "";
  const offset = window?.offset ?? 0;
  const limit = window?.limit ?? Number.POSITIVE_INFINITY;

  const emitted: OutlineRow[] = [];
  let index = 0;

  const walk = (key: CompositeKey, depth: number): boolean => {
    const node = forest.nodes.get(serialiseKey(key));
    if (!node) return true;
    if (index >= offset && emitted.length < limit) {
      emitted.push({
        number: node.number,
        key: node.key,
        depth,
        kind: node.kind,
        provenance: node.provenance,
      });
    }
    index++;
    if (emitted.length >= limit) return false;
    const sortedChildren = [...node.children].sort((a, b) =>
      compareCanonical(a, b, kindOf),
    );
    for (const child of sortedChildren) {
      if (!walk(child, depth + 1)) return false;
    }
    return true;
  };

  const sortedRoots = [...forest.roots].sort((a, b) =>
    compareCanonical(a, b, kindOf),
  );
  for (const root of sortedRoots) {
    if (!walk(root, 0)) break;
  }
  return emitted;
}
