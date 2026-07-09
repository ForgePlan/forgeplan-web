<script lang="ts">
  import { listPoller } from "@/entities/artifact";
  import { healthPoller } from "@/entities/health";
  import { scorePoller } from "@/entities/score";
  import { statsLogPoller } from "@/entities/activity";

  import {
    reffHistogram,
    weeklyVelocity,
    statusTransitions,
    decayProxy,
  } from "../lib/pulse-stats";
  import { computeHealthScore } from "../lib/health-score";
  import {
    interpretHistogram,
    interpretVelocity,
    interpretTransitions,
    interpretDecay,
    interpretHealthScore,
  } from "../lib/interpret";
  import { reconstructTrend, hasSufficientTrend } from "../lib/trend";
  import { statsSignature, makeSignatureMemo } from "../lib/memo";

  import ReffHistogram from "./ReffHistogram.svelte";
  import WeeklyVelocity from "./WeeklyVelocity.svelte";
  import StatusTransitions from "./StatusTransitions.svelte";
  import DecayCalendar from "./DecayCalendar.svelte";
  import HealthScore from "./HealthScore.svelte";

  let {
    onSelect,
  }: {
    onSelect?: (detail: { id: string; event?: Event }) => void;
  } = $props();

  // ---- raw inputs from already-polled, allow-listed endpoints -------------
  const scores = $derived(scorePoller.state.data?.results ?? []);
  const log = $derived(statsLogPoller.state.data?.entries ?? []);
  const artifacts = $derived(listPoller.state.data ?? []);
  const health = $derived(healthPoller.state.data);

  const total = $derived(health?.total ?? artifacts.length);
  const activeCount = $derived(
    artifacts.filter((a) => a.status.toLowerCase() === "active").length,
  );
  const blindSpotCount = $derived(health?.blind_spots?.length ?? 0);
  const decay = $derived(
    decayProxy({
      at_risk: health?.at_risk,
      stale_count: health?.stale_count,
      stale_drafts: health?.stale_drafts,
    }),
  );

  // ---- NFR-001 content-signature memoization ------------------------------
  // One signature gates the whole compute set; the poll layer hands fresh
  // array refs every tick but recompute only happens on real change.
  const memo = makeSignatureMemo<{
    histogram: ReturnType<typeof reffHistogram>;
    velocity: ReturnType<typeof weeklyVelocity>;
    transitions: ReturnType<typeof statusTransitions>;
    healthScore: ReturnType<typeof computeHealthScore>;
    trend: ReturnType<typeof reconstructTrend>;
    trendOk: boolean;
  }>();

  const computed = $derived.by(() => {
    const sig = statsSignature({
      scores,
      log,
      total,
      activeCount,
      blindSpotCount,
      decayTotal: decay.total,
    });
    return memo(sig, () => ({
      histogram: reffHistogram(scores),
      velocity: weeklyVelocity(log),
      transitions: statusTransitions(log),
      healthScore: computeHealthScore({
        scores,
        activeCount,
        totalCount: total,
        blindSpotCount,
        log,
      }),
      trend: reconstructTrend(log),
      trendOk: hasSufficientTrend(log),
    }));
  });

  // Loader ONLY before the first payload while no error is known; a failing
  // poll (e.g. workspace lock contention) must surface as an error line, not
  // an eternal spinner. With stale-while-error in the poller, once data has
  // arrived it stays rendered through later failures.
  const loading = $derived(
    scorePoller.state.loading &&
      !scorePoller.state.data &&
      !scorePoller.state.error,
  );
  const failedWithNoData = $derived(
    !scorePoller.state.data && scorePoller.state.error !== null,
  );

  function onBucket() {
    // Drill-down hook (FR-012): a histogram bucket maps to many artifacts, not
    // one, so there is no single id to forward yet. `onSelect` stays wired for
    // future per-element drill-down (e.g. a transition row → its artifact).
    // TODO(fr-012-drill): route a single-artifact element → onSelect({ id }).
    void onSelect;
  }
</script>

<div class="stats-panel" data-test="stats-panel">
  {#if loading}
    <p class="muted">loading…</p>
  {:else if failedWithNoData}
    <!-- Honest degradation (no eternal spinner): the CLI is unreachable —
         typically the forgeplan workspace lock is held by an agent session.
         The poller keeps retrying every 30s; data appears when a run lands. -->
    <p class="muted" role="status">
      Stats unavailable: {scorePoller.state.error}. Retrying…
    </p>
  {:else}
    <HealthScore
      health={computed.healthScore}
      interpretation={interpretHealthScore(computed.healthScore)}
      trend={computed.trend}
      trendSufficient={computed.trendOk}
    />

    <ReffHistogram
      buckets={computed.histogram}
      interpretation={interpretHistogram(computed.histogram)}
      onSelectBucket={onBucket}
    />

    <WeeklyVelocity
      weeks={computed.velocity}
      interpretation={interpretVelocity(computed.velocity)}
    />

    <StatusTransitions
      transitions={computed.transitions}
      interpretation={interpretTransitions(computed.transitions)}
    />

    <DecayCalendar {decay} interpretation={interpretDecay(decay)} />
  {/if}
</div>

<style>
  .stats-panel {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .muted {
    color: var(--fg-3);
  }
</style>
