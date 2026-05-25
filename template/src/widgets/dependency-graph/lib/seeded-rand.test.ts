import { describe, it, expect } from "vitest";
import { hashStringFnv1a, mulberry32, seededJitter } from "./seeded-rand";

describe("mulberry32 — deterministic sequence", () => {
  it("emits the same 5-value sequence across two separate generators with the same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    const seq1 = [r1(), r1(), r1(), r1(), r1()];
    const seq2 = [r2(), r2(), r2(), r2(), r2()];
    expect(seq1).toEqual(seq2);
  });
});

describe("hashStringFnv1a — distinct inputs", () => {
  it("PRD-001 and PRD-010 produce different hashes", () => {
    expect(hashStringFnv1a("PRD-001")).not.toBe(hashStringFnv1a("PRD-010"));
  });
});

describe("seededJitter — stability and bounds", () => {
  it("returns the same {dx, dy} on every call for the same nodeId", () => {
    const a = seededJitter("PRD-001", 20);
    const b = seededJitter("PRD-001", 20);
    expect(a).toEqual(b);
  });

  it("keeps dx and dy within [-half, +half]", () => {
    const { dx, dy } = seededJitter("PRD-001", 20);
    expect(dx).toBeGreaterThanOrEqual(-20);
    expect(dx).toBeLessThanOrEqual(20);
    expect(dy).toBeGreaterThanOrEqual(-20);
    expect(dy).toBeLessThanOrEqual(20);
  });

  it("produces different jitters for different nodeIds", () => {
    const a = seededJitter("PRD-001", 20);
    const b = seededJitter("PRD-002", 20);
    expect(a).not.toEqual(b);
  });
});
