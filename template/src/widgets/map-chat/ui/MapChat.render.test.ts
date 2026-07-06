// @vitest-environment happy-dom
/**
 * RFC-034 (Pillar C, Phase 1b) render-proof for MapChat.svelte. Harness:
 * happy-dom + Svelte's built-in mount() — same pattern as
 * OnboardTour.render.test.ts / nav-contract.render.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import MapChat from "./MapChat.svelte";
import { resetChat } from "../model/chat-store.svelte";
import { clearCameraTarget } from "@/widgets/composed-map/model/camera-bus.svelte";
import type { MapDocument, MapZone } from "@/entities/map";

let host: HTMLElement | null = null;
let instance: unknown = null;

function zone(overrides: Partial<MapZone> = {}): MapZone {
  return {
    id: "z.a",
    label: "Zone A",
    kind: "surface",
    accent: "--map-accent-cyan",
    treatment: "neutral-dashed",
    rule_edge: "off",
    layout_rule: "grid",
    cols: 2,
    ...overrides,
  };
}

function fixtureDoc(): MapDocument {
  return {
    schema: "forgeplan.map/v1",
    meta: {
      map_id: "test",
      status: "confirmed",
      project_type: "generic",
      composition_id: "c1",
      source_fingerprint: "fp",
      version: 1,
    },
    canvas: {
      grid: { cols: 1, rows: 1 },
      gap: { x: 88, y: 70 },
      margin: 40,
      cell: {
        card_w: 190,
        card_h: 60,
        card_gap: 36,
        zpad: { top: 50, side: 24, bottom: 24 },
      },
    },
    composition: {
      template: "generic",
      arrangement: "stack-ttb",
      entry_zone: "z.a",
      placements: [{ zone: "z.a", cell: { row: 0, col: 0 } }],
      zone_connectors: [],
    },
    zones: [zone({ id: "z.a", label: "CLI Surfaces" })],
    nodes: [],
    edges: [],
  };
}

function mountChat(props: {
  doc: MapDocument;
  onClose?: () => void;
}): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(MapChat, { target: host, props });
  flushSync();
  return host;
}

function getInput(root: HTMLElement): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(
    '[aria-label="Ask the map a question"]',
  );
  expect(input).not.toBeNull();
  return input!;
}

function getSendButton(root: HTMLElement): HTMLButtonElement {
  const btn = Array.from(root.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Send"),
  );
  expect(btn).toBeDefined();
  return btn as HTMLButtonElement;
}

function typeInto(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  flushSync();
}

beforeEach(() => {
  resetChat();
  clearCameraTarget();
});

afterEach(() => {
  if (instance) {
    unmount(instance as object);
    instance = null;
  }
  host?.remove();
  host = null;
  vi.restoreAllMocks();
});

describe("MapChat", () => {
  it("renders the empty-transcript hint, an input, and a disabled Send button", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.textContent).toContain("Ask about a zone");
    getInput(root);
    expect(getSendButton(root).disabled).toBe(true);
  });

  it("shows the Tier 0 offline badge", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.textContent).toContain("Offline");
    expect(root.textContent).toContain("Tier 0");
  });

  it("renders prior messages already in the store", () => {
    const root = mountChat({ doc: fixtureDoc() });
    // Simulate an already-populated transcript by driving the store
    // directly, then re-render.
    typeInto(getInput(root), "Tell me about CLI Surfaces");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(root.textContent).toContain("CLI Surfaces");
    expect(root.textContent).toContain("You");
    expect(root.textContent).toContain("Map");
  });

  it("enables Send once the input has non-whitespace text", () => {
    const root = mountChat({ doc: fixtureDoc() });
    const input = getInput(root);
    typeInto(input, "   ");
    expect(getSendButton(root).disabled).toBe(true);
    typeInto(input, "hello");
    expect(getSendButton(root).disabled).toBe(false);
  });

  it("pressing Enter in the input sends the message and clears it", () => {
    const root = mountChat({ doc: fixtureDoc() });
    const input = getInput(root);
    typeInto(input, "Tell me about CLI Surfaces");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    flushSync();
    expect(root.textContent).toContain("CLI Surfaces");
    expect(input.value).toBe("");
  });

  it("clicking Send sends the message and clears the input", () => {
    const root = mountChat({ doc: fixtureDoc() });
    const input = getInput(root);
    typeInto(input, "Tell me about CLI Surfaces");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(root.textContent).toContain("CLI Surfaces");
    expect(input.value).toBe("");
  });

  it("renders a close button and fires onClose when clicked", () => {
    const onClose = vi.fn();
    const root = mountChat({ doc: fixtureDoc(), onClose });
    const closeBtn = root.querySelector<HTMLButtonElement>(
      '[aria-label="Close chat"]',
    );
    expect(closeBtn).not.toBeNull();
    closeBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the close button when onClose is not provided", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.querySelector('[aria-label="Close chat"]')).toBeNull();
  });
});
