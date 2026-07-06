// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import MapNodePanel from "./MapNodePanel.svelte";
import { setNodeTab } from "@/widgets/composed-map/model/node-tabs.svelte";
import type { MapNode } from "@/entities/map";

let host: HTMLElement | null = null;
let instance: unknown = null;

function mountPanel(nodeId: string): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(MapNodePanel, { target: host, props: { nodeId } });
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

function makeNode(id: string, overrides: Partial<MapNode> = {}): MapNode {
  return {
    id,
    label: `Label for ${id}`,
    kind: "module",
    zone: "z1",
    found_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("MapNodePanel", () => {
  it("renders the description_ru narration when present", () => {
    setNodeTab("node-with-narration", {
      node: makeNode("node-with-narration", {
        description_ru: "Реальное описание модуля.",
      }),
      connections: [],
    });
    const root = mountPanel("node-with-narration");
    expect(root.querySelector(".description")?.textContent).toBe(
      "Реальное описание модуля.",
    );
    expect(root.querySelector(".no-narration")).toBeNull();
  });

  it("renders an honest no-narration note when description_ru is absent (never fabricates)", () => {
    setNodeTab("node-without-narration", {
      node: makeNode("node-without-narration"),
      connections: [],
    });
    const root = mountPanel("node-without-narration");
    const note = root.querySelector(".no-narration");
    expect(note).not.toBeNull();
    expect(note!.textContent).toBe(
      "Нарратив недоступен — у этого модуля нет doc-источника.",
    );
    expect(root.querySelector(".description")).toBeNull();
  });

  it("renders outgoing and incoming connections", () => {
    setNodeTab("node-with-connections", {
      node: makeNode("node-with-connections"),
      connections: [
        { dir: "out", label: "Downstream Module", relation: "calls" },
        { dir: "in", label: "Upstream Module", relation: "informs" },
      ],
    });
    const root = mountPanel("node-with-connections");
    const items = root.querySelectorAll(".connections li");
    expect(items.length).toBe(2);
    expect(items[0]!.textContent).toContain("Downstream Module");
    expect(items[0]!.textContent).toContain("calls");
    expect(items[1]!.textContent).toContain("Upstream Module");
    expect(items[1]!.textContent).toContain("informs");
  });

  it("shows a source path from provenance.ref when present", () => {
    setNodeTab("node-with-provenance", {
      node: makeNode("node-with-provenance", {
        provenance: {
          source: "code-scanner",
          ref: "src/foo/bar.ts",
          confidence: 0.9,
        },
      }),
      connections: [],
    });
    const root = mountPanel("node-with-provenance");
    expect(root.querySelector(".source-meta code")?.textContent).toBe(
      "src/foo/bar.ts",
    );
  });

  it("renders a no-data fallback when the store has no snapshot for the id", () => {
    const root = mountPanel("node-never-set");
    expect(root.querySelector(".muted")?.textContent).toContain(
      "No data recorded",
    );
  });

  it("shows an open-artifact affordance only when artifact_id is present", () => {
    setNodeTab("node-with-artifact", {
      node: makeNode("node-with-artifact", { artifact_id: "RFC-999" }),
      connections: [],
    });
    const root = mountPanel("node-with-artifact");
    const btn = Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("RFC-999"),
    );
    expect(btn).toBeDefined();
  });
});
