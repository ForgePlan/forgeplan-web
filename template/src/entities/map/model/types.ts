import type { GraphEdge } from "@/entities/graph/model/types";

// ===== SPEC-006 C1 — forgeplan.map/v1 document schema =====

export interface MapMeta {
  map_id: string;
  status: "proposed" | "confirmed";
  project_type: string;
  composition_id: string;
  source_fingerprint: string;
  version: number;
  agent_run?: string;
}

export interface MapCanvas {
  grid: { cols: number; rows: number };
  /** carried, Phase 2+ */
  col_weights?: number[];
  /** carried, Phase 2+ */
  row_weights?: number[];
  gap: { x: number; y: number };
  margin: number;
  cell: {
    card_w: number;
    card_h: number;
    card_gap: number;
    zpad: { top: number; side: number; bottom: number };
  };
}

export interface MapPlacement {
  zone: string;
  cell: { row: number; col: number; col_span?: number; row_span?: number };
}

export interface MapZoneConnector {
  from: string;
  to: string;
  label: string;
}

export interface MapComposition {
  template: string;
  /** other arrangements carried, Phase 2+ */
  arrangement: "stack-ttb";
  entry_zone: string;
  placements: MapPlacement[];
  zone_connectors: MapZoneConnector[];
}

export interface MapZone {
  id: string;
  label: string;
  sub?: string;
  description_ru?: string;
  kind: string;
  /** TOKEN name only — hover-hint, never a raw color (§16) */
  accent: string;
  altitude?: string;
  /** §16 FINAL: always neutral-dashed for Phase 1 */
  treatment: "neutral-dashed";
  /** §16 FINAL: always off for Phase 1 */
  rule_edge: "off";
  /** other strategies carried, Phase 2+ */
  layout_rule: "grid";
  /** PINNED — required; never derived from node count (§4/§10) */
  cols: number;
  layers?: string[];
  /** carried, Phase 2+ */
  capacity?: number;
  /** carried, Phase 2+ */
  overflow?: "grow" | "spill" | "collapse";
}

/** carried, Phase 2+ */
export interface MapLayer {
  id: string;
  zone: string;
  label: string;
  order: number;
}

export interface MapNode {
  id: string;
  label: string;
  kind: string;
  zone: string;
  layer?: string;
  meta?: string;
  status?: string;
  r_eff?: number;
  artifact_id?: string;
  description_ru?: string;
  provenance?: { source: string; ref: string; confidence: number };
  /** ISO timestamp — append-stability sort key (§19) */
  found_at: string;
  is_new?: boolean;
  /** carried, Phase 2+ */
  is_mega?: boolean;
  /** carried, Phase 2+ */
  children?: string[];
  /** carried, Phase 2+ */
  collapsed?: boolean;
  // NO x, NO y — ever. Geometry is layout-owned (§4 load-bearing invariant).
}

// ===== SPEC-006 C2 — edges-only compatibility seam =====
// GraphEdge (existing transport, unchanged): { from: string; to: string; relation: string }
// MapEdge STRICTLY EXTENDS it with additive optional keys only.
export interface MapEdge extends GraphEdge {
  namespace?: "typed-link" | "code-dep";
  trust?: "high" | "medium" | "low";
  verified_by?: string;
  /** hand-routed override; carried, Phase 2+ */
  path?: string;
}

// Compile-time Liskov invariant (SPEC-006 AC-4):
// Every MapEdge must narrow to a valid GraphEdge by dropping optional keys.
type _GraphEdgeFrom_MapEdge =
  Pick<MapEdge, "from" | "to" | "relation"> extends GraphEdge ? true : never;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _assertLiskov: _GraphEdgeFrom_MapEdge = true;

export interface MapFlow {
  id: string;
  name: string;
  node_ids: string[];
  edge_ids?: string[];
  /** RU narration steps per §15/§22 */
  steps?: string[];
}

/** carried, Phase 2+ */
export interface MapIncrement {
  version: number;
  added_node_ids: string[];
  stale_node_ids: string[];
}

export interface MapDocument {
  schema: "forgeplan.map/v1";
  meta: MapMeta;
  canvas: MapCanvas;
  composition: MapComposition;
  zones: MapZone[];
  /** carried, Phase 2+ */
  layers?: MapLayer[];
  nodes: MapNode[];
  edges: MapEdge[];
  flows?: MapFlow[];
  /** carried, Phase 2+ */
  increments?: MapIncrement[];
}

// ===== SPEC-006 C4 — validation result types =====

export interface MapValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export type ValidateResult =
  | { ok: true; doc: MapDocument }
  | { ok: false; errors: MapValidationError[] };

// ===== Transport envelope =====

export interface MapResponse {
  ok: boolean;
  data: MapDocument | Record<string, never>;
  cmd: "map:read";
  error?: string;
}
