import { describe, it, expect } from "vitest";
import {
  reffHistogram,
  median,
  weekStartMs,
  weeklyVelocity,
  statusTransitions,
  decayProxy,
  HISTOGRAM_BUCKET_COUNT,
} from "./pulse-stats";
import type { ScoreEntry } from "@/entities/score";
import type { ActivityEntry } from "@/entities/activity";

const score = (id: string, r_eff: number): ScoreEntry => ({ id, r_eff });

const entry = (p: Partial<ActivityEntry>): ActivityEntry => ({
  action: "update",
  artifact_id: "PRD-001",
  field: null,
  new_value: null,
  old_value: null,
  source: "cli",
  timestamp: "2026-06-01T00:00:00Z",
  ...p,
});

describe("reffHistogram", () => {
  it("produces exactly 10 buckets spanning [0,1]", () => {
    const h = reffHistogram([]);
    expect(h).toHaveLength(HISTOGRAM_BUCKET_COUNT);
    expect(h[0]!.lo).toBe(0);
    expect(h[9]!.hi).toBe(1);
  });

  it("places r_eff into the floor(r*10) bucket", () => {
    const h = reffHistogram([
      score("a", 0.05),
      score("b", 0.15),
      score("c", 0.35),
    ]);
    expect(h[0]!.count).toBe(1); // 0.05 → bucket 0
    expect(h[1]!.count).toBe(1); // 0.15 → bucket 1
    expect(h[3]!.count).toBe(1); // 0.35 → bucket 3
  });

  it("puts a perfect 1.0 into the final bucket (inclusive)", () => {
    const h = reffHistogram([score("a", 1.0)]);
    expect(h[9]!.count).toBe(1);
  });

  it("clamps out-of-range and skips NaN", () => {
    const h = reffHistogram([
      score("a", 1.5),
      score("b", -0.2),
      score("c", NaN),
    ]);
    expect(h[9]!.count).toBe(1); // 1.5 clamped to bucket 9
    expect(h[0]!.count).toBe(1); // -0.2 clamped to bucket 0
    const total = h.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(2); // NaN dropped
  });
});

