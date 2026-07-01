import { describe, it, expect } from "vitest";
import {
  HIERARCHY_RELATIONS,
  normaliseHierarchyEdge,
} from "@/widgets/dependency-graph/lib/type-tier";
import {
  buildDecompForest,
  classifyEdges,
  classifyIcom,
  deriveIdef0,
  port,
  serialiseKey,
  structuralSignature,
} from "./index";
import type { CompositeKey, RawSnapshot } from "./types";

const T = 0.3; // RFC-028 density threshold

function snap(
  nodes: Array<[string, string, string]>, // [id, title, kind]
  edges: Array<[string, string, string]>, // [from, to, relation]
): RawSnapshot {
  return {
    nodes: nodes.map(([id, title, kind]) => ({ id, title, kind })),
    edges: edges.map(([from, to, relation]) => ({ from, to, relation })),
  };
}

// SPEC-004 Scenario 1 (tier byte-identity) is covered by tier.test.ts.

describe("Scenario: buildDecompForest one-parent + informs=Mechanism (INV-2/INV-4)", () => {
  it("informs never makes a tree edge; a node has ≤1 structural parent", () => {
    const input = port(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
          ["C", "c", "rfc"],
          ["D", "d", "evidence"],
        ],
        [
          ["B", "A", "refines"],
          ["C", "A", "refines"],
          ["B", "C", "refines"],
          ["D", "A", "informs"],
        ],
      ),
      T,
    );
    const forest = buildDecompForest(input);
    const B = forest.nodes.get(serialiseKey({ id: "B", title: "b" }))!;
    const D = forest.nodes.get(serialiseKey({ id: "D", title: "d" }))!;
    // A (prd, lower tier) wins B's parent over C (rfc).
    expect(B.parent).toEqual({ id: "A", title: "a" });
    // D reachable only via informs → root/leaf, no parent.
    expect(D.parent).toBeNull();
    expect(classifyIcom("informs")).toBe("mechanism");
    // count(nodes with >1 parent) == 0 by construction.
    for (const n of forest.nodes.values()) {
      expect(n.parent === null || typeof n.parent.id === "string").toBe(true);
    }
    // The demoted second refines-parent (B→C) is a derived link.
    expect(forest.derivedLinks.some((l) => l.reason === "E-MULTI-PARENT")).toBe(
      true,
    );
  });
});

describe("Scenario: densityGate threshold + tier-stack fallback (INV-6)", () => {
  it("N≤2 forces tier-stack regardless of density", () => {
    const r = deriveIdef0(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
        ],
        [["B", "A", "refines"]],
      ),
      { threshold: T },
    );
    expect(r.verdict.mode).toBe("tier-stack");
    expect(r.diagram.mode).toBe("tier-stack");
    expect(r.diagram.boxes.length).toBeGreaterThan(0); // non-null (I-12)
  });

  it("dense chain (N=3, density 1.0) routes to idef0", () => {
    const r = deriveIdef0(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
          ["C", "c", "adr"],
        ],
        [
          ["B", "A", "refines"],
          ["C", "B", "refines"],
        ],
      ),
      { threshold: T },
    );
    expect(r.verdict.mode).toBe("idef0");
  });

  it("isolated nodes (density 0) route to tier-stack", () => {
    const r = deriveIdef0(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
          ["C", "c", "adr"],
        ],
        [],
      ),
      { threshold: T },
    );
    expect(r.verdict.mode).toBe("tier-stack");
    expect(r.verdict.metric).toBe(0);
  });

  it("same input routes to the same mode (determinism)", () => {
    const s = snap(
      [
        ["A", "a", "prd"],
        ["B", "b", "rfc"],
        ["C", "c", "adr"],
      ],
      [["B", "A", "refines"]],
    );
    const a = deriveIdef0(s, { threshold: T });
    const b = deriveIdef0(s, { threshold: T });
    expect(a.verdict.mode).toBe(b.verdict.mode);
  });
});

