<script lang="ts">
  /**
   * /onboard — RFC-033 (Pillar B), FR-004. A thin, calm-chrome host for the
   * SAME `ComposedMapView` widget that backs the dashboard's 9th view
   * (Cycle 1, H2: one widget, two hosts — never a second map mount). This
   * route touches neither `HomePage.svelte` nor `DependencyGraph.svelte`:
   * it mounts the widget directly, so the dashboard, the 8 legacy views,
   * and the Phase-2 drill-down are byte-unchanged by this route existing
   * (FR-004 AC / Invariant 1).
   *
   * TODO(onboard-route-autostart): the tour does not yet auto-start on
   * load. RFC-033's Proposed Direction preferred a one-boolean auto-start
   * signal threaded through HomePage -> DependencyGraph -> ComposedMapView
   * (mirroring the `isLive` prop precedent), forcing a singleton "map"
   * mosaic layout on this route. That wiring touches two additional
   * shared, heavily-trafficked files for a one-click convenience; deferred
   * per RFC-033 SCOPE ("ship the in-view tour regardless... the route
   * never blocks the tour"). Until then, the newcomer clicks the widget's
   * own "Start tour" affordance once landing here.
   *
   * RFC-035 — the chat launcher used to live in THIS header as its own
   * `variant="magic"`/star button, with `showChatLauncher={false}` +
   * `bind:chatOpen` suppressing and re-driving the widget's own launcher.
   * That's been retired: the launcher now lives inside `ComposedMapView`'s
   * own top chips toolbar (left of "All", via `FlowChips`'s `leading`
   * slot) for EVERY host, so this route no longer needs any chat-related
   * prop or state of its own — it mounts the widget exactly like the
   * dashboard host (DependencyGraph.svelte) does.
   */
  import ComposedMapView from "@/widgets/composed-map/ui/ComposedMapView.svelte";
</script>

<svelte:head>
  <title>Onboarding — Project Map</title>
</svelte:head>

<div class="onboard-shell">
  <header class="onboard-header">
    <span class="onboard-title">Project Map — Onboarding</span>
    <div class="onboard-header-right">
      <a class="onboard-exit" href="/">Exit to standard view →</a>
    </div>
  </header>
  <div class="onboard-canvas">
    <ComposedMapView isLive={true} />
  </div>
</div>

<style>
  .onboard-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: var(--bg);
    color: var(--fg-1);
    overflow: hidden;
  }

  .onboard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--line);
    font-family: var(--font-sans);
  }

  .onboard-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-1);
    letter-spacing: 0.02em;
  }

  .onboard-header-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .onboard-exit {
    font-size: 12px;
    color: var(--accent);
    text-decoration: none;
    white-space: nowrap;
  }
  .onboard-exit:hover {
    text-decoration: underline;
  }

  .onboard-canvas {
    flex: 1;
    min-height: 0;
  }
</style>
