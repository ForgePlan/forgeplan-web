import { describe, it, expect } from "vitest";
import { buildMarkdownSummary } from "./markdown-export";
import type { ArtifactDetail } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

const mkArtifact = (overrides: Partial<ArtifactDetail> = {}): ArtifactDetail =>
  ({
    id: "PRD-001",
    title: "Test PRD",
    kind: "prd",
    status: "active",
    r_eff: 0.85,
    body: "Hello world",
    ...overrides,
  }) as ArtifactDetail;

const mkEdge = (from: string, to: string, relation: string): GraphEdge =>
  ({ from, to, relation }) as GraphEdge;

describe("buildMarkdownSummary", () => {
  it("includes id, title, status, kind, r_eff", () => {
    const md = buildMarkdownSummary(mkArtifact(), [], []);
    expect(md).toContain("# PRD-001 — Test PRD");
    expect(md).toContain("**Status**: active");
    expect(md).toContain("**Kind**: prd");
    expect(md).toContain("**R_eff**: 0.85");
  });

  it("omits Outgoing/Incoming sections when empty", () => {
    const md = buildMarkdownSummary(mkArtifact(), [], []);
    expect(md).not.toContain("## Outgoing");
    expect(md).not.toContain("## Incoming");
  });

  it("renders outgoing/incoming as bullet lists", () => {
    const md = buildMarkdownSummary(
      mkArtifact(),
      [
        mkEdge("PRD-001", "RFC-001", "refines"),
        mkEdge("PRD-001", "EVID-001", "informs"),
      ],
      [mkEdge("EPIC-001", "PRD-001", "contains")],
    );
    expect(md).toContain("## Outgoing");
    expect(md).toContain("- RFC-001 (refines)");
    expect(md).toContain("- EVID-001 (informs)");
    expect(md).toContain("## Incoming");
    expect(md).toContain("- EPIC-001 (contains)");
  });

  it("renders R_eff as 'n/a' when missing", () => {
    const md = buildMarkdownSummary(mkArtifact({ r_eff: undefined }), [], []);
    expect(md).toContain("**R_eff**: n/a");
  });

  it("truncates body excerpt past 500 chars and appends ...", () => {
    const longBody = "x".repeat(800);
    const md = buildMarkdownSummary(mkArtifact({ body: longBody }), [], []);
    expect(md).toContain("## Body excerpt");
    // Find the body excerpt content
    const idx = md.indexOf("## Body excerpt");
    const tail = md.slice(idx);
    expect(tail).toMatch(/x{1,500}\.\.\./);
    // Should NOT contain the full 800-x string
    expect(tail).not.toContain("x".repeat(800));
  });

  it("omits Body section when artifact.body is empty", () => {
    const md = buildMarkdownSummary(mkArtifact({ body: "" }), [], []);
    expect(md).not.toContain("## Body excerpt");
  });
});
