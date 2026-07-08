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
import type {
  AgentConnection,
  OtherAgentInstance,
  UsageDelta,
} from "./agent-client";
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

/** RFC-035 (chat panel v2) — which of the two panel tabs is active. Lives
 * here (not local component state) so it's the store's single source of
 * truth for anything the Info tab needs, matching how tier/model already
 * work; window geometry stays entirely inside the `FloatingWindow`
 * primitive (rule 24 — the store never duplicates that). */
export type ChatTab = "chat" | "info";

/** RFC-035 (Wave 2, FR-5) — accumulated token/cost totals for the Info tab.
 * `session` resets on `newChat()`; `cumulative` persists for the lifetime
 * of this page load. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface UsageSnapshot {
  session: TokenUsage;
  cumulative: TokenUsage;
}

const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

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
let activeTab = $state<ChatTab>("chat");
let sessionId = $state(createSessionId());
let sessionHistory = $state<ChatSession[]>(loadSessionHistory());
/** Non-null while the view is revisiting a past session read-only (MVP —
 * see `viewSession`'s TODO for the live-continue graduation path). */
let viewingSessionId = $state<string | null>(null);
/** RFC-035 (Wave 2, FR-5) — resets on `newChat()`. */
let sessionUsage = $state<TokenUsage>({ ...ZERO_USAGE });
/** RFC-035 (Wave 2, FR-5) — persists across `newChat()`, for the page's
 * lifetime. */
let cumulativeUsage = $state<TokenUsage>({ ...ZERO_USAGE });
/** RFC-035 (Wave 2, FR-6) — the other live instances reported by the most
 * recent `ready` frame; empty until the first one arrives (or if genuinely
 * alone on the machine). */
let otherInstances = $state<OtherAgentInstance[]>([]);

let connection: AgentConnection | null = null;
let activeAssistantIndex: number | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let agentPort = DEFAULT_AGENT_PORT;
/** Bugfix #1 (cross-turn frame race) — the turnId of the turn currently
 * being rendered, generated fresh per `send()` and threaded onto
 * `connection.send`/`user_message`. Every per-turn server frame echoes a
 * `turnId`; frames whose `turnId` doesn't match this are stale (from a
 * cancelled or otherwise superseded turn) and are dropped — see
 * `isCurrentTurn`. */
let currentTurnId: string | null = null;
/** Bugfix #9 (stale probe race) — bumped on every `startAgentProbe`/
 * `stopAgentProbe` call; a `checkDaemon` result only applies while its
 * captured generation is still current, so a fast close→reopen can't let
 * an older in-flight probe overwrite a newer result. */
let probeGeneration = 0;

function createSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTurnId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Bugfix #1 — `turnId === null` means "no correlation available" (older
 * daemon, or a cancel-triggered synthetic frame) and per
 * agent/lib/protocol.mjs's contract must be accepted as-is; otherwise the
 * frame only applies if it matches the turn currently being rendered. */
