import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { ApiEnvelope } from '$lib/types';

const POLL_INTERVAL_MS = 10_000;

export interface PollState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  cmd: string | null;
}

export interface Poller<T> {
  store: Writable<PollState<T>>;
  refresh: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

export function createPoller<T>(path: string, intervalMs: number = POLL_INTERVAL_MS): Poller<T> {
  const store = writable<PollState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
    cmd: null
  });

  let timer: ReturnType<typeof setInterval> | null = null;
  let inflight: AbortController | null = null;

  async function refresh() {
    if (!browser) return;
    if (inflight) inflight.abort();
    const ctrl = new AbortController();
    inflight = ctrl;
    store.update((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(path, { signal: ctrl.signal });
      const env = (await res.json()) as ApiEnvelope<T>;
      if (!env.ok) {
        store.set({
          data: null,
          loading: false,
          error: env.error ?? `HTTP ${res.status}`,
          lastFetched: Date.now(),
          cmd: env.cmd ?? null
        });
        return;
      }
      store.set({
        data: env.data ?? null,
        loading: false,
        error: null,
        lastFetched: Date.now(),
        cmd: env.cmd ?? null
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      store.update((s) => ({
        ...s,
        loading: false,
        error: (err as Error).message,
        lastFetched: Date.now()
      }));
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

  return { store, refresh, start, stop };
}
