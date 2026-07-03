import { serialiseKey } from "./keys";
import type { DecompForest } from "./types";

/**
 * Order-independent shape hash (INV-8): collect the set of structural facts
 * (roots + parent→child edges + kind/tier of each node), sort them into a
 * canonical byte sequence, then FNV-1a. Equal DecompInput ⇒ equal signature,
 * regardless of input array order. Deterministic, no wall-clock/randomness.
 */
export function structuralSignature(forest: DecompForest): string {
  const tokens: string[] = [];
  for (const [ks, node] of forest.nodes) {
    if (node.parent === null) tokens.push("R:" + ks + ":" + node.kind);
    else tokens.push("E:" + serialiseKey(node.parent) + ">" + ks);
    tokens.push("N:" + ks + ":" + node.kind + ":" + node.tier);
  }
  tokens.sort();
  return fnv1a(tokens.join("\n"));
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via Math.imul; >>> 0 keeps it unsigned.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