function isCurrentTurn(turnId: string | null): boolean {
  return turnId === null || turnId === currentTurnId;
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

/** View reads: which panel tab (Chat | Info) is active. */
export function getActiveTab(): ChatTab {
  return activeTab;
}

/** View writes: switches the active panel tab. Never touches `messages`/
 * `connection` — switching tabs must never interrupt a streaming answer or
 * reset scroll/in-flight state (RFC-035 FR-3), which is why the Chat
 * subtree stays mounted in the view (bits-ui's `Tabs.Content` hides
 * inactive panels via the `hidden` attribute, not by unmounting). */
export function setActiveTab(tab: ChatTab): void {
  activeTab = tab;
}

/** View reads (Info tab, RFC-035 Wave 2 FR-5): accumulated token/cost
 * totals — `session` since the current transcript started, `cumulative`
 * for the lifetime of this page load. Both stay all-zero (rendered as "—"
 * by the view) until the first `usage` frame arrives. */
export function getUsage(): UsageSnapshot {
  return { session: sessionUsage, cumulative: cumulativeUsage };
}

/** View reads (Info tab, RFC-035 Wave 2 FR-6): the other live
 * forgeplan-web/agent instances discovered via the daemon's `ready` frame.
 * Empty until the first `ready` frame arrives (or if genuinely alone). */
export function getOtherInstances(): OtherAgentInstance[] {
  return otherInstances;
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
  currentTurnId = null;
}

/** Bugfix #6 — `fatal` (echoed from the daemon's `error` frame) decides
 * whether this is a connection-ending failure or a recoverable per-turn
 * one. `fatal: true` tears the whole Tier-1 session down via
 * `fallBackToTier0`, same as before this fix. `fatal: false` means the
 * connection/session is still usable: the error text is appended to the
 * in-flight assistant bubble same as always, but `pending`/
 * `activeAssistantIndex` are simply cleared so the user can try another
 * question on the SAME live connection. */
function handleError(message: string, fatal: boolean): void {
  if (activeAssistantIndex !== null) {
    const existing = messages[activeAssistantIndex]?.text ?? "";
    appendDelta(
      activeAssistantIndex,
      existing.length > 0 ? `\n\n${message}` : message,
    );
  }
  if (fatal) {
    fallBackToTier0();
    return;
  }
  pending = false;
  activeAssistantIndex = null;
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

function addUsage(total: TokenUsage, delta: UsageDelta): TokenUsage {
  return {
    inputTokens: total.inputTokens + delta.inputTokens,
    outputTokens: total.outputTokens + delta.outputTokens,
    costUsd: total.costUsd + delta.costUsd,
  };
}

/** RFC-035 (Wave 2, FR-5) — one daemon `usage` frame (one per completed
 * turn); folded into both the current-session and page-lifetime totals. */
function handleUsage(delta: UsageDelta): void {
  sessionUsage = addUsage(sessionUsage, delta);
  cumulativeUsage = addUsage(cumulativeUsage, delta);
}

/** RFC-035 (Wave 2, FR-6) — the `ready` frame's instance-discovery
 * snapshot; `capabilities` isn't surfaced by the Info tab yet, so only
 * `otherInstances` is retained. */
function handleReadyMeta(meta: {
  capabilities: string[];
  otherInstances: OtherAgentInstance[];
}): void {
  otherInstances = meta.otherInstances;
}

function ensureConnection(): AgentConnection {
  if (connection) return connection;
  connection = connectAgent(agentPort, {
    // Bugfix #1 — every per-turn handler below drops a frame whose
    // `turnId` no longer matches the turn currently being rendered (a
    // cancelled-then-superseded turn's late frames land here too since the
    // daemon runs one persistent Query per connection). `onClose`/
    // `onReadyMeta` stay unguarded — they are connection-level, not
    // per-turn.
    onToken: (delta, turnId) => {
      if (!isCurrentTurn(turnId)) return;
      if (activeAssistantIndex !== null)
        appendDelta(activeAssistantIndex, delta);
    },
    onShowOnMap: (target, turnId) => {
      if (!isCurrentTurn(turnId)) return;
      handleShowOnMap(target);
    },
    onDone: (turnId) => {
      if (!isCurrentTurn(turnId)) return;
      handleDone();
    },
    onError: (message, fatal, turnId) => {
      if (!isCurrentTurn(turnId)) return;
      handleError(message, fatal);
    },
    onClose: fallBackToTier0,
    onUsage: (usage, turnId) => {
      if (!isCurrentTurn(turnId)) return;
      handleUsage(usage);
    },
    onReadyMeta: handleReadyMeta,
  });
  return connection;
}

function sendTier1(question: string): void {
  pending = true;
  currentTurnId = createTurnId();
  activeAssistantIndex = appendMessage("assistant", "");
  ensureConnection().send(question, currentTurnId);
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
 *
 * Bugfix #1 — also invalidates `currentTurnId`, so any frame from the
 * cancelled turn that arrives after this point (the daemon's `cancel`
 * interrupts the turn but doesn't guarantee no frames are already in
 * flight) no longer matches `isCurrentTurn` and is dropped rather than
 * corrupting whatever the user sends next.
 */
export function cancelCurrent(): void {
  if (!pending) return;
  connection?.cancel();
  if (activeAssistantIndex !== null) {
    appendStoppedMarker(activeAssistantIndex);
  }
  pending = false;
  activeAssistantIndex = null;
  currentTurnId = null;
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
  currentTurnId = null;
  messages = [];
  sessionId = createSessionId();
  viewingSessionId = null;
  sessionUsage = { ...ZERO_USAGE };
}

/**
 * Probes the daemon once and updates tier/model on success. Exposed
 * directly (not just via the interval) so callers — including tests —
 * can await a single check without waiting on `PROBE_INTERVAL_MS`. A
 * down result only reverts to Tier 0 when there's no live connection
 * already open — an established Tier-1 session's own onError/onClose is
 * the source of truth for *that* session dropping, not a parallel probe.
 *
 * Bugfix #9 — captures `probeGeneration` before awaiting the (~1.5s
 * timeout) probe and re-checks it on resolve: a fast close→reopen bumps
 * the generation via `stopAgentProbe`/`startAgentProbe`, so an
 * older in-flight probe's result is discarded instead of overwriting a
 * newer one that already landed.
 */
export async function checkDaemon(
  port: number = DEFAULT_AGENT_PORT,
): Promise<void> {
  agentPort = port;
  const generation = probeGeneration;
  const result = await probeDaemon(port);
  if (generation !== probeGeneration) return; // superseded by a newer probe
  if (result.up) {
    tier = "tier1";
    model = result.model ?? null;
    // RFC-035 (Wave 2 follow-up) — the probe now carries the same
    // otherInstances snapshot the `ready` frame does, so the Info tab's
    // "Other projects" row populates on chat open, before any WebSocket
    // connects. Whichever of the probe (every PROBE_INTERVAL_MS) or a live
    // `ready` frame (handleReadyMeta) fired most recently wins — both write
    // the same store field.
    otherInstances = result.otherInstances ?? [];
  } else if (!connection) {
    tier = "tier0";
    model = null;
  }
}

/** View lifecycle (MapChat onMount): start probing for the daemon.
 * Idempotent — a second call while a timer is already running is a
 * no-op. Bugfix #9 — bumps `probeGeneration` so a probe left in flight
 * from a just-stopped probe cycle (see `stopAgentProbe`) can never
 * overwrite the state this fresh cycle establishes. */
export function startAgentProbe(port: number = DEFAULT_AGENT_PORT): void {
  if (probeTimer) return;
  probeGeneration++;
  void checkDaemon(port);
  probeTimer = setInterval(() => void checkDaemon(port), PROBE_INTERVAL_MS);
}

/** View lifecycle (MapChat onDestroy): stop probing and tear down any
 * live connection/pending state.
 *
 * Bugfix #2 — closing the connection directly here (the old behaviour)
 * left `pending`/`activeAssistantIndex` stuck if a Tier-1 answer was mid
 * stream when the panel closed: `newChat()` no-ops while `pending`, so a
 * later remount with a fresh probe couldn't clear the orphaned
 * "● thinking…" bubble. Routing through `fallBackToTier0` clears that
 * state the same way any other connection teardown does.
 *
 * Bugfix #9 — bumps `probeGeneration` so a probe already in flight when
 * the panel closes can't land after this call and resurrect tier1 state
 * for a connection that no longer exists.
 */
export function stopAgentProbe(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  probeGeneration++;
  fallBackToTier0();
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
  currentTurnId = null;
  sessionId = createSessionId();
  sessionHistory = [];
  viewingSessionId = null;
  sessionUsage = { ...ZERO_USAGE };
  cumulativeUsage = { ...ZERO_USAGE };
  otherInstances = [];
  clearSessionHistoryStorage();
}
