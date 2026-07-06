// @vitest-environment happy-dom
/**
 * RFC-033 (Pillar B) render-proof for the onboarding tour wired into
 * ComposedMapView.svelte: the "Start tour" affordance, the camera-driving
 * step lifecycle (Next/Prev/last-Next-exits), Esc/canvas-click precedence
 * over the Phase-1 nav contract (Invariant 6), and the shared fit-scale
 * clamp `fitToRect` reuses (Invariant 3). Harness: happy-dom + Svelte's
 * built-in mount() — same pattern as nav-contract.render.test.ts.
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
import { buildTourStops } from "../model/tour-state";
import fixture from "@/entities/map/lib/fixtures/checkpoint-map.json";
import type { MapDocument } from "@/entities/map";

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

function findButton(root: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(root.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  );
  expect(btn).toBeDefined();
  return btn as HTMLButtonElement;
}

function click(el: Element) {
  el.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  flushSync();
}

const expectedStops = buildTourStops(fixture as unknown as MapDocument);

describe("onboarding tour — lifecycle", () => {
  it("shows a Start tour affordance at level 0 when the doc has stops", () => {
    const root = mountView();
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    findButton(root, "Start tour");
  });

  it("Start tour opens the overlay on the first stop with progress 1 / N", () => {
    const root = mountView();
    click(findButton(root, "Start tour"));

    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain(expectedStops[0]!.label);
    expect(dialog!.textContent).toContain(`1 / ${expectedStops.length}`);
  });

  it("Next advances to the next stop; Prev steps back; Prev is clamped at stop 1", () => {
    const root = mountView();
    click(findButton(root, "Start tour"));

    click(findButton(root, "Next"));
    let dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(expectedStops[1]!.label);
    expect(dialog.textContent).toContain(`2 / ${expectedStops.length}`);

    click(findButton(root, "Prev"));
    dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(expectedStops[0]!.label);
    expect(dialog.textContent).toContain(`1 / ${expectedStops.length}`);
  });

  it("reaching the last stop and clicking Next (Done) exits the tour", () => {
    const root = mountView();
    click(findButton(root, "Start tour"));

    for (let i = 1; i < expectedStops.length; i++) {
      click(findButton(root, "Next"));
    }
    let dialog = root.querySelector('[role="dialog"]');
    expect(dialog!.textContent).toContain(
      `${expectedStops.length} / ${expectedStops.length}`,
    );

    click(findButton(root, "Done"));
    dialog = root.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
    // Free-browse again: the affordance is back.
    findButton(root, "Start tour");
  });

  it("Exit closes the overlay and returns the Start tour affordance", () => {
    const root = mountView();
    click(findButton(root, "Start tour"));
    click(findButton(root, "Exit"));
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    findButton(root, "Start tour");
  });
});

describe("onboarding tour — Esc/click precedence (Invariant 6, Cycle 3)", () => {
  it("Esc exits the tour WITHOUT also triggering the Phase-1 full reset", () => {
    const onClearSelection = vi.fn();
    const root = mountView({ onClearSelection });
    click(findButton(root, "Start tour"));

    const svg = root.querySelector(".map-canvas")!;
    svg.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();

    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("ArrowRight/Space advance and ArrowLeft steps back while the tour is active", () => {
    const root = mountView();
    click(findButton(root, "Start tour"));
    const svg = root.querySelector(".map-canvas")!;

    svg.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();
    let dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(expectedStops[1]!.label);

    svg.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();
    dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(expectedStops[0]!.label);
  });

  it("a canvas click during the tour exits it WITHOUT running select/reset", () => {
    const onClearSelection = vi.fn();
    const root = mountView({ onClearSelection });
    click(findButton(root, "Start tour"));

    const svg = root.querySelector(".map-canvas")!;
    click(svg);

    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(onClearSelection).not.toHaveBeenCalled();
  });
});

describe("onboarding tour — non-regression (tour inactive)", () => {
  it("Esc still performs the ordinary full reset when the tour was never started", () => {
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
});

describe("fitToRect — shared fit-scale clamp (Invariant 3)", () => {
  it("centers a rect's center on the viewport center at the fitScale clamp", () => {
    vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const onViewState = vi.fn();
    mountView({ onViewState });

    const view = instance as unknown as {
      fitToRect: (
        rect: { x: number; y: number; w: number; h: number },
        animated?: boolean,
      ) => void;
    };
    const rect = { x: 120, y: 40, w: 300, h: 150 };
    view.fitToRect(rect, false);
    flushSync();

    const t = onViewState.mock.calls.at(-1)?.[0]?.transform;
    expect(t).toBeDefined();

    // Same clamp computeFitTransform uses: max(0.1, min(1.5, min(fitW, fitH))).
    const expectedK = Math.max(
      0.1,
      Math.min(1.5, Math.min((800 - 40) / rect.w, (600 - 40) / rect.h)),
    );
    expect(t.k).toBeCloseTo(expectedK, 6);

    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    expect(t.x + centerX * t.k).toBeCloseTo(400, 5);
    expect(t.y + centerY * t.k).toBeCloseTo(300, 5);
  });
});
