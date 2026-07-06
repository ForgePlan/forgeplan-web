// RFC-034 (Pillar C, Phase 1b) — Tier 0: client-grounded, model-free
// answering. `answerFromMap` is a pure function of (doc, question): no
// network, no model, no DOM, never throws. It matches the lowercased
// question against zone/node/flow text already loaded in the `MapDocument`
// and, on a match, also returns a `CameraTarget` so the chat store can drive
// the existing camera (camera-bus.svelte.ts). Reuses
// node-tabs.svelte.ts#buildNodeConnections for node in/out neighbours — the
// same derivation `MapNodePanel` renders — rather than re-deriving it here.
//
// Honesty (MASTER-SPEC §15 / RFC-033 precedent): a missing `description_ru`
// is omitted, never fabricated as a placeholder sentence.

import type { MapDocument, MapNode, MapZone, MapFlow } from "@/entities/map";
import { buildNodeConnections } from "@/widgets/composed-map/model/node-tabs.svelte";
import type { CameraTarget } from "@/widgets/composed-map/model/camera-bus.svelte";

export interface Tier0Answer {
  text: string;
  target?: CameraTarget;
}

const MEMBER_SUMMARY_LIMIT = 6;
const FALLBACK_ZONE_SAMPLE = 3;
const MIN_KEYWORD_LENGTH = 3;

// Common English question scaffolding — stripped before keyword scoring so
// "where is the CLI Surfaces zone" scores on "cli"/"surfaces", not on
// "where"/"the"/"is".
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "how",
  "what",
  "where",
  "which",
  "who",
  "whom",
  "tell",
  "me",
  "about",
  "of",
  "in",
  "on",
  "to",
  "for",
  "and",
  "or",
  "this",
  "that",
  "it",
  "its",
  "with",
  "from",
  "by",
  "can",
  "you",
  "please",
  "show",
  "explain",
  "describe",
  "map",
]);

/** Splits on any run of non-letter/non-digit chars (Unicode-aware, so this
 * also tokenizes RU narration and path-shaped provenance refs). */
function tokenize(input: string): string[] {
  return input
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(t));
}

/** A literal label/name match (either direction) is a strong signal; each
 * keyword found in the entity's text is a weaker, additive one. */
function scoreMatch(
  qLower: string,
  keywords: readonly string[],
  matchText: string,
  primaryKey: string,
): number {
  if (!matchText) return 0;
  let score = 0;
  if (
    primaryKey &&
    (qLower.includes(primaryKey) || matchText.includes(qLower))
  ) {
    score += 5;
  }
  for (const kw of keywords) {
    if (matchText.includes(kw)) score += 1;
  }
  return score;
}

function describeZone(doc: MapDocument, zone: MapZone): string {
  const parts: string[] = [zone.label];
  if (zone.description_ru) parts.push(zone.description_ru);
  const members = doc.nodes.filter((n) => n.zone === zone.id && !n.is_mega);
  if (members.length > 0) {
    const labels = members.slice(0, MEMBER_SUMMARY_LIMIT).map((n) => n.label);
    const remaining = members.length - labels.length;
    const suffix = remaining > 0 ? ` (+${remaining} more)` : "";
    parts.push(`What's inside: ${labels.join(", ")}${suffix}`);
  }
  return parts.join(" — ");
}

function describeNode(doc: MapDocument, node: MapNode): string {
  const parts: string[] = [node.label];
  if (node.description_ru) parts.push(node.description_ru);
  const connections = buildNodeConnections(doc, node.id);
  const out = connections.filter((c) => c.dir === "out").map((c) => c.label);
  const inbound = connections.filter((c) => c.dir === "in").map((c) => c.label);
  if (out.length > 0) parts.push(`Connects to: ${out.join(", ")}`);
  if (inbound.length > 0) parts.push(`Connected from: ${inbound.join(", ")}`);
  return parts.join(" — ");
}

function describeFlow(flow: MapFlow): string {
  const parts: string[] = [flow.name];
  if (flow.steps && flow.steps.length > 0) {
    parts.push(flow.steps.map((step, i) => `${i + 1}. ${step}`).join(" "));
  }
  return parts.join(" — ");
}

function fallbackText(doc: MapDocument): string {
  const sample = doc.zones.slice(0, FALLBACK_ZONE_SAMPLE).map((z) => z.label);
  if (sample.length === 0) {
    return "I don't have a loaded map to answer from yet.";
  }
  return `I couldn't find a match for that on the map. Try asking about one of: ${sample.join(", ")}.`;
}

/**
 * Model-free, client-grounded answering: matches `question` against
 * zone.label + zone.description_ru, node.label + node path (provenance.ref)
 * + node.description_ru, and flow.name — never throws, never fabricates.
 */
export function answerFromMap(doc: MapDocument, question: string): Tier0Answer {
  try {
    const qLower = (question ?? "").toLowerCase().trim();
    if (!qLower) return { text: fallbackText(doc) };
    const keywords = tokenize(qLower);

    let best: { score: number; kind: CameraTarget["kind"]; id: string } | null =
      null;
    const consider = (
      score: number,
      kind: CameraTarget["kind"],
      id: string,
    ) => {
      if (score > 0 && (!best || score > best.score))
        best = { score, kind, id };
    };

    for (const zone of doc.zones) {
      const matchText = [zone.label, zone.description_ru]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      consider(
        scoreMatch(qLower, keywords, matchText, zone.label.toLowerCase()),
        "zone",
        zone.id,
      );
    }
    for (const node of doc.nodes) {
      const matchText = [node.label, node.description_ru, node.provenance?.ref]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      consider(
        scoreMatch(qLower, keywords, matchText, node.label.toLowerCase()),
        "node",
        node.id,
      );
    }
    for (const flow of doc.flows ?? []) {
      const matchText = flow.name.toLowerCase();
      consider(
        scoreMatch(qLower, keywords, matchText, flow.name.toLowerCase()),
        "flow",
        flow.id,
      );
    }

    if (!best) return { text: fallbackText(doc) };
    const picked: { score: number; kind: CameraTarget["kind"]; id: string } =
      best;

    const target: CameraTarget = { kind: picked.kind, id: picked.id };
    if (picked.kind === "zone") {
      const zone = doc.zones.find((z) => z.id === picked.id);
      if (!zone) return { text: fallbackText(doc) };
      return { text: describeZone(doc, zone), target };
    }
    if (picked.kind === "node") {
      const node = doc.nodes.find((n) => n.id === picked.id);
      if (!node) return { text: fallbackText(doc) };
      return { text: describeNode(doc, node), target };
    }
    const flow = (doc.flows ?? []).find((f) => f.id === picked.id);
    if (!flow) return { text: fallbackText(doc) };
    return { text: describeFlow(flow), target };
  } catch {
    // Never throw (RFC-034 contract) — a malformed doc or unexpected input
    // degrades to an honest, generic notice rather than crashing the chat.
    return {
      text: "Something went wrong answering that — try rephrasing your question.",
    };
  }
}
