import { describe, expect, it } from "vitest";
import { quadrant } from "./drag";

function rect(): DOMRect {
  return {
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("quadrant", () => {
  it("returns center for the middle area", () => {
    expect(quadrant(rect(), 50, 50)).toBe("center");
  });
  it("returns left for the leftmost edge", () => {
    expect(quadrant(rect(), 5, 50)).toBe("left");
  });
  it("returns right for the rightmost edge", () => {
    expect(quadrant(rect(), 95, 50)).toBe("right");
  });
  it("returns top for top edge", () => {
    expect(quadrant(rect(), 50, 5)).toBe("top");
  });
  it("returns bottom for bottom edge", () => {
    expect(quadrant(rect(), 50, 95)).toBe("bottom");
  });
});
