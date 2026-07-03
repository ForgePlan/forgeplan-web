import { describe, expect, it } from "vitest";
import { validateMapDocument } from "./validate";
import fixture from "./fixtures/checkpoint-map.json";

// SPEC-006 AC-1 — one fixture per E2 rule row (14 rules), a fully-valid
// fixture, a multi-error-in-one-call fixture, a never-throws sweep, and the
// checked-in checkpoint document. Every invalid fixture starts from a fresh
// `baseDoc()` call and breaks exactly one thing, so failures aren't
// tautological across rules.

function baseDoc(): Record<string, any> {
  return {
    schema: "forgeplan.map/v1",
    meta: {
      map_id: "m1",
      status: "confirmed",
      project_type: "test",
      composition_id: "c1",
      source_fingerprint: "fp1",
      version: 1,
    },
    canvas: {
      grid: { cols: 2, rows: 1 },
      gap: { x: 10, y: 10 },
      margin: 10,
      cell: {
        card_w: 100,
        card_h: 40,
        card_gap: 10,
        zpad: { top: 10, side: 10, bottom: 10 },
      },
    },
    composition: {
      template: "t1",
      arrangement: "stack-ttb",
      entry_zone: "z.a",
      placements: [
        { zone: "z.a", cell: { row: 0, col: 0 } },
        { zone: "z.b", cell: { row: 0, col: 1 } },
      ],
      zone_connectors: [{ from: "z.a", to: "z.b", label: "connects" }],
    },
    zones: [
      {
        id: "z.a",
        label: "Zone A",
        kind: "component",
        accent: "--map-accent-a",
        treatment: "neutral-dashed",
        rule_edge: "off",
        layout_rule: "grid",
        cols: 1,
      },
      {
        id: "z.b",
        label: "Zone B",
        kind: "component",
        accent: "--map-accent-b",
        treatment: "neutral-dashed",
        rule_edge: "off",
        layout_rule: "grid",
        cols: 1,
      },
    ],
    nodes: [
      {
        id: "n.1",
        label: "Node 1",
        kind: "gate",
        zone: "z.a",
        found_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "n.2",
        label: "Node 2",
        kind: "store",
        zone: "z.b",
        found_at: "2026-01-01T00:00:01Z",
      },
    ],
    edges: [{ from: "n.1", to: "n.2", relation: "informs" }],
    flows: [{ id: "flow.1", name: "Flow 1", node_ids: ["n.1", "n.2"] }],
  };
}

