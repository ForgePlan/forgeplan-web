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
