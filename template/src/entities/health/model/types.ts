export interface BlindSpot {
  id: string;
  title?: string;
  issue?: string;
}

export interface StaleDraft {
  id: string;
  kind?: string;
  age_hours?: number;
  has_links?: boolean;
  recommendation?: string;
  verdict_set?: boolean;
}

export interface HealthResponse {
  total: number;
  by_kind: { kind: string; count: number }[];
  by_status: { status: string; count: number }[];
  by_derived_status: { status: string; count: number }[];
  blind_spots: BlindSpot[];
  orphans: string[];
  active_stubs: string[];
  stale_count: number;
  // Decay signals surfaced by `forgeplan health --json` (read-only). Used by
  // the stats-pulse widget's decay proxy (PRD-010 / RFC-009 FR-003). Optional
  // for forward/back-compat with older CLI shapes.
  at_risk?: { id: string }[];
  stale_drafts?: StaleDraft[];
  next_actions: string[];
  project: string;
  _next_action?: string | null;
}
