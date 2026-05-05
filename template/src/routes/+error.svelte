<!-- FR-001 (PRD-003): SvelteKit error boundary — styled fallback UI when a
     load/render throws (replaces the generic unstyled "500 Internal Error"). -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<main class="error-shell fp-dot-grid">
  <div class="error-card">
    <p class="fp-eyebrow">forgeplan-web</p>
    <h1 class="status">{page.status}</h1>
    <p class="message">{page.error?.message ?? 'Unexpected error'}</p>
    <a class="home-link" href="/">
      <span class="fp-arrow" aria-hidden="true">{'->'}</span>
      <span>Go home</span>
    </a>
  </div>
</main>

<style>
  .error-shell {
    min-height: 100vh;
    width: 100%;
    background: var(--bg);
    color: var(--fg-1);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .error-card {
    max-width: 520px;
    width: 100%;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: center;
    align-items: center;
    font-family: var(--font-mono);
  }

  .status {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: clamp(72px, 12vw, 128px);
    line-height: 1;
    letter-spacing: -0.04em;
    color: var(--accent);
    margin: 0;
  }

  .message {
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1.5;
    color: var(--fg-2);
    margin: 0;
    word-break: break-word;
  }

  .home-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 18px;
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-1);
    border: 1px solid var(--line-2);
    background: transparent;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  }

  .home-link:hover,
  .home-link:focus-visible {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
    outline: none;
  }
</style>
