import type { Hint, HintInput, HintSeverity } from "./types";
import { HINT_RULES } from "./hint-rules";

// PRD-011 / RFC-010 FR-006 — pure computeHints(state) → Hint[]. Runs every
// rule, dedupes, filters snoozed, ranks. Same input → same output (NFR-003).

export const SEVERITY_WEIGHT: Record<HintSeverity, number> = {
  critical: 3,
  warning: 2,
  tip: 1,
};

export const DEFAULT_TOP_N = 3;

/**
 * Deterministic ranking (NFR-003): severity weight desc, then stable rule
 * priority asc, then id asc. Deliberately NOT the RFC's `computedAt` recency
 * tiebreak — Date.now-based ordering is non-deterministic across renders
 * (plan blocker B4). `priority` (the rule's index in HINT_RULES) is the
 * stable replacement.
 */
export function rankHints(hints: Hint[]): Hint[] {
  return [...hints].sort((a, b) => {
    const dw = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (dw !== 0) return dw;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export interface ComputeOptions {
  /** hint id → epoch ms when the snooze ends. */
  snoozed?: Record<string, number>;
  /** Reference time for snooze expiry. Defaults to input.now. */
  now?: Date;
}

/**
 * Run every rule against `input`, producing at most one hint per rule.
 * Dedupe: if two hints share `affectedIds[0]`, the earlier rule in
 * HINT_RULES wins (RFC-010 R-2). Snoozed hints whose TTL has not expired are
 * filtered. Result is ranked (rankHints). Pure — no I/O, no Date.now beyond
 * the explicitly-passed reference time.
 */
export function computeHints(
  input: HintInput,
  options: ComputeOptions = {},
): Hint[] {
  const snoozed = options.snoozed ?? {};
  const nowMs = (options.now ?? input.now).getTime();

  const produced: Hint[] = [];
  for (let priority = 0; priority < HINT_RULES.length; priority++) {
    const rule = HINT_RULES[priority];
    if (!rule) continue;
    const match = rule.match(input);
    if (!match) continue;
    const text = rule.copy(input, match);
    produced.push({
      id: rule.id,
      severity: match.severity ?? rule.defaultSeverity,
      text,
      affectedIds: match.affectedIds,
      priority,
    });
  }

  // Dedupe by affectedIds[0], first-rule-wins. Hints with no affected ids
  // (e.g. velocity-drop) never collide — they key on their own id.
  const seenAnchor = new Set<string>();
  const deduped: Hint[] = [];
  for (const hint of produced) {
    const anchor = hint.affectedIds?.[0] ?? `__rule:${hint.id}`;
    if (seenAnchor.has(anchor)) continue;
    seenAnchor.add(anchor);
    deduped.push(hint);
  }

  const visible = deduped.filter((hint) => {
    const until = snoozed[hint.id];
    return !until || until <= nowMs;
  });

  return rankHints(visible);
}

/**
 * Drop snooze entries whose TTL has already passed. Returns a new record —
 * does not mutate the input. Called before persisting so localStorage never
 * accumulates dead entries (RFC-010 auto-cleanup, FR-008).
 */
export function pruneSnoozed(
  snoozed: Record<string, number>,
  nowMs: number = Date.now(),
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, until] of Object.entries(snoozed)) {
    if (typeof until === "number" && until > nowMs) out[id] = until;
  }
  return out;
}
