import { describe, it, expect } from "vitest";
import {
  computeBBox,
  bboxScale,
  canvasToMini,
  miniToCanvas,
  viewportRectInMini,
} from "./minimap-math";

const MINI_W = 180;
const MINI_H = 120;

describe("computeBBox", () => {
  it("returns safe default for empty positions", () => {
    const bbox = computeBBox([]);
    expect(bbox).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
  });

  it("expands by padding around min/max", () => {
    const bbox = computeBBox(
      [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
      ],
      10,
    );
    expect(bbox).toEqual({ minX: -10, minY: -10, maxX: 110, maxY: 210 });
  });
});

describe("canvasToMini ↔ miniToCanvas round-trip", () => {
  it("inverse of canvasToMini reproduces original canvas-space point", () => {
    const bbox = computeBBox([
      { x: 0, y: 0 },
      { x: 400, y: 300 },
    ]);
    const scale = bboxScale(bbox, MINI_W, MINI_H);
    const original = { x: 150, y: 80 };
    const mini = canvasToMini(original, bbox, scale, MINI_W, MINI_H);
    const back = miniToCanvas(mini, bbox, scale, MINI_W, MINI_H);
    expect(back.x).toBeCloseTo(original.x, 6);
    expect(back.y).toBeCloseTo(original.y, 6);
  });

  it("centre of canvas bbox maps to centre of minimap rect", () => {
    const bbox = computeBBox([
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    ]);
    const scale = bboxScale(bbox, MINI_W, MINI_H);
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const mini = canvasToMini({ x: cx, y: cy }, bbox, scale, MINI_W, MINI_H);
    expect(mini.x).toBeCloseTo(MINI_W / 2, 6);
    expect(mini.y).toBeCloseTo(MINI_H / 2, 6);
  });
});

describe("viewportRectInMini", () => {
  it("at identity transform with viewport == bbox span, rect spans the inscribed area", () => {
    const bbox = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    const scale = bboxScale(bbox, MINI_W, MINI_H);
    const rect = viewportRectInMini(
      { x: 0, y: 0, k: 1 },
      { w: 200, h: 100 },
      bbox,
      scale,
      MINI_W,
      MINI_H,
    );
    const tl = canvasToMini({ x: 0, y: 0 }, bbox, scale, MINI_W, MINI_H);
    expect(rect.x).toBeCloseTo(tl.x, 6);
    expect(rect.y).toBeCloseTo(tl.y, 6);
    expect(rect.w).toBeCloseTo(200 * scale, 6);
    expect(rect.h).toBeCloseTo(100 * scale, 6);
  });

  it("zooming in (k>1) shrinks viewport rect proportionally", () => {
    const bbox = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
    const scale = bboxScale(bbox, MINI_W, MINI_H);
    const r1 = viewportRectInMini(
      { x: 0, y: 0, k: 1 },
      { w: 400, h: 300 },
      bbox,
      scale,
      MINI_W,
      MINI_H,
    );
    const r2 = viewportRectInMini(
      { x: 0, y: 0, k: 2 },
      { w: 400, h: 300 },
      bbox,
      scale,
      MINI_W,
      MINI_H,
    );
    expect(r2.w).toBeCloseTo(r1.w / 2, 6);
    expect(r2.h).toBeCloseTo(r1.h / 2, 6);
  });

  it("panning the canvas shifts the viewport rect in the opposite minimap direction", () => {
    const bbox = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
    const scale = bboxScale(bbox, MINI_W, MINI_H);
    const base = viewportRectInMini(
      { x: 0, y: 0, k: 1 },
      { w: 400, h: 300 },
      bbox,
      scale,
      MINI_W,
      MINI_H,
    );
    const panned = viewportRectInMini(
      { x: -100, y: 0, k: 1 },
      { w: 400, h: 300 },
      bbox,
      scale,
      MINI_W,
      MINI_H,
    );
    expect(panned.x - base.x).toBeCloseTo(100 * scale, 6);
    expect(panned.y).toBeCloseTo(base.y, 6);
  });
});
