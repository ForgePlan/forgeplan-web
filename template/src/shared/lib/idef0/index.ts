import { computeIdef0Diagram, computeTierStackDiagram } from "./diagram";
import { buildDecompForest, buildTierStackForest } from "./forest";
import { assignNodeNumbers } from "./numbering";
import { densityGate } from "./density";
import { port } from "./port";
import { classifyIcom, isCanonicalRelation } from "./relation";
import { flattenOutline } from "./outline";
import { structuralSignature } from "./signature";
import type {
  ClassifiedEdge,
  CompositeKey,
  DecompForest,
  DecompInput,
  DensityVerdict,
  Idef0Diagram,
  OutlineRow,
  RawSnapshot,
  TierStackForest,
  Window,
} from "./types";

export * from "./types";
export { port } from "./port";
export { buildDecompForest, buildTierStackForest } from "./forest";
export { assignNodeNumbers } from "./numbering";
export {
  classifyIcom,
  icomToSide,
  isCanonicalRelation,
  CANONICAL_RELATIONS,
} from "./relation";
export { densityGate, densityMetric } from "./density";
export { structuralSignature } from "./signature";
export { flattenOutline } from "./outline";
export { computeIdef0Diagram, computeTierStackDiagram } from "./diagram";
export { serialiseKey } from "./keys";

export interface DeriveOptions {
  threshold: number;
  focus?: CompositeKey | null;
  window?: Window;
  takenAt?: string;
}

export interface DeriveResult {
  input: DecompInput;
  forest: DecompForest;
  tierStack: TierStackForest;
  verdict: DensityVerdict;
  /** Non-null in BOTH modes (I-12). */
  diagram: Idef0Diagram;
  outline: OutlineRow[];
  signature: string;
}

/** Classify every authored edge; a non-canonical relation is surfaced as
 * `derived` (E-UNKNOWN) — never dropped, never a tree edge (INV-3). */
export function classifyEdges(input: DecompInput): ClassifiedEdge[] {
  return input.edges.map((e) => ({
    from: e.from,
    to: e.to,
    relation: e.relation,
    icom: classifyIcom(e.relation),
    provenance: isCanonicalRelation(e.relation) ? "real" : "derived",
  }));
}

/**
 * The full TADD pipeline (SPEC-004 frozen order). Pure & deterministic: same
 * RawSnapshot + options ⇒ identical result. `diagram` is non-null in both the
 * dense (`idef0`) and honest-fallback (`tier-stack`) modes.
 */
export function deriveIdef0(
  raw: RawSnapshot,
  opts: DeriveOptions,
): DeriveResult {
  const input = port(raw, opts.threshold, opts.takenAt);
  const forest = buildDecompForest(input);
  assignNodeNumbers(forest);
  const tierStack = buildTierStackForest(input);
  const verdict = densityGate(input, forest);
  const classified = classifyEdges(input);
  const diagram =
    verdict.mode === "idef0"
      ? computeIdef0Diagram(forest, classified, opts.focus ?? null, opts.window)
      : computeTierStackDiagram(tierStack, opts.window);
  const outline = flattenOutline(forest, opts.window);
  const signature = structuralSignature(forest);
  return { input, forest, tierStack, verdict, diagram, outline, signature };
}
