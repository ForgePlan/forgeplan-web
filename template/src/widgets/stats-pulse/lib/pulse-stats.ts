import type { ScoreEntry } from "@/entities/score";
import type { ActivityEntry } from "@/entities/activity";

// PRD-010 / RFC-009 — pure stat compute for the Workspace-pulse widget.
// All inputs come from allow-listed read-only endpoints (/api/score,
// /api/log). No server endpoint, no /api/pulse (rule 22).

export interface HistogramBucket {
  /** Inclusive lower bound of the bucket, e.g. 0.0, 0.1 … 0.9. */
  lo: number;
  /** Exclusive upper bound, except the final bucket which is inclusive of 1.0. */
  hi: number;
  count: number;
}

export const HISTOGRAM_BUCKET_COUNT = 10;

/**
 * 10 evenly-spaced R_eff buckets over [0, 1] (step 0.1). The last bucket
 * [0.9, 1.0] is inclusive of 1.0 so a perfect score lands somewhere.
 * Operates on the scored subset only — callers must label accordingly
 * ("evidenced artifacts", not "all").
 */
export function reffHistogram(scores: ScoreEntry[]): HistogramBucket[] {
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < HISTOGRAM_BUCKET_COUNT; i++) {
    buckets.push({ lo: i / 10, hi: (i + 1) / 10, count: 0 });
  }
  for (const s of scores) {
    const r = s.r_eff;
    if (typeof r !== "number" || Number.isNaN(r)) continue;
    const clamped = Math.max(0, Math.min(1, r));
    let idx = Math.floor(clamped * 10);
    if (idx >= HISTOGRAM_BUCKET_COUNT) idx = HISTOGRAM_BUCKET_COUNT - 1;
    const bucket = buckets[idx];
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

/** Median of a numeric list. Empty list → 0. Pure, sort-stable. */
export function median(values: number[]): number {
  const xs = values
    .filter((v) => typeof v === "number" && !Number.isNaN(v))
    .sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2 === 0) return ((xs[mid - 1] ?? 0) + (xs[mid] ?? 0)) / 2;
  return xs[mid] ?? 0;
}

// ---------------------------------------------------------------------------
// Week bucketing — UTC ISO week-start (Monday). Stable across timezones so a
// poll at any local hour buckets the same event the same way.
// ---------------------------------------------------------------------------

/** UTC midnight of the Monday on/just-before the given instant, ms epoch. */
export function weekStartMs(timestampMs: number): number {
  const d = new Date(timestampMs);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay(); // 0=Sun … 6=Sat
  const sinceMonday = (day + 6) % 7; // Mon→0, Sun→6
  return utc - sinceMonday * 86_400_000;
}

export function isoWeekKey(timestampMs: number): string {
  return new Date(weekStartMs(timestampMs)).toISOString().slice(0, 10);
}

export interface WeekVelocity {
  /** ISO date (YYYY-MM-DD) of the week's Monday, UTC. */
  week: string;
  weekStartMs: number;
  activated: number;
  deprecated: number;
  draftsAdded: number;
  /** Net flow = activated + deprecated − draftsAdded. */
  net: number;
}

function isCreate(e: ActivityEntry): boolean {
  return e.action === "create";
}
function isStatusChange(e: ActivityEntry): boolean {
  return e.action === "update" && e.field === "status";
}

/**
 * Per-week velocity from the activity log. A week counts:
 *  - activated   = status update → 'active'
 *  - deprecated  = status update → 'deprecated' | 'superseded' | 'stale'
 *  - draftsAdded = create events (a new draft entering the workspace)
 * net = activated + deprecated − draftsAdded (RFC-009 FR-004 definition:
 * progress minus new backlog). Weeks are returned chronologically; empty
 * weeks inside the covered span are filled with zeros so the line is
 * continuous. `weeks` caps the trailing window (default 12).
 */
