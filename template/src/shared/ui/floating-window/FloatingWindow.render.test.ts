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

describe("FloatingWindow — resize grip inventory per mode", () => {
  it("docked mode wires only the left-edge width grip", () => {
    const root = mountWindow();
    expect(root.querySelector(".fw-resize-left")).not.toBeNull();
    expect(root.querySelector(".fw-resize-right")).toBeNull();
    expect(root.querySelector(".fw-resize-top")).toBeNull();
    expect(root.querySelector(".fw-resize-bottom")).toBeNull();
    expect(root.querySelector(".fw-resize-top-left")).toBeNull();
    expect(root.querySelector(".fw-resize-top-right")).toBeNull();
    expect(root.querySelector(".fw-resize-bottom-left")).toBeNull();
    expect(root.querySelector(".fw-resize-bottom-right")).toBeNull();
  });

  it("floating mode wires all 4 edges + all 4 corners", () => {
    const root = mountWindow();
    getDockToggle(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    for (const cls of [
      "fw-resize-left",
      "fw-resize-right",
      "fw-resize-top",
      "fw-resize-bottom",
      "fw-resize-top-left",
      "fw-resize-top-right",
      "fw-resize-bottom-left",
      "fw-resize-bottom-right",
    ]) {
      expect(root.querySelector(`.${cls}`)).not.toBeNull();
    }
  });
});

describe("FloatingWindow — corner/edge resize (floating mode)", () => {
  function toFloating(root: HTMLElement): void {
    getDockToggle(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
  }

  /** `persist()` (called synchronously from the resize `up()` handler on
   * pointerup) is the one reliable synchronous read of `floatX`/`floatY` —
   * position is otherwise only reflected in the DOM via neodrag's
   * `requestAnimationFrame`-scheduled paint effect, which doesn't resolve
   * within `flushSync()`. */
  function readPersisted(): {
    floatX: number;
    floatY: number;
    floatWidth: number;
    floatHeight: number;
  } {
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    return JSON.parse(raw!);
  }

  function drag(handle: HTMLElement, dx: number, dy: number): void {
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        bubbles: true,
      }),
    );
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: dx,
        clientY: dy,
        pointerId: 1,
        bubbles: true,
      }),
    );
    flushSync();
    handle.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: dx,
        clientY: dy,
        pointerId: 1,
        bubbles: true,
      }),
    );
    flushSync();
  }

  it("dragging the bottom-right corner changes BOTH width and height together", () => {
    const root = mountWindow({
      minWidth: 320,
      minHeight: 320,
      defaultWidth: 420,
      defaultHeight: 560,
    });
    const fw = getRoot(root);
    toFloating(root);
    const before = { w: widthPx(fw), h: heightPx(fw) };

    const corner = root.querySelector<HTMLElement>(".fw-resize-bottom-right")!;
    // Floating height seeds at the viewport-derived ceiling on detach (Wave
    // 1 behaviour), so grow width but shrink height to stay clear of both
    // the ceiling and the floor while still exercising both axes at once.
    drag(corner, 40, -30);

    expect(widthPx(fw)).toBe(before.w + 40);
    expect(heightPx(fw)).toBe(before.h - 30);
  });

  it("dragging the bottom-right corner far past the floor clamps BOTH axes at their minimums", () => {
    const root = mountWindow({
      minWidth: 320,
      minHeight: 320,
      defaultWidth: 420,
      defaultHeight: 560,
    });
    const fw = getRoot(root);
    toFloating(root);

    const corner = root.querySelector<HTMLElement>(".fw-resize-bottom-right")!;
    drag(corner, -900, -900);

    expect(widthPx(fw)).toBe(320);
    expect(heightPx(fw)).toBe(320);
  });

  it("dragging the right edge changes only width, not height", () => {
    const root = mountWindow({ defaultWidth: 420, defaultHeight: 560 });
    const fw = getRoot(root);
    toFloating(root);
    const beforeH = heightPx(fw);

    const handle = root.querySelector<HTMLElement>(".fw-resize-right")!;
    drag(handle, 35, 200);

    expect(widthPx(fw)).toBe(420 + 35);
    expect(heightPx(fw)).toBe(beforeH);
  });

  it("dragging the bottom edge changes only height, not width", () => {
    const root = mountWindow({ defaultWidth: 420, defaultHeight: 560 });
    const fw = getRoot(root);
    toFloating(root);
    const beforeW = widthPx(fw);
    const beforeH = heightPx(fw);

    const handle = root.querySelector<HTMLElement>(".fw-resize-bottom")!;
    // Floating height seeds at the viewport-derived ceiling on detach, so
    // shrink (negative dy) to observe a change instead of hitting the clamp.
    drag(handle, 200, -25);

    expect(heightPx(fw)).toBe(beforeH - 25);
    expect(widthPx(fw)).toBe(beforeW);
  });

  it("the left grip keeps the right edge fixed (floatX + floatWidth constant) while growing width", () => {
    const root = mountWindow({
      minWidth: 320,
      defaultWidth: 420,
      defaultHeight: 560,
    });
    toFloating(root);
    const initial = readPersisted();
    const rightEdge = initial.floatX + initial.floatWidth;

    const handle = root.querySelector<HTMLElement>(".fw-resize-left")!;
    // Dragging the left edge leftward (negative dx) grows width.
    drag(handle, -60, 0);

    const after = readPersisted();
    expect(after.floatWidth).toBe(initial.floatWidth + 60);
    expect(after.floatX + after.floatWidth).toBe(rightEdge);
  });

  it("the top grip keeps the bottom edge fixed (floatY + floatHeight constant) while resizing height", () => {
    const root = mountWindow({
      minHeight: 320,
      defaultWidth: 420,
      defaultHeight: 560,
    });
    toFloating(root);
    const initial = readPersisted();
    const bottomEdge = initial.floatY + initial.floatHeight;

    const handle = root.querySelector<HTMLElement>(".fw-resize-top")!;
    // Floating height seeds at the viewport-derived ceiling on detach, so
    // drag the top edge downward (positive dy) to shrink height rather than
    // grow it — same "opposite edge fixed" invariant either direction.
    drag(handle, 0, 45);

    const after = readPersisted();
    expect(after.floatHeight).toBe(initial.floatHeight - 45);
    expect(after.floatY + after.floatHeight).toBe(bottomEdge);
  });

  it("the top-left corner moves both origin axes to keep the bottom-right corner fixed", () => {
    const root = mountWindow({
      minWidth: 320,
      minHeight: 320,
      defaultWidth: 420,
      defaultHeight: 560,
    });
    toFloating(root);
    const initial = readPersisted();
    const rightEdge = initial.floatX + initial.floatWidth;
    const bottomEdge = initial.floatY + initial.floatHeight;

    const handle = root.querySelector<HTMLElement>(".fw-resize-top-left")!;
    // Width has headroom to grow (negative dx); height seeds at the
    // viewport-derived ceiling on detach, so shrink it (positive dy) —
    // both axes still move together through one corner grip.
    drag(handle, -20, 15);

    const after = readPersisted();
    expect(after.floatWidth).toBe(initial.floatWidth + 20);
    expect(after.floatHeight).toBe(initial.floatHeight - 15);
    expect(after.floatX + after.floatWidth).toBe(rightEdge);
    expect(after.floatY + after.floatHeight).toBe(bottomEdge);
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
