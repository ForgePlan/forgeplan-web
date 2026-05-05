import { describe, it, expect } from "vitest";
import { pickNextNode, type FocusNode } from "./keyboard-nav";

const mk = (id: string, x: number, y: number): FocusNode => ({ id, x, y });

describe("pickNextNode — direction-based focus pick", () => {
  it("ArrowRight picks the rightward neighbour over the upward one", () => {
    const current = mk("A", 0, 0);
    const candidates = [current, mk("RIGHT", 100, 0), mk("UP", 0, -100)];
    const next = pickNextNode(current, candidates, "ArrowRight");
    expect(next?.id).toBe("RIGHT");
  });

  it("ArrowUp picks the upward node even when a rightward one is closer", () => {
    const current = mk("A", 0, 0);
    const candidates = [current, mk("UP", 0, -100), mk("RIGHT", 30, 0)];
    const next = pickNextNode(current, candidates, "ArrowUp");
    expect(next?.id).toBe("UP");
  });

  it("ArrowLeft falls back to nearest when no candidate inside cone", () => {
    const current = mk("A", 0, 0);
    // Both candidates are to the right, none to the left → fall back to nearest.
    const candidates = [current, mk("R1", 50, 0), mk("R2", 100, 0)];
    const next = pickNextNode(current, candidates, "ArrowLeft");
    expect(next?.id).toBe("R1");
  });

  it("returns null when there is only the current node", () => {
    const current = mk("A", 0, 0);
    expect(pickNextNode(current, [current], "ArrowDown")).toBeNull();
  });

  it("ArrowDown prefers a slightly-off-axis closer node over a far on-axis one", () => {
    const current = mk("A", 0, 0);
    // CLOSE_OFF: 10° off the down axis at distance 50.
    // FAR_ON: exactly down at distance 200.
    const ang = (10 * Math.PI) / 180;
    const closeOff = mk("CLOSE_OFF", Math.sin(ang) * 50, Math.cos(ang) * 50);
    const farOn = mk("FAR_ON", 0, 200);
    const next = pickNextNode(current, [current, closeOff, farOn], "ArrowDown");
    expect(next?.id).toBe("CLOSE_OFF");
  });

  it("ignores nodes at exactly the same position (avoid divide-by-zero)", () => {
    const current = mk("A", 0, 0);
    const dup = mk("DUP", 0, 0);
    const right = mk("R", 50, 0);
    const next = pickNextNode(current, [current, dup, right], "ArrowRight");
    expect(next?.id).toBe("R");
  });
});
