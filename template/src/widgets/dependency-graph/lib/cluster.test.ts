import { describe, it, expect } from "vitest";
import {
  computeRingRadius,
  computeOrbitRing,
  computeAnchoredAngles,
  detectClusters,
  ringCounts,
  MIN_CHORD,
  RING_GAP,
  INTER_CLUSTER_GAP,
  BASE_RADIUS,
} from "./cluster.svelte";
import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

const mk = (id: string, kind: ArtifactSummary["kind"]): ArtifactSummary => ({
  id,
  kind,
  title: "",
  status: "active",
});

describe("computeRingRadius — chord rule", () => {
  it("same-ring chord ≥ MIN_CHORD for N=2..12 on ring 1", () => {
    for (let N = 2; N <= 12; N++) {
      const r1 = computeRingRadius((ring) => (ring === 0 ? 0 : N))(1);
      const chord = 2 * r1 * Math.sin(Math.PI / N);
      expect(chord).toBeGreaterThanOrEqual(MIN_CHORD - 0.01);
    }
  });

  it("adjacent-ring radial gap ≥ RING_GAP across rings 1..3", () => {
    const r = computeRingRadius((ring) =>
      ring === 0 ? 0 : ring === 1 ? 5 : 8,
    );
    const r1 = r(1);
    const r2 = r(2);
    const r3 = r(3);
    expect(r2 - r1).toBeGreaterThanOrEqual(RING_GAP - 0.01);
    expect(r3 - r2).toBeGreaterThanOrEqual(RING_GAP - 0.01);
  });

  it("N=1 special-case: radius ≥ MIN_CHORD/2", () => {
    const r1 = computeRingRadius((ring) => (ring === 0 ? 0 : 1))(1);
    expect(r1).toBeGreaterThanOrEqual(MIN_CHORD / 2);
  });

  it("ring 0 is always 0 (root pinned at centroid)", () => {
    const r = computeRingRadius(() => 5);
    expect(r(0)).toBe(0);
  });

  it("radius is monotonically non-decreasing with ring index", () => {
    const r = computeRingRadius((ring) => (ring === 0 ? 0 : ring + 2));
    let prev = r(0);
    for (let i = 1; i <= 5; i++) {
      const cur = r(i);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("computeOrbitRing — compact type-rank", () => {
  it("root sits on ring 0", () => {
    const members = [mk("PRD-1", "prd"), mk("RFC-1", "rfc")];
    const out = computeOrbitRing("PRD-1", members);
    expect(out["PRD-1"]).toBe(0);
  });

  it("members of the same kind get the same ring", () => {
    const members = [
      mk("PRD-1", "prd"),
      mk("RFC-1", "rfc"),
      mk("RFC-2", "rfc"),
      mk("EVID-1", "evidence"),
    ];
    const out = computeOrbitRing("PRD-1", members);
    expect(out["RFC-1"]).toBe(out["RFC-2"]);
    expect(out["EVID-1"]).toBeGreaterThan(out["RFC-1"]!);
  });

  it("missing types collapse inward (no empty ring)", () => {
    const members = [
      mk("PRD-1", "prd"),
      mk("EVID-1", "evidence"),
      mk("EVID-2", "evidence"),
    ];
    const out = computeOrbitRing("PRD-1", members);
    expect(out["PRD-1"]).toBe(0);
    expect(out["EVID-1"]).toBe(1);
    expect(out["EVID-2"]).toBe(1);
  });
});

describe("computeAnchoredAngles", () => {
  it("ring-1 with no anchors spreads evenly", () => {
    const members = [
      mk("PRD-1", "prd"),
      mk("RFC-1", "rfc"),
      mk("RFC-2", "rfc"),
      mk("RFC-3", "rfc"),
      mk("RFC-4", "rfc"),
    ];
    const rings = {
      "PRD-1": 0,
      "RFC-1": 1,
      "RFC-2": 1,
      "RFC-3": 1,
      "RFC-4": 1,
    };
    const adj = new Map<string, string[]>([
      ["PRD-1", []],
      ["RFC-1", []],
      ["RFC-2", []],
      ["RFC-3", []],
      ["RFC-4", []],
    ]);
    const angles = computeAnchoredAngles("PRD-1", members, rings, adj);
    const sorted = ["RFC-1", "RFC-2", "RFC-3", "RFC-4"]
      .map((id) => angles.get(id)!)
      .sort((a, b) => a - b);
    expect(sorted.length).toBe(4);
    const expectedStep = (Math.PI * 2) / 4;
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i]! - sorted[i - 1]!;
      expect(Math.abs(diff - expectedStep)).toBeLessThan(0.01);
    }
    const wrap = sorted[0]! + Math.PI * 2 - sorted[sorted.length - 1]!;
    expect(Math.abs(wrap - expectedStep)).toBeLessThan(0.01);
  });

  it("root angle is 0", () => {
    const members = [mk("PRD-1", "prd"), mk("RFC-1", "rfc")];
    const rings = { "PRD-1": 0, "RFC-1": 1 };
    const adj = new Map<string, string[]>([
      ["PRD-1", []],
      ["RFC-1", []],
    ]);
    const angles = computeAnchoredAngles("PRD-1", members, rings, adj);
    expect(angles.get("PRD-1")).toBe(0);
  });
});

describe("ringCounts", () => {
  it("counts members per ring", () => {
    const counts = ringCounts({ a: 0, b: 1, c: 1, d: 2, e: 2, f: 2 });
    expect(counts.get(0)).toBe(1);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(3);
  });
});

describe("detectClusters — multi-cluster placement", () => {
  it("K=0: empty input returns empty clusters", () => {
    const result = detectClusters([], [], { width: 1000, height: 600 });
    expect(result.clusters.length).toBe(0);
    expect(Object.keys(result.nodeToCluster).length).toBe(0);
  });

  it("K=1: centroid sits at canvas centre", () => {
    const nodes = [mk("PRD-1", "prd"), mk("RFC-1", "rfc")];
    const result = detectClusters(nodes, [], { width: 1000, height: 600 });
    expect(result.clusters.length).toBe(1);
    expect(result.clusters[0]!.centroid.x).toBeCloseTo(500, 5);
    expect(result.clusters[0]!.centroid.y).toBeCloseTo(300, 5);
    expect(result.nodeToCluster["PRD-1"]).toBe("PRD-1");
    expect(result.nodeToCluster["RFC-1"]).toBe("PRD-1");
  });

  it("K=2: centroids span the canvas centre symmetrically", () => {
    const nodes = [mk("PRD-1", "prd"), mk("PRD-2", "prd")];
    const result = detectClusters(nodes, [], { width: 2000, height: 1500 });
    expect(result.clusters.length).toBe(2);
    const a = result.clusters[0]!;
    const b = result.clusters[1]!;
    const cx = 1000;
    const cy = 750;
    expect(a.centroid.y).toBeCloseTo(cy, 5);
    expect(b.centroid.y).toBeCloseTo(cy, 5);
    expect((a.centroid.x + b.centroid.x) / 2).toBeCloseTo(cx, 5);
    const d = Math.hypot(
      b.centroid.x - a.centroid.x,
      b.centroid.y - a.centroid.y,
    );
    const minExpected = 2 * BASE_RADIUS + INTER_CLUSTER_GAP - 0.01;
    expect(d).toBeGreaterThanOrEqual(minExpected);
  });

  it("K≥3: largest cluster at centre, others on regular polygon (equal radii)", () => {
    const nodes = [
      mk("PRD-1", "prd"),
      mk("E1", "evidence"),
      mk("E2", "evidence"),
      mk("E3", "evidence"),
      mk("PRD-2", "prd"),
      mk("E4", "evidence"),
      mk("PRD-3", "prd"),
      mk("E5", "evidence"),
      mk("PRD-4", "prd"),
      mk("E6", "evidence"),
    ];
    const edges: GraphEdge[] = [
      { from: "E1", to: "PRD-1", relation: "informs" },
      { from: "E2", to: "PRD-1", relation: "informs" },
      { from: "E3", to: "PRD-1", relation: "informs" },
      { from: "E4", to: "PRD-2", relation: "informs" },
      { from: "E5", to: "PRD-3", relation: "informs" },
      { from: "E6", to: "PRD-4", relation: "informs" },
    ];
    const result = detectClusters(nodes, edges, { width: 2000, height: 2000 });
    expect(result.clusters.length).toBe(4);
    const centre = result.clusters.find((c) => c.id === "PRD-1")!;
    expect(centre.centroid.x).toBeCloseTo(1000, 5);
    expect(centre.centroid.y).toBeCloseTo(1000, 5);
    const others = result.clusters.filter((c) => c.id !== "PRD-1");
    const distances = others.map((o) =>
      Math.hypot(
        o.centroid.x - centre.centroid.x,
        o.centroid.y - centre.centroid.y,
      ),
    );
    for (let i = 1; i < distances.length; i++) {
      expect(Math.abs(distances[i]! - distances[0]!)).toBeLessThan(0.01);
    }
  });

  it("hierarchy edges route members to their ancestor centroid", () => {
    const nodes = [
      mk("PRD-1", "prd"),
      mk("PRD-2", "prd"),
      mk("E1", "evidence"),
      mk("E2", "evidence"),
    ];
    const edges: GraphEdge[] = [
      { from: "E1", to: "PRD-1", relation: "informs" },
      { from: "E2", to: "PRD-2", relation: "informs" },
    ];
    const result = detectClusters(nodes, edges, { width: 2000, height: 1500 });
    expect(result.nodeToCluster["E1"]).toBe("PRD-1");
    expect(result.nodeToCluster["E2"]).toBe("PRD-2");
  });
});
