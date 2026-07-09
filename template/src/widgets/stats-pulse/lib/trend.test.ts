import { describe, it, expect } from "vitest";
import {
  reconstructTrend,
  trendCoverageDays,
  hasSufficientTrend,
  MIN_TREND_COVERAGE_DAYS,
} from "./trend";
import type { ActivityEntry } from "@/entities/activity";

const transition = (to: string, ts: string, from = "draft"): ActivityEntry => ({
  action: "update",
  artifact_id: "PRD-001",
  field: "status",
  new_value: to,
  old_value: from,
  source: "cli",
  timestamp: ts,
});

const now = Date.parse("2026-06-30T12:00:00Z");

describe("reconstructTrend", () => {
  it("returns [] when there are no status transitions", () => {
    expect(reconstructTrend([], 30, now)).toEqual([]);
  });

  it("emits one point per day in the window", () => {
    const log = [transition("active", "2026-06-20T00:00:00Z")];
    expect(reconstructTrend(log, 30, now)).toHaveLength(30);
  });

  it("running active count rises on →active and falls on retirement", () => {
    const log = [
      transition("active", "2026-06-25T00:00:00Z"),
      transition("active", "2026-06-26T00:00:00Z"),
      transition("deprecated", "2026-06-27T00:00:00Z", "active"),
    ];
    const pts = reconstructTrend(log, 30, now);
    const last = pts[pts.length - 1]!;
    // +1 +1 -1 = net 1 active.
    expect(last.activeCumulative).toBe(1);
  });

  it("seeds the baseline from transitions before the window", () => {
    const log = [
      transition("active", "2026-01-01T00:00:00Z"), // long before window
      transition("active", "2026-06-29T00:00:00Z"), // inside window
    ];
    const pts = reconstructTrend(log, 30, now);
    // 1 pre-window active carried in + 1 in-window = 2 by the end.
    expect(pts[pts.length - 1]!.activeCumulative).toBe(2);
  });

  it("never goes negative", () => {
    const log = [transition("deprecated", "2026-06-29T00:00:00Z", "active")];
    const pts = reconstructTrend(log, 30, now);
    expect(pts.every((p) => p.activeCumulative >= 0)).toBe(true);
  });

  it("carries the running value forward across quiet days", () => {
    const log = [transition("active", "2026-06-10T00:00:00Z")];
    const pts = reconstructTrend(log, 30, now);
    // every day from Jun 10 onward should read 1.
    const jun15 = pts.find((p) => p.day === "2026-06-15");
    expect(jun15?.activeCumulative).toBe(1);
  });
});

describe("trendCoverageDays / hasSufficientTrend", () => {
  it("counts distinct days with status changes", () => {
    const log = [
      transition("active", "2026-06-01T00:00:00Z"),
      transition("active", "2026-06-01T10:00:00Z"), // same day
      transition("active", "2026-06-02T00:00:00Z"),
    ];
    expect(trendCoverageDays(log)).toBe(2);
  });

  it("gates on MIN_TREND_COVERAGE_DAYS", () => {
    const few = [transition("active", "2026-06-01T00:00:00Z")];
    expect(hasSufficientTrend(few)).toBe(false);

    const many: ActivityEntry[] = [];
    for (let i = 0; i < MIN_TREND_COVERAGE_DAYS; i++) {
      many.push(transition("active", `2026-06-0${i + 1}T00:00:00Z`));
    }
    expect(hasSufficientTrend(many)).toBe(true);
  });
});
