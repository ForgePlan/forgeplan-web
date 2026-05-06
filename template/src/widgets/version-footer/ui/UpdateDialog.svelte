<script lang="ts">
  import { Button, Code, Dialog } from '@/shared/ui';
  import { modalManager } from '@/shared/services';
  import type { ApiEnvelope } from '@/shared/api';

  interface Props {
    modalId: number;
    current: string;
    latest: string;
  }

  let { modalId, current, latest }: Props = $props();

  let open = $state(true);
  let detectedVersion = $state<string | null>(null);
  let serverDown = $state(false);
  // Short visible countdown before auto-reload — so the user can see what
  // happened and Cancel if they have unsaved state in the page.
  const AUTO_RELOAD_MS = 1500;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  function close() {
    open = false;
    modalManager.close(modalId);
  }

  function reload() {
    if (typeof window !== 'undefined') window.location.reload();
  }

  function cancelReload() {
    if (reloadTimer) {
      clearTimeout(reloadTimer);
      reloadTimer = null;
    }
    detectedVersion = null;
  }

  // `-y` skips npx's "Ok to proceed?" prompt for the install confirmation.
  // `@latest` forces npx to fetch the newest tarball instead of running a
  // stale cached copy (which would no-op the update). See PRD-013 § Risks.
  const updateCommand = 'npx -y @forgeplan/web@latest update';

  // While the dialog is open, ping /api/version every 5s to detect a
  // server restart with a new version. The running Node process holds
  // open file inodes after `update` rmSync's the .forgeplan-web/ tree,
  // so a *running* server keeps serving the old code — only a fresh
  // process boot exposes the new __FORGEPLAN_WEB_VERSION__.
  const POLL_MS = 5_000;

  type VersionData = { web: string; cli: string | null };

  $effect(() => {
    if (!open) return;
    let cancelled = false;

    async function ping() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (cancelled) return;
        const env = (await res.json()) as ApiEnvelope<VersionData>;
        if (env.ok && env.data && env.data.web && env.data.web !== current) {
          if (!detectedVersion) {
            detectedVersion = env.data.web;
            serverDown = false;
            // Auto-reload — user explicitly opened the update dialog, so the
            // intent to upgrade is clear. Short window leaves room for Cancel.
            reloadTimer = setTimeout(reload, AUTO_RELOAD_MS);
          }
        } else {
          serverDown = false;
        }
      } catch {
        if (!cancelled) serverDown = true;
      }
    }

    const timer = setInterval(ping, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  });
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

    {#if detectedVersion}
      <div class="banner ok" role="status" aria-live="polite">
        <span class="banner-title">✓ Server now serves v{detectedVersion} — reloading…</span>
        <span class="banner-actions">
          <Button variant="ghost" size="sm" onclick={cancelReload}>Cancel</Button>
          <Button variant="primary" size="sm" onclick={reload}>Reload now</Button>
        </span>
      </div>
    {:else if serverDown}
      <div class="banner warn" role="status">
        <span class="banner-title">Server is offline</span>
        <span class="banner-hint">Run <code>npx @forgeplan/web start</code> to restart it, then reload.</span>
      </div>
    {/if}

    <section class="section">
      <h3 class="section-title">Steps</h3>
      <ol class="steps">
        <li>Stop the running server (<code>Ctrl+C</code> in its terminal).</li>
        <li>Run the command below in the directory where you initialized <code>@forgeplan/web</code>.</li>
        <li>Restart the server: <code>npx @forgeplan/web start</code>.</li>
        <li>Reload this page (this dialog auto-reloads after ~1.5&nbsp;s when it sees the new version — Cancel button stops it).</li>
      </ol>
      <Code code={updateCommand} ariaLabel="Manual update command" />
      <p class="footnote">
        <code>-y</code> skips npx's install-confirmation prompt;
        <code>@latest</code> forces npx to fetch the newest tarball
        instead of running a stale cached copy.
      </p>
    </section>

    <section class="section">
      <h3 class="section-title">Why not run it from the browser?</h3>
      <p class="hint">
        The update command replaces the very files this server is executing.
        On macOS / Linux the running process holds the old files open in
        memory and keeps serving the old code; on Windows the
        <code>rm</code> step can fail with a busy-file error. Either way
        the new version becomes visible only after a process restart —
        which the browser cannot perform on the host.
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

  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    margin-bottom: 14px;
    border-radius: 3px;
    font-size: 12px;
  }
  .banner.ok {
    background: var(--good-dim);
    border: 1px solid var(--good);
    color: var(--fg);
  }
  .banner.warn {
    background: color-mix(in srgb, var(--warn) 12%, transparent);
    border: 1px solid var(--warn);
    color: var(--fg-1);
    flex-direction: column;
    align-items: flex-start;
  }
  .banner-title {
    font-weight: 600;
  }
  .banner-actions {
    display: inline-flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .banner-hint {
    color: var(--fg-2);
    font-size: 11px;
  }
  .banner-hint code {
    font-family: var(--font-mono);
    font-size: 10px;
    background: var(--bg-2);
    padding: 1px 4px;
    border-radius: 2px;
    color: var(--fg-1);
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
  .hint code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-1);
    background: var(--bg-2);
    padding: 1px 4px;
    border-radius: 2px;
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
</style>
