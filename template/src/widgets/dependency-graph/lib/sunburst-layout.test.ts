import { describe, it, expect } from "vitest";
import { buildSunburstTree, computeSunburstPartition } from "./sunburst-layout";
import type { ArtifactSummary } from "@/entities/artifact";

const mk = (id: string, kind: string): ArtifactSummary =>
  ({ id, kind, title: "", status: "active" }) as ArtifactSummary;

describe("buildSunburstTree — concentric rings by compact tier", () => {
  it("synthetic root sits at tier -1 with full angular span (after partition)", () => {
    const tree = buildSunburstTree([mk("A", "prd")], []);
    expect(tree.id).toBe("__workspace__");
    expect(tree.tier).toBe(-1);
  });

  it("disconnected artifacts attach to the synthetic root, not to each other", () => {
    const tree = buildSunburstTree([mk("A", "prd"), mk("B", "prd")], []);
    expect(tree.children?.length).toBe(2);
    expect(tree.children?.every((c) => c.children === undefined)).toBe(true);
  });

  it("evidence informs PRD → evidence becomes child of PRD (one tier outside)", () => {
    const tree = buildSunburstTree(
      [mk("PRD-1", "prd"), mk("EVID-1", "evidence")],
      [{ from: "EVID-1", to: "PRD-1", relation: "informs" }],
    );
    const prd = tree.children?.find((c) => c.id === "PRD-1");
    expect(prd?.children?.map((k) => k.id)).toEqual(["EVID-1"]);
  });

  it("rfc refines PRD → RFC child of PRD (PRD parent semantically)", () => {
    const tree = buildSunburstTree(
      [mk("PRD-1", "prd"), mk("RFC-1", "rfc")],
      [{ from: "RFC-1", to: "PRD-1", relation: "refines" }],
    );
    const prd = tree.children?.find((c) => c.id === "PRD-1");
    expect(prd?.children?.map((k) => k.id)).toEqual(["RFC-1"]);
  });

  it("ignores intra-tier edges (e.g. supersedes between two ADRs)", () => {
    const tree = buildSunburstTree(
      [mk("A", "adr"), mk("B", "adr")],
      [{ from: "B", to: "A", relation: "supersedes" }],
    );
    // Both ADRs are tier-0 within their compact mapping → neither
    // becomes a child of the other; both attach to synthetic root.
    expect(tree.children?.length).toBe(2);
    expect(tree.children?.every((c) => c.children === undefined)).toBe(true);
  });

  it("does not infinite-loop on cycles", () => {
    const tree = buildSunburstTree(
      [mk("A", "prd"), mk("B", "prd")],
      [
        { from: "A", to: "B", relation: "refines" },
        { from: "B", to: "A", relation: "refines" },
      ],
    );
    expect(tree.children?.length).toBeGreaterThan(0);
  });
});

describe("computeSunburstPartition — d3-hierarchy partition", () => {
  it("returns rectangular layout with x in [0, 2π] and y in [0, radius]", () => {
    const tree = buildSunburstTree(
      [mk("PRD-1", "prd"), mk("RFC-1", "rfc"), mk("EVID-1", "evidence")],
      [
        { from: "RFC-1", to: "PRD-1", relation: "refines" },
        { from: "EVID-1", to: "RFC-1", relation: "informs" },
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
