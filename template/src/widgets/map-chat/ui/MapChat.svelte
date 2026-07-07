<script lang="ts">
  /**
   * MapChat — RFC-034 (Pillar C) chat panel; RFC-035 Wave 1 upgraded the
   * shell from a fixed right-docked drawer into a floatable/dockable/
   * resizable `FloatingWindow` with a Chat|Info `Tabs` split. Composes:
   * `ChatMarkdown` for assistant answers (real markdown — headings, bold,
   * lists, code, links — instead of raw `**`/`##`), `shared/ui`'s
   * `ScrollArea` for the message list, `shared/ui`'s `Code` for the offline
   * call-to-action's copyable command, and `chat-store.svelte.ts`'s session
   * history (New chat / past-session revisit) on top of the daemon-only
   * (Tier 1, live `@forgeplan/web-agent`, streamed) answering path. There is
   * no client-side fallback answerer any more — when the daemon isn't
   * detected (`tier !== "tier1"`) and we aren't revisiting an archived
   * session, the body shows an offline call-to-action instead of the
   * message list + input, so the chat never fabricates an answer; the
   * probe (`startAgentProbe`) keeps polling in the background and the
   * normal chat appears automatically once it flips to "tier1". Both the
   * live chat and archived sessions drive the map's existing camera through
   * camera-bus when an answer names a zone/node/flow — rendered here as a
   * small "→ <label>" chip under the message that triggered it.
   *
   * Pure presentation + local input/scroll state here; composes
   * `shared/ui` primitives only (rule 24) — no primitive re-skinning. The
   * `FloatingWindow` primitive owns all positioning (fixed root, docked/
   * floating mode, drag, resize, viewport-clamp, localStorage persistence);
   * this file only supplies its header chrome (status, New chat, sessions,
   * the Chat|Info tab triggers) and body (the two `TabsContent` panes). The
   * mounting wrapper in ComposedMapView.svelte is a bare, unstyled `<div
   * id="map-chat-panel">` (no position/z-index of its own — that CSS was
   * deliberately removed, since it would establish a stacking context that
   * traps this file's `position: fixed` root inside it); the div exists
   * only as the launcher button's `aria-controls` anchor. `FloatingWindow`'s
   * own root escapes to the viewport the same way the old `.map-chat` root
   * did (no ancestor between here and the viewport sets a
   * `transform`/`filter`/`contain`, and now none sets `position`+`z-index`
   * either).
   */
  import { onDestroy, onMount } from "svelte";
  import type { MapDocument } from "@/entities/map";
  import {
    cancelCurrent,
    getActiveTab,
    getMessages,
    getModel,
    getOtherInstances,
    getSessionHistory,
    getTier,
    getUsage,
    getViewedSession,
    getViewingSessionId,
    isPending,
    newChat,
    send,
    setActiveTab,
    startAgentProbe,
    stopAgentProbe,
    viewCurrentSession,
    viewSession,
  } from "../model/chat-store.svelte";
  import type { ChatTab } from "../model/chat-store.svelte";
  import type { CameraTarget } from "@/widgets/composed-map/model/camera-bus.svelte";
  import {
    Button,
    Code,
    FloatingWindow,
    Popover,
    PopoverTrigger,
    PopoverContent,
    ScrollArea,
    Separator,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/shared/ui";
  import ChatMarkdown from "./ChatMarkdown.svelte";
  import History from "@lucide/svelte/icons/history";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";

  let { doc, onClose }: { doc: MapDocument; onClose?: () => void } = $props();

  const TEXTAREA_LINE_HEIGHT_PX = 18;
  const TEXTAREA_MAX_LINES = 4;
  const TEXTAREA_VERTICAL_PADDING_PX = 16;
  const NEAR_BOTTOM_THRESHOLD_PX = 48;
  const ONBOARD_AGENT_COMMAND = "npx @forgeplan/web onboard-agent";

  // RFC-035 Wave 1 — static, read-only agent profile (agent/lib/profile.mjs).
  // Surfaced verbatim in the Info tab; there is no runtime introspection of
  // the daemon's actual tool grants yet (Wave 2), so this mirrors the
  // daemon's own known constants rather than deriving them.
  const ALLOWED_TOOLS = "Read, Glob, Grep, show_on_map";
  const DISALLOWED_TOOLS = "Write, Edit, Bash";

  let question = $state("");
  let textareaEl = $state<HTMLTextAreaElement | undefined>();
  let viewportEl = $state<HTMLDivElement | null>(null);
  let sessionsOpen = $state(false);
  let isNearBottom = $state(true);
  let reducedMotion = $state(false);

  const tier = $derived(getTier());
  const model = $derived(getModel());
  const pending = $derived(isPending());
  const sessionHistory = $derived(getSessionHistory());
  const viewingSessionId = $derived(getViewingSessionId());
  const viewedSession = $derived(getViewedSession());
  const isViewingPast = $derived(viewingSessionId !== null);
  const messages = $derived(
    isViewingPast ? (viewedSession?.messages ?? []) : getMessages(),
  );
  /** True when there is no live daemon to answer, we aren't passively
   * revisiting an already-answered archived session, AND the transcript is
   * genuinely empty — the one state in which the chat body must show the
   * offline call-to-action instead of a message list + input (AI-only: no
   * client-side fallback answerer).
   *
   * Bugfix #5 — this used to ignore `messages.length`, so the instant
   * `handleError` appended the daemon's error text and synchronously fell
   * back to tier0 (chat-store's `fallBackToTier0`), the transcript
   * (including that error) was yanked off-screen in favour of a blank
   * "isn't running" CTA. Gating on `messages.length === 0` keeps any
   * existing transcript — error text included — visible; the offline CTA
   * is reserved for the case where there is truly nothing to show yet. */
  const isOffline = $derived(
    !isViewingPast && tier !== "tier1" && messages.length === 0,
  );
  const canSend = $derived(
    question.trim().length > 0 &&
      !pending &&
      !isViewingPast &&
      tier === "tier1",
  );
  /** True while a Tier-1 answer is streaming — the form's Send button
   * swaps to Stop in this state (Phase 4a: cancel a streaming answer). */
  const showStop = $derived(pending && !isViewingPast);
  /** RFC-035 FR-2 — the compact header/Info-tab status word; the old
   * verbose "● live — {model}" string is gone, the model itself moved to
   * the Info tab (FR-4). */
  const statusWord = $derived(tier === "tier1" ? "online" : "offline");
  /** RFC-035 FR-3 — which panel tab is active, driven by the store so the
   * Info tab (FR-4) can read the same source of truth. */
  const activeTab = $derived(getActiveTab());
  const isStreamingLast = $derived(
    !isViewingPast && pending && messages[messages.length - 1]?.role === "assistant",
  );
  // RFC-035 Wave 2 (FR-5/FR-6) — Info tab live data.
  const usage = $derived(getUsage());
  const otherInstances = $derived(getOtherInstances());
  const hasUsage = $derived(
    usage.cumulative.inputTokens > 0 || usage.cumulative.outputTokens > 0,
  );

  /** Thousands-separated token count, locale-pinned so the format doesn't
   * drift with the host's `Intl` default. */
  function formatTokenCount(n: number): string {
    return n.toLocaleString("en-US");
  }

  function formatCostUsd(costUsd: number): string {
    return `$${costUsd.toFixed(4)}`;
  }

  function otherInstanceLabel(instance: { projectName: string; port: number }): string {
    return `${instance.projectName}:${instance.port}`;
  }

  /** Human label for a camera-bus target, read straight from the loaded
   * `MapDocument` — never fabricated (falls back to the raw id only if the
   * zone/node/flow can no longer be found, e.g. a stale target after the map
   * reloaded). */
  function targetLabel(target: CameraTarget): string {
    if (target.kind === "zone") {
      return doc.zones.find((z) => z.id === target.id)?.label ?? target.id;
    }
    if (target.kind === "node") {
      return doc.nodes.find((n) => n.id === target.id)?.label ?? target.id;
    }
    return (doc.flows ?? []).find((f) => f.id === target.id)?.name ?? target.id;
  }

  onMount(() => {
    startAgentProbe();
    textareaEl?.focus();
  });
  onDestroy(() => {
    stopAgentProbe();
  });

  function handleSend(): void {
    if (!canSend) return;
    send(question);
    question = "";
  }

  function handleStop(): void {
    cancelCurrent();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleSend();
  }

  function resizeTextarea(): void {
    const el = textareaEl;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight =
      TEXTAREA_LINE_HEIGHT_PX * TEXTAREA_MAX_LINES + TEXTAREA_VERTICAL_PADDING_PX;
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  // Re-measure on every change to `question` — covers both user typing
  // (bind:value) and the programmatic clear in handleSend, so the textarea
  // shrinks back to one line after sending without a separate code path.
  $effect(() => {
    question;
    resizeTextarea();
  });

  function handleViewportScroll(event: Event): void {
    const el = event.currentTarget as HTMLDivElement;
    isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
  }

  function scrollToBottom(smooth: boolean): void {
    viewportEl?.scrollTo({
      top: viewportEl.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  function jumpToLatest(): void {
    isNearBottom = true;
    scrollToBottom(!reducedMotion);
  }

  // Auto-stick to the newest message ONLY while already near the bottom —
  // a user who scrolled up to reread something earlier is never yanked back
  // down; they get the "Jump to latest" affordance instead.
  $effect(() => {
    if (messages.length === 0 || !isNearBottom) return;
    requestAnimationFrame(() => scrollToBottom(!reducedMotion));
  });

  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  function openCurrentSession(): void {
    viewCurrentSession();
    sessionsOpen = false;
  }

  function openSession(id: string): void {
    viewSession(id);
    sessionsOpen = false;
  }

  /** RFC-035 FR-3 — `Tabs`'s `onValueChange` hands back a plain `string`
   * (bits-ui's contract); narrow it to `ChatTab` before writing the store,
   * since the only values that can ever reach here are the two
   * `TabsTrigger` values below ("chat" / "info"). */
  function handleTabChange(next: string): void {
    setActiveTab(next as ChatTab);
  }
</script>

{#snippet statusIndicator()}
  <span class="mc-status" class:online={tier === "tier1"}>
    <span class="mc-status-dot" aria-hidden="true"></span>
    {statusWord}
  </span>
{/snippet}

<Tabs value={activeTab} onValueChange={handleTabChange}>
  <FloatingWindow
    storageKey="map-chat"
    ariaLabel="Map assistant chat"
    closeAriaLabel="Close chat"
    onClose={onClose}
  >
    {#snippet header()}
      <div class="mc-header-block">
        <div class="mc-header-row">
          <div class="mc-header-titles">
            <span class="mc-title">Ask the map</span>
            {@render statusIndicator()}
          </div>
          <div class="mc-header-actions">
            <Button variant="ghost" size="sm" disabled={pending} onclick={() => newChat()}>
              <SquarePen size={13} />
              New chat
            </Button>
            <Popover bind:open={sessionsOpen}>
              <PopoverTrigger class="mc-sessions-trigger">
                <Button variant="ghost" size="icon" aria-label="Chat sessions">
                  <History size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" class="mc-sessions-menu">
                <div class="mc-sessions-list" role="menu" aria-label="Chat sessions">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="mc-session-item"
                    aria-current={!isViewingPast ? "true" : undefined}
                    onclick={openCurrentSession}
                  >
                    Current chat
                  </Button>
                  {#if sessionHistory.length > 0}
                    <Separator />
                    {#each sessionHistory as session (session.id)}
                      <Button
                        variant="ghost"
                        size="sm"
                        class="mc-session-item"
                        aria-current={viewingSessionId === session.id ? "true" : undefined}
                        onclick={() => openSession(session.id)}
                      >
                        {session.title}
                      </Button>
                    {/each}
                  {:else}
                    <p class="mc-sessions-empty">No past sessions yet.</p>
                  {/if}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <TabsList class="mc-tabs-list" ariaLabel="Chat panel sections">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
      </div>
    {/snippet}

    <TabsContent value="chat" class="mc-tab-chat">
      <div class="mc-body">
        {#if isOffline}
          <div class="mc-offline" role="status">
            <p class="mc-offline-msg">The live assistant isn't running.</p>
            <p class="mc-offline-label">Start it in your project to chat:</p>
            <Code code={ONBOARD_AGENT_COMMAND} ariaLabel="onboard-agent command" />
            <p class="mc-offline-hint">
              The chat connects automatically once the agent is running.
            </p>
          </div>
        {:else}
          <ScrollArea
            class="mc-scroll"
            viewportClass="mc-messages"
            bind:viewportRef={viewportEl}
            onViewportScroll={handleViewportScroll}
          >
            <div
              class="mc-messages-inner"
              role="log"
              aria-live="polite"
              aria-label="Chat transcript"
            >
              {#if messages.length === 0}
                <p class="mc-empty">
                  Ask anything about this project — the live assistant reads your
                  code, .forgeplan/, and the map to answer, and moves the map as
                  it explains.
                </p>
              {/if}
              {#each messages as msg, i (i)}
                {@const streamingThis = isStreamingLast && i === messages.length - 1}
                <div class="mc-msg mc-msg-{msg.role}">
                  <span class="mc-role">{msg.role === "user" ? "You" : "Map"}</span>
                  {#if msg.role === "assistant"}
                    <div class="mc-assistant-body">
                      <ChatMarkdown text={msg.text} />
                      {#if streamingThis}
                        {#if msg.text.length === 0}
                          <span class="mc-thinking">● thinking…</span>
                        {:else}
                          <span class="mc-caret" aria-hidden="true"></span>
                        {/if}
                      {/if}
                    </div>
                  {:else}
                    <p class="mc-text">{msg.text}</p>
                  {/if}
                  {#if msg.target}
                    <span class="mc-target-chip">→ {targetLabel(msg.target)}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </ScrollArea>
          {#if !isNearBottom && messages.length > 0}
            <div class="mc-jump-wrap">
              <Button variant="secondary" size="sm" onclick={jumpToLatest}>
                <ArrowDown size={12} />
                Jump to latest
              </Button>
            </div>
          {/if}
        {/if}
      </div>

      {#if !isOffline}
        <div class="mc-form">
          {#if isViewingPast}
            <p class="mc-viewing-hint" role="status">
              Viewing a past chat.
              <Button variant="ghost" size="sm" onclick={openCurrentSession}>
                Return to current chat
              </Button>
            </p>
          {/if}
          <div class="mc-input-row">
            <textarea
              bind:this={textareaEl}
              bind:value={question}
              class="mc-textarea"
              rows="1"
              placeholder="Ask where something lives…"
              aria-label="Ask the map a question"
              disabled={isViewingPast}
              onkeydown={handleKeydown}
            ></textarea>
            {#if showStop}
              <Button type="button" variant="secondary" size="sm" onclick={handleStop}>
                Stop
              </Button>
            {:else}
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!canSend}
                onclick={handleSend}
              >
                Send
              </Button>
            {/if}
          </div>
        </div>
      {/if}
    </TabsContent>

    <TabsContent value="info" class="mc-tab-info">
      <dl class="mc-info-dl">
        <div class="mc-info-row">
          <dt>Status</dt>
          <dd>{@render statusIndicator()}</dd>
        </div>
        <div class="mc-info-row">
          <dt>Model</dt>
          <dd>{model ?? "—"}</dd>
        </div>
        <div class="mc-info-row">
          <dt>Allowed tools</dt>
          <dd>{ALLOWED_TOOLS}</dd>
        </div>
        <div class="mc-info-row">
          <dt>Disallowed tools</dt>
          <dd>{DISALLOWED_TOOLS}</dd>
        </div>
        <div class="mc-info-row">
          <dt>Notes</dt>
          <dd>Read-only agent.</dd>
        </div>
        <div class="mc-info-row">
          <dt>Token usage</dt>
          <dd>
            {#if !hasUsage}
              —
            {:else}
              <div class="mc-usage-line">
                input {formatTokenCount(usage.session.inputTokens)} · output {formatTokenCount(
                  usage.session.outputTokens,
                )}
                {#if usage.session.costUsd > 0}
                  · {formatCostUsd(usage.session.costUsd)}
                {/if}
              </div>
              <div class="mc-usage-line mc-usage-cumulative">
                cumulative: input {formatTokenCount(
                  usage.cumulative.inputTokens,
                )} · output {formatTokenCount(usage.cumulative.outputTokens)}
                {#if usage.cumulative.costUsd > 0}
                  · {formatCostUsd(usage.cumulative.costUsd)}
                {/if}
              </div>
            {/if}
          </dd>
        </div>
        <div class="mc-info-row">
          <dt>Other projects</dt>
          <dd>
            {#if otherInstances.length === 0}
              just this one
            {:else}
              sees {otherInstances.length} other · {otherInstances
                .map(otherInstanceLabel)
                .join(", ")}
            {/if}
          </dd>
        </div>
      </dl>
    </TabsContent>
  </FloatingWindow>
</Tabs>

<style>
  /* Rule 24: Button/Code/Popover/ScrollArea/Separator/Tabs* below are
     shared/ui primitives, unmodified — this file only lays out its own
     markup (header/body/form chrome, message rows, offline CTA copy, Info
     tab rows) and never reaches into a primitive's internals. `FloatingWindow`
     owns the window shell (docked/floating/resize/position) entirely — this
     file supplies only its `header` snippet + body content. `.mc-tab-chat` /
     `.mc-tab-info` / `.mc-tabs-list` below are consumer-supplied classes
     forwarded onto `TabsContent`/`TabsList` roots for layout only (flex
     sizing, spacing) — not chrome — the sanctioned rule-24 extension point,
     same shape as this file's own pre-existing `.mc-jump-wrap :global(.btn)`. */

  .mc-header-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-width: 0;
  }
  .mc-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }
  .mc-header-titles {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .mc-title {
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 12.5px;
    color: var(--fg-1);
    white-space: nowrap;
  }
  .mc-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
  }

  /* RFC-035 FR-2 — compact status dot replacing the old verbose Badge. */
  .mc-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.03em;
    color: var(--fg-3);
    white-space: nowrap;
  }
  .mc-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--danger);
    flex: none;
  }
  .mc-status.online {
    color: var(--fg-2);
  }
  .mc-status.online .mc-status-dot {
    background: var(--ok);
  }

  :global(.mc-tabs-list) {
    margin-top: 2px;
  }

  /* Layout-only overrides on the forwarded TabsContent class — see rule-24
     note at the top of this style block. `:not([hidden])` matters here:
     bits-ui toggles the inactive panel via the native `hidden` attribute
     (kept mounted, never unmounted — RFC-035 FR-3), which the browser's own
     UA stylesheet hides via `[hidden] { display: none }`. Author CSS wins
     over that UA rule regardless of selector specificity (origin beats
     specificity in the cascade), so an unconditional `display: flex` here
     would defeat `hidden` and show BOTH panels stacked at once — scoping
     every layout declaration to `:not([hidden])` lets the attribute govern
     visibility while this class only supplies layout for the active pane. */
  :global(.mc-tab-chat:not([hidden])) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 0;
  }
  :global(.mc-tab-info:not([hidden])) {
    display: block;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 14px 16px;
  }

  .mc-info-dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mc-info-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mc-info-row dt {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-3);
  }
  .mc-info-row dd {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--fg-1);
  }
  .mc-info-hint {
    margin-left: 4px;
    color: var(--fg-3);
    font-size: 10.5px;
    font-style: italic;
  }
  /* RFC-035 Wave 2 — token usage's two lines (this-session + cumulative). */
  .mc-usage-line {
    display: block;
  }
  .mc-usage-cumulative {
    margin-top: 2px;
    color: var(--fg-3);
    font-size: 10.5px;
  }

  .mc-sessions-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 200px;
  }
  :global(.mc-session-item) {
    justify-content: flex-start;
    text-align: left;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mc-sessions-empty {
    margin: 4px 6px;
    color: var(--fg-3);
    font-size: 11px;
  }

  .mc-body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  :global(.mc-scroll) {
    flex: 1;
    min-height: 0;
  }
  :global(.mc-messages) {
    padding: 10px 14px;
  }
  .mc-messages-inner {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mc-empty {
    margin: 0;
    color: var(--fg-3);
    font-size: 11.5px;
    line-height: 1.5;
  }

  .mc-offline {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px 22px;
    text-align: center;
  }
  .mc-offline-msg {
    margin: 0;
    color: var(--fg-1);
    font-size: 12.5px;
    line-height: 1.5;
  }
  .mc-offline-label {
    margin: 4px 0 0;
    color: var(--fg-3);
    font-size: 11px;
  }
  .mc-offline-hint {
    margin: 4px 0 0;
    max-width: 280px;
    color: var(--fg-3);
    font-size: 10.5px;
    line-height: 1.5;
  }

  .mc-jump-wrap {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 10px;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .mc-jump-wrap :global(.btn) {
    pointer-events: auto;
    box-shadow: var(--shadow-mini);
  }

  .mc-msg {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
  }
  .mc-role {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-3);
  }
  .mc-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--fg-1);
    white-space: pre-wrap;
  }
  .mc-msg-user .mc-role {
    color: var(--accent);
  }
  .mc-assistant-body {
    width: 100%;
  }

  .mc-thinking {
    display: inline-flex;
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .mc-caret {
    display: inline-block;
    width: 2px;
    height: 12px;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: var(--accent);
    animation: mc-caret-blink 1s step-end infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .mc-caret {
      animation: none;
      opacity: 0.6;
    }
  }
  @keyframes mc-caret-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  .mc-target-chip {
    display: inline-flex;
    align-items: center;
    margin-top: 2px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .mc-form {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid var(--line);
  }
  .mc-viewing-hint {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    color: var(--fg-3);
    font-size: 11px;
  }
  .mc-input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .mc-textarea {
    flex: 1;
    min-width: 0;
    min-height: 30px;
    max-height: 88px;
    resize: none;
    box-sizing: border-box;
    background: var(--bg-1);
    color: var(--fg-1);
    border: 1px solid var(--line-2);
    border-radius: 4px;
    padding: 6px 10px;
    font-family: var(--font-sans);
    font-size: 12px;
    line-height: 1.5;
    outline: none;
    transition: border-color 120ms ease;
  }
  .mc-textarea:focus-visible {
    border-color: var(--accent);
  }
  .mc-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* TODO(shared-ui-textarea): no shared/ui multi-line text primitive exists
     yet (Input is single-line only) — this is the one hand-styled control
     in the file. Promote to shared/ui/textarea (rule 24) if a second
     caller needs a growing textarea. */
</style>
