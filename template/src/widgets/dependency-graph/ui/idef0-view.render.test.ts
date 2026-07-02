// @vitest-environment happy-dom
/**
 * SPEC-005 render-surface conformance for Idef0View.svelte (RFC-029, GATE-A
 * AC-4). Covers the 5 scenarios the node-env geometry suite cannot: permanent
 * ICOM legend (RC-4), keyboard operability (RC-8), reduced-motion (RC-8),
 * dual-theme token fidelity (RC-7), and view-registry no-regression (RC-6).
 *
 * Harness: happy-dom + Svelte's built-in mount() — no extra devDependency
 * (EVID-067 gate condition; happy-dom was already a devDep).
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Idef0View from "./Idef0View.svelte";
import { GRAPH_VIEWS, GRAPH_VIEW_IDS } from "@/shared/config/ui-prefs";
import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

// ─── fixtures ────────────────────────────────────────────────────────────────

function node(id: string, title: string, kind: string): ArtifactSummary {
  return { id, title, kind, status: "active" } as ArtifactSummary;
}

/** informs-only → density 0 < 0.3 → honest tier-stack fallback. */
const SPARSE_NODES = [
  node("EPIC-1", "Epic one", "epic"),
  node("PRD-1", "Prd one", "prd"),
  node("RFC-1", "Rfc one", "rfc"),
  node("EVID-1", "Evid one", "evidence"),
  node("EVID-2", "Evid two", "evidence"),
];
const SPARSE_EDGES: GraphEdge[] = [
  { from: "EVID-1", to: "PRD-1", relation: "informs" },
  { from: "EVID-2", to: "RFC-1", relation: "informs" },
];

/** refines chain (depth 3, single root) → density 1.0 ≥ 0.3 → dense idef0. */
const DENSE_NODES = [
  node("A", "Alpha", "prd"),
  node("B", "Beta", "rfc"),
  node("C", "Gamma", "adr"),
];
const DENSE_EDGES: GraphEdge[] = [
  { from: "B", to: "A", relation: "refines" },
  { from: "C", to: "B", relation: "refines" },
];

let host: HTMLElement | null = null;
let instance: Record<string, unknown> | null = null;

function mountView(
  nodes: ArtifactSummary[],
  edges: GraphEdge[],
  extraProps: Record<string, unknown> = {},
): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(Idef0View, {
    target: host,
    props: { nodes, edges, ...extraProps },
  }) as Record<string, unknown>;
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

function pressKey(el: Element, key: string): void {
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
  flushSync();
}

// ─── Scenario: permanent ICOM legend (RC-4) ──────────────────────────────────

describe("SPEC-005: permanent ICOM legend (RC-4)", () => {
  it("legend renders in tier-stack fallback mode with all 4 roles + honesty key", () => {
    const root = mountView(SPARSE_NODES, SPARSE_EDGES);
    const legend = root.querySelector(".icom-legend");
    expect(legend).not.toBeNull();
    const text = legend!.textContent ?? "";
    for (const role of ["input", "control", "output", "mechanism"]) {
      expect(text).toContain(role);
    }
    expect(text).toContain("real");
    expect(text).toContain("derived");
    // The honest fallback banner is visible and names the mode (humanized copy).
    const mode = root.querySelector(".mode-indicator");
    expect(mode?.textContent).toContain("Sparse");
  });

  it("legend renders in dense idef0 mode", () => {
    const root = mountView(DENSE_NODES, DENSE_EDGES);
    expect(root.querySelector(".icom-legend")).not.toBeNull();
    expect(root.querySelector(".mode-indicator")?.textContent).toContain(
      "IDEF0",
    );
  });

  it("legend renders even in the V-EMPTY state", () => {
    const root = mountView([], []);
    expect(root.querySelector(".icom-legend")).not.toBeNull();
    expect(root.querySelector(".empty-state")).not.toBeNull();
  });
});

// ─── Scenario: keyboard operability (RC-8) ───────────────────────────────────

