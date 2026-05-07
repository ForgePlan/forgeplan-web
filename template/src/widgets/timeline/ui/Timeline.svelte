<script lang="ts">
  import { onMount } from 'svelte';
  import {
    eventsToDomain,
    eventsToTicks,
    loadSnapshotAt,
    setNow,
    snapshotStore,
    stepEvent,
    toggleCollapsed,
    xToTimestamp,
    type AxisDomain,
    type TickPosition,
    type TimelineEvent
  } from '../index';
  import { Button } from '@/shared/ui';

  const SCRUBBER_DEBOUNCE_MS = 200;
  const TIMELINE_HEIGHT_PX = 60;

  let events = $state<TimelineEvent[]>([]);
  let loadingEvents = $state(false);
  let eventsError = $state<string | null>(null);
  let bodyClientWidth = $state(800);
  const containerWidth = $derived(Math.max(100, bodyClientWidth - 32));
  let scrubberX = $state(0);
  let dragging = $state(false);
  let svgEl = $state<SVGSVGElement | undefined>(undefined);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const domain = $derived(eventsToDomain(events) as AxisDomain | null);
  const ticks = $derived<TickPosition[]>(
    domain ? eventsToTicks(events, domain, containerWidth) : []
  );
  const currentLabel = $derived(
    snapshotStore.mode === 'single' && snapshotStore.activeAt
      ? new Date(snapshotStore.activeAt).toLocaleString()
      : 'now'
  );

  onMount(() => {
    let cancelled = false;
    void (async () => {
      loadingEvents = true;
      try {
        const res = await fetch('/api/timeline-events');
        const body = (await res.json()) as { ok: boolean; events?: TimelineEvent[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          eventsError = body.error ?? `HTTP ${res.status}`;
          return;
        }
        events = body.events ?? [];
        if (events.length > 0 && domain) {
          scrubberX = containerWidth;
        }
      } catch (err) {
        if (!cancelled) eventsError = (err as Error).message;
      } finally {
        if (!cancelled) loadingEvents = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  function fireScrubAt(x: number) {
    if (!domain) return;
    const ms = xToTimestamp(x, domain, containerWidth);
    const iso = new Date(ms).toISOString();
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void loadSnapshotAt(iso);
      debounceTimer = null;
    }, SCRUBBER_DEBOUNCE_MS);
  }

  function onPointerDown(e: PointerEvent) {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    scrubberX = x;
    dragging = true;
    svgEl.setPointerCapture(e.pointerId);
    fireScrubAt(x);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    scrubberX = x;
    fireScrubAt(x);
  }

  function onPointerUp(e: PointerEvent) {
    if (!svgEl) return;
    dragging = false;
    try {
      svgEl.releasePointerCapture(e.pointerId);
    } catch {
      // FIXME(pointer-capture-race): release may throw if onPointerDown was preempted by capture transfer
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (events.length === 0 || !domain) return;
    if (e.key === 'Home') {
      e.preventDefault();
      const first = stepEvent(null, events, 'next');
      if (first) {
        scrubberX = 0;
        void loadSnapshotAt(first.at);
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      scrubberX = containerWidth;
      setNow();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = stepEvent(snapshotStore.activeAt, events, 'prev');
      if (prev) {
        const ms = Date.parse(prev.at);
        scrubberX = ((ms - domain.startMs) / (domain.endMs - domain.startMs)) * containerWidth;
        void loadSnapshotAt(prev.at);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = stepEvent(snapshotStore.activeAt, events, 'next');
      if (next) {
        const ms = Date.parse(next.at);
        scrubberX = ((ms - domain.startMs) / (domain.endMs - domain.startMs)) * containerWidth;
        void loadSnapshotAt(next.at);
      }
    }
  }

  function onClickNow() {
    setNow();
    scrubberX = containerWidth;
  }
</script>

<aside
  class="timeline"
  class:collapsed={snapshotStore.collapsed}
  data-test="timeline"
>
  <header class="head">
    <Button
      variant="ghost"
      size="sm"
      class="timeline-toggle"
      onclick={() => toggleCollapsed()}
      aria-expanded={!snapshotStore.collapsed}
      aria-controls="timeline-body"
      aria-label={snapshotStore.collapsed ? 'Expand timeline' : 'Collapse timeline'}
    >
      {snapshotStore.collapsed ? '▴ Timeline' : '▾ Timeline'}
    </Button>
    <span class="status">
      {#if snapshotStore.mode === 'now'}
        <span class="muted">live · now</span>
      {:else if snapshotStore.loading}
        <span class="muted">loading…</span>
      {:else if snapshotStore.error}
        <span class="bad" title={snapshotStore.error}>error: {snapshotStore.error}</span>
      {:else}
        <span class="info">viewing snapshot at <strong>{currentLabel}</strong></span>
      {/if}
    </span>
    <div class="actions">
      {#if snapshotStore.mode !== 'now'}
        <Button variant="ghost" size="sm" class="timeline-now" onclick={onClickNow}>now</Button>
      {/if}
    </div>
  </header>

  {#if !snapshotStore.collapsed}
    <div class="body" id="timeline-body" bind:clientWidth={bodyClientWidth}>
      {#if loadingEvents}
        <div class="muted">loading events…</div>
      {:else if eventsError}
        <div class="bad">events error: {eventsError}</div>
      {:else if events.length === 0}
        <div class="muted">no commits touch .forgeplan/</div>
      {:else}
        <svg
          bind:this={svgEl}
          class="axis"
          width={containerWidth}
          height={TIMELINE_HEIGHT_PX}
          role="slider"
          aria-label="Workspace history scrubber"
          aria-valuemin="0"
          aria-valuemax={events.length}
          aria-valuenow={Math.round((scrubberX / containerWidth) * events.length)}
          tabindex="0"
          onpointerdown={onPointerDown}
          onpointermove={onPointerMove}
          onpointerup={onPointerUp}
          onkeydown={onKeyDown}
        >
          <line
            class="axis-baseline"
            x1="0"
            y1={TIMELINE_HEIGHT_PX / 2}
            x2={containerWidth}
            y2={TIMELINE_HEIGHT_PX / 2}
          />
          {#each ticks as t (t.at + t.artifactId)}
            <line
              class="tick tick-{t.kind}"
              x1={t.x}
              y1={TIMELINE_HEIGHT_PX / 2 - 8}
              x2={t.x}
              y2={TIMELINE_HEIGHT_PX / 2 + 8}
            >
              <title>{t.at} · {t.kind} · {t.artifactId}</title>
            </line>
          {/each}
          <line
            class="scrubber"
            x1={scrubberX}
            y1="0"
            x2={scrubberX}
            y2={TIMELINE_HEIGHT_PX}
          />
          <rect
            class="scrubber-handle"
            x={scrubberX - 5}
            y={TIMELINE_HEIGHT_PX / 2 - 10}
            width="10"
            height="20"
            rx="2"
          />
        </svg>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .timeline {
    border-top: 1px solid var(--line);
    background: var(--bg-1);
    color: var(--fg-1);
    font-family: var(--font-mono);
    font-size: 11px;
    flex-shrink: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--line);
  }
  .status {
    flex: 1;
    color: var(--fg-3);
  }
  .info strong {
    color: var(--accent);
    font-weight: 500;
  }
  .body {
    padding: 8px 16px 14px;
  }
  .muted {
    color: var(--fg-3);
  }
  .bad {
    color: var(--bad);
  }
  .axis {
    width: 100%;
    cursor: ew-resize;
    user-select: none;
    outline: none;
  }
  .axis:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 2px;
  }
  .axis-baseline {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tick {
    stroke-width: 1.5;
  }
  .tick-created {
    stroke: var(--fg-3);
  }
  .tick-activated {
    stroke: var(--accent);
  }
  .tick-superseded {
    stroke: var(--fg-4);
  }
  .tick-scored {
    stroke: var(--good);
  }
  .scrubber {
    stroke: var(--accent);
    stroke-width: 1;
    pointer-events: none;
  }
  .scrubber-handle {
    fill: var(--accent);
    stroke: var(--bg);
    stroke-width: 1;
    pointer-events: none;
  }
  .head :global(.timeline-toggle) {
    min-width: 110px;
    justify-content: flex-start;
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
  }
  .timeline.collapsed .body {
    display: none;
  }
</style>
