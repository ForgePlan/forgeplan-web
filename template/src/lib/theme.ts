import type { ArtifactKind, ArtifactStatus } from '$lib/types';

/**
 * Forgeplan kind palette — terminal/black-and-orange aesthetic.
 *
 * Most kinds render as plain white-bordered rectangles; "accent" kinds
 * (Epic, Problem) render in brand orange; Evidence renders in green.
 */

const ACCENT = '#ff5a1f';
const GOOD = '#22c55e';
const NEUTRAL_FG = '#e5e5e5';
const NEUTRAL_BORDER = 'rgba(255, 255, 255, 0.7)';

export const ACCENT_KINDS = new Set<string>(['epic', 'problem', 'evidence', 'evid']);

export const KIND_LABELS: Record<string, string> = {
  prd: 'PRD',
  rfc: 'RFC',
  adr: 'ADR',
  spec: 'Spec',
  epic: 'Epic',
  evidence: 'Evidence',
  evid: 'Evidence',
  problem: 'Problem',
  solution: 'Solution',
  note: 'Note',
  refresh: 'Refresh'
};

export const KIND_TAGLINES: Record<string, { tagline: string; body: string }> = {
  prd: {
    tagline: 'What you build and why',
    body:
      'Product Requirements Doc — the single decision about what changes for the user and the rationale behind it.'
  },
  rfc: {
    tagline: 'How to build it',
    body:
      'Request for Comments — the technical approach: trade-offs, constraints, and the chosen architecture.'
  },
  adr: {
    tagline: 'Why this approach',
    body:
      'Architecture Decision Record — captures the moment a hard call was made and the alternatives that were rejected.'
  },
  epic: {
    tagline: 'Group of work',
    body:
      'Epic — a coordinated bundle of PRDs, RFCs, and Specs that together deliver a larger outcome.'
  },
  spec: {
    tagline: 'API contracts',
    body:
      'Spec — the precise interface description (schemas, endpoints, message shapes) that downstream code commits to.'
  },
  problem: {
    tagline: 'Signal with context',
    body:
      'Problem — a high-quality bug / risk / friction report with enough context to act on, not just a sticky note.'
  },
  evidence: {
    tagline: 'Test and prove',
    body:
      'EvidencePack — measured proof a decision still holds. Verdict + congruence + evidence_type drive R_eff.'
  },
  evid: {
    tagline: 'Test and prove',
    body:
      'EvidencePack — measured proof a decision still holds. Verdict + congruence + evidence_type drive R_eff.'
  },
  solution: {
    tagline: '2-3 variants compared',
    body:
      'Solution — concrete options weighed against the Problem, with the chosen approach and the runners-up.'
  },
  note: {
    tagline: 'Quick micro-decision',
    body:
      'Note — small, durable decision that doesn’t justify a full PRD but is still worth recording.'
  },
  refresh: {
    tagline: 'Re-evaluate stale',
    body:
      'Refresh — re-runs the evidence on a stale artifact and updates the decision (or supersedes it).'
  }
};

export const STATUS_RING: Record<string, string> = {
  active: GOOD,
  draft: ACCENT,
  superseded: '#525252',
  deprecated: '#3f3f3f',
  stale: ACCENT
};

export function kindLabel(kind: ArtifactKind | string): string {
  return KIND_LABELS[kind.toLowerCase()] ?? kind;
}

export function kindIsAccent(kind: ArtifactKind | string): boolean {
  return ACCENT_KINDS.has(kind.toLowerCase());
}

/**
 * Border colour for a graph node, terminal-style.
 *  - Epic / Problem        → brand orange
 *  - Evidence              → green
 *  - everything else       → neutral white border
 */
export function kindBorder(kind: ArtifactKind | string): string {
  const k = kind.toLowerCase();
  if (k === 'evidence' || k === 'evid') return GOOD;
  if (ACCENT_KINDS.has(k)) return ACCENT;
  return NEUTRAL_BORDER;
}

/**
 * Text colour for the ID label inside a node — matches the border so
 * Epic/Problem read in orange, Evidence in green, others in neutral.
 */
export function kindLabelColor(kind: ArtifactKind | string): string {
  const k = kind.toLowerCase();
  if (k === 'evidence' || k === 'evid') return GOOD;
  if (ACCENT_KINDS.has(k)) return ACCENT;
  return NEUTRAL_FG;
}

/**
 * Legacy fill helper kept around for chips / dots that still want a
 * per-kind solid colour.
 */
export const KIND_COLORS: Record<string, string> = {
  prd: NEUTRAL_FG,
  rfc: NEUTRAL_FG,
  adr: NEUTRAL_FG,
  spec: NEUTRAL_FG,
  epic: ACCENT,
  evidence: GOOD,
  evid: GOOD,
  problem: ACCENT,
  solution: NEUTRAL_FG,
  note: NEUTRAL_FG,
  refresh: NEUTRAL_FG
};

export function kindColor(kind: ArtifactKind | string): string {
  return KIND_COLORS[kind.toLowerCase()] ?? NEUTRAL_FG;
}

export function statusRing(status: ArtifactStatus | string): string {
  return STATUS_RING[status.toLowerCase()] ?? '#3f3f3f';
}

/** Map an R_eff score to a tone bucket for progress bars. */
export type ReffTone = 'good' | 'warn' | 'bad';
export function reffTone(reff: number | undefined): ReffTone {
  if (reff === undefined || Number.isNaN(reff)) return 'bad';
  if (reff >= 0.6) return 'good';
  if (reff >= 0.3) return 'warn';
  return 'bad';
}

/** Node radius for force-directed layouts (kept for back-compat). */
export function reffRadius(reff: number | undefined): number {
  if (reff === undefined || Number.isNaN(reff)) return 8;
  const clamped = Math.max(0, Math.min(1, reff));
  return 7 + clamped * 11;
}
