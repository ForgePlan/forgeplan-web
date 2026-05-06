import { TYPE_ORDER } from "./cluster.svelte";

/**
 * Semantic tier of an artifact kind. Reuses the same TYPE_ORDER as
 * RadialView's cluster lib so all hierarchical views share one notion
 * of "abstract → concrete":
 *
 *   epic → prd → spec → rfc → adr → evidence → note → problem → solution
 *
 * Returns the index in TYPE_ORDER, or `TYPE_ORDER.length` for unknown
 * kinds (placed after the last known tier).
 */
export function typeTier(kind: string): number {
  const k = String(kind).toLowerCase();
  const idx = (TYPE_ORDER as readonly string[]).indexOf(k);
  return idx === -1 ? TYPE_ORDER.length : idx;
}

/**
 * Compact-tier mapping: only the tiers actually present in a node set
 * are kept; gaps collapse inward. So a workspace with PRD/RFC/EVID
 * gets {prd: 0, rfc: 1, evidence: 2} (no empty `spec` row), matching
 * the same convention as `computeOrbitRing` in cluster.svelte.ts.
 */
export function compactTierMap(kinds: Iterable<string>): Map<string, number> {
  const present = new Set<string>();
  for (const k of kinds) present.add(String(k).toLowerCase());
  const ordered: string[] = [];
  for (const t of TYPE_ORDER) {
    if (present.has(t)) ordered.push(t);
  }
  for (const t of present) {
    if (!ordered.includes(t)) ordered.push(t);
  }
  const out = new Map<string, number>();
  ordered.forEach((t, i) => out.set(t, i));
  return out;
}

/**
 * Hierarchy relations + which side ("from" or "to") is the more
 * abstract / parent-like side. Used to normalise edge direction so
 * the layout always flows from abstract to concrete.
 *
 *   contains    : source contains target → source is parent
 *   belongs-to  : source belongs to target → target is parent
 *   refines     : source refines target → target is parent
 *   informs     : source informs target → target is the host
 *                 (evidence supports a PRD; PRD is the parent in
 *                 the abstract-to-concrete sense, evidence is the
 *                 leaf detail)
 *   supersedes  : source supersedes target → source is the newer,
 *                 sits in the same tier; flow keeps source→target
 *                 direction (newer → older).
 */
export type HierarchyRelation =
  | "contains"
  | "belongs-to"
  | "refines"
  | "informs"
  | "supersedes";

export const HIERARCHY_RELATIONS: ReadonlySet<string> = new Set([
  "contains",
  "belongs-to",
  "refines",
  "informs",
  "supersedes",
]);

/**
 * Given a hierarchy edge, return its direction in "abstract → concrete"
 * form: parent (abstract) and child (concrete). Returns null for
 * non-hierarchy relations.
 */
export function normaliseHierarchyEdge(
  from: string,
  to: string,
  relation: string,
): { parent: string; child: string } | null {
  if (!HIERARCHY_RELATIONS.has(relation)) return null;
  switch (relation) {
    case "contains":
      return { parent: from, child: to };
    case "belongs-to":
    case "refines":
    case "informs":
      return { parent: to, child: from };
    case "supersedes":
      return { parent: from, child: to };
    default:
      return { parent: from, child: to };
  }
}
