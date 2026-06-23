// Subset of HealthResponse used by the instance-switcher.
// Defined here (not imported from entities/health) to avoid cross-entity imports
// per FSD same-layer isolation rules.
export interface InstanceHealth {
  total: number;
  project: string;
  stale_count: number;
  by_status: { status: string; count: number }[];
}

export interface InstanceStatus {
  health: InstanceHealth | null;
  agentCount: number;
}
