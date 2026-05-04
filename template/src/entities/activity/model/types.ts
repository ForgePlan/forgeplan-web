export interface ActivityEntry {
  action: string;
  artifact_id: string;
  field: string | null;
  new_value: string | null;
  old_value: string | null;
  source: string;
  timestamp: string;
}

export interface ActivityPayload {
  entries: ActivityEntry[];
}
