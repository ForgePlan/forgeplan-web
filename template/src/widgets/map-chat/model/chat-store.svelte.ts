// RFC-034 (Pillar C, Phase 3b) — the chat's message/tier/live-connection
// store. Mirrors node-tabs.svelte.ts / camera-bus.svelte.ts's plain
// module-level `$state` shape: no class, no context, one shared instance
// per page; state stays module-private and is only ever read/written
// through the exported functions below.
//
// Tier 0 (client-grounded, model-free) is the permanent fallback. Tier 1
// (the live daemon, @forgeplan/web-agent) is opportunistic: `checkDaemon`
// probes it and upgrades the tier on success; a live connection that
// errors or closes degrades back to Tier 0 (RFC-034 graceful-degradation
// NFR) rather than leaving the chat stuck mid-answer.

import type { MapDocument } from "@/entities/map";
import { answerFromMap } from "./tier0";
import { showOnMap } from "@/widgets/composed-map/model/camera-bus.svelte";
import { probeDaemon, connectAgent } from "./agent-client";
import type { AgentConnection } from "./agent-client";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export type ChatTier = "tier0" | "tier1";

/** RFC-034 ADI cycle A (A1) — fixed default port + probe for the MVP. */
export const DEFAULT_AGENT_PORT = 7431;
const PROBE_INTERVAL_MS = 15_000;

let messages = $state<ChatMessage[]>([]);
let tier = $state<ChatTier>("tier0");
let model = $state<string | null>(null);
let pending = $state(false);

let connection: AgentConnection | null = null;
let activeAssistantIndex: number | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let agentPort = DEFAULT_AGENT_PORT;

/** View reads: the current transcript, oldest first. */
export function getMessages(): ChatMessage[] {
  return messages;
}

/** View reads: which tier is currently answering. */
export function getTier(): ChatTier {
  return tier;
}

/** View reads: the live daemon's advertised model name (Tier 1 only). */
export function getModel(): string | null {
  return model;
}

/** View reads: true while a Tier-1 answer is still streaming in. */
export function isPending(): boolean {
  return pending;
}

function appendMessage(role: ChatMessage["role"], text: string): number {
  messages = [...messages, { role, text }];
  return messages.length - 1;
}

function appendDelta(index: number, delta: string): void {
  const existing = messages[index];
  if (!existing) return;
  const next = messages.slice();
  next[index] = { ...existing, text: existing.text + delta };
  messages = next;
}

/** Tears down any live connection and reverts to the offline tier. A
 * still-empty placeholder assistant bubble (no tokens ever arrived) is
 * dropped rather than left dangling; a partial answer is kept as-is. */
function fallBackToTier0(): void {
  if (
    activeAssistantIndex !== null &&
    messages[activeAssistantIndex]?.text === ""
  ) {
    const dropIndex = activeAssistantIndex;
    messages = messages.filter((_, i) => i !== dropIndex);
  }
  connection?.close();
  connection = null;
  tier = "tier0";
  model = null;
  pending = false;
  activeAssistantIndex = null;
}

function handleError(message: string): void {
  if (activeAssistantIndex !== null) {
    const existing = messages[activeAssistantIndex]?.text ?? "";
    appendDelta(
      activeAssistantIndex,
      existing.length > 0 ? `\n\n${message}` : message,
    );
  }
  fallBackToTier0();
}

function handleDone(): void {
  pending = false;
  activeAssistantIndex = null;
}

function ensureConnection(): AgentConnection {
  if (connection) return connection;
  connection = connectAgent(agentPort, {
    onToken: (delta) => {
      if (activeAssistantIndex !== null)
        appendDelta(activeAssistantIndex, delta);
    },
    onShowOnMap: showOnMap,
    onDone: handleDone,
    onError: handleError,
    onClose: fallBackToTier0,
  });
  return connection;
}

function sendTier1(question: string): void {
  pending = true;
  activeAssistantIndex = appendMessage("assistant", "");
  ensureConnection().send(question);
}

/**
 * Sends a user question. Tier 0 (default/fallback): answers instantly,
 * client-grounded, from the loaded `MapDocument`. Tier 1 (daemon
 * connected): pushes an empty assistant message and streams the live
 * agent's answer into it, relaying any `show_on_map` call to the camera
 * the same way Tier 0 does.
 */
export function send(doc: MapDocument, question: string): void {
  const trimmed = question.trim();
  if (!trimmed) return;
  if (tier === "tier1" && pending) return; // one in-flight Tier-1 answer at a time

  messages = [...messages, { role: "user", text: trimmed }];

  if (tier === "tier1") {
    sendTier1(trimmed);
    return;
  }

  const { text, target } = answerFromMap(doc, trimmed);
  messages = [...messages, { role: "assistant", text }];
  if (target) showOnMap(target);
}

/**
 * Probes the daemon once and updates tier/model on success. Exposed
 * directly (not just via the interval) so callers — including tests —
 * can await a single check without waiting on `PROBE_INTERVAL_MS`. A
 * down result only reverts to Tier 0 when there's no live connection
 * already open — an established Tier-1 session's own onError/onClose is
 * the source of truth for *that* session dropping, not a parallel probe.
 */
export async function checkDaemon(
  port: number = DEFAULT_AGENT_PORT,
): Promise<void> {
  agentPort = port;
  const result = await probeDaemon(port);
  if (result.up) {
    tier = "tier1";
    model = result.model ?? null;
  } else if (!connection) {
    tier = "tier0";
    model = null;
  }
}

/** View lifecycle (MapChat onMount): start probing for the daemon.
 * Idempotent — a second call while a timer is already running is a
 * no-op. */
export function startAgentProbe(port: number = DEFAULT_AGENT_PORT): void {
  if (probeTimer) return;
  void checkDaemon(port);
  probeTimer = setInterval(() => void checkDaemon(port), PROBE_INTERVAL_MS);
}

/** View lifecycle (MapChat onDestroy): stop probing and close any live
 * connection. */
export function stopAgentProbe(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  connection?.close();
  connection = null;
}

/** Test/dev helper: resets the shared store to its initial state. */
export function resetChat(): void {
  stopAgentProbe();
  messages = [];
  tier = "tier0";
  model = null;
  pending = false;
  activeAssistantIndex = null;
}
