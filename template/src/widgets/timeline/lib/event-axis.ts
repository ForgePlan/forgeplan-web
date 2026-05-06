export interface TimelineEvent {
  at: string;
  kind: "created" | "activated" | "superseded" | "scored" | "linked";
  artifactId: string;
}

export interface TickPosition {
  x: number;
  at: string;
  kind: TimelineEvent["kind"];
  artifactId: string;
}

export interface AxisDomain {
  startMs: number;
  endMs: number;
}

export function eventsToDomain(
  events: ReadonlyArray<TimelineEvent>,
): AxisDomain | null {
  if (events.length === 0) return null;
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  for (const e of events) {
    const t = Date.parse(e.at);
    if (Number.isNaN(t)) continue;
    if (t < startMs) startMs = t;
    if (t > endMs) endMs = t;
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  if (startMs === endMs) {
    // FIXME(single-event-domain): a one-event timeline collapses to a zero-
    // width axis. Pad ±1h so the scrubber has somewhere to land.
    return { startMs: startMs - 3_600_000, endMs: endMs + 3_600_000 };
  }
  return { startMs, endMs };
}

export function timestampToX(
  ms: number,
  domain: AxisDomain,
  widthPx: number,
): number {
  if (widthPx <= 0) return 0;
  const range = domain.endMs - domain.startMs;
  if (range <= 0) return 0;
  const ratio = (ms - domain.startMs) / range;
  return Math.max(0, Math.min(widthPx, ratio * widthPx));
}

export function xToTimestamp(
  x: number,
  domain: AxisDomain,
  widthPx: number,
): number {
  if (widthPx <= 0) return domain.startMs;
  const clampedX = Math.max(0, Math.min(widthPx, x));
  const range = domain.endMs - domain.startMs;
  return domain.startMs + (clampedX / widthPx) * range;
}

export function eventsToTicks(
  events: ReadonlyArray<TimelineEvent>,
  domain: AxisDomain,
  widthPx: number,
): TickPosition[] {
  const out: TickPosition[] = [];
  for (const e of events) {
    const ms = Date.parse(e.at);
    if (Number.isNaN(ms)) continue;
    out.push({
      x: timestampToX(ms, domain, widthPx),
      at: e.at,
      kind: e.kind,
      artifactId: e.artifactId,
    });
  }
  return out;
}

export function snapToNearestEvent(
  x: number,
  events: ReadonlyArray<TimelineEvent>,
  domain: AxisDomain,
  widthPx: number,
): TimelineEvent | null {
  if (events.length === 0) return null;
  let bestEvent: TimelineEvent | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const e of events) {
    const ms = Date.parse(e.at);
    if (Number.isNaN(ms)) continue;
    const ex = timestampToX(ms, domain, widthPx);
    const d = Math.abs(ex - x);
    if (d < bestDistance) {
      bestDistance = d;
      bestEvent = e;
    }
  }
  return bestEvent;
}

export function stepEvent(
  current: string | null,
  events: ReadonlyArray<TimelineEvent>,
  direction: "next" | "prev",
): TimelineEvent | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  if (current === null) {
    return direction === "next" ? sorted[0]! : sorted[sorted.length - 1]!;
  }
  const currentMs = Date.parse(current);
  if (Number.isNaN(currentMs)) return sorted[0]!;
  if (direction === "next") {
    for (const e of sorted) {
      if (Date.parse(e.at) > currentMs) return e;
    }
    return sorted[sorted.length - 1]!;
  }
  let last: TimelineEvent | null = null;
  for (const e of sorted) {
    if (Date.parse(e.at) >= currentMs) break;
    last = e;
  }
  return last ?? sorted[0]!;
}
