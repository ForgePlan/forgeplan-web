import type {
  MapDocument,
  MapValidationError,
  ValidateResult,
} from "../model/types";

// SPEC-006 C4 — never-throwing web-side validator.
// Collects ALL errors (no fail-fast); returns { ok, doc } or { ok, errors }.
// 14-rule catalog matching E2.

const SCHEMA_TAG = "forgeplan.map/v1";

function err(
  path: string,
  message: string,
  severity: "error" | "warning" = "error",
): MapValidationError {
  return { path, message, severity };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

// Rule 1: schema tag
function checkSchemaTag(
  doc: Record<string, unknown>,
  errs: MapValidationError[],
): void {
  if (doc.schema !== SCHEMA_TAG) {
    errs.push(
      err(
        "schema",
        `expected '${SCHEMA_TAG}', got ${JSON.stringify(doc.schema ?? null)}`,
      ),
    );
  }
}

// Rule 2: required top-level blocks present and correctly typed
function checkRequiredBlocks(
  doc: Record<string, unknown>,
  errs: MapValidationError[],
): void {
  const required: [string, string][] = [
    ["meta", "object"],
    ["canvas", "object"],
    ["composition", "object"],
    ["zones", "array"],
    ["nodes", "array"],
    ["edges", "array"],
  ];
  for (const [key, kind] of required) {
    const val = doc[key];
    if (kind === "object" && !isObject(val)) {
      errs.push(err(key, `required ${kind} missing or wrong type`));
    } else if (kind === "array" && !isArray(val)) {
      errs.push(err(key, `required array missing`));
    }
  }
}

// Rule 3: every node.zone ∈ zones
function checkNodeZones(
  zones: Set<string>,
  nodes: unknown[],
  errs: MapValidationError[],
): void {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!isObject(n)) continue;
    if (typeof n.zone === "string" && !zones.has(n.zone)) {
      errs.push(err(`nodes[${i}].zone`, `zone '${n.zone}' not in zones`));
    }
  }
}

// Rule 4: every edge endpoint (from, to) ∈ nodes
function checkEdgeEndpoints(
  nodeIds: Set<string>,
  edges: unknown[],
  errs: MapValidationError[],
): void {
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (!isObject(e)) continue;
    if (typeof e.from === "string" && !nodeIds.has(e.from)) {
      errs.push(err(`edges[${i}].from`, `endpoint '${e.from}' not in nodes`));
    }
    if (typeof e.to === "string" && !nodeIds.has(e.to)) {
      errs.push(err(`edges[${i}].to`, `endpoint '${e.to}' not in nodes`));
    }
  }
}

// Rule 5: every flow.node_ids[*] ∈ nodes
function checkFlowRefs(
  nodeIds: Set<string>,
  flows: unknown[],
  errs: MapValidationError[],
): void {
  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    if (!isObject(f)) continue;
    if (!isArray(f.node_ids)) continue;
    for (let j = 0; j < f.node_ids.length; j++) {
      const nid = f.node_ids[j];
      if (typeof nid === "string" && !nodeIds.has(nid)) {
        errs.push(err(`flows[${i}].node_ids[${j}]`, `'${nid}' not in nodes`));
      }
    }
  }
}

// Rule 6: every zone_connectors[*].from/to ∈ zones
function checkConnectorEndpoints(
  zoneIds: Set<string>,
  composition: Record<string, unknown>,
  errs: MapValidationError[],
): void {
  if (!isArray(composition.zone_connectors)) return;
  for (let i = 0; i < composition.zone_connectors.length; i++) {
    const c = composition.zone_connectors[i];
    if (!isObject(c)) continue;
    if (typeof c.from === "string" && !zoneIds.has(c.from)) {
      errs.push(
        err(
          `composition.zone_connectors[${i}].from`,
          `'${c.from}' not in zones`,
        ),
      );
    }
    if (typeof c.to === "string" && !zoneIds.has(c.to)) {
      errs.push(
        err(`composition.zone_connectors[${i}].to`, `'${c.to}' not in zones`),
      );
    }
  }
}

