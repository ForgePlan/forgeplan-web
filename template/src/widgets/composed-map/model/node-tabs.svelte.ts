import type { MapDocument, MapNode } from "@/entities/map";

export interface NodeConnection {
  dir: "out" | "in";
  label: string;
  relation: string;
}

export interface NodeTabSnapshot {
  node: MapNode;
  connections: NodeConnection[];
}

let tabs = $state<Map<string, NodeTabSnapshot>>(new Map());

export function setNodeTab(nodeId: string, snapshot: NodeTabSnapshot): void {
  const next = new Map(tabs);
  next.set(nodeId, snapshot);
  tabs = next;
}

export function getNodeTab(nodeId: string): NodeTabSnapshot | undefined {
  return tabs.get(nodeId);
}

export function buildNodeConnections(
  doc: MapDocument,
  nodeId: string,
): NodeConnection[] {
  const labelById = new Map(doc.nodes.map((n) => [n.id, n.label]));
  const connections: NodeConnection[] = [];
  for (const edge of doc.edges) {
    if (edge.from === nodeId) {
      connections.push({
        dir: "out",
        label: labelById.get(edge.to) ?? edge.to,
        relation: edge.relation,
      });
    } else if (edge.to === nodeId) {
      connections.push({
        dir: "in",
        label: labelById.get(edge.from) ?? edge.from,
        relation: edge.relation,
      });
    }
  }
  return connections;
}
