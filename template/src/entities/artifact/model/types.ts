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
  // Slug-canonical identity. All five fields are optional and, against the
  // forgeplan CLI transport this app uses (rule 22), four of them never
  // arrive: `list`/`get --json` expose only a nullable top-level `slug`
  // (frontmatter-sourced). `id_display`/`id_canonical` live only in the
  // forgeplan MCP DTO (≥ 0.31); `predicted_number`/`assigned_number` only in
  // markdown frontmatter. They stay undefined in practice — forward-compatible
  // scaffolding, code degrades to raw `id`. See PRD-016 / RFC-015 + the
  // forgeplan 0.33 contract audit (2026-06-23).
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
