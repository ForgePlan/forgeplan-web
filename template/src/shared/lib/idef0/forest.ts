import { compactTierMap, typeTier } from "@/shared/lib/tier";
import { compareCanonical, serialiseKey } from "./keys";
import type {
  CompositeKey,
  DecompForest,
  DecompInput,
  DerivedLink,
  ForestNode,
  TierStackForest,
} from "./types";

function pushInto<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

/**
 * Derive the decomposition forest from `refines` edges only (INV-2: `informs`
 * and every other relation never create a tree edge). Guarantees ≤1 structural
 * parent per node (INV-4) by a deterministic tier-then-key tie-break on
 * multi-parent nodes (E-MULTI-PARENT → derived secondary links) and a
 * lexicographically-lowest-key cycle break (E-CYCLE). Pure & order-invariant.
 */
export function buildDecompForest(input: DecompInput): DecompForest {
  const kindByKey = new Map<string, string>();
  const nodeByKey = new Map<string, CompositeKey>();
  for (const n of input.nodes) {
    const ks = serialiseKey(n.key);
    kindByKey.set(ks, n.kind);
    nodeByKey.set(ks, n.key);
  }
  const kindOf = (k: CompositeKey): string =>
    kindByKey.get(serialiseKey(k)) ?? "";

  // Phase 1 — refines-parent candidates (from refines to ⇒ `to` is the parent).
  const parentCandidates = new Map<string, CompositeKey[]>();
  for (const e of input.edges) {
    if (e.relation !== "refines") continue;
    const childKs = serialiseKey(e.from);
    if (!nodeByKey.has(childKs) || !nodeByKey.has(serialiseKey(e.to))) continue;
    pushInto(parentCandidates, childKs, e.to);
  }

  // Phase 2 — one structural parent per node; extras become derived (INV-4).
  const chosenParent = new Map<string, CompositeKey | null>();
  const derivedLinks: DerivedLink[] = [];
  for (const n of input.nodes) {
    const ks = serialiseKey(n.key);
    const cands = parentCandidates.get(ks) ?? [];
    if (cands.length === 0) {
      chosenParent.set(ks, null);
      continue;
    }
    // Distinct parents only — a duplicate refines edge must not demote a node's
    // sole parent into a phantom E-MULTI-PARENT derived link (INV-4).
    const seenCand = new Set<string>();
    const uniqueCands: CompositeKey[] = [];
    for (const c of cands) {
      const cks = serialiseKey(c);
      if (seenCand.has(cks)) continue;
      seenCand.add(cks);
      uniqueCands.push(c);
    }
    const sorted = uniqueCands.sort((a, b) => compareCanonical(a, b, kindOf));
    chosenParent.set(ks, sorted[0] ?? null);
    for (let i = 1; i < sorted.length; i++) {
      const to = sorted[i];
      if (to) {
        derivedLinks.push({
          from: n.key,
          to,
          provenance: "derived",
          reason: "E-MULTI-PARENT",
        });
      }
    }
  }

  // Phase 3 — break refines cycles at the lexicographically-lowest key (E-CYCLE).
  const visited = new Set<string>();
  for (const n of input.nodes) {
    const start = serialiseKey(n.key);
    if (visited.has(start)) continue;
    const path: string[] = [];
    const pathIdx = new Map<string, number>();
    let current: string | null = start;
    while (current !== null && !visited.has(current)) {
      if (pathIdx.has(current)) {
        const cycle = path.slice(pathIdx.get(current)!);
        let breakKey = cycle[0]!;
        for (const c of cycle) if (c < breakKey) breakKey = c;
        const saved = chosenParent.get(breakKey) ?? null;
        chosenParent.set(breakKey, null);
        const brokenChild = nodeByKey.get(breakKey);
        if (saved && brokenChild) {
          derivedLinks.push({
            from: brokenChild,
            to: saved,
            provenance: "derived",
            reason: "E-CYCLE",
          });
        }
        break;
      }
      pathIdx.set(current, path.length);
      path.push(current);
      const p: CompositeKey | null = chosenParent.get(current) ?? null;
      current = p ? serialiseKey(p) : null;
    }
    for (const p of path) visited.add(p);
  }

  // Phase 4 — children map (canonical-sorted for determinism).
  const childrenMap = new Map<string, CompositeKey[]>();
  for (const n of input.nodes) {
    const p = chosenParent.get(serialiseKey(n.key));
    if (p) pushInto(childrenMap, serialiseKey(p), n.key);
  }
  for (const arr of childrenMap.values()) {
    arr.sort((a, b) => compareCanonical(a, b, kindOf));
  }

  // Phase 5 — ForestNode map + roots.
  const nodes = new Map<string, ForestNode>();
  const roots: CompositeKey[] = [];
  for (const n of input.nodes) {
    const ks = serialiseKey(n.key);
    const parent = chosenParent.get(ks) ?? null;
    nodes.set(ks, {
      key: n.key,
      kind: n.kind,
      tier: typeTier(n.kind),
      parent,
      children: childrenMap.get(ks) ?? [],
      provenance: "real",
      number: null,
      idCollision: n.idCollision,
      degradedKey: n.degradedKey,
    });
    if (parent === null) roots.push(n.key);
  }
  roots.sort((a, b) => compareCanonical(a, b, kindOf));

  // Canonical order for derivedLinks so the forest is byte-identical under
  // input reordering (INV-8), matching roots/children.
  derivedLinks.sort((a, b) => {
    const byFrom = compareCanonical(a.from, b.from, kindOf);
    if (byFrom !== 0) return byFrom;
    const byTo = compareCanonical(a.to, b.to, kindOf);
    if (byTo !== 0) return byTo;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });

  return { roots, nodes, mode: "idef0", provenance: "real", derivedLinks };
}

/**
 * The honest fallback (INV-6): stack nodes by compactTierMap tier. Every
 * element is derived (INV-5) — tier membership is inferred, not authored.
 */
export function buildTierStackForest(input: DecompInput): TierStackForest {
  const present = new Set<string>();
  for (const n of input.nodes) present.add(n.kind);
  const tierMap = compactTierMap(present);

  const tierToMembers = new Map<number, CompositeKey[]>();
  const kindByTier = new Map<number, string>();
  for (const n of input.nodes) {
    const t = tierMap.get(n.kind) ?? tierMap.size;
    pushInto(tierToMembers, t, n.key);
    if (!kindByTier.has(t)) kindByTier.set(t, n.kind);
  }

  const tiers = [...tierToMembers.keys()]
    .sort((a, b) => a - b)
    .map((t) => {
      const members = [...tierToMembers.get(t)!].sort((a, b) => {
        const sa = serialiseKey(a);
        const sb = serialiseKey(b);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
      });
      return { tier: t, kind: kindByTier.get(t) ?? "", members };
    });

  return { tiers, mode: "tier-stack", provenance: "derived" };
}
