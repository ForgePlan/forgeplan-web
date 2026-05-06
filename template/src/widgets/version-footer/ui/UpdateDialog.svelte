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

  // `-y` skips npx's "Ok to proceed?" prompt for the install confirmation.
  // `@latest` forces npx to fetch the newest tarball instead of running a
  // stale cached copy (which would no-op the update). See PRD-013 § Risks.
  const updateCommand = 'npx -y @forgeplan/web@latest update';
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
      <ol class="steps">
        <li><strong>Stop</strong> the running server (<code>Ctrl+C</code> in its terminal).</li>
        <li>Run the command below in the directory where you initialized <code>@forgeplan/web</code>.</li>
        <li><strong>Restart</strong> the server: <code>npx @forgeplan/web start</code>.</li>
        <li>Reload this page.</li>
      </ol>
      <Code code={updateCommand} ariaLabel="Manual update command" />
      <p class="footnote">
        <code>-y</code> skips npx's install-confirmation prompt;
        <code>@latest</code> forces npx to fetch the newest tarball
        instead of running a stale cached copy.
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
  .steps {
    margin: 0 0 10px 0;
    padding-left: 18px;
    font-size: 12px;
    color: var(--fg-1);
    line-height: 1.6;
  }
  .steps code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-1);
    background: var(--bg-2);
    padding: 1px 4px;
    border-radius: 2px;
  }
  .footnote {
    margin: 6px 0 0 0;
    font-size: 11px;
    color: var(--fg-3);
    line-height: 1.5;
  }
  .footnote code {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-2);
    background: var(--bg-2);
    padding: 1px 4px;
    border-radius: 2px;
  }
</style>
