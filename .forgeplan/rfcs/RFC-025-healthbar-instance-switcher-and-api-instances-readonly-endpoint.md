---
depth: standard
id: RFC-025
kind: rfc
links:
- target: PRD-029
  relation: based_on
status: active
title: HealthBar instance switcher and /api/instances readonly endpoint
---

---
id: RFC-025
title: "HealthBar instance switcher and /api/instances readonly endpoint"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
prd: PRD-029
depth: standard
---

# RFC-025: HealthBar instance switcher and /api/instances readonly endpoint

## Summary

Architecture for PRD-029: read-only `/api/instances` endpoint that
returns the live instance registry, plus the client-side wiring of
that data into HealthBar via a Combobox (PRD-028) and a new entity
slice `entities/instance/`.

## Motivation

PRD-029 specifies the user-facing behavior; this RFC specifies the
endpoint contract, the entity-slice shape, and the HealthBar diff. It
also formalizes the rule-22 amendment text so reviewers have a stable
target.

## Goals

- One read-only endpoint, standard envelope.
- Mirror existing `entities/health/` slice exactly so the codebase
  feels consistent.
- HealthBar diff stays small — Combobox replaces only the
  `.theme-radiogroup` neighbor when `instances.length >= 2`.
- Rule-22 amendment is co-landed so reviewers can `git grep` the new
  allowlist.

## Non-Goals

- Health-per-instance indicators.
- Mutating endpoints (kill / restart / activate).
- Cross-host federation.

## Options Considered

### Endpoint shape

#### Option A: Read `~/.forgeplan-web/instances.json` directly + 5s in-memory cache (CHOSEN)

**Description**: Endpoint reads SPEC-003-shaped JSON file directly via
the `template/src/shared/server/registry.ts` helper. In-memory cache
absorbs client poll spikes (5s TTL).

**Pros**:
- No spawn, no fetch.
- Trivial implementation.
- Fast (< 5ms typical).

**Cons**:
- Cache means up to 5s freshness lag — acceptable for human-scale UI.

#### Option B: Spawn `forgeplan instances --json` (no such subcommand exists)

**Description**: Hypothetical — push the registry into the forgeplan
CLI itself.

**Pros**:
- Reuses runForgeplan plumbing.

**Cons**:
- Forgeplan CLI doesn't manage forgeplan-web instances; out of scope
  for that tool. Would require an upstream feature.

#### Option C: WebSocket push from server-side heartbeat

**Description**: Push registry changes to the browser as they happen.

**Pros**:
- Zero polling.

**Cons**:
- New WebSocket infrastructure.
- Existing pollers (health, version) all use `fetch`-poll; consistency
  beats slight latency win.

### Entity slice shape

#### Option A: Mirror `entities/health/` (CHOSEN)

**Description**: `entities/instance/` with `lib/instance-poller.svelte.ts`,
`model/types.ts`, `index.ts`. Poller exposes `state.data`, `state.loading`,
`state.error`, `state.lastFetched` — same shape as `healthPoller`.

**Pros**:
- Consistency with existing slice.
- Reuses Svelte 5 runes pattern already proven.

**Cons**:
- New file count.

#### Option B: Inline polling inside HealthBar

**Description**: Skip the entity slice; poll inside the widget directly.

**Pros**:
- Fewer files.

**Cons**:
- Violates FSD layer ownership (data lives in entity slice, not widget).
- Duplicates pattern already established by `entities/health/`.

## Trade-off Analysis

### Endpoint

| Критерий | A: read JSON+cache (chosen) | B: spawn forgeplan | C: WebSocket |
|----------|------------------------------|---------------------|--------------|
| Implementation cost | Lowest | High (upstream change) | Highest |
| Latency | < 5ms | ~50ms (spawn) | ~0ms |
| Freshness | up to 5s lag | live | live |
| Pattern consistency | Aligns with /api/update-check | Diverges | Diverges |

### Entity slice

| Критерий | A: mirror health/ (chosen) | B: inline in widget |
|----------|----------------------------|---------------------|
| FSD compliance | High | Violates layer ownership |
| Reusability | High (other widgets can consume) | None |
| Code duplication | None | Some |

## Proposed Direction

**Endpoint**: Option A. **Slice**: Option A.

`template/src/routes/api/instances/+server.ts`:

```ts
import type { RequestHandler } from './$types';
import { readInstanceRegistry } from '$lib/server/registry';

let cache: { ts: number; payload: any } | null = null;
const TTL = 5000;

export const GET: RequestHandler = async () => {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return new Response(JSON.stringify(cache.payload), {
      headers: { 'content-type': 'application/json' },
    });
  }
  let payload;
  try {
    const reg = readInstanceRegistry();
    payload = { ok: true, data: { instances: reg.instances } };
  } catch (e) {
    payload = { ok: true, data: { instances: [] }, error: String(e) };
  }
  cache = { ts: now, payload };
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  });
};
```

`template/src/shared/server/registry.ts`:

```ts
import { readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PATH = path.join(os.homedir(), '.forgeplan-web', 'instances.json');

export interface InstanceRow {
  id: string; host: string; port: number; pid: number;
  scope: 'user' | 'project'; workspaceRoot: string; projectName: string;
  startedAt: string; heartbeatAt: string;
  webVersion: string; forgeplanCli: string | null;
}
export interface RegistryFile { version: 1; instances: InstanceRow[]; }

export function readInstanceRegistry(): RegistryFile {
  if (!existsSync(PATH)) return { version: 1, instances: [] };
  try {
    const raw = JSON.parse(readFileSync(PATH, 'utf8'));
    if (raw?.version !== 1) return { version: 1, instances: [] };
    return raw;
  } catch {
    return { version: 1, instances: [] };
  }
}
```

