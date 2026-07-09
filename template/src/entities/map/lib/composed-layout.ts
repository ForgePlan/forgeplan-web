import type {
  MapCanvas,
  MapDocument,
  MapEdge,
  MapNode,
  MapZone,
} from "../model/types";

// SPEC-006 C3 — pure, deterministic, pinned-cols layout. Verbatim port of the
// proven spike's layout()/curve() (group -> measure -> macro-grid max-track
// sizing -> cumulative origins -> emit; dominant-axis curve with
// k=max(38, dist*0.4)). Extends the spike's single-span-only macro grid to
// honor MapPlacement.cell.col_span/row_span (the spike's zones never spanned
// more than one macro cell) by expanding under-sized spanned tracks to fit.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

interface Box extends Rect {
  cx: number;
  cy: number;
}

export interface EdgePathEntry {
  edge: MapEdge;
  d: string;
}

export interface ConnectorPathEntry {
  from: string;
  to: string;
  label: string;
  d: string;
}

export interface ComposedLayout {
  width: number;
  height: number;
  zoneRects: ReadonlyMap<string, Rect>;
  nodePositions: ReadonlyMap<string, Point>;
  edgePaths: ReadonlyArray<EdgePathEntry>;
  connectorPaths: ReadonlyArray<ConnectorPathEntry>;
}

function toBox(rect: Rect): Box {
  return { ...rect, cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 };
}

export function curve(
  a: Box,
  b: Box,
  spread: number,
): { d: string; mid: Point } {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const horiz = Math.abs(dx) >= Math.abs(dy);
  let s: Point;
  let e: Point;
  let c1: Point;
  let c2: Point;
  if (horiz) {
    const dir = dx > 0 ? 1 : -1;
    s = { x: dir > 0 ? a.x + a.w : a.x, y: a.cy + spread };
    e = { x: dir > 0 ? b.x : b.x + b.w, y: b.cy - spread };
    const k = Math.max(38, Math.abs(e.x - s.x) * 0.4);
    c1 = { x: s.x + dir * k, y: s.y };
    c2 = { x: e.x - dir * k, y: e.y };
  } else {
    const dir = dy > 0 ? 1 : -1;
    s = { x: a.cx + spread, y: dir > 0 ? a.y + a.h : a.y };
    e = { x: b.cx - spread, y: dir > 0 ? b.y : b.y + b.h };
    const k = Math.max(38, Math.abs(e.y - s.y) * 0.4);
    c1 = { x: s.x, y: s.y + dir * k };
    c2 = { x: e.x, y: e.y - dir * k };
  }
  return {
    d: `M ${s.x} ${s.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${e.x} ${e.y}`,
    mid: { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 },
  };
}

interface ZoneSubGrid {
  rows: number;
  positions: ReadonlyMap<string, { row: number; col: number }>;
}

