import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_ORDER, typeTier, compactTierMap } from "./index";
import { TYPE_ORDER as TYPE_ORDER_VIA_SHIM } from "@/widgets/dependency-graph/lib/cluster.svelte";

// Golden values: pre-lift expected outputs for byte-identical regression
// (SPEC-004 AC-1 / FR-001). If this fails after the lift, the altitude ladder
// of every hierarchical view (Tree/Radial/Sankey/Sunburst) has shifted.

describe("tier-vocab byte-identical behaviour", () => {
  it("typeTier returns the canonical index for all 9 TYPE_ORDER kinds", () => {
    expect(typeTier("epic")).toBe(0);
    expect(typeTier("prd")).toBe(1);
    expect(typeTier("spec")).toBe(2);
    expect(typeTier("rfc")).toBe(3);
    expect(typeTier("adr")).toBe(4);
    expect(typeTier("evidence")).toBe(5);
    expect(typeTier("note")).toBe(6);
    expect(typeTier("problem")).toBe(7);
    expect(typeTier("solution")).toBe(8);
  });

  it("typeTier returns TYPE_ORDER.length (9) for unknown / empty kinds", () => {
    expect(typeTier("ZZZ-unknown")).toBe(9);
    expect(typeTier("foobar")).toBe(9);
    expect(typeTier("")).toBe(9);
  });

  it("typeTier is case-insensitive", () => {
    expect(typeTier("PRD")).toBe(1);
    expect(typeTier("Prd")).toBe(1);
    expect(typeTier("EVIDENCE")).toBe(5);
    expect(typeTier("MiXeDcAsE")).toBe(9);
  });

  it("compactTierMap over the full TYPE_ORDER list yields canonical order", () => {
    const m = compactTierMap([...TYPE_ORDER]);
    expect(m.size).toBe(9);
    expect(m.get("epic")).toBe(0);
    expect(m.get("prd")).toBe(1);
    expect(m.get("spec")).toBe(2);
    expect(m.get("rfc")).toBe(3);
    expect(m.get("adr")).toBe(4);
    expect(m.get("evidence")).toBe(5);
    expect(m.get("note")).toBe(6);
    expect(m.get("problem")).toBe(7);
    expect(m.get("solution")).toBe(8);
  });

  it("compactTierMap gap subset [prd, rfc, evidence] collapses to {prd:0, rfc:1, evidence:2}", () => {
    const m = compactTierMap(["prd", "rfc", "evidence"]);
    expect(m.size).toBe(3);
    expect(m.get("prd")).toBe(0);
    expect(m.get("rfc")).toBe(1);
    expect(m.get("evidence")).toBe(2);
    expect(m.has("spec")).toBe(false);
    expect(m.has("epic")).toBe(false);
  });

  it("compactTierMap appends unknowns after known tiers in encounter order", () => {
    const m = compactTierMap(["prd", "ZZZ-unknown", "rfc"]);
    expect(m.get("prd")).toBe(0);
    expect(m.get("rfc")).toBe(1);
    expect(m.get("zzz-unknown")).toBe(2);
    expect(m.size).toBe(3);
  });

  it("compactTierMap is case-insensitive on input kinds", () => {
    const m = compactTierMap(["PRD", "RFC"]);
    expect(m.get("prd")).toBe(0);
    expect(m.get("rfc")).toBe(1);
  });

  it("compactTierMap empty input returns an empty Map", () => {
    expect(compactTierMap([])).toEqual(new Map());
    expect(compactTierMap(new Set())).toEqual(new Map());
  });
});

describe("TYPE_ORDER canonical membership", () => {
  it("has exactly 9 members in canonical order", () => {
    expect([...TYPE_ORDER]).toEqual([
      "epic",
      "prd",
      "spec",
      "rfc",
      "adr",
      "evidence",
      "note",
      "problem",
      "solution",
    ]);
  });
});

describe("SankeyView TYPE_ORDER resolution via the cluster.svelte shim", () => {
  // SankeyView.svelte imports TYPE_ORDER directly from cluster.svelte. After
  // the lift, cluster.svelte re-exports from @/shared/lib/tier, so the direct
  // import must resolve to the SAME canonical array (ADR-006 hard criterion).
  it("TYPE_ORDER via the cluster.svelte shim is the same reference as canonical", () => {
    expect(TYPE_ORDER_VIA_SHIM).toBe(TYPE_ORDER);
  });

  it("TYPE_ORDER via the cluster.svelte shim has all 9 canonical members", () => {
    expect([...TYPE_ORDER_VIA_SHIM]).toEqual([...TYPE_ORDER]);
  });
});

describe("FSD boundary: shared/lib/tier imports nothing from widgets/", () => {
  it("no non-test source file in tier/ imports from widgets/", () => {
    const tierDir = fileURLToPath(new URL(".", import.meta.url));
    const sourceFiles = readdirSync(tierDir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    expect(sourceFiles.length).toBeGreaterThan(0);
    for (const file of sourceFiles) {
      const content = readFileSync(join(tierDir, file), "utf8");
      const importsWidgets =
        /from\s+['"][^'"]*widgets[^'"]*['"]/.test(content) ||
        /from\s+['"]@\/widgets/.test(content);
      expect(
        importsWidgets,
        `${file} must not import from widgets/ (FSD rule 24 / SPEC-004 INV-1)`,
      ).toBe(false);
    }
  });
});
