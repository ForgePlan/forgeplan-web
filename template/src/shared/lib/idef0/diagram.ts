import { compareCanonical, serialiseKey } from "./keys";
import { icomToSide } from "./relation";
import type {
  ClassifiedEdge,
  CompositeKey,
  DecompForest,
  DiagramArrow,
  DiagramBox,
  Idef0Diagram,
  IcomLegend,
  TierStackForest,
  Window,
} from "./types";

const MAX_BOXES = 6;

const LEGEND: IcomLegend = {
  roles: ["input", "control", "output", "mechanism", "decomposition"],
  honestyKey: { real: "solid", derived: "dashed ≈" },
};

function boxFor(key: CompositeKey, forest: DecompForest): DiagramBox {
  const node = forest.nodes.get(serialiseKey(key));
  return {
    key,
    number: node?.number ?? "?",
    kind: node?.kind ?? "",
    provenance: node?.provenance ?? "real",
  };
}

function capChildren(
  keys: CompositeKey[],
  forest: DecompForest,
  parentNumber: string,
): DiagramBox[] {
  if (keys.length <= MAX_BOXES) return keys.map((k) => boxFor(k, forest));
  const shown = keys.slice(0, MAX_BOXES - 1).map((k) => boxFor(k, forest));
  shown.push({
    key: { id: "__rollup__", title: parentNumber },
    number: parentNumber + ".+",
    kind: "rollup",
    provenance: "derived",
    rollupCount: keys.length - (MAX_BOXES - 1),
  });
  return shown;
}

/**
 * Materialise ONE decomposition level (F2 / I-14): the focus node (context/ghost
 * box) + its ≤6 sorted children, with a mega-node rollup ("+N more") for >6; or
 * the ≤6 top roots when focus is null. The bounded box count is the O(1)-DOM
 * guarantee regardless of N. Arrows = the non-tree ICOM edges incident to the
 * level (decomposition edges are implicit in the box nesting).
 */
export function computeIdef0Diagram(
  forest: DecompForest,
  classifiedEdges: readonly ClassifiedEdge[],
  focus: CompositeKey | null,
  _window?: Window,
): Idef0Diagram {
  const kindOf = (k: CompositeKey): string =>
    forest.nodes.get(serialiseKey(k))?.kind ?? "";

  const boxes: DiagramBox[] = [];
  const focusNode = focus ? forest.nodes.get(serialiseKey(focus)) : undefined;
  let childKeys: CompositeKey[];
  if (focus && focusNode) {
    boxes.push(boxFor(focus, forest));
    childKeys = [...focusNode.children];
  } else {
    childKeys = [...forest.roots];
  }
  childKeys.sort((a, b) => compareCanonical(a, b, kindOf));
  const parentNumber = focusNode?.number ?? "A0";
  for (const b of capChildren(childKeys, forest, parentNumber)) boxes.push(b);

  const inLevel = new Set(
    boxes.filter((b) => b.kind !== "rollup").map((b) => serialiseKey(b.key)),
  );
  const arrows: DiagramArrow[] = [];
  for (const e of classifiedEdges) {
    if (e.icom === "decomposition") continue;
    if (inLevel.has(serialiseKey(e.from)) || inLevel.has(serialiseKey(e.to))) {
      arrows.push({ edge: e, side: icomToSide(e.icom) });
    }
  }

  return { boxes, arrows, legend: LEGEND, mode: "idef0", focus };
}

/**
 * The non-null tier-stack diagram (I-12 / SPEC-004 Scenario 3): tier members as
 * boxes (≤6 per tier + rollup), every element derived (INV-5), no real ICOM
 * arrows. INV-10 holds in the fallback — a host renders it from the diagram
 * alone. This is the DEFAULT render on today's sparse data (S-1 reframe).
 */
export function computeTierStackDiagram(
  stack: TierStackForest,
  _window?: Window,
): Idef0Diagram {
  const boxes: DiagramBox[] = [];
  for (const t of stack.tiers) {
    const shownMembers =
      t.members.length <= MAX_BOXES
        ? t.members
        : t.members.slice(0, MAX_BOXES - 1);
    shownMembers.forEach((k, i) => {
      boxes.push({
        key: k,
        number: `T${t.tier}.${i + 1}`,
        kind: t.kind,
        provenance: "derived",
      });
    });
    if (t.members.length > MAX_BOXES) {
      boxes.push({
        key: { id: "__rollup__", title: `T${t.tier}` },
        number: `T${t.tier}.+`,
        kind: "rollup",
        provenance: "derived",
        rollupCount: t.members.length - (MAX_BOXES - 1),
      });
    }
  }
  return { boxes, arrows: [], legend: LEGEND, mode: "tier-stack", focus: null };
}