// Rule 7: composition.entry_zone ∈ zones
function checkEntryZone(
  zoneIds: Set<string>,
  composition: Record<string, unknown>,
  errs: MapValidationError[],
): void {
  if (typeof composition.entry_zone === "string") {
    if (!zoneIds.has(composition.entry_zone)) {
      errs.push(
        err(
          "composition.entry_zone",
          `zone '${composition.entry_zone}' not in zones`,
        ),
      );
    }
  }
}

// Rule 8: no duplicate node ids, zone ids, flow ids
function checkNoDuplicateIds(
  zones: unknown[],
  nodes: unknown[],
  flows: unknown[],
  errs: MapValidationError[],
): void {
  const seen = new Set<string>();
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (!isObject(z) || typeof z.id !== "string") continue;
    if (seen.has(`z:${z.id}`)) {
      errs.push(err(`zones[${i}].id`, `duplicate zone id '${z.id}'`));
    } else {
      seen.add(`z:${z.id}`);
    }
  }
  const nodesSeen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!isObject(n) || typeof n.id !== "string") continue;
    if (nodesSeen.has(n.id)) {
      errs.push(err(`nodes[${i}].id`, `duplicate node id '${n.id}'`));
    } else {
      nodesSeen.add(n.id);
    }
  }
  const flowsSeen = new Set<string>();
  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    if (!isObject(f) || typeof f.id !== "string") continue;
    if (flowsSeen.has(f.id)) {
      errs.push(err(`flows[${i}].id`, `duplicate flow id '${f.id}'`));
    } else {
      flowsSeen.add(f.id);
    }
  }
}

// Rule 9: every zone has pinned numeric cols >= 1
function checkZoneCols(zones: unknown[], errs: MapValidationError[]): void {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (!isObject(z)) continue;
    if (typeof z.cols !== "number" || z.cols < 1) {
      errs.push(
        err(`zones[${i}].cols`, `cols missing or < 1 (must be pinned)`),
      );
    }
  }
}

// Rule 10: placement cells do not overlap and fit inside canvas.grid
function checkPlacements(
  canvas: Record<string, unknown>,
  composition: Record<string, unknown>,
  errs: MapValidationError[],
): void {
  if (!isArray(composition.placements)) return;
  const grid = isObject(canvas.grid) ? canvas.grid : null;
  const maxRow = typeof grid?.rows === "number" ? (grid.rows as number) : null;
  const maxCol = typeof grid?.cols === "number" ? (grid.cols as number) : null;
  const occupied = new Map<string, string>();

  for (let i = 0; i < composition.placements.length; i++) {
    const p = composition.placements[i];
    if (!isObject(p)) continue;
    const zoneId = typeof p.zone === "string" ? p.zone : `?${i}`;
    const cell = isObject(p.cell) ? p.cell : null;
    if (!cell) continue;
    const row = typeof cell.row === "number" ? cell.row : null;
    const col = typeof cell.col === "number" ? cell.col : null;
    if (row === null || col === null) continue;
    const colSpan = typeof cell.col_span === "number" ? cell.col_span : 1;
    const rowSpan = typeof cell.row_span === "number" ? cell.row_span : 1;

    // bounds check
    if (maxRow !== null && row + rowSpan - 1 >= maxRow) {
      errs.push(
        err(
          `composition.placements[${i}].cell`,
          `row ${row} outside canvas.grid.rows=${maxRow}`,
        ),
      );
    }
    if (maxCol !== null && col + colSpan - 1 >= maxCol) {
      errs.push(
        err(
          `composition.placements[${i}].cell`,
          `col ${col} outside canvas.grid.cols=${maxCol}`,
        ),
      );
    }

    // overlap check (expand spans)
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        const key = `${r}:${c}`;
        const prev = occupied.get(key);
        if (prev !== undefined) {
          errs.push(
            err(
              `composition.placements[${i}].cell`,
              `zone '${zoneId}' cell overlaps '${prev}'`,
            ),
          );
        } else {
          occupied.set(key, zoneId);
        }
      }
    }
  }
}

