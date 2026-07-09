import type { SnapshotData, SnapshotErrorCode } from "@/shared/server";

export type SnapshotMode = "now" | "single" | "compare";

export interface SnapshotState {
  mode: SnapshotMode;
  activeAt: string | null;
  t1: string | null;
  t2: string | null;
  collapsed: boolean;
  loading: boolean;
  error: string | null;
  // Structured failure metadata (PRD-016 / RFC-015 D-4). Both null when
  // there is no error, or when the upstream still emits the legacy
  // generic message (rollback path).
  errorCode: SnapshotErrorCode | null;
  stderrExcerpt: string | null;
  current: SnapshotData | null;
}

const COLLAPSE_KEY = "forgeplan-web.timeline.collapsed";

function readCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    // FIXME(localStorage-quota): silently ignored — surface in ops log later.
  }
}

export const snapshotStore = $state<SnapshotState>({
  mode: "now",
  activeAt: null,
  t1: null,
  t2: null,
  collapsed: readCollapsed(),
  loading: false,
  error: null,
  errorCode: null,
  stderrExcerpt: null,
  current: null,
});

export function setNow(): void {
  snapshotStore.mode = "now";
  snapshotStore.activeAt = null;
  snapshotStore.t1 = null;
  snapshotStore.t2 = null;
  snapshotStore.error = null;
  snapshotStore.current = null;
}

export function setActiveAt(at: string): void {
  snapshotStore.mode = "single";
  snapshotStore.activeAt = at;
  snapshotStore.error = null;
  snapshotStore.errorCode = null;
  snapshotStore.stderrExcerpt = null;
}

export function setComparePair(t1: string, t2: string): void {
  snapshotStore.mode = "compare";
  snapshotStore.t1 = t1;
  snapshotStore.t2 = t2;
  snapshotStore.error = null;
  snapshotStore.errorCode = null;
  snapshotStore.stderrExcerpt = null;
}

export function toggleCollapsed(): void {
  snapshotStore.collapsed = !snapshotStore.collapsed;
  writeCollapsed(snapshotStore.collapsed);
}

interface SnapshotResponse {
  ok: boolean;
  at: string;
  sha?: string;
  snapshot?: SnapshotData;
  fromCache?: "memory" | "disk" | null;
  // Failure-shape fields (PRD-016 / RFC-015 D-4). `error` stays present
  // as a human-readable summary; new clients should switch on `error_code`.
  error?: string;
  error_code?: SnapshotErrorCode;
  stderr_excerpt?: string;
}

export async function loadSnapshotAt(at: string): Promise<void> {
  snapshotStore.loading = true;
  snapshotStore.error = null;
  snapshotStore.errorCode = null;
  snapshotStore.stderrExcerpt = null;
  try {
    const url = `/api/snapshot?at=${encodeURIComponent(at)}`;
    const res = await fetch(url);
    const body = (await res.json()) as SnapshotResponse;
    if (!res.ok || !body.ok || !body.snapshot) {
      snapshotStore.error = body.error ?? `HTTP ${res.status}`;
      snapshotStore.errorCode = body.error_code ?? null;
      snapshotStore.stderrExcerpt = body.stderr_excerpt ?? null;
      snapshotStore.current = null;
      return;
    }
    setActiveAt(at);
    snapshotStore.current = body.snapshot;
  } catch (err) {
    snapshotStore.error = (err as Error).message;
    snapshotStore.current = null;
  } finally {
    snapshotStore.loading = false;
  }
}
