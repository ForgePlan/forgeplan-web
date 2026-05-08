<script lang="ts">
    import { healthPoller } from "@/entities/health";
    import {
        notificationPermission,
        notificationsSupported,
        requestPermission,
    } from "@/entities/health/lib/notify.svelte";
    import { themeStore, type ThemeMode } from "@/shared/lib";
    import { Toggle, ToggleGroup, ToggleGroupItem } from "@/shared/ui";

    interface Props {
        notify?: boolean;
        liveText?: string;
    }

    let { notify = $bindable(false), liveText = "" }: Props = $props();

    let permission = $state<NotificationPermission | "unsupported">("default");
    let requesting = $state(false);
    $effect(() => {
        permission = notificationPermission();
    });

    $effect(() => {
        themeStore.start();
        return () => themeStore.stop();
    });

    const THEME_OPTIONS: ReadonlyArray<{
        id: ThemeMode;
        label: string;
        title: string;
    }> = [
        { id: "auto", label: "Auto", title: "Follow operating system theme" },
        { id: "light", label: "Light", title: "Force light theme" },
        { id: "dark", label: "Dark", title: "Force dark theme" },
        {
            id: "orch",
            label: "Orch",
            title: "Orchestra-inspired pure-black with lavender accent",
        },
    ];

    function isThemeMode(v: string): v is ThemeMode {
        return v === "auto" || v === "light" || v === "dark" || v === "orch";
    }

    const health = $derived(healthPoller.state.data);
    const lastUpdated = $derived(
        healthPoller.state.lastFetched
            ? new Date(healthPoller.state.lastFetched).toLocaleTimeString()
            : "—",
    );

    const notifyPressed = $derived(notify && permission === "granted");

    async function onToggleNotify(next: boolean) {
        if (requesting) return;
        if (next) {
            requesting = true;
            try {
                const result = await requestPermission();
                permission = result;
                notify = result === "granted";
            } finally {
                requesting = false;
            }
        } else {
            notify = false;
        }
    }
</script>

<header class="bar">
    <div class="brand">
        <span class="logo" aria-label="Forgeplan"
            >F<span class="o">O</span>RGEPLAN</span
        >
        {#if health}
            <span class="project">/ {health.project}</span>
        {/if}
    </div>
    <div class="stats">
        {#if health}
            <span class="chip">
                <strong class="chip-value">{health.total}</strong>
                <span class="chip-label">total</span>
            </span>
            {#each health.by_status as s}
                <span class="chip status-{s.status}">
                    <strong class="chip-value">{s.count}</strong>
                    <span class="chip-label">{s.status}</span>
                </span>
            {/each}
            {#if health.stale_count > 0}
                <span class="chip warn">
                    <strong class="chip-value">{health.stale_count}</strong>
                    <span class="chip-label">stale</span>
                </span>
            {/if}
            {#if health.blind_spots.length > 0}
                <span class="chip warn">
                    <strong class="chip-value"
                        >{health.blind_spots.length}</strong
                    >
                    <span class="chip-label">blind</span>
                </span>
            {/if}
        {:else if healthPoller.state.loading}
            <span class="chip muted">
                <span class="chip-label">loading…</span>
            </span>
        {:else if healthPoller.state.error}
            <span class="chip err" title={healthPoller.state.error}>
                <span class="chip-label">error</span>
            </span>
        {/if}
    </div>
    <div class="meta">
        <div role="radiogroup" aria-label="Theme" class="theme-radiogroup">
            <ToggleGroup
                type="single"
                size="sm"
                value={themeStore.mode}
                onValueChange={(v) => {
                    if (isThemeMode(v)) themeStore.setMode(v);
                }}
                ariaLabel="Theme"
                class="theme-toggle"
            >
                {#each THEME_OPTIONS as opt (opt.id)}
                    <ToggleGroupItem
                        value={opt.id}
                        ariaLabel={opt.title}
                        role="radio"
                        aria-checked={themeStore.mode === opt.id}
                    >
                        {opt.label}
                    </ToggleGroupItem>
                {/each}
            </ToggleGroup>
        </div>
        {#if notificationsSupported()}
            <Toggle
                size="sm"
                variant="outline-mono"
                pressed={notifyPressed}
                onPressedChange={onToggleNotify}
                disabled={permission === "denied" || requesting}
                ariaLabel={permission === "denied"
                    ? "Notifications denied — re-enable in browser site settings"
                    : notify
                      ? "Click to mute"
                      : "Click to enable health notifications"}
                class="notify-toggle"
            >
                {notifyPressed ? "🔔 Notify" : "🔕 Notify"}
            </Toggle>
        {/if}
        <span class="muted">updated {lastUpdated}</span>
        <span class="pulse" class:on={healthPoller.state.loading}></span>
    </div>
    <div aria-live="polite" class="sr-only" data-test="notify-live">
        {liveText}
    </div>
</header>

<style>
    .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 12px 20px;
        background: var(--canvas-overlay);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--line);
        color: var(--fg-1);
        font-family: var(--font-mono);
        font-size: 12px;
        letter-spacing: 0.02em;
    }
    .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
    }
    .logo {
        font-family: var(--font-mono);
        font-weight: 600;
        letter-spacing: 0.18em;
        font-size: 13px;
        color: var(--fg);
    }
    .logo .o {
        color: var(--accent);
    }
    .project {
        color: var(--fg-3);
        font-size: 11px;
        letter-spacing: 0.08em;
    }
    .stats {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 0;
        border: 1px solid var(--line-2);
    }
    .chip {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 3px 12px;
        font-family: var(--font-mono);
        border-right: 1px solid var(--line);
    }
    .chip:last-child {
        border-right: 0;
    }
    .chip-value {
        font-size: 13px;
        font-weight: 500;
        color: var(--fg);
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
    }
    .chip-label {
        font-size: 10px;
        color: var(--fg-3);
        text-transform: uppercase;
        letter-spacing: 0.12em;
    }
    .status-active .chip-value {
        color: var(--good);
    }
    .status-active .chip-label {
        color: var(--good);
        opacity: 0.7;
    }
    .status-draft .chip-value {
        color: var(--accent);
    }
    .status-draft .chip-label {
        color: var(--accent);
        opacity: 0.7;
    }
    .chip.warn .chip-value {
        color: var(--accent);
    }
    .chip.warn .chip-label {
        color: var(--accent);
        opacity: 0.7;
    }
    .chip.muted .chip-label,
    .muted {
        color: var(--fg-3);
    }
    .chip.err .chip-label {
        color: var(--bad);
    }
    .meta {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 11px;
        color: var(--fg-3);
    }
    .theme-radiogroup {
        display: inline-flex;
    }
    .pulse {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--fg-4);
        transition:
            background 200ms,
            box-shadow 200ms;
    }
    .pulse.on {
        background: var(--accent);
        box-shadow: 0 0 8px var(--accent);
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
</style>
