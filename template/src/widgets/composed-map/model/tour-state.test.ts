import { describe, expect, it } from "vitest";
import {
  buildTourStops,
  currentStop,
  exitTour,
  goToStop,
  nextStop,
  prevStop,
  startTour,
  type TourState,
} from "./tour-state";
import type { MapDocument, MapNode, MapZone } from "@/entities/map";

// RFC-033 Test Strategy Hooks — stops built in placement order; zones[]
// fallback when placements absent; empty doc -> []; a zone with no
// description_ru -> narrationRu undefined (not fabricated); start/next/
// prev/goTo/exit transitions; last-next -> exit; currentStop
// active/inactive; determinism (same doc -> deep-equal stops twice).

function zone(overrides: Partial<MapZone> = {}): MapZone {
  return {
    id: "z.a",
    label: "Zone A",
    kind: "surface",
    accent: "--map-accent-cyan",
    treatment: "neutral-dashed",
    rule_edge: "off",
    layout_rule: "grid",
    cols: 2,
    ...overrides,
  };
}

function node(overrides: Partial<MapNode> = {}): MapNode {
  return {
    id: "n1",
    label: "Node 1",
    kind: "component",
    zone: "z.a",
    found_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseDoc(overrides: Partial<MapDocument> = {}): MapDocument {
  return {
    schema: "forgeplan.map/v1",
    meta: {
      map_id: "test",
      status: "confirmed",
      project_type: "generic",
      composition_id: "c1",
      source_fingerprint: "fp",
      version: 1,
    },
    canvas: {
      grid: { cols: 2, rows: 1 },
      gap: { x: 88, y: 70 },
      margin: 40,
      cell: {
        card_w: 190,
        card_h: 60,
        card_gap: 36,
        zpad: { top: 50, side: 24, bottom: 24 },
      },
    },
    composition: {
      template: "generic",
      arrangement: "stack-ttb",
      entry_zone: "z.a",
      placements: [{ zone: "z.a", cell: { row: 0, col: 0 } }],
      zone_connectors: [],
    },
    zones: [zone()],
    nodes: [node()],
    edges: [],
    ...overrides,
  };
}

describe("buildTourStops — placement order", () => {
  it("walks composition.placements sorted by (row, col), not authoring order", () => {
    const doc = baseDoc({
      composition: {
        template: "generic",
        arrangement: "stack-ttb",
        entry_zone: "z.b",
        placements: [
          { zone: "z.c", cell: { row: 1, col: 0 } },
          { zone: "z.a", cell: { row: 0, col: 1 } },
          { zone: "z.b", cell: { row: 0, col: 0 } },
        ],
        zone_connectors: [],
      },
      zones: [
        zone({ id: "z.a", label: "A" }),
        zone({ id: "z.b", label: "B" }),
        zone({ id: "z.c", label: "C" }),
      ],
      nodes: [],
    });
    const stops = buildTourStops(doc);
    expect(stops.map((s) => s.zoneId)).toEqual(["z.b", "z.a", "z.c"]);
  });

  it("dedupes a zone placed more than once, keeping its first occurrence", () => {
    const doc = baseDoc({
      composition: {
        template: "generic",
        arrangement: "stack-ttb",
        entry_zone: "z.a",
        placements: [
          { zone: "z.a", cell: { row: 0, col: 0 } },
          { zone: "z.a", cell: { row: 1, col: 0, col_span: 2 } },
        ],
        zone_connectors: [],
      },
      zones: [zone({ id: "z.a" })],
      nodes: [],
    });
    expect(buildTourStops(doc).map((s) => s.zoneId)).toEqual(["z.a"]);
  });

  it("skips a placement referencing an unknown zone id", () => {
    const doc = baseDoc({
      composition: {
        template: "generic",
        arrangement: "stack-ttb",
        entry_zone: "z.a",
        placements: [
          { zone: "z.ghost", cell: { row: 0, col: 0 } },
          { zone: "z.a", cell: { row: 0, col: 1 } },
        ],
        zone_connectors: [],
      },
      zones: [zone({ id: "z.a" })],
      nodes: [],
    });
    expect(buildTourStops(doc).map((s) => s.zoneId)).toEqual(["z.a"]);
  });
});

describe("buildTourStops — zones[] fallback", () => {
  it("falls back to zones[] array order when placements is empty", () => {
    const doc = baseDoc({
      composition: {
        template: "generic",
        arrangement: "stack-ttb",
        entry_zone: "z.a",
        placements: [],
        zone_connectors: [],
      },
      zones: [zone({ id: "z.b", label: "B" }), zone({ id: "z.a", label: "A" })],
      nodes: [],
    });
    expect(buildTourStops(doc).map((s) => s.zoneId)).toEqual(["z.b", "z.a"]);
  });

  it("returns [] for an empty/degenerate document (no zones, no placements)", () => {
    const doc = baseDoc({
      composition: {
        template: "generic",
        arrangement: "stack-ttb",
        entry_zone: "",
        placements: [],
        zone_connectors: [],
      },
      zones: [],
      nodes: [],
    });
    expect(buildTourStops(doc)).toEqual([]);
  });
});

describe("buildTourStops — narration honesty (§15 / FD-7)", () => {
  it("carries zone.description_ru verbatim as narrationRu when present", () => {
    const doc = baseDoc({
      zones: [zone({ id: "z.a", description_ru: "Русское описание." })],
      nodes: [],
    });
    expect(buildTourStops(doc)[0]!.narrationRu).toBe("Русское описание.");
  });

  it("leaves narrationRu undefined (never fabricated) when description_ru is absent", () => {
    const doc = baseDoc({
      zones: [zone({ id: "z.a", description_ru: undefined })],
      nodes: [],
    });
    expect(buildTourStops(doc)[0]!.narrationRu).toBeUndefined();
  });
});

describe("buildTourStops — member summary", () => {
  it("counts non-mega member nodes and lists up to the first 6 labels", () => {
    const nodes: MapNode[] = Array.from({ length: 8 }, (_, i) =>
      node({ id: `n${i}`, label: `Node ${i}`, zone: "z.a" }),
    );
    const doc = baseDoc({ zones: [zone({ id: "z.a" })], nodes });
    const stop = buildTourStops(doc)[0]!;
    expect(stop.memberSummary.total).toBe(8);
    expect(stop.memberSummary.labels).toEqual([
      "Node 0",
      "Node 1",
      "Node 2",
      "Node 3",
      "Node 4",
      "Node 5",
    ]);
  });

  it("excludes is_mega placeholder cards from the member summary", () => {
    const doc = baseDoc({
      zones: [zone({ id: "z.a" })],
      nodes: [
        node({ id: "n1", zone: "z.a" }),
        node({ id: "mega1", zone: "z.a", is_mega: true, label: "Mega" }),
      ],
    });
    const stop = buildTourStops(doc)[0]!;
    expect(stop.memberSummary.total).toBe(1);
    expect(stop.memberSummary.labels).toEqual(["Node 1"]);
  });
});

describe("buildTourStops — determinism", () => {
  it("returns deep-equal stops when called twice with the same document", () => {
    const doc = baseDoc();
    expect(buildTourStops(doc)).toEqual(buildTourStops(doc));
  });
});

describe("tour state transitions", () => {
  const initial: TourState = { active: false, index: 0 };

  it("startTour activates at index 0 regardless of prior state", () => {
    expect(startTour(initial)).toEqual({ active: true, index: 0 });
    expect(startTour({ active: true, index: 3 })).toEqual({
      active: true,
      index: 0,
    });
  });

  it("nextStop advances the index while more stops remain", () => {
    const state: TourState = { active: true, index: 0 };
    expect(nextStop(state, 3)).toEqual({ active: true, index: 1 });
  });

  it("nextStop at the last index exits the tour (FR-006)", () => {
    const state: TourState = { active: true, index: 2 };
    expect(nextStop(state, 3)).toEqual({ active: false, index: 0 });
  });

  it("prevStop steps back and clamps at 0", () => {
    expect(prevStop({ active: true, index: 2 })).toEqual({
      active: true,
      index: 1,
    });
    expect(prevStop({ active: true, index: 0 })).toEqual({
      active: true,
      index: 0,
    });
  });

  it("goToStop clamps to [0, count-1]", () => {
    expect(goToStop({ active: true, index: 0 }, 5, 3)).toEqual({
      active: true,
      index: 2,
    });
    expect(goToStop({ active: true, index: 0 }, -5, 3)).toEqual({
      active: true,
      index: 0,
    });
  });

  it("exitTour always resets to the inactive/index-0 shape", () => {
    expect(exitTour({ active: true, index: 4 })).toEqual({
      active: false,
      index: 0,
    });
  });
});

describe("currentStop", () => {
  const stops = buildTourStops(baseDoc());

  it("returns null while the tour is inactive", () => {
    expect(currentStop(stops, { active: false, index: 0 })).toBeNull();
  });

  it("returns the stop at the active index", () => {
    expect(currentStop(stops, { active: true, index: 0 })).toBe(stops[0]);
  });

  it("returns null when the active index is out of range", () => {
    expect(currentStop(stops, { active: true, index: 99 })).toBeNull();
  });
});
