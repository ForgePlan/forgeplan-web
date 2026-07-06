<script lang="ts">
  /**
   * MdLink — ChatMarkdown's custom renderer for markdown `<a>` (RFC-034
   * Pillar C, chat UI upgrade Phase A). svelte-exmarkdown's `Plugin.renderer`
   * maps the `a` tag to this component instead of a bare element so every
   * link in an assistant answer opens in a new tab without leaving the
   * chat, per the standard `noopener noreferrer` safe-external-link
   * contract. Receives the parsed hast node's properties as props
   * (`href`, plus anything else the markdown carried, e.g. `title`).
   */
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLAnchorElement>, "children"> {
    href?: string;
    children?: Snippet;
  }

  let { href, class: className, children, ...rest }: Props = $props();
</script>

<a {href} target="_blank" rel="noopener noreferrer" class="chat-md-link {className ?? ''}" {...rest}>
  {@render children?.()}
</a>

<style>
  .chat-md-link {
    color: var(--accent);
    text-decoration: none;
  }
  .chat-md-link:hover {
    text-decoration: underline;
  }
  .chat-md-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
