import { describe, it, expect } from "vitest";
import { buildSunburstTree, computeSunburstPartition } from "./sunburst-layout";
import type { ArtifactSummary } from "@/entities/artifact";

const mk = (id: string, kind: string): ArtifactSummary =>
  ({ id, kind, title: "", status: "active" }) as ArtifactSummary;

describe("buildSunburstTree — synthetic workspace root + first-parent attach", () => {
  it("disconnected artifacts attach to the synthetic root", () => {
    const tree = buildSunburstTree([mk("A", "prd"), mk("B", "prd")], []);
    expect(tree.id).toBe("__workspace__");
    expect(tree.children?.length).toBe(2);
    expect(tree.children?.map((c) => c.id).sort()).toEqual(["A", "B"]);
  });

  it("attaches each child to its FIRST hierarchy parent", () => {
    const tree = buildSunburstTree(
      [mk("A", "prd"), mk("B", "prd"), mk("C", "rfc")],
      [
        { from: "A", to: "C", relation: "refines" },
        // Second parent edge is ignored — first wins.
        { from: "B", to: "C", relation: "refines" },
      ],
    );
    const a = tree.children?.find((c) => c.id === "A");
    expect(a?.children?.map((k) => k.id)).toEqual(["C"]);
    const b = tree.children?.find((c) => c.id === "B");
    expect(b?.children).toBeUndefined();
  });

  it("does not infinite-loop on cycles", () => {
    const tree = buildSunburstTree(
      [mk("A", "prd"), mk("B", "prd")],
      [
        { from: "A", to: "B", relation: "refines" },
        { from: "B", to: "A", relation: "refines" },
      ],
    );
    // A's parent is B; B's parent is A; both are non-root in parentOf.
    // Builder picks one as a cycle survivor and attaches it to the
    // synthetic root, the other becomes its child.
    expect(tree.children?.length).toBeGreaterThan(0);
  });

  it("ignores non-hierarchy edges", () => {
    const tree = buildSunburstTree(
      [mk("A", "prd"), mk("B", "rfc")],
      [{ from: "A", to: "B", relation: "risk" }],
    );
    expect(tree.children?.length).toBe(2);
    expect(tree.children?.find((c) => c.id === "A")?.children).toBeUndefined();
    expect(tree.children?.find((c) => c.id === "B")?.children).toBeUndefined();
  });
});

describe("computeSunburstPartition — d3-hierarchy partition", () => {
  it("returns rectangular layout with x in [0, 2π] and y in [0, radius]", () => {
    const tree = buildSunburstTree(
      [mk("A", "prd"), mk("B", "rfc"), mk("C", "evidence")],
      [
        { from: "A", to: "B", relation: "refines" },
        { from: "B", to: "C", relation: "informs" },
      ],
    );
    const root = computeSunburstPartition(tree, 100);
    root.each((d) => {
      expect(d.x0).toBeGreaterThanOrEqual(0);
      expect(d.x1).toBeLessThanOrEqual(2 * Math.PI + 1e-6);
      expect(d.y0).toBeGreaterThanOrEqual(0);
      expect(d.y1).toBeLessThanOrEqual(100 + 1e-6);
    });
  });

  it("synthetic root is at depth 0 with full angular span", () => {
    const tree = buildSunburstTree([mk("A", "prd")], []);
    const root = computeSunburstPartition(tree, 100);
    expect(root.depth).toBe(0);
    expect(root.x0).toBe(0);
    expect(root.x1).toBeCloseTo(2 * Math.PI, 5);
  });
});
