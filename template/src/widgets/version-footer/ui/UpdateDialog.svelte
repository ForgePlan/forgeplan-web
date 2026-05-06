<script lang="ts">
  import { Button, Code, Dialog } from '@/shared/ui';
  import { modalManager } from '@/shared/services';

  interface Props {
    modalId: number;
    current: string;
    latest: string;
  }

  let { modalId, current, latest }: Props = $props();

  let open = $state(true);

  function close() {
    open = false;
    modalManager.close(modalId);
  }

  const updateCommand = 'npx @forgeplan/web update';
</script>

<Dialog
  {open}
  title="Update available"
  width="460px"
  onclose={close}
>
  {#snippet body()}
    <div class="versions" aria-label="Version transition">
      <div class="ver">
        <span class="ver-label">current</span>
        <span class="ver-value">v{current}</span>
      </div>
      <span class="arrow" aria-hidden="true">→</span>
      <div class="ver latest">
        <span class="ver-label">latest</span>
        <span class="ver-value">v{latest}</span>
      </div>
    </div>

    <section class="section">
      <h3 class="section-title">Manual update</h3>
      <p class="hint">
        Run this in the directory where you initialized <code>@forgeplan/web</code>:
      </p>
      <Code code={updateCommand} ariaLabel="Manual update command" />
    </section>

    <section class="section">
      <h3 class="section-title">Automatic update</h3>
      <p class="hint">
        Not available from the browser: running <code>npx @forgeplan/web update</code>
        replaces the very files this server is executing, which would crash the
        running process mid-request. Use the manual command above and reload the
        page when it finishes.
      </p>
    </section>
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" size="md" onclick={close}>Close</Button>
  {/snippet}
</Dialog>

<style>
  .versions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 14px;
    margin-bottom: 14px;
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .ver {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .ver-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-3);
  }
  .ver-value {
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--fg);
  }
  .ver.latest .ver-value {
    color: var(--accent-soft);
  }
  .arrow {
    color: var(--fg-3);
    font-size: 18px;
  }

  .section {
    margin-top: 14px;
  }
  .section:first-child {
    margin-top: 0;
  }
  .section-title {
    margin: 0 0 6px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg);
    letter-spacing: 0.02em;
  }
  .hint {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--fg-2);
    line-height: 1.5;
  }
  .hint code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-1);
    background: var(--bg-2);
    padding: 1px 4px;
    border-radius: 2px;
  }
</style>
