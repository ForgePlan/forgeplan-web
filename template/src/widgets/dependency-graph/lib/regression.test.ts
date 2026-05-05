import { describe, it, expect } from "vitest";
import { detectClusters, RING_GAP } from "./cluster.svelte";
import type { ArtifactSummary } from "@/entities/artifact";

const mk = (id: string, kind: string): ArtifactSummary =>
  ({ id, kind, title: "", status: "active" }) as ArtifactSummary;

describe("regression: cluster.radii populated in dependency order", () => {
  // The bug: ringCounts iterated in Map-insertion order, which depended
  // on orbit-assignment order. detectClusters seeded computeRingRadius's
  // cache out of dependency order: e.g. radius(2) before radius(1).
  // Then `prev = cache.get(1) ?? 0` was 0 (not 126), and the radial-gap
  // rule produced ring 2 = 126 instead of 252. Visible as RFC + ADR
  // sharing the same orbit position in RadialView.
  it("ring N radius ≥ ring N-1 radius + RING_GAP for all populated rings", () => {
    const nodes = [
      mk("PRD-001", "prd"),
      mk("ADR-001", "adr"),
      mk("ADR-002", "adr"),
      mk("EVID-001", "evidence"),
      mk("EVID-002", "evidence"),
      mk("EVID-003", "evidence"),
      mk("EVID-004", "evidence"),
      mk("EVID-005", "evidence"),
      mk("EVID-006", "evidence"),
      mk("EVID-007", "evidence"),
      mk("EVID-008", "evidence"),
      mk("RFC-001", "rfc"),
      mk("RFC-002", "rfc"),
      mk("RFC-003", "rfc"),
    ];
    const result = detectClusters(nodes, [], { width: 1000, height: 700 });
    const cluster = result.clusters.find((c) => c.id === "PRD-001")!;
    const radii = cluster.radii;
    expect(radii[1]! - radii[0]!).toBeGreaterThanOrEqual(RING_GAP - 0.01);
    expect(radii[2]! - radii[1]!).toBeGreaterThanOrEqual(RING_GAP - 0.01);
    expect(radii[3]! - radii[2]!).toBeGreaterThanOrEqual(RING_GAP - 0.01);
  });

  it("RFC (ring 1) and ADR (ring 2) cannot share radius", () => {
    const nodes = [
      mk("PRD-001", "prd"),
      mk("ADR-001", "adr"),
      mk("RFC-001", "rfc"),
    ];
    const result = detectClusters(nodes, [], { width: 1000, height: 700 });
    const cluster = result.clusters.find((c) => c.id === "PRD-001")!;
    const orbits = cluster.orbits;
    expect(orbits["RFC-001"]).toBe(1);
    expect(orbits["ADR-001"]).toBe(2);
    expect(cluster.radii[2]).toBeGreaterThan(cluster.radii[1]!);
  });
});
