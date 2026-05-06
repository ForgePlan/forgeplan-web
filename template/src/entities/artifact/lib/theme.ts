import type { ArtifactKind, ArtifactStatus } from '../model/types';

/**
 * Forgeplan kind palette — terminal/black-and-orange aesthetic.
 *
 * All color values are returned as CSS `var(--token)` strings so the
 * dual-theme system (PRD-015 / RFC-014) takes effect without re-rendering
 * the graph. Call sites that hand the result to an SVG presentation
 * attribute MUST use Svelte's `style:` directive (e.g. `style:stroke={...}`)
 * — bare attributes like `stroke={...}` will not interpolate `var()`.
 *
 * Most kinds render with a neutral border; "accent" kinds (Epic, Problem)
 * render in brand orange; Evidence renders in green.
 */

const ACCENT = 'var(--accent)';
const GOOD = 'var(--good)';
const NEUTRAL_FG = 'var(--node-fg-neutral)';
const NEUTRAL_BORDER = 'var(--node-border-neutral)';
// Decorative kind-dot fill: softer than NEUTRAL_FG so the dots read as
// "subtle" in both themes (white-on-black in dark, mid-grey on cream in
// light). Using NEUTRAL_FG here renders as heavy black blobs in light
// mode (PRD-015 user feedback: "вот тут какие-то черные круги").
const NEUTRAL_DOT = 'var(--fg-3)';

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
  superseded: 'var(--fg-4)',
  deprecated: 'var(--fg-4)',
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
 *  - everything else       → neutral (white in dark theme, black in light)
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
 * Decorative kind dots (filter chips, insights rail). Neutral kinds use
 * the softer NEUTRAL_DOT token; accent kinds keep their saturated brand
 * colors so the legend stays scannable in both themes.
 */
export const KIND_COLORS: Record<string, string> = {
  prd: NEUTRAL_DOT,
  rfc: NEUTRAL_DOT,
  adr: NEUTRAL_DOT,
  spec: NEUTRAL_DOT,
  epic: ACCENT,
  evidence: GOOD,
  evid: GOOD,
  problem: ACCENT,
  solution: NEUTRAL_DOT,
  note: NEUTRAL_DOT,
  refresh: NEUTRAL_DOT
};

export function kindColor(kind: ArtifactKind | string): string {
  return KIND_COLORS[kind.toLowerCase()] ?? NEUTRAL_DOT;
}

export function statusRing(status: ArtifactStatus | string): string {
  return STATUS_RING[status.toLowerCase()] ?? 'var(--fg-4)';
}
