// @vitest-environment happy-dom
/**
 * RFC-033 (Pillar B) render-proof for OnboardTour.svelte. Harness: happy-dom
 * + Svelte's built-in mount() — same pattern as nav-contract.render.test.ts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import OnboardTour from "./OnboardTour.svelte";
import type { TourStop } from "../model/tour-state";

let host: HTMLElement | null = null;
let instance: unknown = null;

function mountTour(props: {
  stop: TourStop | null;
  index: number;
  total: number;
  projectTitle: string;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  reducedMotion?: boolean;
}): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(OnboardTour, { target: host, props });
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

const stopWithNarration: TourStop = {
  zoneId: "z.a",
  label: "CLI Surfaces",
  narrationRu: "Публичные точки входа.",
  memberSummary: { total: 3, labels: ["init", "start", "update"] },
};

const stopWithoutNarration: TourStop = {
  zoneId: "z.b",
  label: "Undocumented Zone",
  memberSummary: { total: 0, labels: [] },
};

describe("OnboardTour", () => {
  it("renders nothing when stop is null", () => {
    const root = mountTour({
      stop: null,
      index: 0,
      total: 3,
      projectTitle: "forgeplan-web",
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onExit: vi.fn(),
    });
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows the project title, label, progress, and RU narration when present", () => {
    const root = mountTour({
      stop: stopWithNarration,
      index: 0,
      total: 5,
      projectTitle: "forgeplan-web",
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onExit: vi.fn(),
    });
    expect(root.textContent).toContain("forgeplan-web");
    expect(root.textContent).toContain("CLI Surfaces");
    expect(root.textContent).toContain("1 / 5");
    expect(root.textContent).toContain("Публичные точки входа.");
  });

  it("shows the what's-inside summary with a +N more suffix when truncated", () => {
    const root = mountTour({
      stop: {
        zoneId: "z.c",
        label: "Big Zone",
        memberSummary: {
          total: 9,
          labels: ["a", "b", "c", "d", "e", "f"],
        },
      },
      index: 1,
      total: 2,
      projectTitle: "p",
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onExit: vi.fn(),
    });
    expect(root.textContent).toContain("a, b, c, d, e, f");
    expect(root.textContent).toContain("+3 more");
  });

  it("renders no narration block for a stop with no description_ru (never fabricated)", () => {
    const root = mountTour({
      stop: stopWithoutNarration,
      index: 0,
      total: 1,
      projectTitle: "p",
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onExit: vi.fn(),
    });
    expect(root.querySelector(".ot-narration")).toBeNull();
    expect(root.querySelector(".ot-inside-label")).toBeNull();
  });

  it("disables Prev at index 0 and labels the last stop's Next button Done", () => {
    const root = mountTour({
      stop: stopWithNarration,
      index: 2,
      total: 3,
      projectTitle: "p",
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onExit: vi.fn(),
    });
    const buttons = Array.from(root.querySelectorAll("button"));
    const next = buttons.find((b) => b.textContent?.includes("Done"));
    expect(next).toBeDefined();
  });

  it("Prev is disabled at index 0", () => {
    const root = mountTour({
      stop: stopWithNarration,
      index: 0,
      total: 3,
      projectTitle: "p",
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onExit: vi.fn(),
    });
    const prev = Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Prev"),
    );
    expect(prev).toBeDefined();
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it("fires onNext/onPrev/onExit when their buttons are clicked", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onExit = vi.fn();
    const root = mountTour({
      stop: stopWithNarration,
      index: 1,
      total: 3,
      projectTitle: "p",
      onNext,
      onPrev,
      onExit,
    });
    const click = (label: string) => {
      const btn = Array.from(root.querySelectorAll("button")).find((b) =>
        b.textContent?.includes(label),
      );
      expect(btn).toBeDefined();
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    };
    click("Next");
    click("Prev");
    click("Exit");
    flushSync();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
