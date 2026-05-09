<script lang="ts">
    import type { Instance } from "../model/types";
    import type { InstanceStatus } from "../model/instance-status";

    interface Props {
        instance: Instance;
        status: InstanceStatus | null | undefined;
    }

    let { instance, status }: Props = $props();
</script>

<span class="item">
    <span class="item-name">{instance.projectName}</span>
    <span class="item-meta">
        <span class="item-host">{instance.host}:{instance.port}</span>
        {#if status === undefined}
            <span class="item-skeleton" aria-hidden="true"></span>
        {:else if status !== null}
            <span class="item-status" data-test="instance-status">
                {status.agentCount} agent{status.agentCount === 1 ? "" : "s"}
                · {status.health?.total ?? "?"} artifacts
            </span>
        {:else}
            <span class="item-offline" data-test="instance-offline">offline</span>
        {/if}
    </span>
</span>

<style>
    .item {
        display: inline-flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }
    .item-name {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-1);
        font-size: 12px;
        font-family: var(--font-mono);
    }
    .item-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    .item-host {
        color: var(--fg-3);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.04em;
    }
    .item-skeleton {
        display: inline-block;
        width: 56px;
        height: 9px;
        border-radius: 2px;
        background: color-mix(in srgb, var(--fg) 10%, transparent);
        animation: skeleton-pulse 1.4s ease-in-out infinite;
    }
    @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.7; }
    }
    .item-status {
        color: var(--fg-4);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.02em;
    }
    .item-offline {
        color: var(--bad);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
</style>
