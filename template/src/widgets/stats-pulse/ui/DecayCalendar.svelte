<script lang="ts">
  import { Tooltip } from "@/shared/ui";
  import type { DecayProxy } from "../lib/pulse-stats";
  import type { Interpretation } from "../lib/interpret";

  let {
    decay,
    interpretation,
  }: {
    decay: DecayProxy;
    interpretation: Interpretation;
  } = $props();

  // FR-003 DEGRADED (plan blocker #2): valid_until is not reachable in any
  // allow-listed aggregate endpoint (only /api/get/[id]). Rather than a
  // bounded N+1 fan-out over every artifact on each poll, the Must-tier first
  // cut surfaces a coarse decay signal from /api/health: at-risk, stale, and
  // stale-draft counts. No 12-month / per-week horizon — labelled honestly.
  // TODO(fr-003-calendar): opt-in valid_until fan-out via /api/get for a true
  // 12-month expiry calendar once a rate-limited, fetch-once path exists.

  interface Tile {
    key: string;
    label: string;
    count: number;
    tone: "good" | "warn" | "bad";
  }

  const tiles = $derived<Tile[]>([
    {
      key: "at-risk",
      label: "At risk",
      count: decay.atRisk,
      tone: decay.atRisk > 0 ? "bad" : "good",
    },
    {
      key: "stale",
      label: "Stale",
      count: decay.stale,
      tone: decay.stale > 0 ? "bad" : "good",
    },
    {
      key: "stale-drafts",
      label: "Stale drafts",
      count: decay.staleDrafts,
      tone: decay.staleDrafts > 0 ? "warn" : "good",
    },
  ]);
</script>

<figure class="chart">
  <figcaption class="head">
    <Tooltip
      label="Coarse decay signal from health: artifacts at risk, already stale, or stale drafts. A precise per-expiry calendar needs per-artifact data not exposed read-only."
    >
      <h4 class="title">Decay risk</h4>
    </Tooltip>
    <span
      class="status status-{interpretation.tone}"
      data-test="chart-status"
      title={interpretation.copy}
    >
      <span class="status-icon" aria-hidden="true">{interpretation.icon}</span>
    </span>
  </figcaption>

  <div class="tiles" data-test="stats-decay" role="group" aria-label="Decay risk counts">
    {#each tiles as t (t.key)}
      <div class="tile tone-{t.tone}" role="img" aria-label="{t.label}: {t.count}">
        <span class="tile-count">{t.count}</span>
        <span class="tile-label">{t.label}</span>
      </div>
    {/each}
  </div>
  <p class="caption" data-test="chart-caption">
    Coarse signal from <code>health</code>. A per-week expiry calendar requires
    per-artifact <code>valid_until</code>, not exposed by the read-only proxy.
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
  .tiles {
    display: flex;
    gap: 6px;
  }
  .tile {
    flex: 1 1 0;
    border: 1px solid var(--line-2);
    background: var(--bg-1);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: flex-start;
    min-width: 0;
  }
  .tile:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .tile-count {
    font-family: var(--font-mono);
    font-size: 18px;
    line-height: 1;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .tile-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--fg-3);
    font-family: var(--font-mono);
  }
  .tile.tone-bad {
    border-color: var(--bad);
  }
  .tile.tone-bad .tile-count {
    color: var(--bad);
  }
  .tile.tone-warn {
    border-color: var(--accent);
  }
  .tile.tone-warn .tile-count {
    color: var(--accent);
  }
  .caption {
    margin: 0;
    font-size: 10px;
    color: var(--fg-3);
    line-height: 1.4;
  }
  code {
    background: var(--bg-2);
    padding: 0 3px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--fg-2);
  }
</style>
