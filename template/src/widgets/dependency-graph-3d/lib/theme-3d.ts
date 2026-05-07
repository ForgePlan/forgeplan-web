import { Color } from 'three';

const ACCENT_KINDS = new Set(['epic', 'problem']);
const EVIDENCE_KINDS = new Set(['evidence', 'evid']);

const FALLBACK = {
  bg: '#0a0a0f',
  fg: '#e6e6f0',
  accent: '#ff7a18',
  good: '#3ddc84',
  neutral: '#9aa0a6',
  fg3: '#5a5d66',
  line: '#2a2a35',
};

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v.length > 0 ? v : fallback;
}

export interface Theme3DPalette {
  bg: Color;
  accent: Color;
  good: Color;
  neutral: Color;
  fg3: Color;
  line: Color;
}

export function readTheme3D(): Theme3DPalette {
  return {
    bg: new Color(readVar('--bg', FALLBACK.bg)),
    accent: new Color(readVar('--accent', FALLBACK.accent)),
    good: new Color(readVar('--accent-good', FALLBACK.good)),
    neutral: new Color(readVar('--fg-1', FALLBACK.neutral)),
    fg3: new Color(readVar('--fg-3', FALLBACK.fg3)),
    line: new Color(readVar('--line-2', FALLBACK.line)),
  };
}

export function nodeColor(palette: Theme3DPalette, kind: string): Color {
  const k = kind.toLowerCase();
  if (EVIDENCE_KINDS.has(k)) return palette.good;
  if (ACCENT_KINDS.has(k)) return palette.accent;
  return palette.neutral;
}

const STATUS_GLOW: Record<string, 'good' | 'accent' | 'fg3'> = {
  active: 'good',
  draft: 'accent',
  superseded: 'fg3',
  deprecated: 'fg3',
  stale: 'accent',
};

export function statusGlow(palette: Theme3DPalette, status: string): Color {
  const tone = STATUS_GLOW[status.toLowerCase()] ?? 'fg3';
  return palette[tone];
}

export function nodeRadius(rEff: number): number {
  const safe = Number.isFinite(rEff) ? rEff : 0;
  const t = Math.max(0, Math.min(1, safe));
  return 1.8 + t * 2.0;
}
