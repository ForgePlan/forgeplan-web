<script lang="ts">
  /**
   * MapChat — RFC-034 (Pillar C) chat panel. Tier 0 (client-grounded,
   * model-free, offline): answers come straight from the already-loaded
   * `MapDocument` via `chat-store.svelte.ts#send`. Tier 1 (Phase 3b): once
   * the store's daemon probe (started on mount) finds
   * `@forgeplan/web-agent` listening on `127.0.0.1`, `send` streams a live
   * answer into a progressively-updated assistant message instead. Both
   * tiers drive the map's existing camera through camera-bus when the
   * answer names a zone/node/flow. Pure presentation + local input state
   * here; composes `shared/ui` primitives only (rule 24) — no primitive
   * re-skinning, layout/positioning CSS lives on the mounting view
   * (ComposedMapView.svelte), not in this file.
   */
  import { onDestroy, onMount } from "svelte";
  import type { MapDocument } from "@/entities/map";
  import {
    getMessages,
    getModel,
    getTier,
    isPending,
    send,
    startAgentProbe,
    stopAgentProbe,
  } from "../model/chat-store.svelte";
  import { Badge, Button, Card, Input } from "@/shared/ui";

  let { doc, onClose }: { doc: MapDocument; onClose?: () => void } = $props();

  let question = $state("");
  let listEl = $state<HTMLDivElement | undefined>();

  const messages = $derived(getMessages());
  const tier = $derived(getTier());
  const model = $derived(getModel());
  const pending = $derived(isPending());
  const canSend = $derived(question.trim().length > 0 && !pending);

  onMount(() => {
    startAgentProbe();
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
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleSend();
  }

  // Auto-scroll to the newest message whenever the transcript grows.
  $effect(() => {
    if (messages.length === 0) return;
    listEl?.scrollTo({ top: listEl.scrollHeight });
  });
</script>

<Card
  variant="elevated"
  padding="none"
  class="map-chat"
  role="dialog"
  aria-label="Map assistant chat"
>
  {#snippet header()}
    <div class="mc-header">
      <span class="mc-title">Ask the map</span>
      <div class="mc-header-actions">
        <Badge variant={tier === "tier0" ? "mono" : "success"} size="sm">
          {tier === "tier0" ? "Offline (Tier 0)" : `● live — ${model ?? "agent"}`}
        </Badge>
        {#if onClose}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close chat"
            onclick={onClose}
          >
            ×
          </Button>
        {/if}
      </div>
    </div>
  {/snippet}

  <div class="mc-messages" bind:this={listEl} role="log" aria-live="polite">
    {#if messages.length === 0}
      <p class="mc-empty">
        Ask about a zone, module, or flow — answers come straight from the
        loaded map.
      </p>
    {/if}
    {#each messages as msg, i (i)}
      <div class="mc-msg mc-msg-{msg.role}">
        <span class="mc-role">{msg.role === "user" ? "You" : "Map"}</span>
        <p class="mc-text">{msg.text}</p>
      </div>
    {/each}
  </div>

  {#snippet footer()}
    <div class="mc-form">
      <div class="mc-input-wrap">
        <Input
          type="text"
          inputSize="sm"
          placeholder="Ask where something lives…"
          aria-label="Ask the map a question"
          bind:value={question}
          onkeydown={handleKeydown}
        />
      </div>
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
  {/snippet}
</Card>

<style>
  /* Rule 24: Card/Badge/Button/Input above are shared/ui primitives,
     unmodified — this file only lays out its own markup (message rows,
     header/footer chrome) and never reaches into a primitive's internals. */
  :global(.map-chat) {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .mc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .mc-title {
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 12.5px;
    color: var(--fg-1);
  }
  .mc-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mc-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mc-empty {
    margin: 0;
    color: var(--fg-3);
    font-size: 11.5px;
    line-height: 1.5;
  }

  .mc-msg {
    display: flex;
    flex-direction: column;
    gap: 2px;
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

  .mc-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mc-input-wrap {
    flex: 1;
    min-width: 0;
  }
</style>
