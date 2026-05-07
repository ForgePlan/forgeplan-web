export interface ScoreEntry {
  id: string;
  r_eff: number;
}

export interface ScoreResponse {
  errors: string[];
  results: ScoreEntry[];
}

export type ReffTone = 'good' | 'warn' | 'bad';
