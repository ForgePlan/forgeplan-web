import { describe, expect, it } from "vitest";
import { filterEdges } from "./filter";
import type { GraphEdge } from "@/entities/graph";

describe("filterEdges", () => {
  it("filters out edges whose endpoints are not in visibleIds", () => {
    const edges: GraphEdge[] = [
      { from: "A", to: "B", relation: "informs" },
      { from: "A", to: "Z", relation: "informs" },
    ];
    const out = filterEdges(edges, new Set(["A", "B"]));
    expect(out).toEqual([{ from: "A", to: "B", relation: "informs" }]);
  });

  it("dedupes duplicate (from, to, relation) tuples — keeps first occurrence", () => {
    const edges: GraphEdge[] = [
      { from: "A", to: "B", relation: "informs" },
      { from: "A", to: "B", relation: "informs" },
      { from: "A", to: "B", relation: "informs" },
    ];
    const out = filterEdges(edges, new Set(["A", "B"]));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ from: "A", to: "B", relation: "informs" });
  });

  it("preserves duplicates that differ only in relation", () => {
    const edges: GraphEdge[] = [
      { from: "A", to: "B", relation: "informs" },
      { from: "A", to: "B", relation: "supersedes" },
    ];
    const out = filterEdges(edges, new Set(["A", "B"]));
    expect(out).toHaveLength(2);
  });

  it("dedupes only after visibility filter", () => {
    const edges: GraphEdge[] = [
      { from: "A", to: "B", relation: "informs" },
      { from: "A", to: "Z", relation: "informs" },
      { from: "A", to: "B", relation: "informs" },
    ];
    const out = filterEdges(edges, new Set(["A", "B"]));
    expect(out).toHaveLength(1);
  });
});