export function weeklyVelocity(
  log: ActivityEntry[],
  weeks = 12,
): WeekVelocity[] {
  const byWeek = new Map<number, WeekVelocity>();
  for (const e of log) {
    const t = Date.parse(e.timestamp);
    if (Number.isNaN(t)) continue;
    const ws = weekStartMs(t);
    let w = byWeek.get(ws);
    if (!w) {
      w = {
        week: new Date(ws).toISOString().slice(0, 10),
        weekStartMs: ws,
        activated: 0,
        deprecated: 0,
        draftsAdded: 0,
        net: 0,
      };
      byWeek.set(ws, w);
    }
    if (isCreate(e)) {
      w.draftsAdded += 1;
    } else if (isStatusChange(e)) {
      const to = (e.new_value ?? "").toLowerCase();
      if (to === "active") w.activated += 1;
      else if (to === "deprecated" || to === "superseded" || to === "stale")
        w.deprecated += 1;
    }
  }
  if (byWeek.size === 0) return [];
  const sorted = [...byWeek.keys()].sort((a, b) => a - b);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const out: WeekVelocity[] = [];
  for (let ws = first; ws <= last; ws += 7 * 86_400_000) {
    const w = byWeek.get(ws) ?? {
      week: new Date(ws).toISOString().slice(0, 10),
      weekStartMs: ws,
      activated: 0,
      deprecated: 0,
      draftsAdded: 0,
      net: 0,
    };
    w.net = w.activated + w.deprecated - w.draftsAdded;
    out.push(w);
  }
  return out.slice(-weeks);
}

// ---------------------------------------------------------------------------
// Status transitions — directed from→to flow over a trailing window.
// ---------------------------------------------------------------------------

export interface StatusTransition {
  from: string;
  to: string;
  count: number;
}

export const TRANSITION_WINDOW_DAYS = 90;

/**
 * Aggregate status transitions (action=update, field=status) over the trailing
 * `windowDays`. Skips self-transitions and entries with a blank from/to.
 * Sorted by count desc for stable, deterministic ordering.
 */
export function statusTransitions(
  log: ActivityEntry[],
  windowDays = TRANSITION_WINDOW_DAYS,
  now: number = Date.now(),
): StatusTransition[] {
  const cutoff = now - windowDays * 86_400_000;
  const counts = new Map<string, number>();
  for (const e of log) {
    if (!isStatusChange(e)) continue;
    const t = Date.parse(e.timestamp);
    if (Number.isNaN(t) || t < cutoff) continue;
    const from = (e.old_value ?? "").toLowerCase();
    const to = (e.new_value ?? "").toLowerCase();
    if (!from || !to || from === to) continue;
    const key = `${from} ${to}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]): StatusTransition => {
      const parts = key.split(" ");
      return { from: parts[0] ?? "", to: parts[1] ?? "", count };
    })
    .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from));
}

// ---------------------------------------------------------------------------
// Decay proxy — FR-003 degraded path. valid_until is not reachable in any
// aggregate read-only endpoint (only /api/get/[id]); we surface a coarse
// at-risk / stale signal from /api/health instead. See plan blocker #2.
// ---------------------------------------------------------------------------

export interface DecayProxy {
  atRisk: number;
  stale: number;
  staleDrafts: number;
  /** Total artifacts flagged as decaying by health (dedup not possible — sum). */
  total: number;
}

export function decayProxy(input: {
  at_risk?: unknown[];
  stale_count?: number;
  stale_drafts?: unknown[];
}): DecayProxy {
  const atRisk = Array.isArray(input.at_risk) ? input.at_risk.length : 0;
  const stale = typeof input.stale_count === "number" ? input.stale_count : 0;
  const staleDrafts = Array.isArray(input.stale_drafts)
    ? input.stale_drafts.length
    : 0;
  return { atRisk, stale, staleDrafts, total: atRisk + stale + staleDrafts };
}
