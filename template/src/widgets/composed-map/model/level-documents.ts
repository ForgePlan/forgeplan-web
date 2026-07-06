import type { MapDocument } from "@/entities/map";
import { deriveSubDocument } from "@/entities/map/lib/derive-subdocument";

// PRD-038 FR-002 (E3 seam) — builds the per-altitude document chain the
// same way docsByDepth always has (RFC-031), except the FIRST descent
// (root -> level 1) prefers a map-pack-emitted layer over the
// client-derived deriveSubDocument fold when one is cached and valid.
//
// Pure — no I/O, no Svelte state. `layerCache` maps a root-level zone id to
// its validated emitted MapDocument, or `null` when fetched-and-absent/
// invalid (client-derived fallback applies). A zone never looked up yet is
// simply absent from the map (`get` returns `undefined`), which also falls
// back — the caller (ComposedMapView) is responsible for kicking the fetch
// and updating the cache; this function only ever reads it.
//
// TODO(e3-nested-layers): deeper levels (index > 0 in focusChain) always
// use deriveSubDocument — map-pack does not yet emit nested
// "<ancestor>/<zone>" layer files (PRD-038 MVP scope).
export function buildLevelDocuments(
  rootDoc: MapDocument,
  focusChain: readonly string[],
  layerCache: ReadonlyMap<string, MapDocument | null>,
): MapDocument[] {
  const docs: MapDocument[] = [rootDoc];
  for (let i = 0; i < focusChain.length; i++) {
    const focusId = focusChain[i]!;
    const parent = docs[docs.length - 1]!;
    if (i === 0) {
      const emitted = layerCache.get(focusId);
      if (emitted) {
        docs.push(emitted);
        continue;
      }
    }
    docs.push(deriveSubDocument(parent, focusId));
  }
  return docs;
}

// A fetch is only ever worth kicking off when descending FROM the root
// level INTO one of the root document's own top-level zones (not a
// mega-node, and not from a deeper level — TODO(e3-nested-layers) above).
export function isRootZoneDescend(
  rootDoc: MapDocument,
  levelStackLength: number,
  focusId: string,
): boolean {
  return levelStackLength === 1 && rootDoc.zones.some((z) => z.id === focusId);
}
