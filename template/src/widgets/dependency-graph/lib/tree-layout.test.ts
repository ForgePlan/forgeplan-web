import { describe, it, expect } from "vitest";
import { kindTierLayer, wrapColumns } from "./tree-layout";

describe("kindTierLayer — compact tier index per kind", () => {
  it("EPIC sits at tier 0 when all canonical kinds are present", () => {
    const all = [
      "epic",
      "prd",
      "spec",
      "rfc",
      "adr",
      "evidence",
      "note",
      "problem",
      "solution",
    ];
    expect(kindTierLayer("epic", all)).toBe(0);
    expect(kindTierLayer("prd", all)).toBe(1);
    expect(kindTierLayer("spec", all)).toBe(2);
    expect(kindTierLayer("rfc", all)).toBe(3);
    expect(kindTierLayer("adr", all)).toBe(4);
    expect(kindTierLayer("evidence", all)).toBe(5);
  });

  it("collapses gaps: prd + evidence only → 0 / 1", () => {
    const all = ["prd", "evidence"];
    expect(kindTierLayer("prd", all)).toBe(0);
    expect(kindTierLayer("evidence", all)).toBe(1);
  });

  it("kind comparison is case-insensitive", () => {
    const all = ["PRD", "EVIDENCE"];
    expect(kindTierLayer("EVIDENCE", all)).toBe(1);
    expect(kindTierLayer("evidence", all)).toBe(1);
  });

  it("unknown kinds fall back to a stable tail position", () => {
    const all = ["prd", "evidence", "wat"];
    const tier = kindTierLayer("wat", all);
    expect(tier).toBeGreaterThanOrEqual(2);
  });
});

describe("wrapColumns — split a kind row into balanced sub-rows", () => {
  const widthsOf = (ids: string[], px: number): Map<string, number> => {
    const m = new Map<string, number>();
    for (const id of ids) m.set(id, px);
    return m;
  };

  it("returns one sub-row when natural width fits", () => {
    const ids = ["A", "B", "C", "D", "E"];
    const widths = widthsOf(ids, 96);
    const subs = wrapColumns(ids, widths, 1200, 28);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toEqual(ids);
  });

  it("wraps a 30-node row past viewport into multiple sub-rows", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `N${i + 1}`);
    const widths = widthsOf(ids, 96);
    const subs = wrapColumns(ids, widths, 1200, 28);
    expect(subs.length).toBeGreaterThanOrEqual(3);
    const flattened = subs.flat();
    expect(flattened).toEqual(ids);
  });

  it("every sub-row's natural width stays under the budget", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `N${i + 1}`);
    const widths = widthsOf(ids, 96);
    const maxRowW = 1200;
    const colGap = 28;
    const subs = wrapColumns(ids, widths, maxRowW, colGap);
    for (const sub of subs) {
      const w =
        sub.reduce((s, id) => s + (widths.get(id) ?? 0), 0) +
        colGap * Math.max(0, sub.length - 1);
      expect(w).toBeLessThanOrEqual(maxRowW);
    }
  });

  it("returns [] for an empty input", () => {
    expect(wrapColumns([], new Map(), 1000, 28)).toEqual([]);
  });

  it("preserves node order within sub-rows (stable wrap)", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `N${i + 1}`);
    const widths = widthsOf(ids, 200);
    const subs = wrapColumns(ids, widths, 600, 28);
    const flattened = subs.flat();
    expect(flattened).toEqual(ids);
  });
});
