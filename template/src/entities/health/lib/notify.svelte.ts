// PRD-007 / RFC-006 — push notifications for workspace health breaches.
// Detects three kinds of breach by diffing successive `/api/health` poll
// outputs: new blind_spots, stale_count increase, orphan_count increase.
// Fires a browser Notification when the user has opted in AND permission
// is granted, throttled per category.

export type Breach =
  | { kind: "blind_spot"; id: string; title: string }
  | { kind: "stale"; delta: number }
  | { kind: "orphan"; delta: number };

export interface HealthSnapshot {
  blindSpotIds: Set<string>;
  staleCount: number;
  orphanCount: number;
}

export const THROTTLE_MS = 60_000;

export function emptySnapshot(): HealthSnapshot {
  return { blindSpotIds: new Set(), staleCount: 0, orphanCount: 0 };
}

export function snapshotFromHealth(health: {
  blind_spots?: Array<{ id: string; title: string }>;
  stale_count?: number;
  orphan_count?: number;
}): HealthSnapshot {
  return {
    blindSpotIds: new Set((health.blind_spots ?? []).map((s) => s.id)),
    staleCount: health.stale_count ?? 0,
    orphanCount: health.orphan_count ?? 0,
  };
}

export function detectBreaches(
  prev: HealthSnapshot,
  next: HealthSnapshot,
  nextHealth: { blind_spots?: Array<{ id: string; title: string }> },
): Breach[] {
  const out: Breach[] = [];
  for (const s of nextHealth.blind_spots ?? []) {
    if (!prev.blindSpotIds.has(s.id)) {
      out.push({ kind: "blind_spot", id: s.id, title: s.title });
    }
  }
  if (next.staleCount > prev.staleCount) {
    out.push({ kind: "stale", delta: next.staleCount - prev.staleCount });
  }
  if (next.orphanCount > prev.orphanCount) {
    out.push({ kind: "orphan", delta: next.orphanCount - prev.orphanCount });
  }
  return out;
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission():
  | NotificationPermission
  | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

const lastFireAt = new Map<Breach["kind"], number>();

export function fire(
  breach: Breach,
  onClick?: (b: Breach) => void,
  now: () => number = () => Date.now(),
): boolean {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const ts = now();
  const last = lastFireAt.get(breach.kind) ?? 0;
  if (ts - last < THROTTLE_MS) return false;
  lastFireAt.set(breach.kind, ts);

  let title: string;
  let body: string;
  switch (breach.kind) {
    case "blind_spot":
      title = `Forgeplan: new blind spot`;
      body = `${breach.id}: ${breach.title}`;
      break;
    case "stale":
      title = `Forgeplan: ${breach.delta} new stale artifact${breach.delta === 1 ? "" : "s"}`;
      body = "";
      break;
    case "orphan":
      title = `Forgeplan: ${breach.delta} new orphan artifact${breach.delta === 1 ? "" : "s"}`;
      body = "";
      break;
  }
  const n = new Notification(title, {
    body,
    silent: true,
    tag: `forgeplan.${breach.kind}`,
  });
  if (onClick) {
    n.onclick = () => onClick(breach);
  }
  return true;
}

// TODO(test-only): drop or guard behind import.meta.vitest if hot-reload starts
// shipping test-helpers into the bundle.
export function _resetForTesting(): void {
  lastFireAt.clear();
}

// notify-bus singleton: foreign closures (e.g. notification.onclick) cannot
// directly reach HomePage state; they set notifyBus.pendingFocus and
// HomePage's $effect picks it up.
export const notifyBus = $state({ pendingFocus: null as string | null });

export function focusArtifact(id: string): void {
  notifyBus.pendingFocus = id;
}
