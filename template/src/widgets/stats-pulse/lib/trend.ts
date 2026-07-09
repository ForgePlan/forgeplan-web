import type { ActivityEntry } from "@/entities/activity";

// PRD-010 / RFC-009 FR-011 — 30-day health-trend sparkline. The RFC's
// server-written health-history.json is FORBIDDEN (init host-isolation +
// read-only proxy). Substitute: reconstruct a coarse historical signal by
// replaying the /api/log status-transition stream. We can recover the
// activation count (and hence an activation-driven proxy) per day; we CANNOT
// recover past median r_eff or evidence freshness (no historical score events
// in the log). So this is an APPROXIMATE trend — surfaced honestly in the UI.

export interface TrendPoint {
  /** Day key YYYY-MM-DD (UTC). */
  day: string;
  dayMs: number;
  /** Cumulative active-artifact count as of end-of-day. */
  activeCumulative: number;
}

const DAY_MS = 86_400_000;

function dayStartMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const TERMINAL = new Set(["deprecated", "superseded", "stale"]);

/**
 * Replay status transitions to derive cumulative active count per day over the
 * trailing `days` window. The running count rises on →active and falls on
 * →deprecated/superseded/stale; other transitions are net-neutral. Returns one
 * point per day in the window (carry-forward fills quiet days), so the
 * sparkline is continuous. Returns [] when there is too little signal.
 */
export function reconstructTrend(
  log: ActivityEntry[],
  days = 30,
  now: number = Date.now(),
): TrendPoint[] {
  const transitions = log
    .filter((e) => e.action === "update" && e.field === "status")
    .map((e) => ({
      t: Date.parse(e.timestamp),
      to: (e.new_value ?? "").toLowerCase(),
      from: (e.old_value ?? "").toLowerCase(),
    }))
    .filter((e) => !Number.isNaN(e.t))
    .sort((a, b) => a.t - b.t);

  if (transitions.length === 0) return [];

  const windowStart = dayStartMs(now) - (days - 1) * DAY_MS;

  // Seed: net active delta of everything BEFORE the window so the first
  // in-window point starts from the correct baseline rather than zero.
  let running = 0;
  for (const e of transitions) {
    if (e.t >= windowStart) break;
    if (e.to === "active") running += 1;
    else if (TERMINAL.has(e.to)) running -= 1;
  }

  // Bucket in-window deltas by day.
  const deltaByDay = new Map<number, number>();
  for (const e of transitions) {
    if (e.t < windowStart) continue;
    const d = dayStartMs(e.t);
    let delta = 0;
    if (e.to === "active") delta = 1;
    else if (TERMINAL.has(e.to)) delta = -1;
    if (delta !== 0) deltaByDay.set(d, (deltaByDay.get(d) ?? 0) + delta);
  }

  const out: TrendPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = windowStart + i * DAY_MS;
    running += deltaByDay.get(d) ?? 0;
    out.push({
      day: new Date(d).toISOString().slice(0, 10),
      dayMs: d,
      activeCumulative: Math.max(0, running),
    });
  }
  return out;
}

/** Days of distinct status-change activity present in the log. */
export function trendCoverageDays(log: ActivityEntry[]): number {
  const days = new Set<number>();
  for (const e of log) {
    if (e.action !== "update" || e.field !== "status") continue;
    const t = Date.parse(e.timestamp);
    if (Number.isNaN(t)) continue;
    days.add(dayStartMs(t));
  }
  return days.size;
}

export const MIN_TREND_COVERAGE_DAYS = 7;

/** Whether there is enough log history to draw a meaningful trend (FR-011). */
export function hasSufficientTrend(log: ActivityEntry[]): boolean {
  return trendCoverageDays(log) >= MIN_TREND_COVERAGE_DAYS;
}
