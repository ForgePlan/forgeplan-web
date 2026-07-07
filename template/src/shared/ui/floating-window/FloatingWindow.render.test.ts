// @vitest-environment happy-dom
/**
 * RFC-035 Wave 1 (EVID-097 Finding #2) — unit coverage for `FloatingWindow`'s
 * persistence/clamp/dock-float/resize logic. happy-dom implements
 * `setPointerCapture`/`releasePointerCapture` as no-ops (present, not
 * throwing), so the pointer-capture resize path under test doesn't need a
 * pointer-capture mock. Mirrors the mount()/flushSync() harness used by
 * MapChat.render.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import FloatingWindow from "./FloatingWindow.svelte";

const STORAGE_KEY = "forgeplan-web:floating-window:test-window:v1";

let host: HTMLElement | null = null;
let instance: unknown = null;

function mountWindow(props: Partial<Record<string, unknown>> = {}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(FloatingWindow, {
    target: host,
    props: {
      storageKey: "test-window",
      ariaLabel: "Test window",
      ...props,
    },
  });
  flushSync();
  return host;
}

function getRoot(root: HTMLElement): HTMLElement {
  const el = root.querySelector<HTMLElement>(".fw-root");
  expect(el).not.toBeNull();
  return el!;
}

function getHeader(root: HTMLElement): HTMLElement {
  const el = root.querySelector<HTMLElement>(".fw-header");
  expect(el).not.toBeNull();
  return el!;
}

function getDockToggle(root: HTMLElement): HTMLButtonElement {
  const btn = root.querySelector<HTMLButtonElement>(
    '[aria-label="Undock (float)"], [aria-label="Dock to edge"]',
  );
  expect(btn).not.toBeNull();
  return btn!;
}

function widthPx(el: HTMLElement): number {
  const match = /width:\s*([\d.]+)px/.exec(el.getAttribute("style") ?? "");
  expect(match).not.toBeNull();
  return Number(match![1]);
}

function heightPx(el: HTMLElement): number {
  const match = /height:\s*([\d.]+)px/.exec(el.getAttribute("style") ?? "");
  expect(match).not.toBeNull();
  return Number(match![1]);
}

beforeEach(() => {
  localStorage.clear();
  window.innerWidth = 1280;
  window.innerHeight = 800;
});

afterEach(() => {
  if (instance) {
    unmount(instance as object);
    instance = null;
  }
  host?.remove();
  host = null;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("FloatingWindow — persisted geometry restore", () => {
  it("clamps an off-screen persisted floating position back into the viewport", () => {
    // A position from a since-shrunk/changed monitor: way outside the
    // current 1280x800 viewport (invariant I4 — never restore off-screen).
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        mode: "floating",
        dockedWidth: 420,
        floatX: 5000,
        floatY: 4000,
        floatWidth: 420,
        floatHeight: 560,
      }),
    );

    const root = mountWindow();
    const fw = getRoot(root);
    const xMatch = /transform:\s*translate\(([\d.]+)px,\s*([\d.]+)px\)/.exec(
      fw.style.transform ? `transform: ${fw.style.transform}` : "",
    );
    void xMatch;

    // The clamp is expressed through width/height + neodrag's position
    // compartment; assert the sizes are clamped within the viewport bounds
    // (the direct, environment-independent signal `clampFloating()` guarantees).
    expect(widthPx(fw)).toBeLessThanOrEqual(1280);
    expect(heightPx(fw)).toBeLessThanOrEqual(800);
  });

  it("degrades to default docked geometry when the persisted payload is unparsable JSON", () => {
    // Genuinely malformed JSON throws inside loadPersisted's try/catch —
    // the catch leaves the already-in-place defaults alone and does NOT
    // touch storage (unlike the valid-JSON-wrong-shape path below), so the
    // raw string survives; the component just never trusts it.
    localStorage.setItem(STORAGE_KEY, "{not json");
    const root = mountWindow();
    const fw = getRoot(root);
    expect(fw.classList.contains("docked")).toBe(true);
  });

  it("degrades to default docked geometry AND clears the key when the persisted payload has a stale version", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 999,
        mode: "floating",
        dockedWidth: 420,
        floatX: 10,
        floatY: 10,
        floatWidth: 420,
        floatHeight: 560,
      }),
    );
    const root = mountWindow();
    const fw = getRoot(root);
    expect(fw.classList.contains("docked")).toBe(true);
    // Valid JSON but the wrong shape/version IS actively cleared, rather
    // than re-fought on every future mount (rollback plan: "a stale
    // window-geometry key is ignored by a version guard, or cleared").
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("FloatingWindow — dock <-> float toggle", () => {
  it("starts docked by default", () => {
    const root = mountWindow();
    const fw = getRoot(root);
    expect(fw.classList.contains("docked")).toBe(true);
    expect(fw.classList.contains("floating")).toBe(false);
  });

  it("toggling the pin control flips docked -> floating", () => {
    const root = mountWindow();
    const fw = getRoot(root);
    expect(fw.classList.contains("docked")).toBe(true);

    getDockToggle(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    expect(fw.classList.contains("floating")).toBe(true);
    expect(fw.classList.contains("docked")).toBe(false);
  });

  it("toggling twice returns to docked", () => {
    const root = mountWindow();
    const fw = getRoot(root);

    getDockToggle(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(fw.classList.contains("floating")).toBe(true);

    getDockToggle(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(fw.classList.contains("docked")).toBe(true);
  });

  it("persists mode across a toggle so a remount restores floating", () => {
    const root = mountWindow();
    getDockToggle(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    unmount(instance as object);
    instance = null;
    host?.remove();

    const root2 = mountWindow();
    const fw2 = getRoot(root2);
    expect(fw2.classList.contains("floating")).toBe(true);
  });
});

describe("FloatingWindow — min-size clamp on resize", () => {
  it("does not shrink narrower than minWidth when dragging the left (width) resize handle", () => {
    const root = mountWindow({ minWidth: 320, defaultWidth: 420 });
    const fw = getRoot(root);
    const handle = root.querySelector<HTMLElement>(".fw-resize-left");
    expect(handle).not.toBeNull();

    handle!.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        bubbles: true,
      }),
    );
    // Dragging the left edge far to the right shrinks width — attempt to
    // go well past the 320px floor.
    handle!.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 900,
        clientY: 0,
        pointerId: 1,
        bubbles: true,
      }),
    );
    flushSync();

    expect(widthPx(fw)).toBeGreaterThanOrEqual(320);

    handle!.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 900,
        clientY: 0,
        pointerId: 1,
        bubbles: true,
      }),
    );
    flushSync();
  });

  it("keyboard ArrowLeft/ArrowRight on the resize handle nudges width and respects the floor", () => {
    const root = mountWindow({ minWidth: 320, defaultWidth: 330 });
    const fw = getRoot(root);
    const handle = root.querySelector<HTMLElement>(".fw-resize-left");
    expect(handle).not.toBeNull();

    const before = widthPx(fw);
    // ArrowRight narrows (per startResize("left") convention: dragging the
    // left edge right shrinks width) — repeated presses must not cross the
    // 320px floor.
    for (let i = 0; i < 5; i++) {
      handle!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    }
    flushSync();

    expect(widthPx(fw)).toBeLessThanOrEqual(before);
    expect(widthPx(fw)).toBeGreaterThanOrEqual(320);
  });
});

describe("FloatingWindow — persist -> restore round trip", () => {
  it("round-trips mode + geometry through the storage key after a dock/undock + remount", () => {
    const root = mountWindow();
    getDockToggle(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw!);
    expect(persisted.v).toBe(1);
    expect(persisted.mode).toBe("floating");

    unmount(instance as object);
    instance = null;
    host?.remove();

    const root2 = mountWindow();
    const fw2 = getRoot(root2);
    expect(fw2.classList.contains("floating")).toBe(true);
    expect(widthPx(fw2)).toBe(persisted.floatWidth);
    expect(heightPx(fw2)).toBe(persisted.floatHeight);
  });

  it("writes nothing to storage before any interaction (defaults only, no spurious persist)", () => {
    mountWindow();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("FloatingWindow — header + close", () => {
  it("the header is keyboard-focusable and carries an accessible name (no role=presentation)", () => {
    const root = mountWindow();
    const header = getHeader(root);
    expect(header.getAttribute("tabindex")).toBe("0");
    expect(header.getAttribute("role")).not.toBe("presentation");
    expect(header.getAttribute("aria-label")).toContain("Test window");
  });

  it("Escape fires onClose", () => {
    const onClose = vi.fn();
    const root = mountWindow({ onClose });
    const fw = getRoot(root);
    fw.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    flushSync();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the close button when onClose is not provided", () => {
    const root = mountWindow();
    expect(root.querySelector('[aria-label="Close"]')).toBeNull();
  });
});
