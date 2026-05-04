export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  cmd?: string;
  raw?: string;
}
