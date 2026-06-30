<script lang="ts">
  import { Alert, Badge, Button, Popover, PopoverTrigger, PopoverContent } from '@/shared/ui';
  import X from '@lucide/svelte/icons/x';
  import AlarmClockOff from '@lucide/svelte/icons/alarm-clock-off';
  import type { Hint, HintSeverity } from '../lib/types';

  interface Props {
    hint: Hint;
    onSnooze: (id: string, ms: number) => void;
    onDismiss: (id: string) => void;
    onSelect?: (detail: { id: string }) => void;
  }

  let { hint, onSnooze, onDismiss, onSelect }: Props = $props();

  let menuOpen = $state(false);

  const ONE_DAY = 24 * 3600 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;

  // FR-003 — severity → Alert variant + leading glyph. Variant carries the
  // chrome (color/border via app.css tokens inside the Alert primitive); the
  // glyph is the spec's ⚠/💡/📈 affordance.
  const VARIANT: Record<HintSeverity, 'danger' | 'warning' | 'info'> = {
    critical: 'danger',
    warning: 'warning',
    tip: 'info',
  };
  const GLYPH: Record<HintSeverity, string> = {
    critical: '⚠',
    warning: '📈',
    tip: '💡',
  };
  const SEVERITY_BADGE: Record<HintSeverity, 'danger' | 'primary' | 'secondary'> = {
    critical: 'danger',
    warning: 'primary',
    tip: 'secondary',
  };

  const variant = $derived(VARIANT[hint.severity]);
  const firstId = $derived(hint.affectedIds?.[0] ?? null);

  function snooze(ms: number) {
    menuOpen = false;
    onSnooze(hint.id, ms);
  }
</script>

<Alert
  {variant}
  icon={null}
  class="hint-card"
  data-test="hint-card"
  data-hint-id={hint.id}
>
  <div class="hint-row">
    <span class="hint-glyph" aria-hidden="true">{GLYPH[hint.severity]}</span>
    <div class="hint-main">
      <p class="hint-text">{hint.text}</p>
      <div class="hint-meta">
        <Badge variant={SEVERITY_BADGE[hint.severity]} size="sm">{hint.severity}</Badge>
        {#if firstId}
          <Button
            variant="ghost"
            size="sm"
            class="hint-action"
            data-test="hint-action"
            onclick={() => onSelect?.({ id: firstId })}
          >Open {firstId}</Button>
        {/if}
      </div>
    </div>
    <div class="hint-controls">
      <Popover bind:open={menuOpen}>
        <PopoverTrigger class="hint-snooze-trigger">
          <Button
            variant="ghost"
            size="icon"
            class="hint-snooze"
            aria-label="Snooze hint"
            data-test="hint-snooze"
          ><AlarmClockOff size={13} /></Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" class="hint-menu">
          <div class="hint-menu-body" data-test="hint-snooze-menu">
            <Button variant="ghost" size="sm" onclick={() => snooze(ONE_DAY)}>Snooze 1 day</Button>
            <Button variant="ghost" size="sm" onclick={() => snooze(ONE_WEEK)}>Snooze 1 week</Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        class="hint-dismiss"
        aria-label="Dismiss hint"
        data-test="hint-dismiss"
        onclick={() => onDismiss(hint.id)}
      ><X size={13} /></Button>
    </div>
  </div>
</Alert>

<style>
  .hint-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .hint-glyph {
    flex: 0 0 auto;
    font-size: 14px;
    line-height: 1.3;
  }
  .hint-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hint-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--fg-1);
  }
  .hint-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .hint-controls {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .hint-menu-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 120px;
  }
</style>
