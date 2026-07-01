/**
 * Data contract for the IDEF0-STYLE decomposition core (SPEC-004 Data Models).
 * The core is a pure, deterministic, headless pipeline: no geometry (x/y), no
 * DOM, no I/O, no wall-clock, no randomness. Host renderers own layout.
 */

/** The five canonical forgeplan link relations the core classifies. */
export type Relation =
  | "informs"
  | "based_on"
  | "supersedes"
  | "contradicts"
  | "refines";

/** ICOM role of an edge at its target box. `decomposition` = the structural
 * (tree) role carried by `refines`; `informs` is always `mechanism` (INV-2). */
export type IcomClass =
  | "input"
  | "control"
  | "output"
  | "mechanism"
  | "decomposition";

/** Honesty marker (INV-5, edge-scoped): authored edge = real (solid),
 * inferred link = derived (dashed ≈). Nodes are real by default (roots too). */
export type Provenance = "real" | "derived";

export type DiagramMode = "idef0" | "tier-stack";

/** Stable identity per forgeplan#397 (slug/id fields absent in 0.33 JSON). */
export interface CompositeKey {
  id: string;
  title: string;
}

/** Untrusted poller payload; tolerant of #397 omissions. */
export interface RawSnapshot {
  nodes?: Array<{
    id?: string | null;
    title?: string | null;
    kind?: string | null;
  }>;
  edges?: Array<{
    from?: string | null;
    to?: string | null;
    relation?: string | null;
  }>;
  takenAt?: string;
}

export interface NodeIn {
  key: CompositeKey;
  id: string;
  title: string;
  kind: string;
  idCollision: boolean;
  degradedKey: boolean;
}

export interface EdgeIn {
  from: CompositeKey;
  to: CompositeKey;
  relation: Relation;
}

export interface DecompInput {
  nodes: NodeIn[];
  edges: EdgeIn[];
  /** Injected — purity: the core never reads a default itself. */
  threshold: number;
  takenAt: string;
  /** Count of nodes dropped by port() (E-MISSING-IDENTITY). */
  dropped: number;
}

/** An inferred (non-authored) link — always derived (INV-5). */
export interface DerivedLink {
  from: CompositeKey;
  to: CompositeKey;
  provenance: "derived";
  reason: "E-MULTI-PARENT" | "E-CYCLE";
}

export interface ForestNode {
  key: CompositeKey;
  kind: string;
  tier: number;
  parent: CompositeKey | null;
  children: CompositeKey[];
  provenance: Provenance;
  number: string | null;
  idCollision: boolean;
  degradedKey: boolean;
}

export interface DecompForest {
  roots: CompositeKey[];
  nodes: Map<string, ForestNode>;
  mode: "idef0";
  provenance: "real";
  derivedLinks: DerivedLink[];
}

export interface TierStackTier {
  tier: number;
  kind: string;
  members: CompositeKey[];
}

export interface TierStackForest {
  tiers: TierStackTier[];
  mode: "tier-stack";
  provenance: "derived";
}

export interface ClassifiedEdge {
  from: CompositeKey;
  to: CompositeKey;
  relation: Relation;
  icom: IcomClass;
  provenance: Provenance;
}

export type IcomSide = "left" | "top" | "right" | "bottom";

export interface DiagramBox {
  key: CompositeKey;
  number: string;
  kind: string;
  provenance: Provenance;
  /** Present on a mega-node rollup box ("+N more"); the number of collapsed
   * members (F2 / I-14). Absent on ordinary boxes. */
  rollupCount?: number;
}

export interface DiagramArrow {
  edge: ClassifiedEdge;
  /** ICOM convention (I=left, C=top, O=right, M=bottom) — a role, not pixels. */
  side: IcomSide;
}

export interface IcomLegend {
  roles: IcomClass[];
  honestyKey: { real: "solid"; derived: "dashed ≈" };
}

/** Non-null in BOTH modes (I-12): tier-stack renders tier members as boxes. */
export interface Idef0Diagram {
  boxes: DiagramBox[];
  arrows: DiagramArrow[];
  legend: IcomLegend;
  mode: DiagramMode;
  /** The focus node whose one decomposition level this diagram materialises
   * (F2 / I-14); null for the tier-stack top view. */
  focus: CompositeKey | null;
}

export interface DensityVerdict {
  metric: number;
  threshold: number;
  mode: DiagramMode;
  reason: string;
}

export interface OutlineRow {
  number: string | null;
  key: CompositeKey;
  depth: number;
  kind: string;
  provenance: Provenance;
}

/** Optional windowing for flattenOutline / computeIdef0Diagram (I-14). */
export interface Window {
  offset: number;
  limit: number;
}
