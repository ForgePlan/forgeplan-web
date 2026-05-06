import { describe, it, expect } from "vitest";
import {
  computeDownstream,
  computeUpstream,
  MAX_IMPACT_DEPTH,
} from "./impact-graph";
import type { GraphEdge } from "@/entities/graph";

const edge = (from: string, to: string, relation: string): GraphEdge =>
  ({ from, to, relation }) as GraphEdge;

describe("computeDownstream — forward BFS through hierarchy", () => {
  it("linear chain PRD → RFC → EVID", () => {
    const edges = [
      edge("RFC-1", "PRD-1", "refines"),
      edge("EVID-1", "RFC-1", "informs"),
    ];
    const out = computeDownstream("PRD-1", edges);
    expect(out.get("PRD-1")).toBe(0);
    expect(out.get("RFC-1")).toBe(1);
    expect(out.get("EVID-1")).toBe(2);
  });

  it("diamond pattern: two paths converge on shortest", () => {
    const edges = [
      edge("B", "A", "refines"),
      edge("C", "A", "refines"),
      edge("D", "B", "informs"),
      edge("D", "C", "informs"),
    ];
    const out = computeDownstream("A", edges);
    expect(out.get("A")).toBe(0);
    expect(out.get("B")).toBe(1);
    expect(out.get("C")).toBe(1);
    expect(out.get("D")).toBe(2);
  });

  it("cycle: visited set prevents loop", () => {
    const edges = [edge("B", "A", "refines"), edge("A", "B", "refines")];
    const out = computeDownstream("A", edges);
    expect(out.size).toBeLessThanOrEqual(2);
  });

  it("caps depth at MAX_IMPACT_DEPTH", () => {
    const edges: GraphEdge[] = [];
    for (let i = 0; i < MAX_IMPACT_DEPTH + 5; i++) {
      edges.push(edge(`N${i + 1}`, `N${i}`, "refines"));
    }
    const out = computeDownstream("N0", edges);
    const maxDepth = Math.max(...out.values());
    expect(maxDepth).toBeLessThanOrEqual(MAX_IMPACT_DEPTH);
  });

  it("ignores non-hierarchy edges (e.g. risk)", () => {
    const edges = [edge("B", "A", "risk")];
    const out = computeDownstream("A", edges);
    expect(out.size).toBe(1);
  });
});

describe("computeUpstream — reverse of downstream", () => {
  it("chain reverse: from EVID we reach PRD", () => {
    const edges = [
      edge("RFC-1", "PRD-1", "refines"),
      edge("EVID-1", "RFC-1", "informs"),
    ];
    const out = computeUpstream("EVID-1", edges);
    expect(out.get("EVID-1")).toBe(0);
    expect(out.get("RFC-1")).toBe(1);
    expect(out.get("PRD-1")).toBe(2);
  });

  it("upstream of a leaf returns the chain to the root", () => {
    const edges = [edge("B", "A", "refines"), edge("C", "B", "informs")];
    const downstream = computeDownstream("A", edges);
    const upstream = computeUpstream("C", edges);
    expect(new Set(downstream.keys())).toEqual(new Set(["A", "B", "C"]));
    expect(new Set(upstream.keys())).toEqual(new Set(["A", "B", "C"]));
  });
});
