---
depth: standard
id: RFC-006
kind: rfc
status: active
title: Notification permission UX + breach detection algorithm
---

# RFC-006: Notification permission UX + breach detection

## Summary

Pin the permission flow, the breach-detection algorithm, the throttle
policy, and the click-handler routing for PRD-007's push notifications.
No new npm dependencies — uses the browser's native `Notification` API.

## Motivation

Without a pinned RFC, every iteration on permission timing ("ask on
mount?" "ask on toggle?"), throttle window ("30s? 60s? 5min?"), and
multi-tab semantics turns into ad-hoc decisions and rework. Pinning the
state machine + algorithm here makes implementation mechanical and
audit findings replicable.

## Permission states + UX

```
                ┌─────────────┐
                │ default      │  ← first visit
                └─────┬───────┘
        toggle clicked│
                ┌─────▼───────┐
                │ requested   │  ← Notification.requestPermission()
                └─┬─────────┬─┘
       granted │           │ denied
                ▼           ▼
         ┌─────────┐  ┌──────────┐
         │ enabled │  │ disabled │
         └─────────┘  └──────────┘
              ▲             │
              │   user un-toggles
              └─────────────┘  (revoke local; permission stays granted at browser level)
```

- **default** + toggle off: button shows "Notify (off)", clicking triggers permission request.
- **granted** + toggle on: notifications fire on detected breaches.
- **granted** + toggle off: respect user — silent.
- **denied**: button disabled with tooltip "Re-enable in browser settings → Site permissions".

## Breach detection

Health poller already returns `{blind_spots: [{id, title, issue}], stale_count: number, ...}`. New `notify.svelte.ts` watches the poll output:

```ts
let lastBlindSpotIds = new Set<string>();
let lastStaleCount = 0;
let lastFireAt = new Map<string, number>(); // category → timestamp
const THROTTLE_MS = 60_000;

export function detectBreaches(prev, next): Breach[] {
  const breaches: Breach[] = [];
  // Category 1: new blind_spots
  const newSpots = next.blind_spots.filter((s) => !prev.blindSpotIds.has(s.id));
  for (const s of newSpots)
    breaches.push({ kind: "blind_spot", id: s.id, title: s.title });
  // Category 2: stale_count increase
  if (next.stale_count > prev.staleCount) {
    breaches.push({ kind: "stale", delta: next.stale_count - prev.staleCount });
  }
  // Category 3: orphan_count increase
  if (next.orphan_count > prev.orphanCount) {
    breaches.push({
      kind: "orphan",
      delta: next.orphan_count - prev.orphanCount,
    });
  }
  return breaches;
}

export function fire(breach: Breach): void {
  const now = Date.now();
  const last = lastFireAt.get(breach.kind) ?? 0;
  if (now - last < THROTTLE_MS) return; // FR-007 throttle
  lastFireAt.set(breach.kind, now);

  const n = new Notification(titleFor(breach), {
    body: bodyFor(breach),
    icon: "/favicon.png",
    silent: true, // no audio
    tag: `forgeplan.${breach.kind}`, // collapse repeats
  });
  n.onclick = () => {
    window.focus();
    if (breach.id) selectArtifact(breach.id);
  };
}
```

## Click-handler routing

Notification's `onclick` calls `window.focus()` then sets `selectedId` via
a small `entities/health/lib/notify-bus.ts` event-bus singleton:

```ts
export const notifyBus = $state({ pendingFocus: null as string | null });
```

`HomePage.svelte` watches `notifyBus.pendingFocus` in `$effect`; when set,
it calls `selectNode({ id })` and clears.

Why a bus instead of direct mutation: the notification handler runs
outside the Svelte 5 runes scope of HomePage. Setting the bus from a
foreign closure is fine because `$state` is reactive everywhere; foreign
mutation triggers HomePage's effect.

## Toggle persistence

```ts
// settings.ts addition
export interface Settings {
  // ... existing fields
  notify: boolean; // user opt-in
}
```

Default: `false`. Persisted via existing `loadSettings` / `saveSettings`.

## Implementation Phases

1. **F12-T1** — `entities/health/lib/notify.svelte.ts` (permission + detect + fire + throttle).
2. **F12-T2** — `entities/health/lib/notify.test.ts` (vitest unit tests for permission states, breach detection, throttle).
3. **F12-T3** — `HealthBar.svelte` toggle button + aria-live region.
4. **F12-T4** — `pages/home/lib/settings.ts` add `notify` field.
5. **F12-T5** — `HomePage.svelte` wire `notifyBus.pendingFocus` to `selectedId`.
6. **F12-T6** — CHANGELOG, smoke + svelte-check + tests, commit + push + PR.

## Proposed Direction

Adopt the Notification-API-only approach (no SW). PR `feature/notify-f12`
→ `develop`. After F11 merges. Implementation runs in 6 phases.

## Options Considered

| Option                    | Description                                            | Verdict                                                            |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Service Worker push       | Background notifications even when tab closed          | Rejected — overhead, requires VAPID keys; tab-local enough for MVP |
| FCM / APNs native         | Cross-device push                                      | Rejected — server infra needed; out of scope                       |
| **Notification API only** | Tab-foreground browser notifications                   | **Chosen** — zero deps, simplest contract                          |
| In-page banner only       | No browser notification, just `<aside class="banner">` | Rejected — user must look at tab to see; defeats purpose           |

## Invariants

- No new npm deps.
- Notification fires only when user opted in AND browser granted permission.
- Throttle ≥ 60s per category.
- No body content in notification payload (privacy, NFR-002).
- Feature-detected: `if (!('Notification' in window))` hides toggle.

## Rollback Plan

1. Revert each F12-T\* commit independently.
2. Drop `entities/health/lib/notify*.ts` files.
3. HealthBar toggle removed; `settings.notify` field stays as harmless string in localStorage.

## Risks

- R-1 (denied → stuck): tooltip + manual re-enable instructions.
- R-2 (spam): throttle (FR-007).
- R-3 (multi-tab dupes): documented; BroadcastChannel future RFC.
- R-4 (Safari/Firefox API differences): feature-detect; vitest covers `Notification === undefined` branch.
- R-5 (body leak): hard rule in `bodyFor()` — only count + title, never body.

