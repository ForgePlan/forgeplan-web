// RFC-034 (Pillar C, Phase 3b) — the chat's message/tier/live-connection
// store. Mirrors node-tabs.svelte.ts / camera-bus.svelte.ts's plain
// module-level `$state` shape: no class, no context, one shared instance
// per page; state stays module-private and is only ever read/written
// through the exported functions below.
//
// AI-only (onboard-agent phase 1): the live daemon (Tier 1,
// @forgeplan/web-agent) is the ONLY source of answers — there is no
// client-side, model-free fallback answerer. `checkDaemon` probes the
// daemon and upgrades the tier on success; a live connection that errors
// or closes degrades back to "tier0", which now means "offline, no daemon
// detected" rather than a fallback answering mode. `send()` is a no-op
// while offline — MapChat's offline call-to-action keeps the input/Send
// disabled too, so this is the belt to that view-level suspenders.

import { showOnMap } from "@/widgets/composed-map/model/camera-bus.svelte";
import { probeDaemon, connectAgent } from "./agent-client";
import type { AgentConnection } from "./agent-client";
import type { CameraTarget } from "@/widgets/composed-map/model/camera-bus.svelte";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** Set when this message's answer drove camera-bus — lets the view render
   * a "→ moved to <label>" chip. Omitted (never `undefined`-valued) so the
   * plain `{ role, text }` shape existing callers assert on is unaffected. */
  target?: CameraTarget;
}

export type ChatTier = "tier0" | "tier1";

/** RFC-034 (Pillar C, chat UI upgrade) — a session is the archived shape of
 * one chat transcript. The LIVE transcript (`messages` below) is not itself
 * a `ChatSession` — it is archived into one by `newChat()`. */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  /** RFC-034 (Pillar C, Phase 4c — live-continue) — the Agent SDK's own
   * session id for this transcript's daemon connection, if one was ever
   * captured (the daemon's `{type:"session"}` frame). Absent for sessions
   * archived before this feature shipped, or if the daemon never reported
   * one (e.g. the connection dropped before the SDK's `system`/`init`
   * message arrived). `continueSession` falls back to a fresh (non-resume)
   * reconnect when this is missing — see its own doc comment. */
  agentSessionId?: string;
}

/** RFC-034 ADI cycle A (A1) — fixed default port + probe for the MVP. */
export const DEFAULT_AGENT_PORT = 7431;
const PROBE_INTERVAL_MS = 15_000;
const SESSION_HISTORY_STORAGE_KEY = "forgeplan-web:map-chat:sessions";
const SESSION_HISTORY_CAP = 20;
const SESSION_TITLE_MAX = 64;

let messages = $state<ChatMessage[]>([]);
let tier = $state<ChatTier>("tier0");
let model = $state<string | null>(null);
let pending = $state(false);
let sessionId = $state(createSessionId());
let sessionHistory = $state<ChatSession[]>(loadSessionHistory());
/** Non-null while the view is revisiting a past session read-only (MVP —
 * see `viewSession`'s TODO for the live-continue graduation path). */
let viewingSessionId = $state<string | null>(null);

let connection: AgentConnection | null = null;
let activeAssistantIndex: number | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let agentPort = DEFAULT_AGENT_PORT;

function createSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") && typeof m.text === "string"
  );
}

function isValidSession(value: unknown): value is ChatSession {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.createdAt === "number" &&
    Array.isArray(s.messages) &&
    s.messages.every(isValidChatMessage)
  );
}

/** Reads the archived-session history from `localStorage`. Never throws —
 * a missing/unavailable storage (SSR, private mode, corrupted JSON)
 * degrades to an empty history rather than breaking chat startup. */
function loadSessionHistory(): ChatSession[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidSession) : [];
  } catch {
    return [];
  }
}

/** Best-effort persistence — a full/blocked `localStorage` (private
 * browsing) must not break the chat, so failures are silently ignored. */
function persistSessionHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      SESSION_HISTORY_STORAGE_KEY,
      JSON.stringify(sessionHistory),
    );
  } catch {
    // Storage unavailable/full — the in-memory history still works for
    // the rest of this page session.
  }
}

function clearSessionHistoryStorage(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SESSION_HISTORY_STORAGE_KEY);
  } catch {
    // Best-effort, same as persistSessionHistory.
  }
}

/** Session menu title: the first user question, truncated. Falls back to
 * "New chat" for a (theoretically archived) transcript with no user turn. */
function sessionTitle(msgs: readonly ChatMessage[]): string {
  const firstUser = msgs.find((m) => m.role === "user");
  const text = firstUser?.text.trim();
  if (!text) return "New chat";
  return text.length > SESSION_TITLE_MAX
    ? `${text.slice(0, SESSION_TITLE_MAX)}…`
    : text;
}

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

function appendMessage(
  role: ChatMessage["role"],
  text: string,
  target?: CameraTarget,
): number {
  const msg: ChatMessage = target ? { role, text, target } : { role, text };
  messages = [...messages, msg];
  return messages.length - 1;
}

/** Records the camera target the streaming assistant message drove, so the
 * view can render its "→ moved to <label>" chip once the answer settles. */
