import { createPoller } from './poller';
import type {
  ArtifactSummary,
  ArtifactDetail,
  GraphResponse,
  HealthResponse,
  ScoreEntry
} from '$lib/types';

export const listPoller = createPoller<ArtifactSummary[]>('/api/list');
export const graphPoller = createPoller<GraphResponse>('/api/graph');
export const healthPoller = createPoller<HealthResponse>('/api/health');
export const scorePoller = createPoller<ScoreEntry[]>('/api/score', 30_000);
export interface ClaimEntry {
  id: string;
  agent_id: string;
  claimed_at: string;
  expires_at: string;
  note?: string | null;
}
export const claimsPoller = createPoller<{
  claims: ClaimEntry[];
  count: number;
  skipped?: number;
}>('/api/claims');
export const stalePoller = createPoller<{ stale: { id: string }[] }>('/api/stale');
export const blockedPoller = createPoller<{
  blocked: {
    id: string;
    blocked_by?: string[];
    waiting_on?: string[];
    reason?: string;
  }[];
  ready: string[];
  ready_count: number;
  blocked_count: number;
  cycles: string[][];
}>('/api/blocked');
export const logPoller = createPoller<{
  entries: {
    action: string;
    artifact_id: string;
    field: string | null;
    new_value: string | null;
    old_value: string | null;
    source: string;
    timestamp: string;
  }[];
}>('/api/log');

export async function fetchArtifact(id: string): Promise<ArtifactDetail | null> {
  const res = await fetch(`/api/get/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const env = (await res.json()) as { ok: boolean; data?: ArtifactDetail };
  return env.ok ? env.data ?? null : null;
}
