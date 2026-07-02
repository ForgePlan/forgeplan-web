import { browser } from "$app/environment";
import type { ApiEnvelope } from "./envelope";

const POLL_INTERVAL_MS = 10_000;

export interface PollState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  cmd: string | null;
}

export interface Poller<T> {
  readonly state: PollState<T>;
  refresh: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

export function createPoller<T>(
  path: string,
  intervalMs: number = POLL_INTERVAL_MS,
): Poller<T> {
  const state = $state<PollState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
    cmd: null,
  });

  let timer: ReturnType<typeof setInterval> | null = null;
  let inflight: AbortController | null = null;

  async function refresh() {
    if (!browser) return;
    if (inflight) inflight.abort();
    const ctrl = new AbortController();
    inflight = ctrl;
    state.loading = true;
    try {
      const res = await fetch(path, { signal: ctrl.signal });
      const env = (await res.json()) as ApiEnvelope<T>;
      if (!env.ok) {
        // Stale-while-error: keep the last good payload so a transient CLI
        // failure (e.g. the forgeplan workspace lock held by an agent) shows
        // the previous data + an error chip instead of an eternal loader.
        // A failing envelope may carry the server's own last-good payload
        // (e.g. /api/score) — adopt it only when we have nothing newer.
        state.data = state.data ?? env.data ?? null;
        state.loading = false;
        state.error = env.error ?? `HTTP ${res.status}`;
        state.lastFetched = Date.now();
        state.cmd = env.cmd ?? null;
        return;
      }
      state.data = env.data ?? null;
      state.loading = false;
      state.error = null;
      state.lastFetched = Date.now();
      state.cmd = env.cmd ?? null;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      state.loading = false;
      state.error = (err as Error).message;
      state.lastFetched = Date.now();
    } finally {
      if (inflight === ctrl) inflight = null;
    }
  }

  function start() {
    if (!browser || timer) return;
    void refresh();
    timer = setInterval(() => void refresh(), intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (inflight) {
      inflight.abort();
      inflight = null;
    }
  }

  return { state, refresh, start, stop };
}
