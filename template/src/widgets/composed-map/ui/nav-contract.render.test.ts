// @vitest-environment happy-dom
/**
 * RFC-030:151 nav-contract render-proof for ComposedMapView.svelte.
 *
 * EVID-089 finding 1.A: the Phase-1 checkpoint promised this suite
 * ("Esc -> full reset: clear selection, zoom->1, pan home") but it was
 * never delivered. This covers the 3 cases the audit named: Esc/empty-click
 * reset, >3px drag-suppression, and wheel routing (plain pans, Ctrl/Cmd
 * is left to d3-zoom).
 *
 * Harness: happy-dom + Svelte's built-in mount() — same pattern as the
 * sibling render-proof suite (dependency-graph/ui/idef0-view.render.test.ts).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";

vi.mock("@/shared/api", () => {
  return {
    createPoller: () => ({
      state: {
        data: null,
        loading: false,
        error: null,
        lastFetched: null,
        cmd: null,
      },
      refresh: async () => {},
      start: () => {},
      stop: () => {},
    }),
  };
});

import ComposedMapView from "./ComposedMapView.svelte";
import { mapPoller } from "@/entities/map";
import fixture from "@/entities/map/lib/fixtures/checkpoint-map.json";

let host: HTMLElement | null = null;
let instance: unknown = null;

function mountView(extraProps: Record<string, unknown> = {}): HTMLElement {
  mapPoller.state.data = fixture as never;
  mapPoller.state.error = null;
  mapPoller.state.lastFetched = Date.now();
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(ComposedMapView, { target: host, props: { ...extraProps } });
  flushSync();
  return host;
}

afterEach(() => {
  if (instance) {
    unmount(instance as object);
    instance = null;
  }
  host?.remove();
  host = null;
  vi.restoreAllMocks();
});

describe("§15 nav contract", () => {
  it("Escape triggers full reset: calls onClearSelection (RFC-030:121-125)", () => {
    const onClearSelection = vi.fn();
    const root = mountView({ onClearSelection });
    const svg = root.querySelector(".map-canvas")!;

    svg.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("click on empty canvas (no prior drag) also calls onClearSelection", () => {
    const onClearSelection = vi.fn();
    const root = mountView({ onClearSelection });
    const svg = root.querySelector(".map-canvas")!;

    svg.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("a drag exceeding 3px suppresses the click that follows (§15 drag suppression)", () => {
    const onClearSelection = vi.fn();
    const root = mountView({ onClearSelection });
    const svg = root.querySelector<HTMLElement>(".map-canvas")!;

    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      }),
    );
    svg.dispatchEvent(
      // dx = 20 > 3 -> justDragged
      new PointerEvent("pointerup", {
        clientX: 120,
        clientY: 100,
        bubbles: true,
      }),
    );
    svg.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();

    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("a drag of <=3px does NOT suppress the following click", () => {
    const onClearSelection = vi.fn();
    const root = mountView({ onClearSelection });
    const svg = root.querySelector<HTMLElement>(".map-canvas")!;

    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      }),
    );
    svg.dispatchEvent(
      // dx = 2 <= 3 -> not a drag, click fires normally
      new PointerEvent("pointerup", {
        clientX: 102,
        clientY: 100,
        bubbles: true,
      }),
    );
    svg.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("plain wheel pans the transform by -deltaX/-deltaY; Ctrl/Cmd+wheel leaves the manual pan path untouched", () => {
    const onViewState = vi.fn();
    mountView({ onViewState });
    flushSync();

    const host_ = host!;
    const svg = host_.querySelector<HTMLElement>(".map-canvas")!;

    const before = onViewState.mock.calls.at(-1)?.[0]?.transform;
    expect(before).toBeDefined();

    svg.dispatchEvent(
      new WheelEvent("wheel", {
        deltaX: 30,
        deltaY: 10,
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();

    const afterPlain = onViewState.mock.calls.at(-1)?.[0]?.transform;
    expect(afterPlain.x).toBeCloseTo(before.x - 30, 5);
    expect(afterPlain.y).toBeCloseTo(before.y - 10, 5);
    expect(afterPlain.k).toBeCloseTo(before.k, 5);

    // TODO(happy-dom-wheelevent-ctrlkey): happy-dom's WheelEvent constructor
    // does not forward ctrlKey/metaKey from the init dict (verified against
    // happy-dom directly) -- define it post-construction so handleWheel()
    // sees the same event shape a real browser would dispatch.
    const ctrlWheel = new WheelEvent("wheel", {
      deltaX: 30,
      deltaY: 10,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(ctrlWheel, "ctrlKey", {
      value: true,
      configurable: true,
    });

    // handleWheel() early-returns on ctrlKey/metaKey and leaves the gesture
    // to d3-zoom's own pointer/gesture handling, which needs SVGPoint
    // matrixTransform() + a real CTM/bounding-rect -- happy-dom doesn't
    // implement enough of the SVG geometry API for that path to run
    // end-to-end (verified: it throws or produces NaN here), so this
    // assertion targets ONLY our own contract -- that handleWheel's manual
    // translate-by-delta branch did not run a second time -- not d3-zoom's
    // internal math (that's d3's own tested library code, and this repo's
    // Playwright render-proof already covers the real-browser zoom gesture,
    // e.g. EVID-087's composed-map-zoom-check.png).
    try {
      svg.dispatchEvent(ctrlWheel);
    } catch {
      // Expected in this environment -- see TODO above.
    }
    flushSync();

    const afterCtrl = onViewState.mock.calls.at(-1)?.[0]?.transform;
    expect(afterCtrl.x).not.toBeCloseTo(afterPlain.x - 30, 5);
    expect(afterCtrl.y).not.toBeCloseTo(afterPlain.y - 10, 5);
  });
});

describe("flow highlight (EVID-089 1.B — NodeCard now dims alongside EdgeLayer)", () => {
  it("toggling a flow chip dims nodes outside the flow and leaves member nodes undimmed", () => {
    const root = mountView();

    // "init scaffolds the web app" (flow.init) node_ids: n.init, n.dist-stable,
    // n.api-proxy, n.graph-views -- n.start (label "start") is NOT a member.
    const chip = Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("init scaffolds the web app"),
    );
    expect(chip).toBeDefined();
    chip!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();

    function cardFor(label: string): Element {
      const match = Array.from(root.querySelectorAll(".node-card")).find(
        (card) => card.querySelector(".card-label")?.textContent === label,
      );
      expect(match).toBeDefined();
      return match!;
    }

    expect(cardFor("init").classList.contains("dimmed")).toBe(false);
    expect(cardFor("start").classList.contains("dimmed")).toBe(true);
  });

  it("toggling a flow renders the flowcap step narration + lights member nodes; the All chip clears it", () => {
    const root = mountView();

    function cardFor(label: string): Element {
      const match = Array.from(root.querySelectorAll(".node-card")).find(
        (card) => card.querySelector(".card-label")?.textContent === label,
      );
      expect(match).toBeDefined();
      return match!;
    }

    const chip = Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("init scaffolds the web app"),
    );
    chip!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();

    // flowcap appears with the flow name + one <li> per carried step
    const cap = root.querySelector(".flowcap");
    expect(cap).not.toBeNull();
    expect(cap!.querySelector(".flowcap-name")?.textContent).toContain("init");
    expect(cap!.querySelectorAll(".flowcap-steps li").length).toBeGreaterThan(
      0,
    );

    // member node is lit (clay), non-member is not
    expect(cardFor("init").classList.contains("lit")).toBe(true);
    expect(cardFor("start").classList.contains("lit")).toBe(false);

    // the "All" chip clears the flow -> flowcap disappears
    const allChip = Array.from(root.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "All",
    );
    expect(allChip).toBeDefined();
    allChip!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();
    expect(root.querySelector(".flowcap")).toBeNull();
    expect(cardFor("init").classList.contains("lit")).toBe(false);
  });
});