// Rule 11: mega-node integrity (children ∈ nodes, no nesting cycle)
function checkMegaNodes(
  nodes: unknown[],
  nodeIds: Set<string>,
  errs: MapValidationError[],
): void {
  const megaChildren = new Map<string, string[]>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!isObject(n) || !n.is_mega || !isArray(n.children)) continue;
    const id = typeof n.id === "string" ? n.id : `?${i}`;
    const kids: string[] = [];
    for (let j = 0; j < n.children.length; j++) {
      const cid = n.children[j];
      if (typeof cid === "string") {
        if (!nodeIds.has(cid)) {
          errs.push(err(`nodes[${i}].children[${j}]`, `'${cid}' not in nodes`));
        }
        kids.push(cid);
      }
    }
    megaChildren.set(id, kids);
  }
  // cycle detection: DFS
  for (const [start] of megaChildren) {
    const visited = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) {
        errs.push(
          err(
            `nodes[?]`,
            `mega-node nesting cycle detected involving '${start}'`,
          ),
        );
        break;
      }
      visited.add(cur);
      const kids = megaChildren.get(cur);
      if (kids) stack.push(...kids);
    }
  }
}

// Rule 12: nodes carry NO x/y keys
function checkNoGeometry(nodes: unknown[], errs: MapValidationError[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!isObject(n)) continue;
    if ("x" in n) {
      errs.push(
        err(
          `nodes[${i}].x`,
          `nodes must not carry x/y — geometry is layout-owned`,
        ),
      );
    }
    if ("y" in n) {
      errs.push(
        err(
          `nodes[${i}].y`,
          `nodes must not carry x/y — geometry is layout-owned`,
        ),
      );
    }
  }
}

// Rule 13: every placements[*].zone ∈ zones
function checkPlacementZones(
  zoneIds: Set<string>,
  composition: Record<string, unknown>,
  errs: MapValidationError[],
): void {
  if (!isArray(composition.placements)) return;
  for (let i = 0; i < composition.placements.length; i++) {
    const p = composition.placements[i];
    if (!isObject(p)) continue;
    if (typeof p.zone === "string" && !zoneIds.has(p.zone)) {
      errs.push(
        err(
          `composition.placements[${i}].zone`,
          `zone '${p.zone}' not in zones`,
        ),
      );
    }
  }
}

// Rule 14: unknown extra keys → warning only (forward-compatible reads)
// (Handled implicitly: we don't error on unknown keys, max severity = warning.)
// Unknown edge.relation is NOT an error (namespace default per C1).

export function validateMapDocument(input: unknown): ValidateResult {
  const errs: MapValidationError[] = [];

  if (!isObject(input)) {
    errs.push(err("", "document must be a non-null object"));
    return { ok: false, errors: errs };
  }

  // Rule 1
  checkSchemaTag(input, errs);

  // Rule 2
  checkRequiredBlocks(input, errs);

  // Bail early if structure is missing — downstream checks would throw
  const zones = isArray(input.zones) ? input.zones : [];
  const nodes = isArray(input.nodes) ? input.nodes : [];
  const edges = isArray(input.edges) ? input.edges : [];
  const flows = isArray(input.flows) ? input.flows : [];
  const composition = isObject(input.composition) ? input.composition : {};
  const canvas = isObject(input.canvas) ? input.canvas : {};

  const zoneIds = new Set<string>();
  for (const z of zones) {
    if (isObject(z) && typeof z.id === "string") zoneIds.add(z.id);
  }
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (isObject(n) && typeof n.id === "string") nodeIds.add(n.id);
  }

  // Rules 3–14
  checkNodeZones(zoneIds, nodes, errs);
  checkEdgeEndpoints(nodeIds, edges, errs);
  checkFlowRefs(nodeIds, flows, errs);
  checkConnectorEndpoints(zoneIds, composition, errs);
  checkEntryZone(zoneIds, composition, errs);
  checkNoDuplicateIds(zones, nodes, flows, errs);
  checkZoneCols(zones, errs);
  checkPlacements(canvas, composition, errs);
  checkMegaNodes(nodes, nodeIds, errs);
  checkNoGeometry(nodes, errs);
  checkPlacementZones(zoneIds, composition, errs);

  if (errs.some((e) => e.severity === "error")) {
    return { ok: false, errors: errs };
  }
  // If only warnings (or no errs), the document is valid
  // Warnings are collected but don't block ok:true
  if (errs.length > 0) {
    // Only warnings remain — still ok:true but we pass the doc through
    // The caller receives ok:true; warning display is the view's responsibility
    return { ok: true, doc: input as unknown as MapDocument };
  }
  return { ok: true, doc: input as unknown as MapDocument };
}
