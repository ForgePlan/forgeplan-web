// @vitest-environment happy-dom
/**
 * Coverage for ComposedMapView's chat launcher. RFC-035 moved it out of a
 * standalone bottom-right `.ask-chat-pos` box (and, briefly, an
 * onboard-header-only variant) into `FlowChips`'s `leading` slot — so it
 * now renders inside `.flow-chips`, to the LEFT of the "All" chip, for
 * EVERY host (no more `showChatLauncher`/bindable `chatOpen` prop pair;
 * `chatOpen` is fully internal to ComposedMapView now).
 *
 * The launcher itself is a compact `Button variant="ghost" size="icon"`
 * carrying only a `MagicStar` child (no text). State is conveyed via
 * `aria-label`/`aria-expanded`, not text.
 *
 * Harness: happy-dom + Svelte's built-in mount() — same pattern as the
 * sibling nav-contract render-proof suite.
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

// Same defensive mock as MapChat.render.test.ts — a probe/opening the chat
// panel below must not depend on a real daemon socket/fetch being reachable.
vi.mock("@/widgets/map-chat/model/agent-client", () => ({
  probeDaemon: vi.fn(() => Promise.resolve({ up: false })),
  connectAgent: vi.fn(),
}));

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

describe("chat launcher (FlowChips leading slot)", () => {
  it("renders the compact star launcher as the first child of .flow-chips, left of All", () => {
    const root = mountView();

    const chips = root.querySelector(".flow-chips");
    expect(chips).not.toBeNull();

    const buttons = Array.from(chips!.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(1); // launcher + All + flow chips

    const launcher = buttons[0]!;
    expect(launcher.className).toContain("variant-ghost");
    expect(launcher.className).toContain("size-icon");
    expect(launcher.getAttribute("aria-controls")).toBe("map-chat-panel");
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(launcher.getAttribute("aria-label")).toBe("Ask the map");
    expect(launcher.textContent?.trim()).toBe("");
    expect(launcher.querySelector("svg.magic-star")).not.toBeNull();

    // "All" is the very next button, immediately to the launcher's right.
    const allButton = buttons[1]!;
    expect(allButton.textContent?.trim()).toBe("All");
  });

  it("clicking the launcher toggles chatOpen and mounts the chat panel", () => {
    const root = mountView();

    expect(root.querySelector("#map-chat-panel")).toBeNull();

    const launcher = root.querySelector<HTMLButtonElement>(".flow-chips button")!;
    launcher.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    flushSync();

    expect(launcher.getAttribute("aria-expanded")).toBe("true");
    expect(launcher.getAttribute("aria-label")).toBe("Close chat");
    expect(root.querySelector("#map-chat-panel")).not.toBeNull();
  });
});
