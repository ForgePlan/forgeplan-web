import type { ScoreEntry } from "@/entities/score";
import type { ActivityEntry } from "@/entities/activity";

// PRD-010 / RFC-009 NFR-001 — the 10s poll layer hands fresh array references
// every tick even when the payload is unchanged. Reducing inputs to a content
// signature lets the panel skip recompute when nothing actually changed,
// keeping render under 250ms. Mirrors widgets/dependency-graph/lib/
// filter-memo.svelte.ts.

/** Stable signature of the scored subset (id + r_eff, order-sensitive). */
export function scoreSignature(scores: ScoreEntry[]): string {
  return scores.map((s) => `${s.id}:${s.r_eff}`).join("|");
}

/**
 * Stable signature of the activity log. Only the fields the stat functions
 * read (action / field / status values / timestamp) participate, so a
 * non-semantic field (e.g. commit_hash) never busts the memo.
 */
export function logSignature(log: ActivityEntry[]): string {
  return log
    .map(
      (e) =>
        `${e.action}:${e.field ?? ""}:${e.old_value ?? ""}>${e.new_value ?? ""}@${e.timestamp}`,
    )
    .join("|");
}

/** Combined signature for the whole stats panel input set. */
export function statsSignature(input: {
  scores: ScoreEntry[];
  log: ActivityEntry[];
  total: number;
  activeCount: number;
  blindSpotCount: number;
  decayTotal: number;
}): string {
  return [
    scoreSignature(input.scores),
    logSignature(input.log),
    `t${input.total}`,
    `a${input.activeCount}`,
    `b${input.blindSpotCount}`,
    `d${input.decayTotal}`,
  ].join("##");
}

/**
 * Tiny single-slot memoizer. Recomputes `produce()` only when `signature`
 * changes; otherwise returns the cached value. Not Svelte-reactive by itself —
 * call it from a `$derived` so the signature read tracks the poller state.
 */
export function makeSignatureMemo<T>() {
  let lastSig: string | null = null;
  let cached: T | null = null;
  return (signature: string, produce: () => T): T => {
    if (signature !== lastSig || cached === null) {
      cached = produce();
      lastSig = signature;
    }
    return cached;
  };
}
