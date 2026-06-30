import { describe, expect, it } from "vitest";
import { displayId } from "./identity";

describe("displayId", () => {
  it("returns id_display when present (slug-aware activated artefact)", () => {
    expect(displayId({ id: "PRD-074", id_display: "PRD-074" })).toBe("PRD-074");
  });

  it("preserves '?' marker verbatim for pre-merge drafts", () => {
    expect(displayId({ id: "PRD-074", id_display: "PRD-74?" })).toBe("PRD-74?");
  });

  it("falls back to id for legacy artefacts without id_display", () => {
    expect(displayId({ id: "PRD-001" })).toBe("PRD-001");
  });

  it("falls back to id when id_display is an empty string (I-5)", () => {
    // Defensive against an upstream regression: if forgeplan ever ships
    // an empty id_display, we still render something legible rather than
    // a blank label. Invariant I-5 in RFC-015.
    expect(displayId({ id: "PRD-001", id_display: "" })).toBe("PRD-001");
  });
});
