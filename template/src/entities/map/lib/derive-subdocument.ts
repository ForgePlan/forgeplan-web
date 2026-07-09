import type {
  MapComposition,
  MapDocument,
  MapEdge,
  MapFlow,
  MapNode,
  MapPlacement,
  MapZone,
} from "../model/types";

// RFC-031 Phase 1 — pure drill-down derivation. Turns one altitude of a
// MapDocument into the next by un-hiding child nodes already present (in
// full) in `nodes[]` (SPEC-006 validate.ts Rule 11). Mints no node id, reads
// no x/y, calls no I/O. `computeComposedLayout` (composed-layout.ts) stays
// untouched and runs on the result unchanged.

export type DrillTarget =
  | { kind: "zone"; zone: MapZone }
  | { kind: "mega"; node: MapNode };

export interface SubZoneGroup {
  zone: MapZone;
  nodes: MapNode[];
}

export function resolveDrillTarget(
  doc: MapDocument,
  focusId: string,
): DrillTarget | null {
  const zone = doc.zones.find((z) => z.id === focusId);
  if (zone) return { kind: "zone", zone };
  const node = doc.nodes.find((n) => n.id === focusId && n.is_mega === true);
  if (node) return { kind: "mega", node };
  return null;
}

// A collapsed mega that is itself listed as another (collapsed) mega's
// child, within the same zone, is "nested" — it must surface as a mega card
// via its parent's expansion, not be independently expanded in the same
// pass ("a nested mega among children stays a drillable mega card at this
// altitude").
function nestedMegaIdsInZone(inZoneNodes: readonly MapNode[]): Set<string> {
  const nested = new Set<string>();
  for (const n of inZoneNodes) {
    if (n.is_mega && n.collapsed) {
      for (const cid of n.children ?? []) nested.add(cid);
    }
  }
  return nested;
}

export function collectDirectChildren(
  doc: MapDocument,
  target: DrillTarget,
): MapNode[] {
  const byId = new Map(doc.nodes.map((n) => [n.id, n] as const));
  const seen = new Set<string>();
  const result: MapNode[] = [];
  const add = (n: MapNode | undefined): void => {
    if (!n || seen.has(n.id)) return;
    seen.add(n.id);
    result.push(n);
  };

  if (target.kind === "mega") {
    for (const childId of target.node.children ?? []) add(byId.get(childId));
    return result;
  }

  const inZone = doc.nodes.filter((n) => n.zone === target.zone.id);
  const nested = nestedMegaIdsInZone(inZone);
  for (const candidate of inZone) {
    if (nested.has(candidate.id)) continue;
    if (candidate.is_mega && candidate.collapsed) {
      for (const childId of candidate.children ?? []) add(byId.get(childId));
    } else if (!candidate.is_mega) {
      // TODO(rfc-031-noncollapsed-mega-in-zone): an uncollapsed, non-nested
      // mega node directly in this zone is dropped here — the RFC's literal
      // formula is "non-mega nodes UNION expand(each collapsed mega)"; such
      // a mega's own card matches neither clause. Its children still
      // surface via this same branch (they share `candidate.zone`). No
      // known fixture (the 214-node real map) exercises this combination.
      add(candidate);
    }
  }
  return result;
}

// Every collapsed mega that gets expanded by this derivation step must stop
// suppressing its children in `computeComposedLayout`'s own (unchanged,
// zone-agnostic) hiddenIds scan — otherwise the just-revealed children would
// render nowhere. The mega node itself is carried forward (id/found_at
// verbatim, Rule 11 integrity) with `collapsed` cleared; its `zone` is left
// untouched so it does not newly render (nothing currently targets it).
function dissolvedMegaIds(doc: MapDocument, target: DrillTarget): Set<string> {
  if (target.kind === "mega") return new Set([target.node.id]);
  const inZone = doc.nodes.filter((n) => n.zone === target.zone.id);
  const nested = nestedMegaIdsInZone(inZone);
  const dissolved = new Set<string>();
  for (const n of inZone) {
    if (nested.has(n.id)) continue;
    if (n.is_mega && n.collapsed) dissolved.add(n.id);
  }
  return dissolved;
}

