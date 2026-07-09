<script lang="ts">
  /**
   * OnboardTour — RFC-033 (Pillar B) narration overlay for the composed-map
   * onboarding tour. Pure presentation: reads a single `TourStop` (or
   * `null`) plus progress, and composes `shared/ui` primitives (rule 24) —
   * no primitive re-skinning, layout/positioning CSS only on this file's
   * own wrapper markup.
   *
   * Keyboard (ArrowRight/Space/ArrowLeft/Esc) is owned by ComposedMapView's
   * single window-level handler, not by this component — adding a second
   * keydown listener here would double-fire every step. This component
   * only owns its buttons, focus, and roles.
   *
   * Degrades honestly: `stop.narrationRu` is rendered only when present —
   * a zone with no sourced narration shows label + what's-inside only,
   * never a fabricated placeholder (MASTER-SPEC §15 / FD-7).
   */
  import type { TourStop } from "../model/tour-state";
  import { Badge, Button, Card } from "@/shared/ui";

  let {
    stop,
    index,
    total,
    projectTitle,
    onNext,
    onPrev,
    onExit,
    reducedMotion = false,
  }: {
    stop: TourStop | null;
    index: number;
    total: number;
    projectTitle: string;
    onNext: () => void;
    onPrev: () => void;
    onExit: () => void;
    reducedMotion?: boolean;
  } = $props();

  let cardEl = $state<HTMLDivElement | undefined>();

  // Focus the card on mount / on every new stop — a11y announcement of the
  // dialog without stealing keyboard routing (arrow/space/Esc still flow to
  // ComposedMapView's window-level listener regardless of focus target).
  $effect(() => {
    void stop;
    cardEl?.focus();
  });

  const remaining = $derived.by(() =>
    stop ? Math.max(0, stop.memberSummary.total - stop.memberSummary.labels.length) : 0,
  );
</script>

{#if stop}
  <div
    class="onboard-tour"
    class:no-motion={reducedMotion}
    role="dialog"
    aria-label="Onboarding tour"
    tabindex="-1"
    bind:this={cardEl}
  >
    <Card variant="elevated" padding="md">
      <div class="ot-header">
        <span class="ot-project">{projectTitle}</span>
        <Badge variant="mono" size="sm">{index + 1} / {total}</Badge>
      </div>
      <h3 class="ot-label">{stop.label}</h3>
      {#if stop.narrationRu}
        <p class="ot-narration">{stop.narrationRu}</p>
      {/if}
      {#if stop.memberSummary.total > 0}
        <div class="ot-inside-label">What's inside</div>
        <p class="ot-inside">
          {stop.memberSummary.labels.join(", ")}{#if remaining > 0}
            {" "}+{remaining} more
          {/if}
        </p>
      {/if}
      <div class="ot-controls">
        <Button variant="ghost" size="sm" onclick={onExit}>Exit</Button>
        <div class="ot-controls-nav">
          <Button
            variant="secondary"
            size="sm"
            disabled={index === 0}
            onclick={onPrev}
          >
            ← Prev
          </Button>
          <Button variant="primary" size="sm" onclick={onNext}>
            {index + 1 >= total ? "Done" : "Next →"}
          </Button>
        </div>
      </div>
    </Card>
  </div>
{/if}

<style>
  /* Positioning + our own wrapper's motion only (rule 24) — Card/Badge/
     Button are shared/ui primitives, unmodified. */
  .onboard-tour {
    position: absolute;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    z-index: 20;
    width: min(480px, calc(100% - 32px));
    transition: opacity 160ms ease-out;
  }
  .onboard-tour:focus-visible {
    outline: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .onboard-tour {
      transition: none;
    }
  }
  .onboard-tour.no-motion {
    transition: none;
  }

  .ot-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .ot-project {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-3);
  }

  .ot-label {
    margin: 0 0 6px;
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 16px;
    color: var(--fg);
  }

  .ot-narration {
    margin: 0 0 8px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--fg-2);
  }

  .ot-inside-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-3);
    margin-bottom: 4px;
  }
  .ot-inside {
    margin: 0 0 10px;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--fg-2);
  }

  .ot-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .ot-controls-nav {
    display: flex;
    gap: 6px;
  }
</style>
