import { describe, expect, it } from "vitest";
import { hitTestZone, toLayoutPoint, type Transform } from "./hit-test";
import type { Rect } from "@/entities/map/lib/composed-layout";
import type { MapZone } from "@/entities/map/model/types";

function svgRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

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

const identity: Transform = { x: 0, y: 0, k: 1 };

describe("toLayoutPoint", () => {
  it("is the identity mapping under an identity transform (no viewBox)", () => {
    const p = toLayoutPoint(100, 50, svgRect(), identity);
    expect(p).toEqual({ x: 100, y: 50 });
  });

  it("subtracts the svg element's own offset before inverting the transform", () => {
    const rect = svgRect({ left: 20, top: 10, right: 820, bottom: 610 });
    const p = toLayoutPoint(120, 60, rect, identity);
    expect(p).toEqual({ x: 100, y: 50 });
  });

  it("inverts a non-identity pan/zoom transform", () => {
    const t: Transform = { x: 50, y: 20, k: 2 };
    // client point that should map back to layout (30, 40):
    // local = client - svgRect.{left,top}; layout = (local - t) / k
    const client = { x: 50 + 30 * 2, y: 20 + 40 * 2 };
    const p = toLayoutPoint(client.x, client.y, svgRect(), t);
    expect(p.x).toBeCloseTo(30);
    expect(p.y).toBeCloseTo(40);
  });

  it("round-trips: hitTestZone finds the right zone under a non-identity transform", () => {
    const t: Transform = { x: 50, y: 20, k: 2 };
    const rect: Rect = { x: 10, y: 10, w: 100, h: 60 };
    const zoneRects = new Map([["z.a", rect]]);
    // pick a client point that maps into the middle of `rect` under `t`
    const layoutCenter = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    const client = {
      x: t.x + layoutCenter.x * t.k,
      y: t.y + layoutCenter.y * t.k,
    };
    const p = toLayoutPoint(client.x, client.y, svgRect(), t);
    expect(hitTestZone(p, [zone({ id: "z.a" })], zoneRects)).toBe("z.a");
  });
});

describe("hitTestZone", () => {
  it("returns the id of the zone whose rect contains the point", () => {
    const zoneRects = new Map<string, Rect>([
      ["z.a", { x: 0, y: 0, w: 100, h: 100 }],
      ["z.b", { x: 100, y: 0, w: 100, h: 100 }],
    ]);
    const zones = [zone({ id: "z.a" }), zone({ id: "z.b" })];
    expect(hitTestZone({ x: 50, y: 50 }, zones, zoneRects)).toBe("z.a");
    expect(hitTestZone({ x: 150, y: 50 }, zones, zoneRects)).toBe("z.b");
  });

  it("returns null for a point over empty canvas (no zone rect contains it)", () => {
    const zoneRects = new Map<string, Rect>([
      ["z.a", { x: 0, y: 0, w: 100, h: 100 }],
    ]);
    expect(
      hitTestZone({ x: 500, y: 500 }, [zone({ id: "z.a" })], zoneRects),
    ).toBeNull();
  });

  it("returns null when there are no zones at all", () => {
    expect(hitTestZone({ x: 0, y: 0 }, [], new Map())).toBeNull();
  });

  it("treats the zone rect boundary as inclusive", () => {
    const zoneRects = new Map<string, Rect>([
      ["z.a", { x: 0, y: 0, w: 100, h: 100 }],
    ]);
    const zones = [zone({ id: "z.a" })];
    expect(hitTestZone({ x: 0, y: 0 }, zones, zoneRects)).toBe("z.a");
    expect(hitTestZone({ x: 100, y: 100 }, zones, zoneRects)).toBe("z.a");
    expect(hitTestZone({ x: 100.01, y: 50 }, zones, zoneRects)).toBeNull();
  });

  it("returns the first match in document zone order when rects overlap", () => {
    const zoneRects = new Map<string, Rect>([
      ["z.a", { x: 0, y: 0, w: 100, h: 100 }],
      ["z.b", { x: 0, y: 0, w: 100, h: 100 }],
    ]);
    const zones = [zone({ id: "z.a" }), zone({ id: "z.b" })];
    expect(hitTestZone({ x: 50, y: 50 }, zones, zoneRects)).toBe("z.a");
  });

  it("skips a zone with no resolved rect without throwing", () => {
    const zoneRects = new Map<string, Rect>();
    expect(() =>
      hitTestZone({ x: 0, y: 0 }, [zone({ id: "z.a" })], zoneRects),
    ).not.toThrow();
    expect(
      hitTestZone({ x: 0, y: 0 }, [zone({ id: "z.a" })], zoneRects),
    ).toBeNull();
  });
});
