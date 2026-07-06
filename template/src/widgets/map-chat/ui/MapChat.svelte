<script lang="ts">
  /**
   * MapChat — RFC-034 (Pillar C) chat panel, full UI upgrade. A wide
   * right-side drawer (not the original small card) that composes:
   * `ChatMarkdown` for assistant answers (real markdown — headings, bold,
   * lists, code, links — instead of raw `**`/`##`), `shared/ui`'s
   * `ScrollArea` for the message list, and `chat-store.svelte.ts`'s session
   * history (New chat / past-session revisit) on top of the existing
   * Tier 0 (client-grounded, model-free, offline) / Tier 1 (live
   * `@forgeplan/web-agent` daemon, streamed) split. Both tiers drive the
   * map's existing camera through camera-bus when an answer names a
   * zone/node/flow — rendered here as a small "→ <label>" chip under the
   * message that triggered it.
   *
   * Pure presentation + local input/scroll state here; composes
   * `shared/ui` primitives only (rule 24) — no primitive re-skinning.
   * `position: fixed` on the root is deliberate: the mounting wrapper in
   * ComposedMapView.svelte (`.map-chat-pos`) is a small `position: absolute`
   * box sized for the previous, narrower card. Escaping to a fixed,
   * viewport-anchored panel is how this file alone can become "wider and
   * roomier" without touching that wrapper (out of scope for this pass —
   * no ancestor between here and the viewport sets a `transform`/`filter`/
   * `contain`, so `position: fixed` resolves against the viewport as
   * expected).
   */
  import { onDestroy, onMount } from "svelte";
  import type { MapDocument } from "@/entities/map";
  import {
    getMessages,
    getModel,
    getSessionHistory,
    getTier,
    getViewedSession,
    getViewingSessionId,
    isPending,
    newChat,
    send,
    startAgentProbe,
    stopAgentProbe,
    viewCurrentSession,
    viewSession,
  } from "../model/chat-store.svelte";
  import type { CameraTarget } from "@/widgets/composed-map/model/camera-bus.svelte";
  import {
    Badge,
    Button,
    Popover,
    PopoverTrigger,
    PopoverContent,
    ScrollArea,
    Separator,
  } from "@/shared/ui";
  import ChatMarkdown from "./ChatMarkdown.svelte";
  import History from "@lucide/svelte/icons/history";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import X from "@lucide/svelte/icons/x";

  let { doc, onClose }: { doc: MapDocument; onClose?: () => void } = $props();

  const TEXTAREA_LINE_HEIGHT_PX = 18;
  const TEXTAREA_MAX_LINES = 4;
  const TEXTAREA_VERTICAL_PADDING_PX = 16;
  const NEAR_BOTTOM_THRESHOLD_PX = 48;

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
  const canSend = $derived(
    question.trim().length > 0 && !pending && !isViewingPast,
  );
  const tierLabel = $derived(
    tier === "tier1" ? `● live — ${model ?? "agent"}` : "offline · Tier 0",
  );
  const isStreamingLast = $derived(
    !isViewingPast && pending && messages[messages.length - 1]?.role === "assistant",
  );

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
    send(doc, question);
    question = "";
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
</script>

<div class="map-chat" role="dialog" aria-label="Map assistant chat">
  <div class="mc-header">
    <div class="mc-header-titles">
      <span class="mc-title">Ask the map</span>
      <Badge variant={tier === "tier1" ? "success" : "mono"} size="sm">
        {tierLabel}
      </Badge>
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
      {#if onClose}
        <Button variant="ghost" size="icon" aria-label="Close chat" onclick={onClose}>
          <X size={14} />
        </Button>
      {/if}
    </div>
  </div>

  <div class="mc-body">
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
            Ask about a zone, module, or flow — answers come straight from the
            loaded map.
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
  </div>

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
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={!canSend}
        onclick={handleSend}
      >
        Send
      </Button>
    </div>
  </div>
</div>

<style>
  /* Rule 24: Badge/Button/Popover/ScrollArea/Separator above are shared/ui
     primitives, unmodified — this file only lays out its own markup
     (header/body/form chrome, message rows) and never reaches into a
     primitive's internals. */
  :global(.map-chat) {
    position: fixed;
    top: 16px;
    right: 12px;
    bottom: 16px;
    z-index: 40;
    width: min(420px, 92vw);
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 10px;
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .mc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
    flex: none;
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
