<script lang="ts">
  /**
   * ChatMarkdown — RFC-034 (Pillar C) chat UI upgrade, Phase A. Renders an
   * assistant message's markdown properly instead of the raw `**`/`##`
   * text MapChat showed before this component existed. Built on
   * svelte-exmarkdown (Svelte-5-native, reactive: `<Markdown md={text}>`
   * re-parses as `text` grows, so a Tier-1 answer streaming token-by-token
   * renders progressively without re-mounting) + its `gfmPlugin` (tables,
   * task lists, strikethrough) + rehype-highlight (lowlight) for
   * fenced-code syntax highlighting.
   *
   * Styling is TOKEN-ONLY: highlighted-code `.hljs-*` classes below are
   * mapped straight to our existing --fg/--accent/--good/--bad tokens
   * (no vendored highlight.js theme CSS, no hardcoded hex) — this makes
   * syntax highlighting dual-theme-correct for free, the same way every
   * other token already flips on `data-theme`. `<a>` gets a dedicated
   * renderer component (MdLink) for target=_blank+rel — the one piece
   * that needs real behaviour, not just CSS. Everything else
   * (headings/lists/paragraphs/tables/blockquote/code) is styled via
   * `:global()` selectors scoped under `.chat-md`, over this component's
   * own rendered subtree — the same pattern already used by
   * ArtifactPanel's `{@html}` markdown body (rule 24's documented
   * own-subtree exception; this file reaches into nothing outside itself).
   *
   * `denylist(["script", "iframe"])` is a defence-in-depth backstop:
   * svelte-exmarkdown never uses `{@html}` (raw HTML embedded in markdown
   * parses to an inert hast "raw" text node and is rendered via a plain
   * Svelte text interpolation, never executed), so this mainly guards
   * against a future rehype plugin reintroducing raw HTML elements.
   *
   * `<svelte:boundary>` is the safety net for the "never throws on a
   * growing/partial string" contract: CommonMark itself can't fail to
   * parse (any string is a valid document) and `ignoreMissing: true`
   * stops rehype-highlight from throwing on an unrecognised fence
   * language, but a render-time surprise still falls back to the raw
   * text rather than blanking the message bubble.
   */
  import Markdown, { denylist } from "svelte-exmarkdown";
  import { gfmPlugin } from "svelte-exmarkdown/gfm";
  import rehypeHighlight from "rehype-highlight";
  import type { Plugin } from "svelte-exmarkdown";
  import MdLink from "./MdLink.svelte";

  let { text }: { text: string } = $props();

  const plugins: Plugin[] = [
    gfmPlugin(),
    { rehypePlugin: [rehypeHighlight, { ignoreMissing: true }] },
    denylist(["script", "iframe"]),
    { renderer: { a: MdLink } },
  ];
</script>

