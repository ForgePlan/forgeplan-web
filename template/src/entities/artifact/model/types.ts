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

export interface StalePayload {
  stale: { id: string }[];
}
