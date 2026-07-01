import type { IcomClass, IcomSide, Relation } from "./types";

/**
 * The canonical forgeplan relations the core knows (ADR-007 / SPEC-004 INV-3).
 * A drift guard test asserts this equals the live `forgeplan_link` enum, so a
 * NEW upstream relation fails CI instead of silently hitting E-UNKNOWN (S-3 /
 * RFC-028 I-13). This is a LOCAL table — it never mutates or reads the shared
 * widget `HIERARCHY_RELATIONS` (INV-9).
 */
export const CANONICAL_RELATIONS: readonly Relation[] = [
  "informs",
  "based_on",
  "supersedes",
  "contradicts",
  "refines",
] as const;

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_RELATIONS);

export function isCanonicalRelation(relation: string): relation is Relation {
  return CANONICAL_SET.has(relation.toLowerCase());
}

/**
 * relation → ICOM class at the target box (ADR-007 Q2). Every canonical
 * relation has an explicit case (INV-3, no default fallthrough for them):
 *   refines     → decomposition  (structural tree edge)
 *   informs     → mechanism      (INV-2: bottom, NEVER a tree edge)
 *   based_on    → input          (consumed foundation)
 *   supersedes  → control        (governs the target's lifecycle)
 *   contradicts → control        (governing caveat; residual fit — see ADR-007)
 * A non-canonical relation → a defined, non-structural `input` (E-UNKNOWN),
 * surfaced via the edge's provenance, never null / never a tree edge.
 */
export function classifyIcom(relation: string): IcomClass {
  switch (relation.toLowerCase()) {
    case "refines":
      return "decomposition";
    case "informs":
      return "mechanism";
    case "based_on":
      return "input";
    case "supersedes":
      return "control";
    case "contradicts":
      return "control";
    default:
      return "input";
  }
}

export function icomToSide(icom: IcomClass): IcomSide {
  switch (icom) {
    case "input":
      return "left";
    case "control":
      return "top";
    case "output":
      return "right";
    case "mechanism":
      return "bottom";
    default:
      return "left";
  }
}
