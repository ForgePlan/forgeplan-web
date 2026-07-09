<script lang="ts">
  import { Tooltip } from "@/shared/ui";
  import { motionDuration } from "@/widgets/dependency-graph/lib/reduced-motion";
  import type { StatusTransition } from "../lib/pulse-stats";
  import type { Interpretation } from "../lib/interpret";

  let {
    transitions,
    interpretation,
  }: {
    transitions: StatusTransition[];
    interpretation: Interpretation;
  } = $props();

  const W = 280;
  const ROW_H = 26;
  const PAD_T = 8;
  const PAD_B = 8;
  const LABEL_W = 92;
  const VAL_W = 26;
  const animMs = motionDuration(280);

  // Cap rows to keep the panel compact; the rest are summarised in the caption.
  const MAX_ROWS = 6;
  const shown = $derived(transitions.slice(0, MAX_ROWS));
  const hidden = $derived(Math.max(0, transitions.length - MAX_ROWS));
  const maxCount = $derived(Math.max(1, ...shown.map((t) => t.count)));
  const H = $derived(PAD_T + PAD_B + Math.max(1, shown.length) * ROW_H);
  const barTrack = $derived(W - LABEL_W - VAL_W - 8);

  // Status colour: forward (→active) good, retirement bad, else neutral accent.
  function flowColor(to: string): string {
    if (to === "active") return "var(--good)";
    if (to === "deprecated" || to === "superseded" || to === "stale")
      return "var(--bad)";
    return "var(--accent)";
  }
  function rowY(i: number): number {
    return PAD_T + i * ROW_H;
  }
  function barW(count: number): number {
    return (count / maxCount) * barTrack;
  }
  function label(t: StatusTransition): string {
    return `${t.from} → ${t.to}: ${t.count} time(s)`;
  }
</script>

<figure class="chart" style="--anim:{animMs}ms">
  <figcaption class="head">
    <Tooltip
      label="How artifacts moved between lifecycle states over the last 90 days. →active is forward progress; →deprecated/superseded/stale is retirement."
    >
      <h4 class="title">Status transitions</h4>
    </Tooltip>
    <span
      class="status status-{interpretation.tone}"
      data-test="chart-status"
      title={interpretation.copy}
    >
      <span class="status-icon" aria-hidden="true">{interpretation.icon}</span>
    </span>
  </figcaption>

  <svg
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label="Status transitions over 90 days, {transitions.length} distinct flow(s)"
    data-test="stats-transitions"
    preserveAspectRatio="xMidYMid meet"
  >
    {#if shown.length === 0}
      <text x={W / 2} y={H / 2} class="empty" text-anchor="middle"
        >no transitions</text
      >
    {:else}
      {#each shown as t, i (t.from + ">" + t.to)}
        {@const y = rowY(i)}
        <g class="row" role="img" aria-label={label(t)}>
          <title>{label(t)}</title>
          <text x={0} y={y + ROW_H / 2 + 3} class="flow-label">
            {t.from} → {t.to}
          </text>
          <rect
            x={LABEL_W}
            y={y + 5}
            width={barTrack}
            height={ROW_H - 12}
            class="track"
          />
          <rect
            x={LABEL_W}
            y={y + 5}
            width={Math.max(2, barW(t.count))}
            height={ROW_H - 12}
            fill={flowColor(t.to)}
            class="flow"
          />
          <text
            x={W}
            y={y + ROW_H / 2 + 3}
            class="count"
            text-anchor="end">{t.count}</text
          >
        </g>
      {/each}
    {/if}
  </svg>
  <p class="caption" data-test="chart-caption">
    Lifecycle moves over 90 days from the activity log{hidden > 0
      ? `; ${hidden} smaller flow(s) not shown`
      : ""}.
  </p>
</figure>

<style>
  .chart {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-2);
  }
  .status {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    line-height: 1;
  }
  .status-icon {
    font-size: 13px;
  }
  .status-good {
    color: var(--good);
  }
  .status-warn {
    color: var(--accent);
  }
  .status-bad {
    color: var(--bad);
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .flow-label {
    fill: var(--fg-2);
    font-family: var(--font-mono);
    font-size: 9px;
  }
  .track {
    fill: var(--bg-2);
  }
  .flow {
    transition: width var(--anim) ease;
  }
  .count {
    fill: var(--fg-2);
    font-family: var(--font-mono);
    font-size: 9px;
    font-variant-numeric: tabular-nums;
  }
  .row:focus-visible {
    outline: none;
  }
  .row:focus-visible .flow {
    stroke: var(--accent);
    stroke-width: 1.5;
  }
  .empty {
    fill: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .caption {
    margin: 0;
    font-size: 10px;
    color: var(--fg-3);
    line-height: 1.4;
  }
</style>
