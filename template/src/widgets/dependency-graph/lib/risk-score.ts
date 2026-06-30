// Pure risk-score math for the workspace-decay overlay (PRD-009 / RFC-008).
//
// All inputs are rule-22 allow-listed read-only data already on screen:
//   - r_eff      → /api/score (`score --all --json`) per graph node, and
//                  /api/get/[id] (`get <id> --json`) for the artifact panel.
//   - valid_until → /api/get/[id] (`get <id> --json`).
// No new endpoint, no /api/decay, no mutating subcommand. Risk is computed
// entirely client-side from these two fields.

/** Minimal shape both ArtifactDetail and a view's node summary satisfy. */
export interface RiskInput {
  r_eff?: number;
  valid_until?: string | null;
}

/** Decay window: an artifact with ≥ 90d of validity left carries no decay
 *  pressure (decay_factor 0); at expiry it is fully decayed (1). */
export const DECAY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/** r_eff gate for the in-graph glow halo (PRD-009 FR-002/SC-2, RFC-008
 *  `RISK_THRESHOLD = 0.6 // node-risk class applied below this`). A node
 *  glows when its R_eff is strictly below this — i.e. its weakest-link
 *  evidence is concerning — so a healthy 289-node workspace lights only its
 *  handful of thin places, not every imperfect-evidence node. */
export const RISK_THRESHOLD = 0.6;

/** True when a node's R_eff is below the glow gate (PRD-009 FR-002/SC-2).
 *  Missing / non-numeric r_eff is treated as healthy (R_eff = 1 → no glow),
 *  matching riskScore's r_eff default. */
export function nodeAtRisk(reff: number | undefined): boolean {
  const r = typeof reff === "number" && !Number.isNaN(reff) ? reff : 1;
  return r < RISK_THRESHOLD;
}

/** Risk-anatomy section renders only when riskScore > PANEL_RISK_THRESHOLD. */
export const PANEL_RISK_THRESHOLD = 0.1;

/** Glow radius bounds (px) — radius is linear in risk over [GLOW_R_MIN..GLOW_R_MAX]. */
export const GLOW_R_MIN = 2;
export const GLOW_R_MAX = 14;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Decay pressure in [0..1] from time remaining until valid_until.
 *  0 when ≥ 90d remain (or no expiry set), 1 once expired, linear between. */
export function decayFactor(
  validUntil: string | null | undefined,
  now: Date,
): number {
  if (!validUntil) return 1;
  const t = new Date(validUntil).getTime();
  if (Number.isNaN(t)) return 1;
  const remaining = t - now.getTime();
  if (remaining >= DECAY_WINDOW_MS) return 0;
  if (remaining <= 0) return 1;
  return 1 - remaining / DECAY_WINDOW_MS;
}

// NOTE on decayFactor's no-expiry branch: per RFC-008 an artifact WITHOUT a
// valid_until carries decay_factor = 1 (no expiry data == treat as fully
// decayed weight), so risk reduces to (1 - r_eff). A degraded r_eff alone is
// enough to glow even without a decay clock.

/** Composite risk in [0..1]. Multiplicative: weakest-link evidence gap
 *  (1 - r_eff) scaled by decay pressure. Verbatim from RFC-008. */
export function riskScore(input: RiskInput, now: Date = new Date()): number {
  const reff =
    typeof input.r_eff === "number" && !Number.isNaN(input.r_eff)
      ? input.r_eff
      : 1;
  const reffPart = clamp01(1 - reff);
  return clamp01(reffPart * decayFactor(input.valid_until, now));
}

/** Glow halo radius (px), linear in risk across [GLOW_R_MIN..GLOW_R_MAX]. */
export function glowRadiusPx(score: number): number {
  const s = clamp01(score);
  return Math.round(GLOW_R_MIN + s * (GLOW_R_MAX - GLOW_R_MIN));
}

/** Whole days remaining until valid_until (negative once expired). null when
 *  no expiry is set. Used by the decay timer (FR-008). */
export function daysRemaining(
  validUntil: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!validUntil) return null;
  const t = new Date(validUntil).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** Minimal edge shape (a GraphEdge subset) the weakest-EVID scan needs. */
export interface RiskEdge {
  from: string;
  to: string;
  relation: string;
}

const EVID_ID = /^(EVID|EVIDENCE)-/i;

/** Weakest EVID informing `nodeId` (FR-009 hover tooltip): the lowest-R_eff
 *  source of an `informs` edge whose source is an Evidence pack. Returns the
 *  EVID id or null. Pure: r_eff comes from the caller's score map (rule-22
 *  allow-listed /api/score), edges from /api/graph. Ties broken by id order
 *  for determinism. */
export function weakestInformingEvid(
  nodeId: string,
  edges: readonly RiskEdge[],
  scoreById: ReadonlyMap<string, number>,
): string | null {
  let weakestId: string | null = null;
  let weakestReff = Infinity;
  for (const e of edges) {
    if (e.to !== nodeId) continue;
    if (e.relation.toLowerCase() !== "informs") continue;
    if (!EVID_ID.test(e.from)) continue;
    const reff = scoreById.get(e.from) ?? Infinity;
    if (
      reff < weakestReff ||
      (reff === weakestReff && (weakestId === null || e.from < weakestId))
    ) {
      weakestReff = reff;
      weakestId = e.from;
    }
  }
  return weakestId;
}