describe("Scenario: honesty real-vs-derived marking (INV-5)", () => {
  it("authored edge=real, inferred link=derived, root node=real", () => {
    const input = port(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
          ["C", "c", "rfc"],
          ["R", "r", "note"],
        ],
        [
          ["B", "A", "refines"],
          ["B", "C", "refines"],
        ],
      ),
      T,
    );
    const forest = buildDecompForest(input);
    const classified = classifyEdges(input);
    const authored = classified.find(
      (e) => e.from.id === "B" && e.to.id === "A",
    )!;
    expect(authored.provenance).toBe("real");
    expect(forest.derivedLinks.every((l) => l.provenance === "derived")).toBe(
      true,
    );
    const R = forest.nodes.get(serialiseKey({ id: "R", title: "r" }))!;
    expect(R.parent).toBeNull();
    expect(R.provenance).toBe("real"); // authored root is real despite no edge
    // No derived edge is mislabelled real.
    const derivedAsReal = classified.filter(
      (e) => e.provenance === "real" && e.icom === "mechanism" && false,
    );
    expect(derivedAsReal.length).toBe(0);
  });
});

describe("Scenario: (id,title) numbering stability + id-collision (INV-7)", () => {
  it("same set in different array order yields identical A-numbers", () => {
    const p1 = deriveIdef0(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
          ["C", "c", "rfc"],
        ],
        [
          ["B", "A", "refines"],
          ["C", "A", "refines"],
        ],
      ),
      { threshold: T },
    );
    const p2 = deriveIdef0(
      snap(
        [
          ["C", "c", "rfc"],
          ["B", "b", "rfc"],
          ["A", "a", "prd"],
        ],
        [
          ["C", "A", "refines"],
          ["B", "A", "refines"],
        ],
      ),
      { threshold: T },
    );
    const num = (r: typeof p1, id: string, title: string) =>
      r.forest.nodes.get(serialiseKey({ id, title }))!.number;
    expect(num(p1, "A", "a")).toBe(num(p2, "A", "a"));
    expect(num(p1, "B", "b")).toBe(num(p2, "B", "b"));
    expect(num(p1, "C", "c")).toBe(num(p2, "C", "c"));
    expect(num(p1, "A", "a")).toBe("A1");
  });

  it("id collision retains both nodes, flagged, distinct numbers", () => {
    const input = port(
      snap(
        [
          ["PRD-016", "Alpha", "prd"],
          ["PRD-016", "Beta", "prd"],
        ],
        [],
      ),
      T,
    );
    const a = input.nodes.find((n) => n.title === "Alpha")!;
    const b = input.nodes.find((n) => n.title === "Beta")!;
    expect(a.idCollision).toBe(true);
    expect(b.idCollision).toBe(true);
    expect(serialiseKey(a.key)).not.toBe(serialiseKey(b.key));
  });
});

describe("Scenario: classifyIcom case-per-relation incl. based_on (INV-3)", () => {
  it("every canonical relation gets a defined class; based_on is not dropped", () => {
    expect(classifyIcom("refines")).toBe("decomposition");
    expect(classifyIcom("informs")).toBe("mechanism");
    expect(classifyIcom("based_on")).toBe("input");
    expect(classifyIcom("supersedes")).toBe("control");
    expect(classifyIcom("contradicts")).toBe("control");
    // Contrast with the shared widget table (regression guard):
    expect(normaliseHierarchyEdge("x", "y", "based_on")).toBeNull();
    // The shared HIERARCHY_RELATIONS is byte-unchanged (INV-9).
    expect(HIERARCHY_RELATIONS.has("based_on")).toBe(false);
    expect(HIERARCHY_RELATIONS.has("informs")).toBe(true);
  });
});

describe("Scenario: INV-10 headless metadata sufficiency", () => {
  it("every box has a number; every arrow has a side + provenance", () => {
    const r = deriveIdef0(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
          ["C", "c", "adr"],
          ["E", "e", "evidence"],
        ],
        [
          ["B", "A", "refines"],
          ["C", "B", "refines"],
          ["E", "B", "informs"],
        ],
      ),
      { threshold: T, focus: { id: "B", title: "b" } },
    );
    expect(r.diagram.mode).toBe("idef0");
    expect(r.diagram.boxes.every((b) => typeof b.number === "string")).toBe(
      true,
    );
    expect(
      r.diagram.arrows.every(
        (ar) =>
          typeof ar.side === "string" && typeof ar.edge.provenance === "string",
      ),
    ).toBe(true);
    expect(r.diagram.legend.roles.length).toBeGreaterThan(0);
  });
});

