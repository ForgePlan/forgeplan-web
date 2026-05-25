export type DegreeMap = Map<string, number>;

export function buildDegreeMap(edges: Array<{ source: string; target: string }>): DegreeMap {
  const map: DegreeMap = new Map();
  for (const { source, target } of edges) {
    if (source === target) continue;
    map.set(source, (map.get(source) ?? 0) + 1);
    map.set(target, (map.get(target) ?? 0) + 1);
  }
  return map;
}

export function byDegreeDesc<T extends { id: string }>(
  degree: DegreeMap,
  tieBreak?: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) => {
    const da = degree.get(a.id) ?? 0;
    const db = degree.get(b.id) ?? 0;
    if (db !== da) return db - da;
    if (tieBreak) return tieBreak(a, b);
    return a.id.localeCompare(b.id);
  };
}
