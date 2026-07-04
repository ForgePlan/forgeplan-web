// @vitest-environment happy-dom
/**
 * Regression test for a real bug hit in production: `scorePoller`
 * (interval 60_000ms) polls `/api/score`, whose own server-side single-flight
 * timeout is 120_000ms -- i.e. the server can legitimately take LONGER to
 * respond than the poller's own interval. Every interval tick used to abort
 * the still-pending previous fetch and start a new one, and the abort branch
 * intentionally leaves `state.loading` untouched (so a genuinely-superseded
 * fetch doesn't flicker) -- but since no fetch ever survived long enough to
 * settle naturally, `state.loading` stayed `true` forever: an eternal
 * spinner instead of the "error line" `StatsPanel.svelte` explicitly
 * promises once a poll actually fails.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
// vitest.config.ts's "dom" project aliases $app/environment to a stub
// (poller.svelte.ts's real import is otherwise unresolvable under test,
// since only the bare `svelte()` plugin is registered, not `sveltekit()`).
import { createPoller } from "./poller.svelte";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createPoller — slow-endpoint interval overlap", () => {
  it("a poll interval shorter than the fetch's own resolve time does not abort it away — loading eventually clears", async () => {
    vi.useFakeTimers();
    const first = deferred<Response>();
    const fetchSpy = vi
      .fn()
      // First call: hangs until we resolve it by hand (simulates a slow
      // `forgeplan score --all` spawn that outlives one poll interval).
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(() =>
        Promise.resolve(
          jsonResponse({ ok: true, data: { tick: 2 }, cmd: "score" }),
        ),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const poller = createPoller<{ tick: number }>("/api/score", 60_000);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.state.loading).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Two interval ticks (120s) elapse while the first fetch is still
    // pending -- the buggy version aborted it away at each tick; the fixed
    // version must skip the tick instead and leave the original fetch alone.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(poller.state.loading).toBe(true);

    // The slow spawn finally resolves (e.g. the server's own 120s guardrail
    // fired and returned a real envelope) -- state must settle, not hang.
    first.resolve(jsonResponse({ ok: true, data: { tick: 1 }, cmd: "score" }));
    await vi.advanceTimersByTimeAsync(0);

    expect(poller.state.loading).toBe(false);
    expect(poller.state.data).toEqual({ tick: 1 });
    expect(poller.state.error).toBeNull();

    poller.stop();
  });

  it("an explicit manual refresh() still aborts-and-restarts an in-flight fetch immediately", async () => {
    vi.useFakeTimers();
    const first = deferred<Response>();
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(() =>
        Promise.resolve(
          jsonResponse({ ok: true, data: { tick: 2 }, cmd: "list" }),
        ),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const poller = createPoller<{ tick: number }>("/api/list", 60_000);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Manual refresh (e.g. a user-clicked "refresh" button) must not wait
    // for the stale in-flight fetch -- it starts a fresh one right away.
    void poller.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(poller.state.loading).toBe(false);
    expect(poller.state.data).toEqual({ tick: 2 });

    poller.stop();
  });
});