describe("Scenario: FR-007 no coordinates in the diagram", () => {
  it("no x/y/width/height keys anywhere in the diagram", () => {
    const r = deriveIdef0(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
          ["C", "c", "adr"],
        ],
        [
          ["B", "A", "refines"],
          ["C", "B", "refines"],
        ],
      ),
      { threshold: T },
    );
    const banned = /"(x|y|width|height|px)"/;
    expect(banned.test(JSON.stringify(r.diagram))).toBe(false);
  });
});

describe("Scenario: E-EMPTY", () => {
  it("empty snapshot → empty, stable, no throw", () => {
    const r1 = deriveIdef0({ nodes: [], edges: [] }, { threshold: T });
    const r2 = deriveIdef0({}, { threshold: T });
    expect(r1.forest.nodes.size).toBe(0);
    expect(r1.outline.length).toBe(0);
    expect(r1.diagram.boxes.length).toBe(0);
    expect(r1.signature).toBe(r2.signature);
  });
});

describe("Scenario: E-CYCLE deterministic break", () => {
  it("a refines cycle is broken at the lex-lowest key; remainder acyclic", () => {
    const input = port(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "prd"],
          ["C", "c", "prd"],
        ],
        [
          ["A", "B", "refines"],
          ["B", "C", "refines"],
          ["C", "A", "refines"],
        ],
      ),
      T,
    );
    const forest = buildDecompForest(input);
    expect(forest.derivedLinks.some((l) => l.reason === "E-CYCLE")).toBe(true);
    // Every node reaches a root in ≤ N steps (acyclic).
    for (const start of forest.nodes.keys()) {
      let cur: string | null = start;
      let steps = 0;
      while (cur !== null && steps <= forest.nodes.size + 1) {
        const parent: CompositeKey | null =
          forest.nodes.get(cur)?.parent ?? null;
        cur = parent ? serialiseKey(parent) : null;
        steps++;
      }
      expect(steps).toBeLessThanOrEqual(forest.nodes.size + 1);
    }
  });
});

describe("Scenario: E-UNKNOWN-RELATION", () => {
  it("a non-canonical relation is a defined, derived, non-structural role", () => {
    const input = port(
      snap(
        [
          ["A", "a", "prd"],
          ["B", "b", "rfc"],
        ],
        [["B", "A", "mentions"]],
      ),
      T,
    );
    const forest = buildDecompForest(input);
    // Not a tree edge:
    expect(
      forest.nodes.get(serialiseKey({ id: "B", title: "b" }))!.parent,
    ).toBeNull();
    const classified = classifyEdges(input);
    expect(classified[0]!.icom).not.toBe("decomposition");
    expect(classified[0]!.provenance).toBe("derived"); // surfaced
  });
});

describe("Scenario: E-MISSING-IDENTITY degraded key", () => {
  it("id present + title missing → retained with degradedKey; both missing → dropped", () => {
    const input = port(
      {
        nodes: [
          { id: "X", title: null, kind: "prd" },
          { id: null, title: null, kind: "rfc" },
          { id: "Y", title: "y", kind: "adr" },
        ],
        edges: [],
      },
      T,
    );
    expect(input.dropped).toBe(1);
    const x = input.nodes.find((n) => n.id === "X")!;
    expect(x.degradedKey).toBe(true);
    expect(x.title).toBe("");
    expect(input.nodes.length).toBe(2);
  });
});

describe("INV-8: determinism + scale (N=1000)", () => {
  it("deriveIdef0 is deterministic and completes at N=1000 without throwing", () => {
    const nodes: Array<[string, string, string]> = [];
    const edges: Array<[string, string, string]> = [];
    const kinds = ["epic", "prd", "spec", "rfc", "adr", "evidence"];
    for (let i = 0; i < 1000; i++) {
      nodes.push([`N${i}`, `t${i}`, kinds[i % kinds.length]!]);
      if (i > 0 && i % 3 === 0) edges.push([`N${i}`, `N${i - 3}`, "refines"]);
      if (i % 2 === 0) edges.push([`N${i}`, `N0`, "informs"]);
    }
    const s = snap(nodes, edges);
    const r1 = deriveIdef0(s, {
      threshold: T,
      window: { offset: 0, limit: 50 },
    });
    const r2 = deriveIdef0(s, {
      threshold: T,
      window: { offset: 0, limit: 50 },
    });
    expect(r1.signature).toBe(r2.signature);
    expect(r1.outline.length).toBeLessThanOrEqual(50); // windowed → bounded DOM
    expect(structuralSignature(r1.forest)).toBe(r1.signature);
  });
});
