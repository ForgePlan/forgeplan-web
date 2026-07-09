<script lang="ts">
    import { Command } from "bits-ui";
    import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
    import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
    import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
    import { healthPoller } from "@/entities/health";
    import {
        notificationPermission,
        notificationsSupported,
        requestPermission,
    } from "@/entities/health/lib/notify.svelte";
    import {
        instancePoller,
        InstanceItem,
        type Instance,
        type InstanceStatus,
    } from "@/entities/instance";
    import { themeStore, type ThemeMode } from "@/shared/lib";
    import { Dialog, Toggle, ToggleGroup, ToggleGroupItem, toast } from "@/shared/ui";

    interface Props {
        notify?: boolean;
        liveText?: string;
        // PRD-011 / RFC-010 FR-009 — master "hide all hints" toggle. Owned by
        // settings, surfaced here per the FR text ("toggle in HealthBar").
        hintsHidden?: boolean;
        // Left-rail collapse affordance surfaced on the logo (hover swaps the
        // wordmark for a collapse/expand button). State owned by HomePage.
        sidebarCollapsed?: boolean;
        onToggleSidebar?: () => void;
    }

    let {
        notify = $bindable(false),
        liveText = "",
        hintsHidden = $bindable(false),
        sidebarCollapsed = false,
        onToggleSidebar,
    }: Props = $props();

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
    //
    // Normalize: instances always register with HOST env (default 127.0.0.1).
    // If the user opens the browser via `localhost:port`, window.location.host
    // is "localhost:port" while inst.id is "127.0.0.1:port" — they must match.
    function normalizeHost(h: string): string {
        return h.replace(/^localhost(:\d+)?$/, (_, p) => `127.0.0.1${p ?? ""}`);
    }
    const currentId = $derived<string | null>(
        typeof window !== "undefined" ? normalizeHost(window.location.host) : null,
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

    async function refreshStatuses(toFetch?: Instance[]) {
        if (typeof window === "undefined") return;
        const list = toFetch ?? otherInstances;
        await Promise.all(
            list.map(async (inst) => {
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

    // Stable background poll for instance status — no reactive reads inside
    // the effect body, so the interval is never reset by state changes.
    // `refreshStatuses()` reads `otherInstances` at call-time (inside the
    // async callback, outside the effect's tracking window) — no loop.
    $effect(() => {
        if (typeof window === "undefined") return;
        const timer = setInterval(() => void refreshStatuses(), 10_000);
        return () => clearInterval(timer);
    });

    // Reactive fetch — re-runs when `otherInstances` changes so newly-visible
    // instances get status immediately instead of waiting up to 10 s.
    // IMPORTANT: must NOT set up an interval here — that would reset the stable
    // timer above on every instance-list update, causing a request flood.
    // IMPORTANT: `refreshStatuses(toFetch)` receives the snapshot explicitly so
    // it does NOT re-read `otherInstances` synchronously and does NOT add a
    // second dependency that could loop back through the instancePoller.
    $effect(() => {
        const toFetch = otherInstances; // $derived — registers reactive dep
        if (typeof window === "undefined" || toFetch.length === 0) return;
        void refreshStatuses(toFetch);
    });

    // Refresh the instances registry list every time the dialog opens (issue #134).
    // Status follows automatically via the reactive effect above when
    // `otherInstances` updates after the poller fetches fresh data.
    // Do NOT call `refreshStatuses()` here — reading `otherInstances` inside
    // this effect (even indirectly via the no-arg overload) would make this
    // effect depend on `otherInstances`, creating a request flood loop.
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
        {#if onToggleSidebar}
            <button
                class="logo-toggle"
                aria-label={sidebarCollapsed
                    ? "Expand sidebar"
                    : "Collapse sidebar"}
                onclick={onToggleSidebar}
            >
                <span class="logo" aria-hidden="true"
                    >F<span class="o">O</span>RGEPLAN</span
                >
                <span class="logo-icon" aria-hidden="true">
                    {#if sidebarCollapsed}
                        <PanelLeftOpen size={17} />
                    {:else}
                        <PanelLeftClose size={17} />
                    {/if}
                </span>
            </button>
        {:else}
            <span class="logo" aria-label="Forgeplan"
                >F<span class="o">O</span>RGEPLAN</span
            >
        {/if}
        <span class="project-sep" aria-hidden="true">/</span>
        <div class="project-switcher">
            <button
                class="switcher-btn"
                class:open={switcherOpen}
                data-test="instance-switcher-trigger"
                aria-label="Switch forgeplan-web instance"
                aria-haspopup="dialog"
                title={currentInstance
                    ? `${currentInstance.projectName} (${currentInstance.id})`
                    : (currentId ?? "")}
                onclick={() => { switcherOpen = true; }}
            >
                <span class="switcher-trigger-label">
                    {currentInstance?.projectName ??
                        health?.project ??
                        currentId ??
                        "instance"}
                </span>
                <ChevronsUpDown size={13} class="switcher-chevron" />
            </button>
            <Dialog
                open={switcherOpen}
                title="Switch instance"
                width="340px"
                onclose={() => { switcherOpen = false; switching = false; }}
            >
                <div data-test="instance-switcher">
                    <Command.Root shouldFilter={hasOtherInstances}>
                        <Command.Input
                            placeholder={hasOtherInstances ? "Search instances…" : "No other instances running"}
                            class="switcher-cmd-input"
                        />
                        <Command.List class="switcher-cmd-list">
                            <Command.Empty
                                class="switcher-cmd-empty"
                                data-test="instance-switcher-empty"
                            >
                                <span class="switcher-empty-title">Instance switcher</span>
                                <span class="switcher-empty-hint"
                                    >No other instances are running. Start forgeplan-web
                                    in another project directory to switch between
                                    workspaces.</span
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
                                    <InstanceItem instance={inst} {status} />
                                </Command.Item>
                            {/each}
                        </Command.List>
                    </Command.Root>
                </div>
            </Dialog>
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
        <Toggle
            size="sm"
            variant="outline-mono"
            pressed={!hintsHidden}
            onPressedChange={(next) => (hintsHidden = !next)}
            ariaLabel={hintsHidden
                ? "Show proactive hints"
                : "Hide all proactive hints"}
            class="hints-toggle"
            dataAction="toggle-hints"
        >
            {hintsHidden ? "Hints off" : "Hints on"}
        </Toggle>
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
    /* Logo doubles as the sidebar toggle: wordmark by default, collapse/expand
       icon on hover/focus (occupies the same box, no layout shift). */
    .logo-toggle {
        position: relative;
        display: inline-flex;
        align-items: center;
        padding: 0;
        margin: 0;
        border: 0;
        background: none;
        cursor: pointer;
        color: inherit;
    }
    .logo-toggle .logo {
        transition: opacity 120ms ease-out;
    }
    .logo-icon {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        opacity: 0;
        color: var(--fg-2);
        transition: opacity 120ms ease-out;
        pointer-events: none;
    }
    .logo-toggle:hover .logo,
    .logo-toggle:focus-visible .logo {
        opacity: 0;
    }
    .logo-toggle:hover .logo-icon,
    .logo-toggle:focus-visible .logo-icon {
        opacity: 1;
    }
    @media (prefers-reduced-motion: reduce) {
        .logo-toggle .logo,
        .logo-icon {
            transition: none;
        }
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
    .switcher-btn {
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
    .switcher-btn:hover {
        background: color-mix(in srgb, var(--fg) 10%, transparent);
        color: var(--fg);
    }
    .switcher-btn.open {
        background: color-mix(in srgb, var(--fg) 10%, transparent);
        color: var(--fg);
    }
    .switcher-btn:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
    }
    :global(.switcher-chevron) {
        flex: 0 0 auto;
        color: var(--fg-3);
        transition: transform 140ms ease;
    }
    .switcher-btn.open :global(.switcher-chevron) {
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
    :global(.switcher-cmd-input) {
        width: 100%;
        padding: 6px 8px;
        background: var(--bg-2);
        border: 1px solid var(--line-2);
        border-radius: 3px;
        color: var(--fg-1);
        font: inherit;
        font-size: 11px;
        outline: none;
        margin-bottom: 8px;
        box-sizing: border-box;
    }
    :global(.switcher-cmd-input::placeholder) {
        color: var(--fg-4);
    }
    :global(.switcher-cmd-input:focus) {
        border-color: var(--accent);
    }
    :global(.switcher-cmd-list) {
        display: flex;
        flex-direction: column;
        gap: 1px;
        overflow-y: auto;
        max-height: 260px;
    }
    :global(.switcher-cmd-empty) {
        padding: 10px 4px 12px;
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
