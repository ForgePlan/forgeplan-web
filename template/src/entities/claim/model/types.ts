export interface ClaimEntry {
  id: string;
  agent_id: string;
  claimed_at: string;
  expires_at: string;
  note?: string | null;
}

export interface ClaimsPayload {
  claims: ClaimEntry[];
  count: number;
  skipped?: number;
}
