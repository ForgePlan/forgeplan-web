export interface BlockedItem {
  id: string;
  blocked_by?: string[];
  reason?: string;
}

export interface BlockedPayload {
  blocked: BlockedItem[];
  ready: string[];
  ready_count: number;
  blocked_count: number;
  cycles: string[][];
}
