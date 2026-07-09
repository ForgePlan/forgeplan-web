/**
 * Semantic tier of an artifact kind. Orders kinds from most abstract to most
 * concrete:
 *
 *   epic → prd → spec → rfc → adr → evidence → note → problem → solution
 *
 * Single authoritative definition (ADR-006 / SPEC-004 INV-1). The widgets
 * (`cluster.svelte.ts`, `type-tier.ts`) re-export from here so every existing
 * consumer keeps resolving unchanged. FSD rule 24: this module imports NOTHING
 * from `widgets/`. This barrel is the semver-stable public surface (RFC-028).
 */
export const TYPE_ORDER = [
  "epic",
  "prd",
  "spec",
  "rfc",
  "adr",
  "evidence",
  "note",
  "problem",
  "solution",
] as const;

/**
 * Returns the index of `kind` in TYPE_ORDER (case-insensitive), or
 * `TYPE_ORDER.length` (= 9) for unknown / empty kinds.
 */
export function typeTier(kind: string): number {
  const k = String(kind).toLowerCase();
  const idx = (TYPE_ORDER as readonly string[]).indexOf(k);
  return idx === -1 ? TYPE_ORDER.length : idx;
}

/**
 * Compact-tier mapping: only the tiers actually present in a node set are
 * kept; gaps collapse inward. So a workspace with PRD/RFC/EVID gets
 * {prd: 0, rfc: 1, evidence: 2} (no empty `spec` row), matching the same
 * convention as `computeOrbitRing` in cluster.svelte.ts. Unknown kinds are
 * appended after all known tiers, in encounter order. Empty input → empty Map.
 */
export function compactTierMap(kinds: Iterable<string>): Map<string, number> {
  const present = new Set<string>();
  for (const k of kinds) present.add(String(k).toLowerCase());
  const ordered: string[] = [];
  for (const t of TYPE_ORDER) {
    if (present.has(t)) ordered.push(t);
  }
  for (const t of present) {
    if (!ordered.includes(t)) ordered.push(t);
  }
  const out = new Map<string, number>();
  ordered.forEach((t, i) => out.set(t, i));
  return out;
}
