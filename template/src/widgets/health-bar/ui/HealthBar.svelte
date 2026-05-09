<script lang="ts">
    import { Command, Popover } from "bits-ui";
    import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
    import { healthPoller } from "@/entities/health";
    import {
        notificationPermission,
        notificationsSupported,
        requestPermission,
    } from "@/entities/health/lib/notify.svelte";
    import {
        instancePoller,
        type Instance,
        type InstanceStatus,
    } from "@/entities/instance";
    import { themeStore, type ThemeMode } from "@/shared/lib";
    import { Toggle, ToggleGroup, ToggleGroupItem, toast } from "@/shared/ui";

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

    $effect(() => {
        instancePoller.start();
        return () => instancePoller.stop();
    });

    const instances = $derived<Instance[]>(
        instancePoller.state.data?.instances ?? [],
    );
    // SSR guard: `window` is undefined during SvelteKit prerender / render.
    // `currentId` resolves on the client only; SSR sees `null` — trigger
    // falls back to `health?.project ?? "instance"` until hydration.
    const currentId = $derived<string | null>(
        typeof window !== "undefined" ? window.location.host : null,
    );
    const currentInstance = $derived<Instance | undefined>(
        currentId
            ? instances.find((inst) => inst.id === currentId)
            : undefined,
    );
    // Current instance is excluded from the switcher list per issue #134.
    const otherInstances = $derived<Instance[]>(
        instances.filter((inst) => inst.id !== currentId),
    );
    const sortedOtherInstances = $derived<Instance[]>(
        [...otherInstances].sort((a, b) => a.port - b.port),
    );
    const hasOtherInstances = $derived<boolean>(otherInstances.length > 0);
    let switcherOpen = $state(false);
    let switching = $state(false);

    // Live status fetched from each other instance's /api/instance-status.
    // Keyed by instance id; null means the instance did not respond.
    // undefined means the status has not been fetched yet.
    let instanceStatuses = $state<Record<string, InstanceStatus | null>>({});

    async function refreshStatuses() {
        if (typeof window === "undefined") return;
        const toFetch = otherInstances;
        await Promise.all(
            toFetch.map(async (inst) => {
                try {
                    const res = await fetch(
                        `http://${inst.host}:${inst.port}/api/instance-status`,
                        { signal: AbortSignal.timeout(3_000) },
                    );
                    if (res.ok) {
                        const body = await res.json();
                        instanceStatuses[inst.id] = body.ok
                            ? (body.data as InstanceStatus)
                            : null;
                    } else {
                        instanceStatuses[inst.id] = null;
                    }
                } catch {
                    instanceStatuses[inst.id] = null;
                }
            }),
        );
    }

    // Poll other instances' status every 10 s (issue #134).
    $effect(() => {
        if (typeof window === "undefined") return;
        void refreshStatuses();
        const timer = setInterval(() => void refreshStatuses(), 10_000);
        return () => clearInterval(timer);
    });

    // Refresh the instances registry list every time the popover opens (issue #134).
    $effect(() => {
        if (switcherOpen) {
            void instancePoller.refresh();
        }
    });

    async function onInstancePick(nextId: string) {
        if (!nextId || nextId === currentId || switching) return;
        const target = instances.find((inst) => inst.id === nextId);
        if (!target) return;

        switching = true;
        try {
            const res = await fetch(
                `http://${target.host}:${target.port}/api/instance-status`,
                { signal: AbortSignal.timeout(3_000) },
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            if (!body.ok) throw new Error(body.error ?? "Instance unavailable");
        } catch (err) {
            toast.danger(
                `Cannot reach ${target.projectName} (${target.host}:${target.port})`,
                { title: "Switch failed" },
            );
            switching = false;
            return;
        }

        // `replace` (vs `assign`) avoids a back-button entry — the user is
        // switching contexts, not navigating within one.
        window.location.replace(`http://${target.host}:${target.port}`);
    }

    type ThemeOption = {
        id: ThemeMode;
        label: string;
        title: string;
    };

    const BASE_THEME_OPTIONS: ReadonlyArray<ThemeOption> = [
        { id: "auto", label: "Auto", title: "Follow operating system theme" },
        { id: "light", label: "Light", title: "Force light theme" },
        { id: "dark", label: "Dark", title: "Force dark theme" },
    ];
    const ORCH_OPTION: ThemeOption = {
        id: "orch",
        label: "Orch",
        title: "Orchestra-inspired pure-black with lavender accent",
    };

    function isThemeMode(v: string): v is ThemeMode {
        return v === "auto" || v === "light" || v === "dark" || v === "orch";
    }

    const ORCH_UNLOCK_CLICKS = 5;
    const ORCH_LOCK_MS = 2000;
    let darkStreak = $state(0);
    let themeRadiogroupEl = $state<HTMLElement | null>(null);
    // bits-ui ToggleGroup fires onValueChange synchronously AFTER our click
    // delegation handler has already advanced mode to "orch" on the 5th
    // dark click. The follow-up onValueChange carries v="dark" (its
    // pre-decided post-click value) and would silently revert orch if we
    // honoured it. This sentinel swallows that single follow-up emission.
    let justUnlockedOrch = false;
    // bits-ui's internal data-state desyncs from our controlled `value` prop
    // when the user re-clicks an active item (it goes to "" internally and
    // doesn't recover even though the prop says otherwise). Bumping this
    // counter as part of the {#key} forces a fresh ToggleGroup mount that
    // re-pins the visual state to our store. Spec invariant: 100% always
    // some pressed item.
    let toggleRemountTick = $state(0);
    // After orch becomes visible the toggle is frozen for ORCH_LOCK_MS so
    // accidental follow-up clicks (e.g. the user keeps mashing Dark beyond
    // the 5th unlock click) cannot immediately jump back out of orch.
    let themeLocked = $state(false);
    let themeLockTimeout: ReturnType<typeof setTimeout> | null = null;

    function startThemeLock() {
        themeLocked = true;
        if (themeLockTimeout) clearTimeout(themeLockTimeout);
        themeLockTimeout = setTimeout(() => {
            themeLocked = false;
            themeLockTimeout = null;
        }, ORCH_LOCK_MS);
    }

    $effect(() => {
        return () => {
            if (themeLockTimeout) clearTimeout(themeLockTimeout);
        };
    });

    // `orch` is hidden until unlocked. Once `themeStore.mode === "orch"` it
    // appears as the 4th visible item; clicking elsewhere drops it again.
    const themeOptions = $derived<ReadonlyArray<ThemeOption>>(
        themeStore.mode === "orch"
            ? [...BASE_THEME_OPTIONS, ORCH_OPTION]
            : BASE_THEME_OPTIONS,
    );

    function onThemeChange(v: string) {
        if (justUnlockedOrch) {
            justUnlockedOrch = false;
            toggleRemountTick++;
            return;
        }
        if (themeLocked) return;
        if (!v) {
            // bits-ui ToggleGroup type="single" deselects the active item on
            // re-click. Spec invariant: there must always be a value. Bounce
            // to auto, except for dark (we no-op so the hidden 5-click streak
            // counter on Dark survives the deselect→reselect oscillation —
            // accept the per-click visual flicker as the cost of keeping the
            // streak alive). Bump remount tick so the visual re-pins to mode.
            if (themeStore.mode === "dark") return;
            darkStreak = 0;
            themeStore.setMode("auto");
            toggleRemountTick++;
            return;
        }
        if (!isThemeMode(v)) {
            darkStreak = 0;
            themeStore.setMode("auto");
            toggleRemountTick++;
            return;
        }
        if (v !== "dark") darkStreak = 0;
        themeStore.setMode(v);
    }

    function onDarkClick() {
        if (themeLocked) return;
        darkStreak += 1;
        if (darkStreak >= ORCH_UNLOCK_CLICKS) {
            darkStreak = 0;
            justUnlockedOrch = true;
            themeStore.setMode("orch");
            startThemeLock();
        }
    }

    $effect(() => {
        const root: HTMLElement | null = themeRadiogroupEl;
        if (!root) return;
        const handler = (e: Event) => {
            const target = e.target as HTMLElement | null;
            const btn = target?.closest(".toggle-group-item") as
                | HTMLElement
                | null;
            if (!btn || !root.contains(btn)) return;
            // Match by aria-label (stable for the lifetime of THEME_OPTIONS).
            if (btn.getAttribute("aria-label") === "Force dark theme") {
                onDarkClick();
            }
        };
        root.addEventListener("click", handler);
        return () => {
            root.removeEventListener("click", handler);
        };
    });

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
        <span class="project-sep" aria-hidden="true">/</span>
        <div class="project-switcher">
            <Popover.Root bind:open={switcherOpen}>
                <Popover.Trigger
                    class="switcher-btn"
                    data-test="instance-switcher-trigger"
                    aria-label="Switch forgeplan-web instance"
                    title={currentInstance
                        ? `${currentInstance.projectName} (${currentInstance.id})`
                        : (currentId ?? "")}
                >
                    <span class="switcher-trigger-label">
                        {currentInstance?.projectName ??
                            health?.project ??
                            currentId ??
                            "instance"}
                    </span>
                    <ChevronsUpDown size={13} class="switcher-chevron" />
                </Popover.Trigger>
                <Popover.Portal>
                <Popover.Content
                    class="switcher-popover"
                    data-test="instance-switcher"
                    sideOffset={4}
                    align="start"
                    trapFocus={false}
                >
                    <Command.Root shouldFilter={hasOtherInstances}>
                        <Command.Input
                            placeholder={hasOtherInstances
                                ? "Switch instance…"
                                : "No other instances running"}
                            disabled={!hasOtherInstances}
                            class="switcher-cmd-input"
                        />
                        <Command.List class="switcher-cmd-list">
                            <Command.Empty
                                class="switcher-cmd-empty"
                                data-test="instance-switcher-empty"
                            >
                                <span class="switcher-empty-hint"
                                    >Start forgeplan-web in another project directory
                                    to switch between workspaces.</span
                                >
                                <span class="switcher-empty-cmd"
                                    >npx @forgeplan/web start</span
                                >
                            </Command.Empty>
                            {#each sortedOtherInstances as inst (inst.id)}
                                {@const status = instanceStatuses[inst.id]}
                                <Command.Item
                                    value={inst.id}
                                    keywords={[inst.projectName, inst.host, String(inst.port)]}
                                    onSelect={() => {
                                        onInstancePick(inst.id);
                                        switcherOpen = false;
                                    }}
                                    class="switcher-cmd-item"
                                    data-test="instance-item"
                                    data-test-id={inst.id}
                                    disabled={switching}
                                >
                                    <span class="switcher-item">
                                        <span class="switcher-item-name">
                                            {inst.projectName}
                                        </span>
                                        <span class="switcher-item-meta">
                                            <span class="switcher-item-host"
                                                >{inst.host}:{inst.port}</span
                                            >
                                            {#if status === undefined}
                                                <span
                                                    class="switcher-item-skeleton"
                                                    aria-hidden="true"
                                                ></span>
                                            {:else if status !== null}
                                                <span
                                                    class="switcher-item-status"
                                                    data-test="instance-status"
                                                >
                                                    {status.agentCount} agent{status.agentCount === 1 ? "" : "s"}
                                                    · {status.health?.total ?? "?"} artifacts
                                                </span>
                                            {:else}
                                                <span
                                                    class="switcher-item-offline"
                                                    data-test="instance-offline"
                                                    >offline</span
                                                >
                                            {/if}
                                        </span>
                                    </span>
                                </Command.Item>
                            {/each}
                        </Command.List>
                    </Command.Root>
                </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
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
        <div
            role="radiogroup"
            aria-label="Theme"
            class="theme-radiogroup"
            bind:this={themeRadiogroupEl}
        >
            <!-- {#key} forces ToggleGroup to remount when bits-ui's internal
                 `data-state` would desync from our controlled `value` prop.
                 The key bumps on (a) crossing the orch-visibility boundary
                 (item count change) and (b) any deselect emit that we
                 absorbed via onValueChange("") so the visual re-pins. -->
            {#key themeOptions.length + ":" + toggleRemountTick}
                <ToggleGroup
                    type="single"
                    size="sm"
                    value={themeStore.mode}
                    onValueChange={onThemeChange}
                    ariaLabel="Theme"
                    class="theme-toggle"
                >
                    {#each themeOptions as opt (opt.id)}
                        <ToggleGroupItem
                            value={opt.id}
                            ariaLabel={opt.title}
                            role="radio"
                            aria-checked={themeStore.mode === opt.id}
                            disabled={themeLocked}
                        >
                            {opt.label}
                        </ToggleGroupItem>
                    {/each}
                </ToggleGroup>
            {/key}
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
    .project-sep {
        color: var(--fg-3);
        font-size: 11px;
        letter-spacing: 0.08em;
        user-select: none;
    }
    .project-switcher {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: 240px;
    }
    .project-switcher :global(.switcher-btn) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 4px 2px 2px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 3px;
        color: var(--fg-1);
        font: inherit;
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.02em;
        cursor: pointer;
        user-select: none;
        transition: background 120ms ease, color 120ms ease;
        min-width: 0;
        max-width: 240px;
    }
    .project-switcher :global(.switcher-btn:hover) {
        background: color-mix(in srgb, var(--fg) 10%, transparent);
        color: var(--fg);
    }
    .project-switcher :global(.switcher-btn[data-state='open']) {
        background: color-mix(in srgb, var(--fg) 10%, transparent);
        color: var(--fg);
    }
    .project-switcher :global(.switcher-btn:focus-visible) {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
    }
    .project-switcher :global(.switcher-chevron) {
        flex: 0 0 auto;
        color: var(--fg-3);
        transition: transform 140ms ease;
    }
    .project-switcher :global(.switcher-btn[data-state='open'] .switcher-chevron) {
        color: var(--accent);
        transform: rotate(180deg);
    }
    .switcher-trigger-label {
        color: var(--fg-1);
        letter-spacing: 0.08em;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        min-width: 0;
    }
    :global(.switcher-popover) {
        z-index: 60;
        background: var(--bg-1);
        border: 1px solid var(--line-2);
        border-radius: 4px;
        box-shadow: var(--shadow-card);
        padding: 4px;
        min-width: 220px;
        max-width: 300px;
        max-height: min(var(--bits-popover-content-available-height, 320px), 320px);
        overflow: hidden;
        color: var(--fg-1);
        outline: none;
        font-family: var(--font-mono);
        font-size: 12px;
        letter-spacing: 0.02em;
        display: flex;
        flex-direction: column;
    }
    :global(.switcher-cmd-input) {
        width: 100%;
        padding: 5px 8px;
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--line-2);
        color: var(--fg-1);
        font: inherit;
        font-size: 11px;
        outline: none;
        margin-bottom: 4px;
    }
    :global(.switcher-cmd-input::placeholder) {
        color: var(--fg-4);
    }
    :global(.switcher-cmd-input:disabled) {
        cursor: default;
        color: var(--fg-3);
    }
    :global(.switcher-cmd-input:disabled::placeholder) {
        color: var(--fg-3);
    }
    :global(.switcher-cmd-list) {
        display: flex;
        flex-direction: column;
        gap: 1px;
        overflow-y: auto;
        flex: 1 1 auto;
    }
    :global(.switcher-cmd-empty) {
        padding: 10px 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    :global(.switcher-cmd-item) {
        display: flex;
        align-items: center;
        padding: 5px 8px;
        border-radius: 3px;
        cursor: pointer;
        color: var(--fg-1);
        transition: background 80ms ease;
        outline: none;
    }
    :global(.switcher-cmd-item[data-selected]) {
        background: color-mix(in srgb, var(--fg) 8%, transparent);
    }
    :global(.switcher-cmd-item[data-highlighted]) {
        background: color-mix(in srgb, var(--fg) 8%, transparent);
    }
    :global(.switcher-cmd-item[data-disabled]) {
        opacity: 0.5;
        pointer-events: none;
    }
    .switcher-item {
        display: inline-flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }
    .switcher-item-name {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-1);
        font-size: 12px;
    }
    .switcher-item-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    .switcher-item-host {
        color: var(--fg-3);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.04em;
    }
    .switcher-item-skeleton {
        display: inline-block;
        width: 56px;
        height: 9px;
        border-radius: 2px;
        background: color-mix(in srgb, var(--fg) 10%, transparent);
        animation: switcher-skeleton-pulse 1.4s ease-in-out infinite;
    }
    @keyframes switcher-skeleton-pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.7; }
    }
    .switcher-item-status {
        color: var(--fg-4);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.02em;
    }
    .switcher-item-offline {
        color: var(--bad);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    .switcher-empty-title {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 600;
        color: var(--fg-1);
        letter-spacing: 0.06em;
    }
    .switcher-empty-hint {
        font-size: 11px;
        color: var(--fg-3);
        line-height: 1.55;
    }
    .switcher-empty-cmd {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--accent);
        opacity: 0.85;
        margin-top: 2px;
        letter-spacing: 0.02em;
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
