// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectBreaches,
  emptySnapshot,
  snapshotFromHealth,
  notificationsSupported,
  notificationPermission,
  fire,
  THROTTLE_MS,
  _resetForTesting,
  type Breach,
} from "./notify.svelte";

describe("snapshotFromHealth", () => {
  it("extracts ids and counts", () => {
    const snap = snapshotFromHealth({
      blind_spots: [
        { id: "PRD-1", title: "t" },
        { id: "RFC-1", title: "t2" },
      ],
      stale_count: 3,
      orphan_count: 1,
    });
    expect(snap.blindSpotIds).toEqual(new Set(["PRD-1", "RFC-1"]));
    expect(snap.staleCount).toBe(3);
    expect(snap.orphanCount).toBe(1);
  });
});

describe("detectBreaches", () => {
  it("detects new blind_spot", () => {
    const prev = emptySnapshot();
    const next = snapshotFromHealth({
      blind_spots: [{ id: "PRD-1", title: "foo" }],
    });
    const breaches = detectBreaches(prev, next, {
      blind_spots: [{ id: "PRD-1", title: "foo" }],
    });
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({
      kind: "blind_spot",
      id: "PRD-1",
      title: "foo",
    });
  });

  it("detects stale_count delta", () => {
    const prev = snapshotFromHealth({ stale_count: 2 });
    const next = snapshotFromHealth({ stale_count: 5 });
    const breaches = detectBreaches(prev, next, {});
    expect(breaches).toEqual([{ kind: "stale", delta: 3 }]);
  });

  it("detects orphan_count delta", () => {
    const prev = snapshotFromHealth({ orphan_count: 0 });
    const next = snapshotFromHealth({ orphan_count: 1 });
    const breaches = detectBreaches(prev, next, {});
    expect(breaches).toEqual([{ kind: "orphan", delta: 1 }]);
  });

  it("no breaches when state is unchanged", () => {
    const snap = snapshotFromHealth({
      blind_spots: [{ id: "PRD-1", title: "x" }],
      stale_count: 1,
    });
    const breaches = detectBreaches(snap, snap, {
      blind_spots: [{ id: "PRD-1", title: "x" }],
    });
    expect(breaches).toEqual([]);
  });

  it("decrease in stale_count does NOT fire", () => {
    const prev = snapshotFromHealth({ stale_count: 5 });
    const next = snapshotFromHealth({ stale_count: 2 });
    expect(detectBreaches(prev, next, {})).toEqual([]);
  });
});

describe("notificationsSupported / notificationPermission", () => {
  it("returns false when Notification is missing", () => {
    // FIXME(happy-dom): happy-dom defines Notification on window; remove it
    // for this assertion only, then restore so other suites are unaffected.
    const orig = (globalThis as { Notification?: unknown }).Notification;
    delete (globalThis as { Notification?: unknown }).Notification;
    expect(notificationsSupported()).toBe(false);
    expect(notificationPermission()).toBe("unsupported");
    if (orig) (globalThis as { Notification?: unknown }).Notification = orig;
  });

  it("returns 'unsupported' when accessing Notification.permission throws (iframe sandbox case)", () => {
    // Sandboxed iframes / certain Safari/Firefox contexts allow `Notification`
    // to exist but throw when reading `.permission`. The wrapper must catch.
    const ThrowingNotification = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "permission") {
          throw new Error("SecurityError: permission access denied");
        }
        return undefined;
      },
    });
    vi.stubGlobal("Notification", ThrowingNotification);
    expect(notificationPermission()).toBe("unsupported");
    vi.unstubAllGlobals();
  });
});

describe("fire — throttle", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it("returns false when permission is not granted", () => {
    vi.stubGlobal(
      "Notification",
      class {
        static permission = "default";
      },
    );
    const breach: Breach = { kind: "stale", delta: 1 };
    expect(fire(breach)).toBe(false);
    vi.unstubAllGlobals();
  });

  it("fires when granted and respects throttle", () => {
    let count = 0;
    const NotificationStub = function () {
      count++;
      return { onclick: null };
    } as unknown as { permission: string; new (...args: unknown[]): unknown };
    (NotificationStub as unknown as { permission: string }).permission =
      "granted";
    vi.stubGlobal("Notification", NotificationStub);

    const breach: Breach = { kind: "stale", delta: 1 };
    let now = 1_000_000;
    expect(fire(breach, undefined, () => now)).toBe(true);
    expect(count).toBe(1);

    now += THROTTLE_MS - 100;
    expect(fire(breach, undefined, () => now)).toBe(false);
    expect(count).toBe(1);

    now += 1000;
    expect(fire(breach, undefined, () => now)).toBe(true);
    expect(count).toBe(2);

    vi.unstubAllGlobals();
  });
});
