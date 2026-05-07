import { compactTierMap, typeTier } from "./type-tier";

/**
 * Compact-tier index for a single kind given a workspace's full kind
 * set. Tiers absent from the workspace collapse inward (same convention
 * as Sankey's `assignSankeyColumns`), so a workspace with PRD/RFC/EVID
 * gets {prd: 0, rfc: 1, evidence: 2}.
 *
 * Falls back to the static `typeTier` for unknown kinds — they sort
 * after the last known tier.
 */
export function kindTierLayer(
  kind: string,
  allKinds: Iterable<string>,
): number {
  const tiers = compactTierMap(allKinds);
  const k = String(kind).toLowerCase();
  return tiers.get(k) ?? typeTier(kind);
}

/**
 * Distribute `ids` across N sub-rows of equal cardinality (`ceil(n/N)`)
 * such that the natural width of each sub-row stays at or below
 * `maxRowW`. Returns `[ids]` when one row already fits.
 *
 * Width of a sub-row = sum of node widths + COL_GAP * (count - 1).
 * Cardinality is balanced first; if any sub-row still overflows the
 * cardinality is bumped up until every sub-row fits or each sub-row
 * holds a single node (degenerate case — the caller's viewport is too
 * narrow for even one node, but we still return a valid layout).
 */
export function wrapColumns(
  ids: string[],
  widths: ReadonlyMap<string, number>,
  maxRowW: number,
  colGap: number,
): string[][] {
  if (ids.length === 0) return [];
  const naturalWidth = (slice: string[]): number => {
    let sum = 0;
    for (const id of slice) sum += widths.get(id) ?? 0;
    return sum + colGap * Math.max(0, slice.length - 1);
  };

  if (naturalWidth(ids) <= maxRowW) return [ids];

  for (let subRows = 2; subRows <= ids.length; subRows++) {
    const perRow = Math.ceil(ids.length / subRows);
    const slices: string[][] = [];
    for (let i = 0; i < ids.length; i += perRow) {
      slices.push(ids.slice(i, i + perRow));
    }
    const fits = slices.every((s) => naturalWidth(s) <= maxRowW);
    if (fits) return slices;
  }

  // FIXME(degenerate-narrow-viewport): single node still wider than
  // maxRowW — caller's viewport is too narrow, return one node per row
  // so the layout stays valid.
  return ids.map((id) => [id]);
}