function computeZoneSubGrid(
  zone: MapZone,
  zoneNodes: readonly MapNode[],
): ZoneSubGrid {
  const cols = Math.max(1, zone.cols);
  const sorted = [...zoneNodes].sort((a, b) => {
    const layerA = a.layer ?? "";
    const layerB = b.layer ?? "";
    if (layerA !== layerB) return layerA < layerB ? -1 : 1;
    if (a.found_at !== b.found_at) return a.found_at < b.found_at ? -1 : 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  const rows = sorted.length === 0 ? 1 : Math.ceil(sorted.length / cols);
  const positions = new Map<string, { row: number; col: number }>();
  sorted.forEach((node, i) => {
    positions.set(node.id, { row: Math.floor(i / cols), col: i % cols });
  });
  return { rows, positions };
}

function zoneNaturalSize(
  canvas: MapCanvas,
  rows: number,
  cols: number,
): { w: number; h: number } {
  const { card_w, card_h, card_gap, zpad } = canvas.cell;
  return {
    w: cols * card_w + Math.max(0, cols - 1) * card_gap + zpad.side * 2,
    h:
      rows * card_h + Math.max(0, rows - 1) * card_gap + zpad.top + zpad.bottom,
  };
}

function spanSize(
  tracks: readonly number[],
  start: number,
  span: number,
  gap: number,
): number {
  let total = 0;
  for (let i = start; i < start + span && i < tracks.length; i++) {
    total += tracks[i] ?? 0;
  }
  return total + Math.max(0, span - 1) * gap;
}

function expandTracksForSpan(
  tracks: number[],
  start: number,
  span: number,
  gap: number,
  required: number,
): void {
  const current = spanSize(tracks, start, span, gap);
  if (current >= required) return;
  const deficit = required - current;
  const per = deficit / span;
  for (let i = start; i < start + span && i < tracks.length; i++) {
    tracks[i] = (tracks[i] ?? 0) + per;
  }
}

function cumulativeOrigins(
  tracks: readonly number[],
  margin: number,
  gap: number,
): number[] {
  const origins: number[] = [];
  let cursor = margin;
  for (const size of tracks) {
    origins.push(cursor);
    cursor += size + gap;
  }
  return origins;
}

export function computeComposedLayout(doc: MapDocument): ComposedLayout {
  const { canvas, composition, zones, nodes, edges } = doc;

  // A collapsed mega-node stands IN for its children: the emitter puts BOTH
  // the mega and all its children in nodes[] (validate.ts Rule 11 requires the
  // children to be present for integrity), so the children must not ALSO
  // render as their own cards — otherwise a zone that collapsed 170 nodes
  // draws the mega card PLUS all 170. Exclude every collapsed mega-node's
  // children from the layout; a node with no computed position is skipped by
  // ComposedMapView, and its edges auto-drop (they guard on nodeBoxes).
  const hiddenIds = new Set<string>();
  for (const node of nodes) {
    if (node.is_mega && node.collapsed && Array.isArray(node.children)) {
      for (const cid of node.children) hiddenIds.add(cid);
    }
  }
  const visibleNodes =
    hiddenIds.size > 0 ? nodes.filter((n) => !hiddenIds.has(n.id)) : nodes;

  const zoneById = new Map(zones.map((zone) => [zone.id, zone] as const));
  const nodesByZone = new Map<string, MapNode[]>();
  for (const zone of zones) nodesByZone.set(zone.id, []);
  for (const node of visibleNodes) {
    nodesByZone.get(node.zone)?.push(node);
  }

  const subGrids = new Map<string, ZoneSubGrid>();
  const naturalSizes = new Map<string, { w: number; h: number }>();
  for (const zone of zones) {
    const sub = computeZoneSubGrid(zone, nodesByZone.get(zone.id) ?? []);
    subGrids.set(zone.id, sub);
    naturalSizes.set(
      zone.id,
      zoneNaturalSize(canvas, sub.rows, Math.max(1, zone.cols)),
    );
  }

  const maxCols = Math.max(0, canvas.grid.cols);
  const maxRows = Math.max(0, canvas.grid.rows);
  const colW = new Array<number>(maxCols).fill(0);
  const rowH = new Array<number>(maxRows).fill(0);

  const singleSpan = composition.placements.filter(
    (p) => (p.cell.col_span ?? 1) === 1 && (p.cell.row_span ?? 1) === 1,
  );
  const multiSpan = composition.placements.filter(
    (p) => (p.cell.col_span ?? 1) > 1 || (p.cell.row_span ?? 1) > 1,
  );

  for (const placement of singleSpan) {
    const size = naturalSizes.get(placement.zone);
    if (!size) continue;
    const { row, col } = placement.cell;
    if (col >= 0 && col < colW.length)
      colW[col] = Math.max(colW[col] ?? 0, size.w);
    if (row >= 0 && row < rowH.length)
      rowH[row] = Math.max(rowH[row] ?? 0, size.h);
  }

  for (const placement of multiSpan) {
    const size = naturalSizes.get(placement.zone);
    if (!size) continue;
    const { row, col } = placement.cell;
    const colSpan = placement.cell.col_span ?? 1;
    const rowSpan = placement.cell.row_span ?? 1;
    expandTracksForSpan(colW, col, colSpan, canvas.gap.x, size.w);
    expandTracksForSpan(rowH, row, rowSpan, canvas.gap.y, size.h);
  }

  const colX = cumulativeOrigins(colW, canvas.margin, canvas.gap.x);
  const rowY = cumulativeOrigins(rowH, canvas.margin, canvas.gap.y);

  const zoneRects = new Map<string, Rect>();
  const nodePositions = new Map<string, Point>();

  for (const placement of composition.placements) {
    const zone = zoneById.get(placement.zone);
    if (!zone) continue;
    const { row, col } = placement.cell;
    const colSpan = placement.cell.col_span ?? 1;
    const rowSpan = placement.cell.row_span ?? 1;
    const rect: Rect = {
      x: colX[col] ?? canvas.margin,
      y: rowY[row] ?? canvas.margin,
      w: spanSize(colW, col, colSpan, canvas.gap.x),
      h: spanSize(rowH, row, rowSpan, canvas.gap.y),
    };
    zoneRects.set(zone.id, rect);

    const sub = subGrids.get(zone.id);
    if (!sub) continue;
    const { card_w, card_h, card_gap, zpad } = canvas.cell;
    for (const [nodeId, pos] of sub.positions) {
      nodePositions.set(nodeId, {
        x: rect.x + zpad.side + pos.col * (card_w + card_gap),
        y: rect.y + zpad.top + pos.row * (card_h + card_gap),
      });
    }
  }

  const width =
    colX.length > 0
      ? (colX[colX.length - 1] ?? canvas.margin) +
        (colW[colW.length - 1] ?? 0) +
        canvas.margin
      : canvas.margin * 2;
  const height =
    rowY.length > 0
      ? (rowY[rowY.length - 1] ?? canvas.margin) +
        (rowH[rowH.length - 1] ?? 0) +
        canvas.margin
      : canvas.margin * 2;

  const nodeBoxes = new Map<string, Box>();
  for (const node of nodes) {
    const pos = nodePositions.get(node.id);
    if (!pos) continue;
    nodeBoxes.set(
      node.id,
      toBox({
        x: pos.x,
        y: pos.y,
        w: canvas.cell.card_w,
        h: canvas.cell.card_h,
      }),
    );
  }

  const edgePaths: EdgePathEntry[] = [];
  for (const edge of edges) {
    const a = nodeBoxes.get(edge.from);
    const b = nodeBoxes.get(edge.to);
    if (!a || !b) continue;
    edgePaths.push({ edge, d: curve(a, b, 0).d });
  }

  const connectorPaths: ConnectorPathEntry[] = [];
  for (const connector of composition.zone_connectors) {
    const a = zoneRects.get(connector.from);
    const b = zoneRects.get(connector.to);
    if (!a || !b) continue;
    connectorPaths.push({
      from: connector.from,
      to: connector.to,
      label: connector.label,
      d: curve(toBox(a), toBox(b), 0).d,
    });
  }

  return { width, height, zoneRects, nodePositions, edgePaths, connectorPaths };
}
