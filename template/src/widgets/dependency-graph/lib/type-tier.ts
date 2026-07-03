// typeTier + compactTierMap lifted to @/shared/lib/tier (ADR-006 / SPEC-004
// INV-1); re-exported here so existing consumers (tree-layout, sankey-layout,
// sunburst-layout) keep importing from ./type-tier unchanged.
export { typeTier, compactTierMap } from "@/shared/lib/tier";

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
