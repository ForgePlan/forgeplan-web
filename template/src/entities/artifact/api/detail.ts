import type { ArtifactDetail } from '../model/types';

export async function fetchArtifact(id: string): Promise<ArtifactDetail | null> {
  const res = await fetch(`/api/get/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const env = (await res.json()) as { ok: boolean; data?: ArtifactDetail };
  return env.ok ? env.data ?? null : null;
}
