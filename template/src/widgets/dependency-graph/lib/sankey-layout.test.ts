import { describe, it, expect } from "vitest";
import { assignSankeyColumns, buildSankeyPayload } from "./sankey-layout";
import type { ArtifactSummary } from "@/entities/artifact";

const mk = (id: string, kind: string): ArtifactSummary =>
  ({ id, kind, title: "", status: "active" }) as ArtifactSummary;

describe("assignSankeyColumns — column = hierarchy depth from any root", () => {
  it("isolated nodes all sit at column 0", () => {
    const cols = assignSankeyColumns([mk("A", "prd"), mk("B", "prd")], []);
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(0);
  });

  it("linear chain A → B → C produces columns 0,1,2", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "rfc"), mk("C", "evidence")],
      [
        { from: "A", to: "B", relation: "refines" },
        { from: "B", to: "C", relation: "informs" },
      ],
    );
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(1);
    expect(cols["C"]).toBe(2);
  });

  it("multiple parents → child gets minimum depth", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "prd"), mk("C", "rfc"), mk("D", "evidence")],
      [
        { from: "A", to: "C", relation: "refines" },
        { from: "B", to: "D", relation: "refines" },
        { from: "C", to: "D", relation: "informs" },
      ],
    );
    // D has parents B (col 0 → D=1) and C (col 1 → D=2). min = 1.
    expect(cols["D"]).toBe(1);
  });

  it("ignores non-hierarchy edges (e.g. 'risk')", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "rfc")],
      [{ from: "A", to: "B", relation: "risk" }],
    );
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(0);
  });

  it("cycle: both nodes in cycle reach column 0 (both are roots)", () => {
    const cols = assignSankeyColumns(
      [mk("A", "prd"), mk("B", "prd")],
      [
        { from: "A", to: "B", relation: "refines" },
        { from: "B", to: "A", relation: "refines" },
      ],
    );
    // No root (both have incoming edges) → fallback to column 0.
    expect(cols["A"]).toBe(0);
    expect(cols["B"]).toBe(0);
  });
});

describe("buildSankeyPayload — d3-sankey input shape", () => {
  it("links go from lower column to higher column only", () => {
    const { nodes, links } = buildSankeyPayload(
      [mk("A", "prd"), mk("B", "rfc")],
      [
        { from: "A", to: "B", relation: "refines" },
        { from: "B", to: "A", relation: "refines" },
      ],
    );
    expect(nodes.length).toBe(2);
    // A and B both at col 0 (cycle), so neither link crosses columns →
    // both filtered out.
    expect(links.length).toBe(0);
  });

  it("includes node `column` and `kind`", () => {
    const { nodes } = buildSankeyPayload(
      [mk("A", "prd"), mk("B", "rfc")],
      [{ from: "A", to: "B", relation: "refines" }],
    );
    expect(nodes.find((n) => n.id === "A")?.column).toBe(0);
    expect(nodes.find((n) => n.id === "B")?.column).toBe(1);
    expect(nodes.find((n) => n.id === "A")?.kind).toBe("prd");
  });
});
