// RFC-031 Phase 2 — pure level/breadcrumb reducers + the fit-relative
// zoom-to-descend threshold constants (ADR-009). The `.svelte` view holds
// only the rune-state `LevelFrame[]` array and calls these; no reducer here
// touches the DOM, d3, or any Svelte state.

export interface LevelFrame {
  /** null = root (level 0) */
  focusId: string | null;
  /** last pan/zoom transform recorded AT this altitude */
  transform: { x: number; y: number; k: number };
  /** this altitude's fit scale — the ratio denominator */
  kFit: number;
}

// calibration-pending (RFC-031 Risks) — centralised here, never scattered.
export const R_DESCEND = 2.5;
export const R_ASCEND = 0.55;
export const COOLDOWN_MS = 350;

const CLAMP_EPSILON = 0.01;

export function rootFrame(kFit: number): LevelFrame {
  return { focusId: null, transform: { x: 0, y: 0, k: kFit }, kFit };
}

export function pushLevel(
  stack: readonly LevelFrame[],
  focusId: string,
  savedTop: LevelFrame["transform"],
): LevelFrame[] {
  if (stack.length === 0) return [...stack];
  const top = stack[stack.length - 1]!;
  const updatedTop: LevelFrame = { ...top, transform: savedTop };
  const child: LevelFrame = {
    focusId,
    transform: { x: 0, y: 0, k: 1 },
    kFit: 1,
  };
  return [...stack.slice(0, -1), updatedTop, child];
}

export function popLevel(stack: readonly LevelFrame[]): LevelFrame[] {
  if (stack.length <= 1) return [...stack];
  return stack.slice(0, -1);
}

export function climbTo(
  stack: readonly LevelFrame[],
  index: number,
): LevelFrame[] {
  if (index < 0 || index >= stack.length) return [...stack];
  return stack.slice(0, index + 1);
}

export function focusChain(stack: readonly LevelFrame[]): string[] {
  return stack.slice(1).map((f) => f.focusId!);
}

export function clampBelowDescend(
  t: LevelFrame["transform"],
  kFit: number,
): LevelFrame["transform"] {
  const maxK = kFit * (R_DESCEND - CLAMP_EPSILON);
  if (t.k <= maxK) return { ...t };
  return { ...t, k: maxK };
}
