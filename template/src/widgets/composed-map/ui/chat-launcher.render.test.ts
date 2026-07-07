// @vitest-environment happy-dom
/**
 * Coverage for the `showChatLauncher` / bindable `chatOpen` prop pair added
 * to ComposedMapView (onboard-header launcher lift). Default behaviour
 * (dashboard host — no props passed) must be byte-for-byte unchanged: the
 * widget's own bottom-right launcher renders. A host that sets
 * `showChatLauncher={false}` (the /onboard route) must suppress it while
 * still honoring an externally-driven `chatOpen`.
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

describe("chat launcher visibility (onboard-header lift)", () => {
  it("shows the internal magic launcher by default (dashboard host passes no props)", () => {
    const root = mountView();

    const wrap = root.querySelector(".ask-chat-pos");
    expect(wrap).not.toBeNull();

    const launcher = wrap!.querySelector("button")!;
    expect(launcher).not.toBeNull();
    expect(launcher.className).toContain("variant-magic");
    expect(launcher.getAttribute("aria-controls")).toBe("map-chat-panel");
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(launcher.textContent).toContain("Ask");
  });

  it("hides the internal launcher when showChatLauncher={false}", () => {
    const root = mountView({ showChatLauncher: false });

    expect(root.querySelector(".ask-chat-pos")).toBeNull();
  });

  it("showChatLauncher={false} still opens the chat panel via an externally-driven chatOpen", () => {
    const root = mountView({ showChatLauncher: false, chatOpen: true });

    expect(root.querySelector(".ask-chat-pos")).toBeNull();
    expect(root.querySelector("#map-chat-panel")).not.toBeNull();
  });

  it("clicking the default internal launcher toggles chatOpen and mounts the chat panel", () => {
    const root = mountView();

    expect(root.querySelector("#map-chat-panel")).toBeNull();

    const launcher = root.querySelector<HTMLButtonElement>(".ask-chat-pos button")!;
    launcher.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    flushSync();

    expect(launcher.getAttribute("aria-expanded")).toBe("true");
    expect(root.querySelector("#map-chat-panel")).not.toBeNull();
  });
});