function setMessageTarget(index: number, target: CameraTarget): void {
  const existing = messages[index];
  if (!existing) return;
  const next = messages.slice();
  next[index] = { ...existing, target };
  messages = next;
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

function handleShowOnMap(target: CameraTarget): void {
  if (activeAssistantIndex !== null)
    setMessageTarget(activeAssistantIndex, target);
  showOnMap(target);
}

function ensureConnection(): AgentConnection {
  if (connection) return connection;
  connection = connectAgent(agentPort, {
    onToken: (delta) => {
      if (activeAssistantIndex !== null)
        appendDelta(activeAssistantIndex, delta);
    },
    onShowOnMap: handleShowOnMap,
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
 * Sends a user question to the live agent (Tier 1). Pushes an empty
 * assistant message and streams the live agent's answer into it, relaying
 * any `show_on_map` call to the camera. A no-op while offline (`tier !==
 * "tier1"`) — this app is AI-only, there is no client-side fallback
 * answerer (the Tier 0 keyword matcher was removed, onboard-agent
 * phase 1). MapChat's offline call-to-action already keeps Send disabled
 * while offline; this guard covers any other caller.
 */
export function send(question: string): void {
  const trimmed = question.trim();
  if (!trimmed) return;
  if (tier !== "tier1") return; // offline — no client-side fallback answerer
  if (pending) return; // one in-flight Tier-1 answer at a time

  messages = [...messages, { role: "user", text: trimmed }];
  sendTier1(trimmed);
}

const STOPPED_MARKER = "_(stopped)_";

/** Appends a subtle stopped marker to a message's existing text, used only
 * by `cancelCurrent()`. Keeps whatever partial text already streamed in; a
 * still-empty bubble (cancelled before any token arrived) gets just the
 * marker rather than being left blank. */
function appendStoppedMarker(index: number): void {
  const existing = messages[index];
  if (!existing) return;
  const next = messages.slice();
  next[index] = {
    ...existing,
    text:
      existing.text.length > 0
        ? `${existing.text}\n\n${STOPPED_MARKER}`
        : STOPPED_MARKER,
  };
  messages = next;
}

/**
 * Stops the in-flight Tier-1 answer immediately (the view's Stop button).
 * Tells the daemon to cancel — `AgentConnection#cancel` never throws, even
 * with no live connection (the optional chaining below covers that case
 * too) — then, without waiting for any daemon response, marks the
 * in-progress assistant bubble as stopped (keeping whatever partial text
 * already streamed in) and clears `pending` so the input/Send re-enable
 * immediately. The connection itself is left open — RFC-034 Phase 4a: "the
 * session stays open for the next question" — only `newChat()` closes it.
 * A no-op when nothing is pending.
 */
export function cancelCurrent(): void {
  if (!pending) return;
  connection?.cancel();
  if (activeAssistantIndex !== null) {
    appendStoppedMarker(activeAssistantIndex);
  }
  pending = false;
  activeAssistantIndex = null;
}

/** View reads: past chat transcripts, most recent first (capped at
 * `SESSION_HISTORY_CAP`). */
export function getSessionHistory(): ChatSession[] {
  return sessionHistory;
}

/** View reads: non-null while revisiting a past session — the id into
 * `sessionHistory` currently shown instead of the live transcript. */
export function getViewingSessionId(): string | null {
  return viewingSessionId;
}

/** View reads: the full archived session currently being revisited, or
 * `null` when there isn't one (viewing the live transcript). */
export function getViewedSession(): ChatSession | null {
  if (!viewingSessionId) return null;
  return sessionHistory.find((s) => s.id === viewingSessionId) ?? null;
}

/**
 * Selects a past session for read-only revisit — the view swaps its
 * transcript to `getViewedSession()` and disables sending. The live
 * session keeps running in the background (a Tier-1 answer already
 * in flight is unaffected); `viewCurrentSession` switches back to it.
 *
 * // TODO(rfc-034-live-continue): reconnecting THIS archived session's own
 * daemon context (rather than only viewing its transcript) is a
 * nice-to-have graduation path — MVP ships read-only revisit only.
 */
export function viewSession(id: string): void {
  viewingSessionId = id;
}

/** Switches the view back to the live transcript. */
export function viewCurrentSession(): void {
  viewingSessionId = null;
}

/**
 * Archives the current transcript (if non-empty) into session history and
 * starts a fresh one. Closes any live Tier-1 connection so the next
 * question opens a brand-new daemon session — RFC-034's "New chat gets a
 * fresh agent context" contract — rather than continuing the old one's
 * accrued context. A no-op while a Tier-1 answer is still streaming in,
 * so an in-flight message is never discarded (call again once it settles).
 */
export function newChat(): void {
  if (pending) return;
  if (messages.length > 0) {
    const archived: ChatSession = {
      id: sessionId,
      title: sessionTitle(messages),
      messages,
      createdAt: Date.now(),
    };
    sessionHistory = [archived, ...sessionHistory].slice(
      0,
      SESSION_HISTORY_CAP,
    );
    persistSessionHistory();
  }
  connection?.close();
  connection = null;
  activeAssistantIndex = null;
  messages = [];
  sessionId = createSessionId();
  viewingSessionId = null;
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

/** Test/dev helper: resets the shared store to its initial state, including
 * session history (in-memory + persisted) so tests stay isolated. */
export function resetChat(): void {
  stopAgentProbe();
  messages = [];
  tier = "tier0";
  model = null;
  pending = false;
  activeAssistantIndex = null;
  sessionId = createSessionId();
  sessionHistory = [];
  viewingSessionId = null;
  clearSessionHistoryStorage();
}
