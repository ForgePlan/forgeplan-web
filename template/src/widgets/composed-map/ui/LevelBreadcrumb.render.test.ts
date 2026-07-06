// @vitest-environment happy-dom
/**
 * RFC-031 Phase 4 render-proof for LevelBreadcrumb.svelte. Harness:
 * happy-dom + Svelte's built-in mount() — same pattern as
 * nav-contract.render.test.ts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import LevelBreadcrumb from "./LevelBreadcrumb.svelte";
import type { LevelFrame } from "../model/drill-state";

let host: HTMLElement | null = null;
let instance: unknown = null;

function mountBreadcrumb(props: {
  stack: readonly LevelFrame[];
  onCrumb: (index: number) => void;
  labelFor: (focusId: string | null) => string;
}): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(LevelBreadcrumb, { target: host, props });
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

const rootOnly: LevelFrame[] = [
  { focusId: null, transform: { x: 0, y: 0, k: 1 }, kFit: 1 },
];

const twoLevels: LevelFrame[] = [
  { focusId: null, transform: { x: 0, y: 0, k: 1 }, kFit: 1 },
  { focusId: "z.decisions", transform: { x: 0, y: 0, k: 2 }, kFit: 2 },
];

const labelFor = (focusId: string | null) =>
  focusId === null ? "All" : focusId;

describe("LevelBreadcrumb", () => {
  it("renders nothing at level 0 (root only — no clutter on the flat map)", () => {
    const root = mountBreadcrumb({
      stack: rootOnly,
      onCrumb: vi.fn(),
      labelFor,
    });
    expect(root.querySelector("nav")).toBeNull();
  });

  it("renders the trail with a separator once depth > 0", () => {
    const root = mountBreadcrumb({
      stack: twoLevels,
      onCrumb: vi.fn(),
      labelFor,
    });
    const items = root.querySelectorAll(".crumb-item");
    expect(items.length).toBe(2);
    expect(root.querySelector(".crumb-sep")).not.toBeNull();
  });

  it("renders the current (last) crumb as a non-clickable, aria-current span", () => {
    const root = mountBreadcrumb({
      stack: twoLevels,
      onCrumb: vi.fn(),
      labelFor,
    });
    const current = root.querySelector(".crumb-current");
    expect(current).not.toBeNull();
    expect(current!.getAttribute("aria-current")).toBe("page");
    expect(current!.textContent).toBe("z.decisions");
    // the current crumb must not itself be a <button>
    expect(current!.tagName).not.toBe("BUTTON");
  });

  it("renders every ancestor crumb as a keyboard-reachable button and invokes onCrumb(index) on click", () => {
    const onCrumb = vi.fn();
    const root = mountBreadcrumb({ stack: twoLevels, onCrumb, labelFor });
    const rootCrumbButton = Array.from(root.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "All",
    );
    expect(rootCrumbButton).toBeDefined();
    rootCrumbButton!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();
    expect(onCrumb).toHaveBeenCalledExactlyOnceWith(0);
  });
});
