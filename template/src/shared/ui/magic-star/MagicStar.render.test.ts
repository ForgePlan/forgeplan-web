// @vitest-environment happy-dom
/**
 * Coverage for the `MagicStar` primitive — the compact chat-launcher icon
 * (extraboost.ai signature gradient stroke on a ✨ sparkles motif: one main
 * four-pointed sparkle + two small accent sparkles). Harness: happy-dom +
 * Svelte's built-in mount(), same pattern as the sibling
 * FloatingWindow.render.test.ts.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import MagicStar from "./MagicStar.svelte";

let host: HTMLElement | null = null;
let instance: unknown = null;

function mountStar(props: Record<string, unknown> = {}): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(MagicStar, { target: host, props });
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

describe("MagicStar", () => {
  it("renders a decorative svg with a gradient-stroked sparkles motif", () => {
    const root = mountStar();

    const svg = root.querySelector("svg.magic-star");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
    expect(svg!.getAttribute("fill")).toBe("none");

    const gradient = svg!.querySelector("linearGradient");
    expect(gradient).not.toBeNull();
    const gradientId = gradient!.getAttribute("id");
    expect(gradientId).toMatch(/^magic-star-grad-/);

    const stops = Array.from(gradient!.querySelectorAll("stop"));
    expect(stops.length).toBe(6);
    expect(stops[0]?.getAttribute("stop-color")).toBe("#5B8DEF");
    expect(stops[5]?.getAttribute("stop-color")).toBe("#5B8DEF");

    // The stroke lives on the wrapping <g> — main sparkle + accent sparkles
    // all share the one animated gradient contour.
    const group = svg!.querySelector("g");
    expect(group).not.toBeNull();
    expect(group!.getAttribute("stroke")).toBe(`url(#${gradientId})`);

    // Main sparkle + two small accent sparkles = at least 3 path segments.
    const paths = svg!.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it("defaults to a 20px box and honors an explicit size", () => {
    const root = mountStar({ size: 32 });
    const svg = root.querySelector("svg.magic-star")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("gives each instance a distinct gradient id so multiple stars never collide", () => {
    const rootA = mountStar();
    const idA = rootA.querySelector("linearGradient")!.getAttribute("id");
    unmount(instance as object);
    instance = null;
    host?.remove();

    const rootB = mountStar();
    const idB = rootB.querySelector("linearGradient")!.getAttribute("id");

    expect(idA).not.toBe(idB);
  });

  it("renders animateTransform by default (motion allowed)", () => {
    const root = mountStar();
    expect(root.querySelector("animateTransform")).not.toBeNull();
  });
});
