import type { SnapshotData } from "@/shared/server";

export type SnapshotMode = "now" | "single" | "compare";

export interface SnapshotState {
  mode: SnapshotMode;
  activeAt: string | null;
  t1: string | null;
  t2: string | null;
  collapsed: boolean;
  loading: boolean;
  error: string | null;
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
}

export function setComparePair(t1: string, t2: string): void {
  snapshotStore.mode = "compare";
  snapshotStore.t1 = t1;
  snapshotStore.t2 = t2;
  snapshotStore.error = null;
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
  error?: string;
}

export async function loadSnapshotAt(at: string): Promise<void> {
  snapshotStore.loading = true;
  snapshotStore.error = null;
  try {
    const url = `/api/snapshot?at=${encodeURIComponent(at)}`;
    const res = await fetch(url);
    const body = (await res.json()) as SnapshotResponse;
    if (!res.ok || !body.ok || !body.snapshot) {
      snapshotStore.error = body.error ?? `HTTP ${res.status}`;
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