describe("SPEC-005: keyboard operability (RC-8)", () => {
  it("every outline row and every drillable box is a real <button>", () => {
    const root = mountView(DENSE_NODES, DENSE_EDGES);
    const rows = root.querySelectorAll(".outline-row");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.tagName).toBe("BUTTON");
    for (const box of root.querySelectorAll(".idef0-box.box-real")) {
      expect(box.tagName).toBe("BUTTON");
    }
  });

  it("Enter on an outline row drills in (breadcrumb appears, row selected)", () => {
    const onSelect = vi.fn();
    const root = mountView(DENSE_NODES, DENSE_EDGES, { onSelect });
    expect(root.querySelector(".breadcrumb")).toBeNull();
    const firstRow = root.querySelector(".outline-row")!;
    pressKey(firstRow, "Enter");
    const crumbs = root.querySelector(".breadcrumb");
    expect(crumbs).not.toBeNull();
    expect(crumbs!.querySelector(".crumb-active")).not.toBeNull();
    expect(root.querySelector(".outline-row.row-selected")).not.toBeNull();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("Escape on a diagram box drills back up (breadcrumb clears)", () => {
    const root = mountView(DENSE_NODES, DENSE_EDGES);
    pressKey(root.querySelector(".outline-row")!, "Enter");
    expect(root.querySelector(".breadcrumb")).not.toBeNull();
    const box = root.querySelector(".idef0-box.box-real")!;
    pressKey(box, "Escape");
    expect(root.querySelector(".breadcrumb")).toBeNull();
  });
});

// ─── Scenario: reduced-motion (RC-8) ─────────────────────────────────────────

describe("SPEC-005: reduced-motion (RC-8)", () => {
  it("prefers-reduced-motion: reduce ⇒ box transitions are disabled", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList);
    const root = mountView(DENSE_NODES, DENSE_EDGES);
    const box = root.querySelector<HTMLElement>(".idef0-box.box-real")!;
    expect(box.style.transition).toBe("none");
  });

  it("default motion ⇒ box transition uses the 180ms tween", () => {
    const root = mountView(DENSE_NODES, DENSE_EDGES);
    const box = root.querySelector<HTMLElement>(".idef0-box.box-real")!;
    expect(box.style.transition).toContain("180ms");
  });
});

// ─── Scenario: dual-theme token fidelity (RC-7) ──────────────────────────────

describe("SPEC-005: dual-theme token fidelity (RC-7)", () => {
  // happy-dom rewrites import.meta.url to an http scheme — resolve from the
  // vitest cwd (template/) instead.
  const source = readFileSync(
    resolve(process.cwd(), "src/widgets/dependency-graph/ui/Idef0View.svelte"),
    "utf8",
  );

  it("component styles carry no raw colors — every color resolves via CSS vars", () => {
    const style = source.slice(source.indexOf("<style"));
    expect(style.length).toBeGreaterThan(0);
    // Raw hex / rgb() / hsl() would bypass the light/dark token cascade.
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).not.toMatch(/\brgba?\(/);
    expect(style).not.toMatch(/\bhsla?\(/);
  });

  it("rendered inline styles carry geometry only — never colors", () => {
    const root = mountView(SPARSE_NODES, SPARSE_EDGES);
    for (const el of root.querySelectorAll<HTMLElement>("[style]")) {
      const inline = el.getAttribute("style") ?? "";
      expect(inline).not.toMatch(/color|background|fill|stroke/i);
    }
  });
});

// ─── Scenario: view-registry no-regression (RC-6) ────────────────────────────

describe("SPEC-005: view registry no-regression (RC-6)", () => {
  it("the 7 original views are intact, in order, with idef0 appended last", () => {
    const ids = GRAPH_VIEWS.map((v) => v.id);
    expect(ids).toEqual([
      "force",
      "tree",
      "radial",
      "matrix",
      "lanes",
      "sankey",
      "sunburst",
      "idef0",
    ]);
    for (const v of GRAPH_VIEWS) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.hint.length).toBeGreaterThan(0);
      expect(v.icon).toBeTruthy();
    }
    expect(GRAPH_VIEW_IDS.size).toBe(8);
  });

  it("mounts cleanly with the full sibling-view prop surface (accept-and-ignore)", () => {
    const root = mountView(SPARSE_NODES, SPARSE_EDGES, {
      scores: [],
      selectedId: null,
      openedIds: new Set<string>(),
      kindFilter: new Set<string>(),
      statusFilter: new Set<string>(),
      onSelect: () => {},
      onViewState: () => {},
    });
    expect(root.querySelector(".idef0-host")).not.toBeNull();
    expect(root.querySelector(".outline-pane")).not.toBeNull();
    expect(root.querySelector(".diagram-pane")).not.toBeNull();
  });
});
