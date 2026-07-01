import { typeTier } from "@/shared/lib/tier";
import { sanitiseField, serialiseKey } from "./keys";
import { isCanonicalRelation } from "./relation";
import type {
  CompositeKey,
  DecompInput,
  EdgeIn,
  NodeIn,
  RawSnapshot,
  Relation,
} from "./types";

/**
 * Normalise an untrusted RawSnapshot into a DecompInput. Never throws.
 * Load-bearing invariant I-1 (INV-PORT-IDX): edges are resolved through an
 * `id → NodeIn[]` index in O(1) per edge — a naive per-edge scan would be
 * O(N×E) and fail NFR-002. The index doubles as the id-collision detector.
 *
 * takenAt precedence (F4): explicit `takenAt` arg (non-empty) wins, else
 * RawSnapshot.takenAt, else "". No wall-clock.
 */
export function port(
  raw: RawSnapshot,
  threshold: number,
  takenAt?: string,
): DecompInput {
  let dropped = 0;
  const nodes: NodeIn[] = [];
  const byKeyStr = new Map<string, NodeIn>();
  const byId = new Map<string, NodeIn[]>();

  for (const rawNode of raw.nodes ?? []) {
    const rawId = rawNode.id ?? null;
    const rawTitle = rawNode.title ?? null;
    if (rawId === null && rawTitle === null) {
      dropped++; // E-MISSING-IDENTITY: no stable key possible
      continue;
    }
    const id = sanitiseField(String(rawId ?? ""));
    const degradedKey = rawTitle === null;
    const title = sanitiseField(String(rawTitle ?? ""));
    const kind = String(rawNode.kind ?? "note").toLowerCase();

    const key: CompositeKey = { id, title };
    const keyStr = serialiseKey(key);
    const existing = byKeyStr.get(keyStr);
    if (existing) {
      // Same (id,title) twice. Keep a deterministic kind (lowest tier, then
      // lexicographically-lowest) so the port stays order-invariant even when
      // two rows share a composite key but disagree on kind (INV-8 / I-1).
      if (
        kind !== existing.kind &&
        (typeTier(kind) < typeTier(existing.kind) ||
          (typeTier(kind) === typeTier(existing.kind) && kind < existing.kind))
      ) {
        existing.kind = kind;
      }
      continue;
    }

    const nodeIn: NodeIn = {
      key,
      id,
      title,
      kind,
      idCollision: false,
      degradedKey,
    };
    byKeyStr.set(keyStr, nodeIn);
    nodes.push(nodeIn);
    const bucket = byId.get(id);
    if (bucket) bucket.push(nodeIn);
    else byId.set(id, [nodeIn]);
  }

  // Mark id collisions: same id, distinct (id,title) (E-ID-COLLISION, surfaced).
  for (const bucket of byId.values()) {
    if (bucket.length > 1) {
      for (const n of bucket) n.idCollision = true;
    }
  }

  // Resolve edges by id via the index. Under id-collision, emit ONE EdgeIn per
  // matching (from,to) composite-key pair (INV-PORT-EDGE / RFC-028 I-11), in
  // ascending [serialise(from), serialise(to)] order (reorder-invariant, INV-8).
  const edges: EdgeIn[] = [];
  const seenEdge = new Set<string>();
  for (const rawEdge of raw.edges ?? []) {
    if (
      rawEdge.from === null ||
      rawEdge.from === undefined ||
      rawEdge.to === null ||
      rawEdge.to === undefined ||
      rawEdge.relation === null ||
      rawEdge.relation === undefined
    ) {
      continue;
    }
    const relRaw = String(rawEdge.relation).toLowerCase();
    const relation: Relation = isCanonicalRelation(relRaw)
      ? relRaw
      : (relRaw as Relation); // non-canonical retained; classifyIcom handles it
    const fromNodes = byId.get(sanitiseField(String(rawEdge.from))) ?? [];
    const toNodes = byId.get(sanitiseField(String(rawEdge.to))) ?? [];
    if (fromNodes.length === 0 || toNodes.length === 0) continue;

    const pairs: EdgeIn[] = [];
    for (const f of fromNodes) {
      for (const t of toNodes) {
        pairs.push({ from: f.key, to: t.key, relation });
      }
    }
    pairs.sort((a, b) => {
      const fa = serialiseKey(a.from);
      const fb = serialiseKey(b.from);
      if (fa !== fb) return fa < fb ? -1 : 1;
      const ta = serialiseKey(a.to);
      const tb = serialiseKey(b.to);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    for (const p of pairs) {
      const ek = JSON.stringify([
        serialiseKey(p.from),
        serialiseKey(p.to),
        p.relation,
      ]);
      if (seenEdge.has(ek)) continue; // drop exact-duplicate edge (INV-8)
      seenEdge.add(ek);
      edges.push(p);
    }
  }

  return {
    nodes,
    edges,
    threshold,
    takenAt: takenAt && takenAt.length > 0 ? takenAt : (raw.takenAt ?? ""),
    dropped,
  };
}