export function groupIntoSubZones(
  doc: MapDocument,
  parentZone: MapZone,
  children: readonly MapNode[],
  focusId: string,
): SubZoneGroup[] {
  const labelFor = (layerToken: string, fallback: string): string =>
    doc.layers?.find((l) => l.zone === parentZone.id && l.id === layerToken)
      ?.label ?? fallback;

  const makeZone = (layerToken: string, label: string): MapZone => ({
    id: `sub:${focusId}:${layerToken}`,
    label,
    kind: parentZone.kind,
    accent: parentZone.accent,
    treatment: "neutral-dashed",
    rule_edge: "off",
    layout_rule: "grid",
    cols: parentZone.cols,
  });

  const layerTokens = parentZone.layers ?? [];
  if (layerTokens.length === 0) {
    return [{ zone: makeZone("all", parentZone.label), nodes: [...children] }];
  }

  const groups: SubZoneGroup[] = [];
  const claimed = new Set<string>();
  for (const layerToken of layerTokens) {
    const nodes = children.filter((n) => n.layer === layerToken);
    for (const n of nodes) claimed.add(n.id);
    groups.push({
      zone: makeZone(layerToken, labelFor(layerToken, layerToken)),
      nodes,
    });
  }
  const ungrouped = children.filter((n) => !claimed.has(n.id));
  if (ungrouped.length > 0) {
    groups.push({
      zone: makeZone("ungrouped", "Ungrouped"),
      nodes: ungrouped,
    });
  }
  return groups;
}

export function synthesizeComposition(
  groups: readonly SubZoneGroup[],
): MapComposition {
  const placements: MapPlacement[] = groups.map((g, i) => ({
    zone: g.zone.id,
    cell: { row: i, col: 0 },
  }));
  return {
    template: "derived-drill-stack",
    arrangement: "stack-ttb",
    entry_zone: groups[0]?.zone.id ?? "",
    placements,
    zone_connectors: [],
  };
}

export function isDrillable(doc: MapDocument, focusId: string): boolean {
  const target = resolveDrillTarget(doc, focusId);
  if (!target) return false;

  if (target.kind === "mega") {
    return collectDirectChildren(doc, target).length > 0;
  }

  const zoneNodes = doc.nodes.filter((n) => n.zone === target.zone.id);
  if (zoneNodes.some((n) => n.is_mega && n.collapsed)) return true;

  const layerTokens = target.zone.layers ?? [];
  if (layerTokens.length === 0) return false;

  const children = collectDirectChildren(doc, target);
  if (children.length === 0) return false;

  const groups = groupIntoSubZones(doc, target.zone, children, focusId);
  return groups.length > 1;
}

export function deriveSubDocument(
  doc: MapDocument,
  focusId: string,
): MapDocument {
  const target = resolveDrillTarget(doc, focusId);
  if (!target) return doc;

  const children = collectDirectChildren(doc, target);
  if (children.length === 0) return doc;

  const parentZone =
    target.kind === "zone"
      ? target.zone
      : doc.zones.find((z) => z.id === target.node.zone);
  if (!parentZone) return doc;

  const groups = groupIntoSubZones(doc, parentZone, children, focusId);

  // The FULL node universe is retained (never pruned): a nested mega's own
  // children may not be part of THIS altitude's revealed set, yet must stay
  // resolvable by id when the user later descends into that nested mega
  // (recursive fold, AC-3). Only the revealed subset's `zone` is remapped;
  // every other node passes through untouched (id/found_at verbatim).
  const zoneByNodeId = new Map<string, string>();
  for (const group of groups) {
    for (const n of group.nodes) zoneByNodeId.set(n.id, group.zone.id);
  }
  const dissolved = dissolvedMegaIds(doc, target);

  const nodes: MapNode[] = doc.nodes.map((n) => {
    const subZoneId = zoneByNodeId.get(n.id);
    if (subZoneId !== undefined) return { ...n, zone: subZoneId };
    if (dissolved.has(n.id)) return { ...n, collapsed: false };
    return n;
  });

  const revealedIds = new Set(zoneByNodeId.keys());
  const edges: MapEdge[] = doc.edges.filter(
    (e) => revealedIds.has(e.from) && revealedIds.has(e.to),
  );

  // #21: carry parent flows filtered to the revealed subset (deeper-level chips)
  const carriedFlows: MapFlow[] = [];
  for (const f of doc.flows ?? []) {
    const kept = f.node_ids.filter((id) => revealedIds.has(id));
    if (kept.length < 2) continue;
    const trimmed = kept.length !== f.node_ids.length;
    carriedFlows.push({
      ...f,
      node_ids: kept,
      steps: trimmed ? undefined : f.steps,
      edge_ids: trimmed ? undefined : f.edge_ids,
    });
  }

  return {
    ...doc,
    canvas: { ...doc.canvas, grid: { cols: 1, rows: groups.length } },
    composition: synthesizeComposition(groups),
    zones: groups.map((g) => g.zone),
    nodes,
    edges,
    flows: carriedFlows.length > 0 ? carriedFlows : undefined,
    layers: undefined,
  };
}
