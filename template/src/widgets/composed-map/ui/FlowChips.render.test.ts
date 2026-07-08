// @vitest-environment happy-dom
/**
 * Coverage for FlowChips's `leading` snippet slot (RFC-035) — the compact
 * chat-star launcher renders BEFORE the "All" chip, and the guard change
 * (`flows.length > 0 || leading`) means a `leading` snippet still renders
 * `.flow-chips` even when there are zero flows (only the launcher shows;
 * no "All" / per-flow chips).
 */
import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount, flushSync, createRawSnippet } from "svelte";
import FlowChips from "./FlowChips.svelte";
import type { MapFlow } from "@/entities/map";

const FLOWS: MapFlow[] = [
  { id: "flow-a", name: "Flow A", node_ids: ["n1", "n2"] },
  { id: "flow-b", name: "Flow B", node_ids: ["n3"] },
];

let host: HTMLElement | null = null;
let instance: unknown = null;

function launcherSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      `<button class="test-launcher" aria-label="Ask the map">star</button>`,
  }));
}

function mountChips(
  props: {
    flows: ReadonlyArray<MapFlow>;
    leading?: ReturnType<typeof createRawSnippet>;
  },
): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(FlowChips, { target: host, props });
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
});

describe("FlowChips leading slot", () => {
  it("renders the leading snippet as the first child, before the All chip", () => {
    const root = mountChips({ flows: FLOWS, leading: launcherSnippet() });

    const chips = root.querySelector(".flow-chips");
    expect(chips).not.toBeNull();

    const firstChild = chips!.firstElementChild;
    expect(firstChild?.classList.contains("test-launcher")).toBe(true);

    const buttons = Array.from(chips!.querySelectorAll("button"));
    expect(buttons[0]!.classList.contains("test-launcher")).toBe(true);
    expect(buttons[1]!.textContent?.trim()).toBe("All");
  });

  it("renders only the leading launcher when there are zero flows", () => {
    const root = mountChips({ flows: [], leading: launcherSnippet() });

    const chips = root.querySelector(".flow-chips");
    expect(chips).not.toBeNull();

    const buttons = Array.from(chips!.querySelectorAll("button"));
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.classList.contains("test-launcher")).toBe(true);
    expect(chips!.textContent).not.toContain("All");
  });

  it("renders nothing when there are zero flows and no leading snippet (unchanged default behaviour)", () => {
    const root = mountChips({ flows: [] });

    expect(root.querySelector(".flow-chips")).toBeNull();
  });

  it("renders All + per-flow chips with no leading slot (unchanged default behaviour)", () => {
    const root = mountChips({ flows: FLOWS });

    const chips = root.querySelector(".flow-chips");
    expect(chips).not.toBeNull();
    const buttons = Array.from(chips!.querySelectorAll("button"));
    expect(buttons.length).toBe(3); // All + 2 flows
    expect(buttons[0]!.textContent?.trim()).toBe("All");
  });
});
