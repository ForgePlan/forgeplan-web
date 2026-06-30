---
depth: standard
id: RFC-011
kind: rfc
last_modified_at: 2026-05-06T16:20:21.136108+00:00
last_modified_by: claude-code/2.1.131
links:
- target: PRD-012
  relation: based_on
status: active
title: Version footer — build-time web + spawn-on-demand CLI
---

---
id: RFC-011
title: "Version footer — build-time web + spawn-on-demand CLI"
status: Draft
created: 2026-05-06
updated: 2026-05-06
---

# RFC-011: Version footer — build-time web + spawn-on-demand CLI

## Summary

Add a minimal `GET /api/version` endpoint that returns
`{ web: string, cli: string | null }`. The web string is injected at
Vite-build time from `template/package.json#version` via `define`; the
CLI string is resolved on first call by spawning `forgeplan --version`,
parsing `forgeplan X.Y.Z`, and caching the result for the process
lifetime. A new FSD widget `version-footer` polls this endpoint once on
mount and renders a small low-contrast label fixed to the bottom-left of
the viewport.

## Motivation

Drives PRD-012. The viewer currently exposes neither version, which
makes bug triage from screenshots ambiguous and forces a clarifying
round-trip on every report. Users have no signal that their installed
CLI is the version the web client expects.

## Options Considered

### Option A — `/api/version` with spawn-on-demand (chosen)

- Endpoint shells `forgeplan --version` exactly once, caches.
- Web version baked at build time via Vite `define`.
- Pros: matches existing `/api/*` pattern; single mechanism;
  no host-side coupling between `bin/` and `template/`.
- Cons: extends the read-only proxy surface beyond the current
  subcommand allow-list — needs a documented exception in rule 22.

### Option B — capture CLI version in `bin/forgeplan-web.mjs` `start`

- The bin script runs `forgeplan --version` once before `spawn(node …)`,
  passes it as `FORGEPLAN_CLI_VERSION` env to the SvelteKit server.
- Pros: zero new endpoint; trivial allow-list compliance; single
  spawn happens at server boot, not at first user request.
- Cons: bin → template env coupling that hasn't existed before;
  `npm run dev` (vite dev) does not go through `bin/` at all,
  so dev would always show `cli ?` unless a fallback also queries
  the CLI in the server. Two code paths for the same value.

### Option C — pure client-side `/<filename>?v=<hash>` cache-buster reading meta tags

- Inline the web version into `<svelte:head>` via `+layout.ts`.
- No CLI version at all; relies on user running `forgeplan --version`
  manually.
- Pros: smallest change; zero new endpoints.
- Cons: doesn't satisfy FR-002 (CLI version visible without terminal).

### Option D — every poller already shells the CLI, piggyback on `/api/health`

- `forgeplan health --json` does not currently include version. We could
  add it upstream (forgeplan repo) — out of scope for this repo.
- Cons: cross-repo dependency, multi-month coordination for a 30-line
  feature.

## Proposed Direction

**Option A** is selected.

Justification:

- Matches the established `/api/*` mental model — one endpoint per data
  surface, polled or fetched-once by the UI layer.
- The widening of the read-only proxy is bounded: a dedicated
  `getForgeplanVersion()` function lives in
  `template/src/shared/server/forgeplan.ts` alongside `runForgeplan`,
  bypasses the `READ_ONLY_SUBCOMMANDS` set (because `--version` is a
  flag, not a subcommand), but reuses the same `FORGEPLAN_BIN`
  validation, concurrency cap, and timeout. Rule 22 is updated in the
  same PR to make this exception explicit.
- One round-trip per page load (cached after first), cost negligible.

Implementation outline:

1. `template/src/shared/server/forgeplan.ts`
   - export `getForgeplanVersion(): Promise<string | null>`
   - on first call, spawn `[FORGEPLAN_BIN, '--version']`, 5 s timeout,
     same concurrency cap as `runForgeplan`
   - parse stdout with `/forgeplan\s+(\d+\.\d+\.\d+\S*)/i`; if no match,
     return `null`; if spawn fails, return `null`
   - memoize the resolved promise
2. `template/src/routes/api/version/+server.ts`
   - `export const GET: RequestHandler` returning
     `json({ ok: true, data: { web: __FORGEPLAN_WEB_VERSION__, cli } })`
3. `template/vite.config.ts`
   - read `template/package.json#version` at config-load time
   - `define: { __FORGEPLAN_WEB_VERSION__: JSON.stringify(version) }`
4. `template/src/app.d.ts`
   - `declare const __FORGEPLAN_WEB_VERSION__: string;`
5. `template/src/widgets/version-footer/`
   - `ui/VersionFooter.svelte` — fixed bottom-left, fetches `/api/version`
     once on mount, shows `web v<x> · cli v<y>` (or `cli ?`)
   - `index.ts` re-export
6. `template/src/pages/home/ui/HomePage.svelte`
   - import + render `<VersionFooter />` inside `.root`
7. `.claude/rules/22-readonly-proxy.md`
   - amend allow-list section: explicitly call out `--version`
     flag-only invocation handled via a dedicated function, not a
     subcommand entry.

## Implementation Phases

### Phase 1 — backend wire-up

- [ ] Add `getForgeplanVersion()` to `template/src/shared/server/forgeplan.ts`.
- [ ] Add `template/src/routes/api/version/+server.ts`.
- [ ] Inject `__FORGEPLAN_WEB_VERSION__` via Vite `define`.
- [ ] Declare ambient global in `app.d.ts`.

### Phase 2 — UI

- [ ] Create `template/src/widgets/version-footer/{ui/VersionFooter.svelte,index.ts}`.
- [ ] Render in `HomePage.svelte`.
- [ ] Fixed bottom-left, `--font-mono`, `--fg-3` color, `aria-label`.

### Phase 3 — rule + evidence

- [ ] Amend `.claude/rules/22-readonly-proxy.md`.
- [ ] Smoke test (vite dev or `npm run build && start`): hit `/api/version`,
      assert `{ ok: true, data: { web: "0.1.11", cli: "0.27.0" } }`.
- [ ] Visual confirmation that footer renders, no overlap with the panel.

## Risks

- `--version` flag may be re-purposed in a future forgeplan release.
  Mitigation: regex parser falls back to `null`; UI handles `null`.
- New ambient global typing — TypeScript needs `declare const`.
  Mitigation: added in `app.d.ts` in same PR.
- Vite-defined string is double-quoted; ensure `JSON.stringify(version)`
  is used (single-quoting would inline an identifier reference).

## Alternatives rejected

- Option B (env coupling) — rejected for `dev` divergence.
- Option C (web-only) — rejected, fails FR-002.
- Option D (upstream change) — out of scope.

## Related Artifacts

- PRD-012 — driver



