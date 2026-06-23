export function hashStringFnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) | 0) >>> 0;
  }
  return h;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) >>> 0;
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000;
  };
}

export function seededJitter(nodeId: string, half: number): { dx: number; dy: number } {
  const rand = mulberry32(hashStringFnv1a(nodeId));
  const dx = (rand() - 0.5) * 2 * half;
  const dy = (rand() - 0.5) * 2 * half;
  return { dx, dy };
}
