import { describe, it, expect } from "vitest";
import { buildDegreeMap, byDegreeDesc } from "./degree";

// Fixture graph: n1-n2, n1-n3, n1-n4, n2-n3
// Resulting degrees: n1=3, n2=2, n3=2, n4=1, n5=0 (not connected)
const EDGES = [
  { source: "n1", target: "n2" },
  { source: "n1", target: "n3" },
  { source: "n1", target: "n4" },
  { source: "n2", target: "n3" },
];

describe("buildDegreeMap", () => {
  it("counts undirected degrees correctly", () => {
    const dm = buildDegreeMap(EDGES);
    expect(dm.get("n1")).toBe(3);
    expect(dm.get("n2")).toBe(2);
    expect(dm.get("n3")).toBe(2);
    expect(dm.get("n4")).toBe(1);
    expect(dm.get("n5")).toBeUndefined();
  });

  it("excludes self-edges from degree count", () => {
    const dm = buildDegreeMap([
      ...EDGES,
      { source: "n1", target: "n1" },
    ]);
    expect(dm.get("n1")).toBe(3);
  });
});

describe("byDegreeDesc comparator", () => {
  it("sorts higher-degree nodes first, for every adjacent pair degree(a) >= degree(b)", () => {
    const dm = buildDegreeMap(EDGES);
    const cmp = byDegreeDesc(dm);
    const sorted = [
      { id: "n5" },
      { id: "n4" },
      { id: "n3" },
      { id: "n2" },
      { id: "n1" },
    ].sort(cmp);
    const ids = sorted.map((n) => n.id);
    expect(ids.at(0)).toBe("n1");
    const degreeFor = (id: string | undefined) => dm.get(id ?? "") ?? 0;
    for (let i = 0; i < ids.length - 1; i++) {
      expect(degreeFor(ids.at(i))).toBeGreaterThanOrEqual(degreeFor(ids.at(i + 1)));
    }
  });

  it("breaks ties by id lexicographic order (n2 before n3, both degree 2)", () => {
    const dm = buildDegreeMap(EDGES);
    const cmp = byDegreeDesc(dm);
    const sorted = [{ id: "n3" }, { id: "n2" }].sort(cmp);
    expect(sorted.at(0)?.id).toBe("n2");
    expect(sorted.at(1)?.id).toBe("n3");
  });

  it("uses custom tieBreak when provided", () => {
    const dm = buildDegreeMap(EDGES);
    const cmp = byDegreeDesc(dm, (a, b) => b.id.localeCompare(a.id));
    const sorted = [{ id: "n2" }, { id: "n3" }].sort(cmp);
    expect(sorted.at(0)?.id).toBe("n3");
  });
});
