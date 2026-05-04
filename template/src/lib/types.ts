export type ArtifactKind =
  | 'prd'
  | 'rfc'
  | 'adr'
  | 'spec'
  | 'epic'
  | 'evidence'
  | 'evid'
  | 'note'
  | 'problem'
  | 'solution';

export type ArtifactStatus =
  | 'draft'
  | 'active'
  | 'superseded'
  | 'deprecated'
  | 'stale';

export interface ArtifactSummary {
  id: string;
  kind: ArtifactKind;
  status: ArtifactStatus;
  title: string;
}

export interface ArtifactDetail extends ArtifactSummary {
  body?: string;
  r_eff?: number;
  depth?: string;
  parent_epic?: string | null;
  created_at?: string;
  updated_at?: string;
  valid_until?: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface GraphResponse {
  edges: GraphEdge[];
  _next_action?: string | null;
}

export interface HealthResponse {
  total: number;
  by_kind: { kind: string; count: number }[];
  by_status: { status: string; count: number }[];
  by_derived_status: { status: string; count: number }[];
  blind_spots: string[];
  orphans: string[];
  active_stubs: string[];
  stale_count: number;
  next_actions: string[];
  project: string;
  _next_action?: string | null;
}

export interface ScoreEntry {
  id: string;
  r_eff: number;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  cmd?: string;
  raw?: string;
}