`template/src/entities/instance/lib/instance-poller.svelte.ts`:

```ts
import type { InstanceRow } from '$entities/instance/model/types';

class InstancePoller {
  state = $state<{
    data: InstanceRow[] | null;
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
  }>({ data: null, loading: false, error: null, lastFetched: null });

  private timer: ReturnType<typeof setInterval> | null = null;

  async fetchOnce() {
    this.state.loading = true;
    try {
      const r = await fetch('/api/instances');
      const j = await r.json();
      this.state.data = j?.data?.instances ?? [];
      this.state.error = null;
      this.state.lastFetched = Date.now();
    } catch (e) {
      this.state.error = String(e);
    } finally {
      this.state.loading = false;
    }
  }

  start({ intervalMs = 5000 } = {}) {
    if (this.timer) return;
    this.fetchOnce();
    this.timer = setInterval(() => this.fetchOnce(), intervalMs);
  }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

export const instancePoller = new InstancePoller();
```

HealthBar diff (sketch — only the new bit):

```svelte
<script lang="ts">
  import { instancePoller } from '@/entities/instance';
  import { Combobox, ComboboxTrigger, ComboboxContent, ComboboxItem, ComboboxInput } from '@/shared/ui';

  $effect(() => { instancePoller.start(); return () => instancePoller.stop(); });

  const instances = $derived(instancePoller.state.data ?? []);
  const showSwitcher = $derived(instances.length >= 2);
  const currentId = $derived(`${location.hostname}:${location.port}`);
  let pickedId = $state(currentId);

  function onPick(id: string) {
    if (id === currentId) return;
    const target = instances.find((i) => i.id === id);
    if (!target) return;
    window.location.replace(`http://${target.host}:${target.port}`);
  }
</script>

{#if showSwitcher}
  <Combobox value={pickedId} onValueChange={onPick} variant="mono" size="sm">
    <ComboboxTrigger>{instances.find((i) => i.id === currentId)?.projectName ?? currentId}</ComboboxTrigger>
    <ComboboxContent>
      <ComboboxInput placeholder="Search…" />
      {#each [...instances].sort((a, b) => a.port - b.port) as inst (inst.id)}
        <ComboboxItem value={inst.id}>
          {inst.projectName} ({inst.host}:{inst.port})
        </ComboboxItem>
      {/each}
    </ComboboxContent>
  </Combobox>
{/if}
```

Rule 22 amendment text appears in PRD-029's body verbatim — reviewers
copy-paste into `.claude/rules/22-readonly-proxy.md`.

## Risks & Open Questions

- **R-1: `location.hostname`/`location.port` may not match registered
  `host`/`port`** when the user proxies through a tunnel. MVP assumes
  localhost; document the limitation.
- **R-2: Browser blocks cross-port `window.location.replace`** as a
  cross-origin navigation. Same-origin per scheme is allowed for
  localhost; verify on Chrome/Firefox/Safari.
- **R-3: Cache 5s TTL hides crashed peer for up to 5s** — acceptable;
  client poll on 5s anyway.
- **R-4: SSR hydration mismatch** if the slice is touched during SSR.
  `instancePoller.start()` is gated by `$effect` (client-only); safe.
- **OQ-1**: Should the endpoint expose `version` field too? No —
  consumer doesn't need it; future schema bumps are forward-only.
- **OQ-2**: Should we add optimistic-UI for the local instance? No —
  registry-driven only.

## Implementation Phases

### Phase 1: Endpoint + helper

- [ ] **1.1** `template/src/shared/server/registry.ts` (NEW).
- [ ] **1.2** `template/src/routes/api/instances/+server.ts` (NEW).
- [ ] **1.3** Unit test endpoint: empty file, valid file, malformed
  JSON, version mismatch.

### Phase 2: Entity slice

- [ ] **2.1** `template/src/entities/instance/model/types.ts`.
- [ ] **2.2** `template/src/entities/instance/lib/instance-poller.svelte.ts`.
- [ ] **2.3** `template/src/entities/instance/index.ts` barrel.

### Phase 3: HealthBar wiring

- [ ] **3.1** Import poller + Combobox in HealthBar.
- [ ] **3.2** Conditional render on `instances.length >= 2`.
- [ ] **3.3** Pre-select current; navigate on pick.
- [ ] **3.4** Visual review across themes.

### Phase 4: Rule 22 amendment

- [ ] **4.1** Append the block from PRD-029 to
  `.claude/rules/22-readonly-proxy.md`.
- [ ] **4.2** Update verification snippet to allow
  `instances/+server.ts` reading from `~/.forgeplan-web/instances.json`.

### Phase 5: Smoke + e2e

- [ ] **5.1** Smoke: 1 instance → no Combobox; 2 instances → Combobox.
- [ ] **5.2** E2E spy on `window.location.replace`.

## Affected Files

- `template/src/shared/server/registry.ts` (NEW)
- `template/src/routes/api/instances/+server.ts` (NEW)
- `template/src/entities/instance/*` (NEW — 3 files)
- `template/src/widgets/health-bar/ui/HealthBar.svelte` (modified)
- `.claude/rules/22-readonly-proxy.md` (amendment)

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-029 | PRD | based_on |
| PRD-027 | PRD | informs (registry source) |
| PRD-028 | PRD | informs (Combobox consumer) |
| SPEC-003 | Spec | informs (data shape) |
| RFC-024 | RFC | informs (Combobox architecture) |
| GitHub #115 | Issue | implements |

---

> **Next step**: Land alongside PRD-029. Last RFC of the #109 chain.



