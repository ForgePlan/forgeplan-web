import { describe, it, expect } from "vitest";
import {
  buildNodeConnections,
  getNodeTab,
  setNodeTab,
  type NodeTabSnapshot,
} from "./node-tabs.svelte";
import type { MapDocument, MapNode } from "@/entities/map";

function makeDoc(nodes: MapNode[], edges: MapDocument["edges"]): MapDocument {
  return {
    schema: "forgeplan.map/v1",
    meta: {
      map_id: "test",
      status: "confirmed",
      project_type: "test",
      composition_id: "c1",
      source_fingerprint: "fp",
      version: 1,
    },
    canvas: {
      grid: { cols: 1, rows: 1 },
      gap: { x: 0, y: 0 },
      margin: 0,
      cell: {
        card_w: 10,
        card_h: 10,
        card_gap: 0,
        zpad: { top: 0, side: 0, bottom: 0 },
      },
    },
    composition: {
      template: "t",
      arrangement: "stack-ttb",
      entry_zone: "z1",
      placements: [],
      zone_connectors: [],
    },
    zones: [],
    nodes,
    edges,
  };
}

function makeNode(
  id: string,
  label: string,
  overrides: Partial<MapNode> = {},
): MapNode {
  return {
    id,
    label,
    kind: "module",
    zone: "z1",
    found_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildNodeConnections", () => {
  it("resolves outgoing edges to the target node's label", () => {
    const doc = makeDoc(
      [makeNode("a", "Module A"), makeNode("b", "Module B")],
      [{ from: "a", to: "b", relation: "calls" }],
    );
    expect(buildNodeConnections(doc, "a")).toEqual([
      { dir: "out", label: "Module B", relation: "calls" },
    ]);
  });

  it("resolves incoming edges to the source node's label", () => {
    const doc = makeDoc(
      [makeNode("a", "Module A"), makeNode("b", "Module B")],
      [{ from: "a", to: "b", relation: "calls" }],
    );
    expect(buildNodeConnections(doc, "b")).toEqual([
      { dir: "in", label: "Module A", relation: "calls" },
    ]);
  });

  it("mixes outgoing and incoming edges for a node with both", () => {
    const doc = makeDoc(
      [
        makeNode("a", "Module A"),
        makeNode("b", "Module B"),
        makeNode("c", "Module C"),
      ],
      [
        { from: "b", to: "a", relation: "imports" },
        { from: "a", to: "c", relation: "informs" },
      ],
    );
    expect(buildNodeConnections(doc, "a")).toEqual([
      { dir: "in", label: "Module B", relation: "imports" },
      { dir: "out", label: "Module C", relation: "informs" },
    ]);
  });

  it("falls back to the raw id when the endpoint node is missing from doc.nodes", () => {
    const doc = makeDoc(
      [makeNode("a", "Module A")],
      [{ from: "a", to: "ghost", relation: "calls" }],
    );
    expect(buildNodeConnections(doc, "a")).toEqual([
      { dir: "out", label: "ghost", relation: "calls" },
    ]);
  });

  it("returns an empty array for a node with no edges", () => {
    const doc = makeDoc([makeNode("a", "Module A")], []);
    expect(buildNodeConnections(doc, "a")).toEqual([]);
  });
});

describe("node tab snapshot store", () => {
  it("returns undefined for a nodeId that was never set", () => {
    expect(getNodeTab("never-set-node-id")).toBeUndefined();
  });

  it("stores and retrieves a snapshot by nodeId", () => {
    const snapshot: NodeTabSnapshot = {
      node: makeNode("store-test-a", "Store Test A"),
      connections: [{ dir: "out", label: "Store Test B", relation: "calls" }],
    };
    setNodeTab("store-test-a", snapshot);
    expect(getNodeTab("store-test-a")).toEqual(snapshot);
  });

  it("overwrites a prior snapshot for the same nodeId", () => {
    const first: NodeTabSnapshot = {
      node: makeNode("store-test-b", "First"),
      connections: [],
    };
    const second: NodeTabSnapshot = {
      node: makeNode("store-test-b", "Second"),
      connections: [],
    };
    setNodeTab("store-test-b", first);
    setNodeTab("store-test-b", second);
    expect(getNodeTab("store-test-b")?.node.label).toBe("Second");
  });
});