describe("median (gaming-resistance primitive)", () => {
  it("returns 0 for empty input", () => {
    expect(median([])).toBe(0);
  });
  it("odd count → middle element", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("even count → average of the two middles", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("is unmoved by a single inflated outlier (unlike mean)", () => {
    // mean would jump; median holds at the center.
    expect(median([0.5, 0.5, 0.5, 0.5, 1.0])).toBe(0.5);
  });
});

describe("weekStartMs — UTC Monday alignment", () => {
  it("snaps any weekday to that week's Monday 00:00 UTC", () => {
    // 2026-06-03 is a Wednesday → Monday 2026-06-01.
    const wed = Date.parse("2026-06-03T15:00:00Z");
    expect(new Date(weekStartMs(wed)).toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });
  it("a Sunday belongs to the preceding Monday's week", () => {
    // 2026-06-07 is a Sunday → still week of Monday 2026-06-01.
    const sun = Date.parse("2026-06-07T23:59:00Z");
    expect(new Date(weekStartMs(sun)).toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });
});

describe("weeklyVelocity", () => {
  it("returns [] for empty log", () => {
    expect(weeklyVelocity([])).toEqual([]);
  });

  it("net = activated + deprecated − draftsAdded", () => {
    const log: ActivityEntry[] = [
      entry({ action: "create", timestamp: "2026-06-01T01:00:00Z" }),
      entry({ action: "create", timestamp: "2026-06-02T01:00:00Z" }),
      entry({
        field: "status",
        new_value: "active",
        timestamp: "2026-06-03T01:00:00Z",
      }),
      entry({
        field: "status",
        new_value: "deprecated",
        timestamp: "2026-06-04T01:00:00Z",
      }),
    ];
    const v = weeklyVelocity(log);
    expect(v).toHaveLength(1);
    expect(v[0]!.draftsAdded).toBe(2);
    expect(v[0]!.activated).toBe(1);
    expect(v[0]!.deprecated).toBe(1);
    expect(v[0]!.net).toBe(0); // 1 + 1 − 2
  });

  it("fills empty weeks between first and last with zeros (continuous line)", () => {
    const log: ActivityEntry[] = [
      entry({
        field: "status",
        new_value: "active",
        timestamp: "2026-06-01T01:00:00Z",
      }),
      entry({
        field: "status",
        new_value: "active",
        timestamp: "2026-06-22T01:00:00Z",
      }),
    ];
    const v = weeklyVelocity(log);
    expect(v).toHaveLength(4); // weeks of Jun 1, 8, 15, 22
    expect(v[1]!.net).toBe(0);
    expect(v[2]!.net).toBe(0);
    expect(v[3]!.activated).toBe(1);
  });

  it("caps to the trailing `weeks` window", () => {
    const log: ActivityEntry[] = [];
    for (let i = 0; i < 20; i++) {
      const d = new Date(Date.UTC(2026, 0, 5 + i * 7)); // Mondays
      log.push(
        entry({
          field: "status",
          new_value: "active",
          timestamp: d.toISOString(),
        }),
      );
    }
    expect(weeklyVelocity(log, 12)).toHaveLength(12);
  });

  it("ignores non-status updates and malformed timestamps", () => {
    const log: ActivityEntry[] = [
      entry({
        field: "title",
        new_value: "x",
        timestamp: "2026-06-01T01:00:00Z",
      }),
      entry({ field: "status", new_value: "active", timestamp: "not-a-date" }),
      entry({
        field: "status",
        new_value: "active",
        timestamp: "2026-06-01T02:00:00Z",
      }),
    ];
    const v = weeklyVelocity(log);
    expect(v).toHaveLength(1);
    expect(v[0]!.activated).toBe(1);
  });
});

describe("statusTransitions", () => {
  const now = Date.parse("2026-06-30T00:00:00Z");

  it("aggregates from→to over the window, count desc", () => {
    const log: ActivityEntry[] = [
      entry({
        field: "status",
        old_value: "draft",
        new_value: "active",
        timestamp: "2026-06-20T00:00:00Z",
      }),
      entry({
        field: "status",
        old_value: "draft",
        new_value: "active",
        timestamp: "2026-06-21T00:00:00Z",
      }),
      entry({
        field: "status",
        old_value: "active",
        new_value: "deprecated",
        timestamp: "2026-06-22T00:00:00Z",
      }),
    ];
    const t = statusTransitions(log, 90, now);
    expect(t[0]).toEqual({ from: "draft", to: "active", count: 2 });
    expect(t[1]).toEqual({ from: "active", to: "deprecated", count: 1 });
  });

  it("excludes events older than the window", () => {
    const log: ActivityEntry[] = [
      entry({
        field: "status",
        old_value: "draft",
        new_value: "active",
        timestamp: "2026-01-01T00:00:00Z",
      }),
    ];
    expect(statusTransitions(log, 90, now)).toEqual([]);
  });

  it("skips self-transitions and blank endpoints", () => {
    const log: ActivityEntry[] = [
      entry({
        field: "status",
        old_value: "active",
        new_value: "active",
        timestamp: "2026-06-20T00:00:00Z",
      }),
      entry({
        field: "status",
        old_value: null,
        new_value: "active",
        timestamp: "2026-06-20T00:00:00Z",
      }),
    ];
    expect(statusTransitions(log, 90, now)).toEqual([]);
  });
});

describe("decayProxy", () => {
  it("sums at_risk, stale_count, stale_drafts", () => {
    const d = decayProxy({
      at_risk: [1, 2],
      stale_count: 3,
      stale_drafts: [1],
    });
    expect(d).toEqual({ atRisk: 2, stale: 3, staleDrafts: 1, total: 6 });
  });
  it("tolerates missing fields", () => {
    expect(decayProxy({})).toEqual({
      atRisk: 0,
      stale: 0,
      staleDrafts: 0,
      total: 0,
    });
  });
});
