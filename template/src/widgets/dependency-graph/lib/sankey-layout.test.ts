import { describe, it, expect } from "vitest";
import { assignSankeyColumns, buildSankeyPayload } from "./sankey-layout";
import type { ArtifactSummary } from "@/entities/artifact";

const mk = (id: string, kind: string): ArtifactSummary =>
  ({ id, kind, title: "", status: "active" }) as ArtifactSummary;

describe("assignSankeyColumns — column = compact tier of kind", () => {
  it("orders prd / rfc / evidence as 0 / 1 / 2", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "rfc"), mk("C", "evidence")],
      [],
    );
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(1);
    expect(cols["C"]).toBe(2);
  });

  it("missing tiers collapse: prd + evidence → 0 / 1 (no gap)", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "evidence"), mk("C", "evidence")],
      [],
    );
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(1);
    expect(cols["C"]).toBe(1);
  });

  it("kinds that share a tier share a column (two PRDs both 0)", () => {
    const cols = assignSankeyColumns([mk("P1", "prd"), mk("P2", "prd")], []);
    expect(cols["P1"]).toBe(0);
    expect(cols["P2"]).toBe(0);
  });
});

describe("buildSankeyPayload — direction normalised abstract → concrete", () => {
  it("evidence informs PRD: link goes from PRD column → evidence column", () => {
    const { links } = buildSankeyPayload(
      [mk("PRD-1", "prd"), mk("EVID-1", "evidence")],
      [{ from: "EVID-1", to: "PRD-1", relation: "informs" }],
    );
    expect(links).toHaveLength(1);
    // 'informs' → target (PRD-1) is the parent; layout flows from
    // PRD-1 (column 0) to EVID-1 (column 1).
    expect(links[0]?.source).toBe("PRD-1");
    expect(links[0]?.target).toBe("EVID-1");
  });

  it("rfc refines PRD: link from PRD → RFC (PRD parent, RFC child)", () => {
    const { links } = buildSankeyPayload(
      [mk("PRD-1", "prd"), mk("RFC-1", "rfc")],
      [{ from: "RFC-1", to: "PRD-1", relation: "refines" }],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.source).toBe("PRD-1");
    expect(links[0]?.target).toBe("RFC-1");
  });

  it("contains: source remains parent (PRD contains spec → PRD → spec)", () => {
    const { links } = buildSankeyPayload(
      [mk("PRD-1", "prd"), mk("SPEC-1", "spec")],
      [{ from: "PRD-1", to: "SPEC-1", relation: "contains" }],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.source).toBe("PRD-1");
    expect(links[0]?.target).toBe("SPEC-1");
  });

  it("intra-tier edges (same column) are dropped", () => {
    const { links } = buildSankeyPayload(
      [mk("ADR-1", "adr"), mk("ADR-2", "adr")],
      [{ from: "ADR-2", to: "ADR-1", relation: "supersedes" }],
    );
    expect(links).toHaveLength(0);
  });

  it("nodes carry their compact-tier column + kind", () => {
    const { nodes } = buildSankeyPayload(
      [mk("A", "prd"), mk("B", "rfc"), mk("C", "evidence")],
      [],
    );
    expect(nodes.find((n) => n.id === "A")?.column).toBe(0);
    expect(nodes.find((n) => n.id === "B")?.column).toBe(1);
    expect(nodes.find((n) => n.id === "C")?.column).toBe(2);
    expect(nodes.find((n) => n.id === "A")?.kind).toBe("prd");
  });
});
