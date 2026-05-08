export type ArtifactKind =
  | "prd"
  | "rfc"
  | "adr"
  | "spec"
  | "epic"
  | "evidence"
  | "evid"
  | "note"
  | "problem"
  | "solution";

export type ArtifactStatus =
  | "draft"
  | "active"
  | "superseded"
  | "deprecated"
  | "stale";

export interface ArtifactSummary {
  id: string;
  kind: ArtifactKind;
  status: ArtifactStatus;
  title: string;
  // Slug-canonical identity (forgeplan ≥ 0.28). All five fields are
  // optional — legacy artefacts and forgeplan 0.27 hosts simply have
  // them undefined. See PRD-016 / RFC-015.
  slug?: string;
  predicted_number?: number;
  assigned_number?: number | null;
  id_canonical?: string;
  id_display?: string;
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
