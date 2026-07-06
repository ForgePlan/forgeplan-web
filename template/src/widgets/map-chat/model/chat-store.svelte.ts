// RFC-034 (Pillar C, Phase 1b) — the chat's message/tier store. Mirrors
// node-tabs.svelte.ts / camera-bus.svelte.ts's plain module-level `$state`
// shape: no class, no context, one shared instance per page; state stays
// module-private and is only ever read/written through the exported
// functions below.

import type { MapDocument } from "@/entities/map";
import { answerFromMap } from "./tier0";
import { showOnMap } from "@/widgets/composed-map/model/camera-bus.svelte";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export type ChatTier = "tier0" | "tier1";

let messages = $state<ChatMessage[]>([]);
let tier = $state<ChatTier>("tier0");

/** View reads: the current transcript, oldest first. */
export function getMessages(): ChatMessage[] {
  return messages;
}

/** View reads: which tier is currently answering (Phase 1b is always Tier 0). */
export function getTier(): ChatTier {
  return tier;
}

/**
 * Sends a user question: pushes the user message, answers it (Tier 0 today —
 * client-grounded, model-free), pushes the assistant reply, and — when the
 * answer names a zone/node/flow — drives the map camera via camera-bus.
 */
export function send(doc: MapDocument, question: string): void {
  const trimmed = question.trim();
  if (!trimmed) return;
  messages = [...messages, { role: "user", text: trimmed }];

  // TODO(pillar-c-phase3-tier1): once the daemon (@forgeplan/web-agent) is
  // probed and connected, a "tier1" tier should route through
  // agent-client.ts's WebSocket session instead of answerFromMap. Tier 0
  // remains the offline fallback whenever the daemon is absent/unreachable.
  const { text, target } = answerFromMap(doc, trimmed);
  messages = [...messages, { role: "assistant", text }];
  if (target) showOnMap(target);
}

/** Test/dev helper: resets the shared store to its initial state. */
export function resetChat(): void {
  messages = [];
  tier = "tier0";
}
