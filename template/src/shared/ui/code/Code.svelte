<script lang="ts">
  interface Props {
    code: string;
    language?: string;
    inline?: boolean;
    ariaLabel?: string;
  }

  let { code, language, inline = false, ariaLabel }: Props = $props();

  let copied = $state(false);
  let failed = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  function flashCopied(success: boolean) {
    copied = success;
    failed = !success;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
      failed = false;
    }, 1500);
  }

  async function copyToClipboard() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        flashCopied(true);
        return;
      }
    } catch {
      // FIXME(clipboard): clipboard API rejected (insecure context, permission) — falling back to textarea + execCommand.
    }
    flashCopied(legacyCopy(code));
  }

  function legacyCopy(text: string): boolean {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      // TODO(deprecated): document.execCommand removed in future browsers — fallback path only.
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
</script>

{#if inline}
  <span class="inline" aria-label={ariaLabel}>
    <code>{code}</code>
    <button
      type="button"
      class="btn"
      class:ok={copied}
      class:err={failed}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      onclick={copyToClipboard}
    >
      {copied ? 'copied' : failed ? 'failed' : 'copy'}
    </button>
  </span>
{:else}
  <div class="block" data-language={language ?? 'shell'} aria-label={ariaLabel}>
    <pre><code>{code}</code></pre>
    <button
      type="button"
      class="btn floating"
      class:ok={copied}
      class:err={failed}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      onclick={copyToClipboard}
    >
      {copied ? 'copied' : failed ? 'failed' : 'copy'}
    </button>
  </div>
{/if}

<style>
  .block {
    position: relative;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 3px;
    padding: 10px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    color: var(--fg-1);
    overflow-x: auto;
  }
  .block pre {
    margin: 0;
    padding-right: 64px;
  }
  .block code {
    white-space: pre;
  }

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 3px;
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .inline code {
    color: var(--fg-1);
  }

  .btn {
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: 2px;
    color: var(--fg-2);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    transition:
      color 120ms ease,
      background 120ms ease,
      border-color 120ms ease;
  }
  .btn:hover {
    color: var(--fg);
    background: var(--bg-3);
    border-color: var(--line-3);
  }
  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .btn.ok {
    color: var(--good);
    border-color: var(--good-dim);
  }
  .btn.err {
    color: var(--bad);
    border-color: var(--bad);
  }

  .floating {
    position: absolute;
    top: 6px;
    right: 6px;
  }
</style>