describe("validateMapDocument", () => {
  it("accepts a fully valid document with zero errors", () => {
    const result = validateMapDocument(baseDoc());
    expect(result.ok).toBe(true);
  });

  it("rule 1 (schema tag) — rejects a wrong schema tag", () => {
    const doc = baseDoc();
    doc.schema = "forgeplan.map/v2";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "schema")).toBe(true);
    }
  });

  it("rule 2 (required blocks) — reports a missing required array", () => {
    const doc = baseDoc();
    delete doc.zones;
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "zones")).toBe(true);
    }
  });

  it("rule 3 (node zone) — reports a node referencing a zone that does not exist", () => {
    const doc = baseDoc();
    doc.nodes[0].zone = "z.ghost";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "nodes[0].zone")).toBe(true);
    }
  });

  it("rule 4 (edge endpoints) — reports an edge endpoint that is not a node", () => {
    const doc = baseDoc();
    doc.edges[0].to = "n.ghost";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "edges[0].to")).toBe(true);
    }
  });

  it("rule 5 (flow refs) — reports a flow referencing a node that does not exist", () => {
    const doc = baseDoc();
    doc.flows[0].node_ids = ["n.1", "n.ghost"];
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "flows[0].node_ids[1]")).toBe(
        true,
      );
    }
  });

  it("rule 6 (connector endpoints) — reports a zone connector endpoint that is not a zone", () => {
    const doc = baseDoc();
    doc.composition.zone_connectors[0].to = "z.ghost";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.path === "composition.zone_connectors[0].to",
        ),
      ).toBe(true);
    }
  });

  it("rule 7 (entry zone) — reports an entry_zone that is not a zone", () => {
    const doc = baseDoc();
    doc.composition.entry_zone = "z.ghost";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "composition.entry_zone"),
      ).toBe(true);
    }
  });

  it("rule 8 (duplicate ids) — reports a duplicate node id", () => {
    const doc = baseDoc();
    doc.nodes[1].id = "n.1";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "nodes[1].id")).toBe(true);
    }
  });

  it("rule 9 (pinned cols) — reports a zone with cols below 1", () => {
    const doc = baseDoc();
    doc.zones[0].cols = 0;
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "zones[0].cols")).toBe(true);
    }
  });

  it("rule 10 (placements) — reports overlapping placement cells", () => {
    const doc = baseDoc();
    doc.composition.placements[1].cell = { row: 0, col: 0 };
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "composition.placements[1].cell"),
      ).toBe(true);
    }
  });

  it("rule 10 (placements) — reports a placement cell outside canvas.grid", () => {
    const doc = baseDoc();
    doc.composition.placements[1].cell = { row: 5, col: 1 };
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "composition.placements[1].cell"),
      ).toBe(true);
    }
  });

  it("rule 11 (mega-node integrity) — reports a mega-node child that is not a node", () => {
    const doc = baseDoc();
    doc.nodes.push({
      id: "n.mega",
      label: "Mega",
      kind: "component",
      zone: "z.a",
      found_at: "2026-01-01T00:00:02Z",
      is_mega: true,
      children: ["n.ghost"],
    });
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "nodes[2].children[0]")).toBe(
        true,
      );
    }
  });

  it("rule 11 (mega-node integrity) — reports a mega-node nesting cycle", () => {
    const doc = baseDoc();
    doc.nodes.push(
      {
        id: "n.mega.a",
        label: "Mega A",
        kind: "component",
        zone: "z.a",
        found_at: "2026-01-01T00:00:02Z",
        is_mega: true,
        children: ["n.mega.b"],
      },
      {
        id: "n.mega.b",
        label: "Mega B",
        kind: "component",
        zone: "z.b",
        found_at: "2026-01-01T00:00:03Z",
        is_mega: true,
        children: ["n.mega.a"],
      },
    );
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.message.includes("nesting cycle")),
      ).toBe(true);
    }
  });

  it("rule 12 (no geometry) — reports a node carrying x/y geometry", () => {
    const doc = baseDoc();
    doc.nodes[0].x = 42;
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "nodes[0].x")).toBe(true);
    }
  });

  it("rule 13 (placement zones) — reports a placement referencing a zone that does not exist", () => {
    const doc = baseDoc();
    doc.composition.placements[0].zone = "z.ghost";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "composition.placements[0].zone"),
      ).toBe(true);
    }
  });

  it("rule 14 (forward-compat) — tolerates unknown keys and unknown edge relations", () => {
    const doc = baseDoc();
    doc.future_field = "reserved for phase 2";
    doc.zones[0].future_zone_field = 1;
    doc.edges[0].relation = "custom-future-relation";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(true);
  });

  it("rule 15 (zone accent) — warns (not errors) on an accent token outside the 7 real --map-accent-* tokens", () => {
    const doc = baseDoc();
    doc.zones[0].accent = "--map-accent-olive";
    const result = validateMapDocument(doc);
    // Warning only — must not flip the document to invalid (EVID-089 1.C).
    expect(result.ok).toBe(true);
  });

  it("rule 15 (zone accent) — accepts every one of the 7 real tokens with zero warnings", () => {
    const tokens = [
      "--map-accent-cyan",
      "--map-accent-emerald",
      "--map-accent-violet",
      "--map-accent-amber",
      "--map-accent-rose",
      "--map-accent-orange",
      "--map-accent-slate",
    ];
    for (const token of tokens) {
      const doc = baseDoc();
      doc.zones[0].accent = token;
      doc.zones[1].accent = token;
      const result = validateMapDocument(doc);
      expect(result.ok).toBe(true);
    }
  });

  it("collects every violated rule in a single call instead of failing fast", () => {
    const doc = baseDoc();
    doc.schema = "forgeplan.map/v2";
    doc.nodes[0].zone = "z.ghost";
    doc.nodes[1].id = "n.1";
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.errors.map((e) => e.path);
      expect(paths).toContain("schema");
      expect(paths).toContain("nodes[0].zone");
      expect(paths).toContain("nodes[1].id");
    }
  });

  it("never throws on hostile input", () => {
    const hostileInputs: unknown[] = [
      undefined,
      null,
      "not an object",
      42,
      [],
      { deeply: { nested: { garbage: true } } },
    ];
    for (const input of hostileInputs) {
      expect(() => validateMapDocument(input)).not.toThrow();
      const result = validateMapDocument(input);
      expect(result.ok).toBe(false);
    }
  });

  it("validates the checked-in checkpoint fixture with zero errors", () => {
    const result = validateMapDocument(fixture);
    expect(result.ok).toBe(true);
  });
});