<div class="chat-md">
  <svelte:boundary>
    <Markdown md={text} {plugins} />
    {#snippet failed()}
      <p class="chat-md-fallback">{text}</p>
    {/snippet}
  </svelte:boundary>
</div>

<style>
  .chat-md {
    font-family: var(--font-sans);
    font-size: 12px;
    line-height: 1.5;
    color: var(--fg-1);
  }
  .chat-md-fallback {
    margin: 0;
    white-space: pre-wrap;
    color: var(--fg-1);
  }

  /* Block spacing — sensible for a chat bubble (tighter than a full
     document panel): first/last child collapse their outer margin so a
     one-line answer doesn't add extra air above/below. */
  .chat-md :global(> :first-child) {
    margin-top: 0;
  }
  .chat-md :global(> :last-child) {
    margin-bottom: 0;
  }

  .chat-md :global(p) {
    margin: 6px 0;
  }
  .chat-md :global(h1),
  .chat-md :global(h2),
  .chat-md :global(h3),
  .chat-md :global(h4),
  .chat-md :global(h5),
  .chat-md :global(h6) {
    margin: 10px 0 4px;
    color: var(--fg);
    font-weight: 600;
    line-height: 1.3;
  }
  .chat-md :global(h1) {
    font-size: 14px;
  }
  .chat-md :global(h2) {
    font-size: 13.5px;
  }
  .chat-md :global(h3),
  .chat-md :global(h4),
  .chat-md :global(h5),
  .chat-md :global(h6) {
    font-size: 12.5px;
  }

  .chat-md :global(ul),
  .chat-md :global(ol) {
    margin: 6px 0;
    padding-left: 20px;
  }
  .chat-md :global(li) {
    margin: 2px 0;
  }
  .chat-md :global(li > p) {
    margin: 0;
  }

  .chat-md :global(blockquote) {
    margin: 6px 0;
    padding-left: 10px;
    border-left: 2px solid var(--accent);
    color: var(--fg-2);
  }

  .chat-md :global(hr) {
    margin: 10px 0;
    border: none;
    border-top: 1px solid var(--line);
  }

  .chat-md :global(table) {
    margin: 6px 0;
    border-collapse: collapse;
    font-size: 11.5px;
    max-width: 100%;
  }
  .chat-md :global(th),
  .chat-md :global(td) {
    border: 1px solid var(--line);
    padding: 3px 6px;
    text-align: left;
  }
  .chat-md :global(th) {
    background: var(--bg-2);
    font-weight: 600;
    color: var(--fg);
  }

  .chat-md :global(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  /* Inline code — a small chip, matching shared/ui/code's `.inline` look. */
  .chat-md :global(code) {
    background: var(--bg-2);
    border-radius: 2px;
    padding: 1px 4px;
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  /* Fenced code blocks — rehype-highlight wraps these in
     <pre><code class="hljs language-xxx">, so `pre code` resets the
     inline chip styling and the block itself carries the bg/border. */
  .chat-md :global(pre) {
    margin: 6px 0;
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: 3px;
    padding: 8px 10px;
    overflow-x: auto;
    max-width: 100%;
  }
  .chat-md :global(pre code) {
    background: transparent;
    padding: 0;
    font-size: 11.5px;
    white-space: pre;
  }

  /* Syntax-highlighting tokens (rehype-highlight / lowlight's `.hljs-*`
     classes) — mapped straight to design tokens, no vendored theme CSS,
     so highlighting stays correct in both themes automatically. */
  .chat-md :global(.hljs-comment),
  .chat-md :global(.hljs-quote) {
    color: var(--fg-3);
    font-style: italic;
  }
  .chat-md :global(.hljs-keyword),
  .chat-md :global(.hljs-selector-tag),
  .chat-md :global(.hljs-literal),
  .chat-md :global(.hljs-section),
  .chat-md :global(.hljs-link) {
    color: var(--accent);
  }
  .chat-md :global(.hljs-string),
  .chat-md :global(.hljs-addition),
  .chat-md :global(.hljs-attr),
  .chat-md :global(.hljs-meta .hljs-string) {
    color: var(--good);
  }
  .chat-md :global(.hljs-number),
  .chat-md :global(.hljs-symbol),
  .chat-md :global(.hljs-bullet) {
    color: var(--accent-soft);
  }
  .chat-md :global(.hljs-title),
  .chat-md :global(.hljs-name),
  .chat-md :global(.hljs-selector-id),
  .chat-md :global(.hljs-selector-class) {
    color: var(--fg);
  }
  .chat-md :global(.hljs-type),
  .chat-md :global(.hljs-built_in),
  .chat-md :global(.hljs-builtin-name),
  .chat-md :global(.hljs-attribute) {
    color: var(--fg-2);
  }
  .chat-md :global(.hljs-deletion) {
    color: var(--bad);
  }
  .chat-md :global(.hljs-emphasis) {
    font-style: italic;
  }
  .chat-md :global(.hljs-strong) {
    font-weight: 600;
  }
</style>
