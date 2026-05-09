# Changelog

All notable changes to `@forgeplan/web` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-09

### Added (PRD-027 / RFC-023 / SPEC-003 / ADR-004 — multi-instance registry)

- **Global instance registry at `~/.forgeplan-web/instances.json`** — every
  running `forgeplan-web` server registers itself with `{ id, host, port,
  pid, scope, workspaceRoot, projectName, startedAt, heartbeatAt,
  webVersion, forgeplanCli }` and heartbeats every 30 s. Mutations live
  in `bin/lib/registry.mjs` (file-locked, atomic rename).
- **`/api/instances` endpoint** — read-only mirror of the registry with
  in-process liveness sweep (`process.kill(pid, 0)` + heartbeat ≤ 60 s).
  Allow-listed extension to rule 22.
- **HealthBar instance switcher** — Combobox-based picker that lists
  every live instance and opens it in a new tab. Visible only when
  ≥ 2 live instances are registered.

### Added (PRD-025 / RFC-021 / ADR-004 — `--scope user|project`)

- **`init --scope user|project`** — user scope writes to
  `~/.forgeplan-web/` (workspace-agnostic, gitignore-silent); project
  scope is the historical `<cwd>/.forgeplan-web/` behaviour. Interactive
  prompt offered when neither flag nor `-y` is passed.
- **`start` fallback chain** — `<cwd>/.forgeplan-web/` →
  `~/.forgeplan-web/` → friendly error. Workspace bound via
  `FORGEPLAN_CWD` (defaults to cwd for user scope).

### Added (ADR-003 — citty CLI framework)

- **`bin/` migrated to citty** (`^0.2.2`, the only allow-listed runtime
  dep). Subcommand routing, typed args, auto-help, and a future prompt
  hook (#111). `bin/` split into `cli.mjs` + `commands/*.mjs` +
  `lib/*.mjs`.

### Added (PRD-030 / RFC-026 / ADR-005 — feature-flag + image system)

- **Multi-image scaffold pipeline** — `@forgeplan/web` now ships named
  "images" of the scaffold. v1 ships two: `stable` (default) and `nightly`.
  Each image is a `dist*/` directory in the npm tarball with its own
  `forgeplan-web-build.json` manifest (image name + feature list).
- **`--image <name>` CLI flag** on `init` and `update`, default `stable`.
  Choice is sticky in `forgeplan-web.json`. `update --image nightly`
  switches tracks.
- **`config/images.json` + `config/features.json`** — single source of
  truth for what images ship and what feature flags each image includes.
  See [`config/IMAGES.md`](config/IMAGES.md) for the maintainer guide.
- **Build-time lifecycle validator** — `scripts/build.mjs` fails fast
  when any feature flag has `expiresIn ≤ currentVersion` or when a
  flag's lifetime exceeds 3 minor versions. Forces graduation.
- **Per-image smoke test** — `npm run smoke` exercises both `stable`
  and `nightly`.

### Changed (PRD-030 / RFC-026 — graduates PRD-014 / RFC-013)

- **Bundle approach is now the universal artifact form for every
  image.** The legacy SvelteKit-with-`node_modules/` shape (≈14 MB) is
  removed from the published tarball. Every emitted `dist*/` is the
  ~1.8 MB esbuild single-file bundle, capped at 3 MB.
- **`forgeplan-web.json` gains an `image` field**; existing scaffolds
  with `experimental: true` are migrated to `image: "nightly"` on first
  `update`.

### Deprecated

- **`--experimental` flag** on `init` and `update` — now a deprecated
  alias for `--image nightly`. Prints a stderr warning on every
  invocation. **Removed in 0.3.0.**

### Removed (BREAKING — only relevant if you depend on internals)

- `dist-experimental/` directory in the published tarball is replaced by
  `dist-nightly/`. Users running `npx @forgeplan/web init` see no
  change; consumers that pinned the directory name in scripts must
  switch to `dist-nightly/`.
- Legacy build pipeline functions `installRuntimeDeps()`,
  `emitDistPackageJson()`, `copyToDist()` removed from
  `scripts/build.mjs`.

### Added (UI / template polish)

- **Multi-tab artifact viewing** — Shift+click on a graph node opens
  the artifact in a new in-app tab; the closure model preserves the
  tab order and active selection.
- **`Combobox` primitive** in `shared/ui/` — `bits-ui`-backed,
  keyboard-navigable, used by the HealthBar instance switcher.

### Changed

- **`adapter-node` precompress disabled** — shrinks the published
  tarball by removing `.gz` / `.br` duplicates that the upstream
  `forgeplan` CLI never serves.

## [0.1.13] - 2026-05-08

### Added (PRD-018 / RFC-016 — shared/ui catalogue)

- **`shared/ui/` primitives based on `bits-ui`** — single source of truth
  for visual atoms. Visual atoms (Badge / Separator / Skeleton / Spinner /
  Card / Alert / Progress), form basics (Label / Input / Field / InputGroup),
  toggles (Toggle / ToggleGroup / ButtonGroup / Switch / Checkbox), radio
  (Radio / RadioGroup), disclosure (Tabs / Collapsible / Accordion),
  overlays (Tooltip / Popover, Toaster via `svelte-sonner`), and command
  palette (Command + Item family).
- **`/playground` showcase route** — every primitive × every variant ×
  every size, in both light and dark themes. The catalogue is the
  contract for what an atom looks like.
- **Rule 24 — `shared/ui` ownership and customisation discipline**
  (`.claude/rules/24-shared-ui-ownership.md`). Forbids `:global()`
  re-skins of primitive internals from `entities/` / `widgets/` /
  `pages/` / `routes/`. Includes a verification grep snippet.
- **New primitive variants** added by the rule-24 audit: `Button.variant=
  "ghost-mono"`, `Button.size="icon"`, `Badge.variant="mono"`,
  `Toggle.variant="outline-mono"`, `ToggleGroup.variant="outline-mono"`,
  `Alert.tone="banner"`, `TabsList.wrap`. Replaces hand-rolled markup
  (`Tabs`, `Collapsible`) across widgets.

### Added (UI)

- **`orch` theme — third palette** (Orchestra-inspired), exposed as a
  hidden 5-click easter egg on the theme toggle, with a 2 s freeze
  after unlock to prevent immediate accidental switch.
- **Dense-graph render-resilience** — Sankey and Tree views handle
  100+ artifacts without layout thrash.

### Changed

- Widget visuals migrated to primitives — `UpdateButton`, mosaic
  pane-icon buttons, `HomePage` error-bar, filter chips, `HealthBar`
  theme-switcher and notify, `InsightsRail` tab badges and R_eff
  bars, `ArtifactPanel` kind chip and ghost buttons.

### Reverted

- **Force 3D experimental Threlte view mode** (`#103`) — reverted in
  `#105`. The `dist-experimental/` cap stays at 6M for now.

## [0.1.12] - 2026-05-07

### Added (F18 — time-travel slider, SINGLE mode)

- **`/api/snapshot?at=ISO`** — read-only endpoint reconstructing workspace state at any past ISO 8601 timestamp. Resolves `at` → commit SHA via `git rev-list -1 --before=<at> --first-parent HEAD -- .forgeplan/`, then reconstructs via `git worktree add --detach` to `os.tmpdir()` + `forgeplan reindex` (rebuilds LanceDB inside the temp worktree from markdown source-of-truth) + `forgeplan list/graph --json`. Two-tier cache: in-memory LRU (32 entries, 60s TTL) + on-disk (`.forgeplan-web/.snapshots/<sha>.json`). Cold path 660 ms (39 artifacts), warm 10–11 ms.
- **`/api/timeline-events`** — read-only proxy over `git log --first-parent .forgeplan/`. Emits one event per `.forgeplan/`-touching commit with `at` / `kind` / `artifactId` / `sha` / `subject`. `kind` heuristically classified from commit subject (activate / supersede / scored / created).
- **Timeline panel** — collapsible scrubber UI below the canvas (`widgets/timeline/`). SVG axis with coloured ticks per event kind, draggable scrubber with PointerEvent capture, ArrowLeft/Right step-by-event, Home/End jump, 200 ms debounce before fetch. `role=slider` for a11y. State persisted in localStorage.
- **Canvas snapshot hydration** — when `snapshotStore.mode === 'single'`, `nodes`/`edges` switch from live pollers to `snapshotStore.current.{artifacts,edges}`. Status indicator surfaces "viewing snapshot at HH:MM" / "live · now" / loading / error.
- **`gitRepoRoot()`** helper — detects host git top via `git rev-parse --show-toplevel`, cached. Required because `workspaceRoot()` resolves to `template/src/` in dev mode.

### Added (other)

- **`init --experimental` flag** — opt-in to a single-file esbuild bundle
  of the SvelteKit server (`dist-experimental/`, ~1.5 MB) instead of the
  legacy `dist/` (~14 MB with `node_modules/`). Same CLI, same `/api/*`
  envelopes; ≈9× smaller, ~27× fewer files copied into `.forgeplan-web/`.
  Refs: PRD-014, RFC-013.
- `--no-experimental` flag on `update` — switch a pre-existing
  `.forgeplan-web/` from bundled back to legacy on the next refresh.
- `experimental: bool` field in `forgeplan-web.json` — records the dist
  shape `init` / `update` copied; persisted across sessions.

### Deferred (post-v0.1.12)

- **COMPARE mode for time-travel (Alt-drag two scrubbers, diff overlay)** — endpoint returns 501 with TODO marker. SC-4/SC-5 from PRD-008.

## [0.1.11] - 2026-05-06

### Added (F17)

- **Minimap on Matrix / Sankey / Sunburst** — F16 left these three views with a "MINIMAP N/A" stub because their layouts are layout-system-specific (matrix grid, sankey columns, polar). They DO have 2D node positions; just in different coord systems. Each view now emits `onViewState` with projected canvas-space `(x, y)` per node:
  - **Sankey** — centroid of d3-sankey's `(x0, y0, x1, y1)` per node.
  - **Sunburst** — polar→xy: `VIEW_W/2 + r·cos(θ − π/2)`, `VIEW_H/2 + r·sin(θ − π/2)` (matches the view's own `<g translate(VIEW_W/2, VIEW_H/2)>` wrap).
  - **Matrix** — diagonal centroid `MARGIN + HEADER + i·CELL + CELL/2` for each artifact (matches the real cell-centre in canvas coords so click-teleport lands accurately).
- **`panTo(x, y, k)` exported** from all 3 views (already existed on Force/Tree/Radial/Lanes). Click anywhere in minimap teleports the canvas at `k=1`.
- **Removed** the `enabled={false}` gate in DependencyGraph for Matrix/Sankey/Sunburst — Minimap now self-gates on `nodes.length > 0`.

## [0.1.10] - 2026-05-06

### Added (F16)

- **Infinite-feel zoom** — `scaleExtent` raised from `[0.3, 3]` (`[0.3, 4]` on Sunburst) to `[0.05, 50]` across Force / Tree / Radial / Lanes / Matrix / Sunburst views. Sankey untouched (its grid layout doesn't benefit from extreme zoom). `fitToView` clamp ceilings raised to `Math.min(2, ...)` so auto-fit can zoom in moderately on small workspaces; floors dropped to 0.05 to match scaleExtent.
- **Minimap** — new `widgets/dependency-graph/ui/Minimap.svelte` mirrors the active view's nodes in a 180×120 panel anchored bottom-right of `.canvas-body`. Each node renders as a 1.6 px circle in its kind colour; current viewport is overlaid as an accent-stroked rectangle (`var(--accent)` outline + `var(--accent-dim)` fill). Click or drag inside the minimap teleports the canvas viewport to that point at `k=1` — user never gets lost at extreme zoom. Active for Force / Tree / Radial / Lanes; Matrix / Sankey / Sunburst show a muted "MINIMAP N/A" stub since their layouts are fixed-grid.
- **`lib/minimap-math.ts`** — pure functions `computeBBox` / `bboxScale` / `canvasToMini` / `miniToCanvas` / `viewportRectInMini`. 7 vitest unit tests cover empty bbox safe default, round-trip canvas↔mini coords, viewport-rect math at identity / k=2 / panned transforms.
- **View teleport API** — Force / Tree / Radial / Lanes views expose an `onViewState` callback prop emitting `{nodes, transform, viewport}` and a `panTo(canvasX, canvasY, k?)` method via `bind:this`. DependencyGraph wraps the active view + Minimap in a `position: relative` host and routes teleport events.

## [0.1.9] - 2026-05-06

### Fixed (F15)

- **CRITICAL crash on duplicate edges** — workspaces with two `from→to:relation` tuples on the same artifact pair triggered Svelte `each_key_duplicate` runtime error across Force / Tree / Radial / Lanes / Matrix views. `filterEdges` in `lib/filter.ts` now dedupes by composite key (keeps first occurrence). 4 unit tests added.
- **HealthBar readability** — chips restructured: `<strong class="chip-value">{n}</strong> <span class="chip-label">{label}</span>` with monospace tabular numerals + uppercase 0.12em letter-spacing labels. Reads as "30 TOTAL · 27 ACTIVE · 3 DRAFT" cleanly instead of mashed `289total177active...`.
- **Chrome 132+ devtools probe 404** — added `template/static/.well-known/appspecific/com.chrome.devtools.json = {}`. SvelteKit serves it as static asset; browser stops probing.
- **ArtifactPanel button styling** — `.ghost` rule was missing inside the panel component (lived only in HomePage, scoped CSS didn't reach). Buttons rendered as browser-default. Added local `.ghost` rule: monospace, uppercase 0.06em, accent stroke on hover/`aria-expanded="true"`. Now matches landing-style design tokens (`.fp-eyebrow`, `.fp-meta-label`).

### Changed (F15)

- **ArtifactPanel default width 380 → 658 px** (+73%). Reading PRD bodies side-by-side with the graph is now comfortable. `PANEL_MAX_RATIO` raised to 0.7 (70vw drag cap from 60vw).
- **Resizable left edge** — 4px hit-area drag handle on the panel's left edge. `pointerdown/move/up` with `setPointerCapture`; `aria-orientation="vertical"`; ArrowLeft/Right keyboard alt; persisted to `localStorage.forgeplan-web.panelWidth`. Range [320, 0.7×innerWidth]. `prefers-reduced-motion` respected.
- **"📋 Copy as markdown" button moved** out of `.impact-actions` (Show downstream / Show upstream / Clear) into a new `.body-actions` row inside `<section class="body">` next to `+ Show body / − Hide body`.
- **Body section opens by default** — `bodyExpanded = $state(true)`. localStorage hydration overrides for users who explicitly muted; new users see body markdown immediately. Race-safe via `bodyHydrated` guard so the writer-effect can't overwrite the saved value before the reader-effect runs.
- **Removed inner scroll containers** — `.artifact-body { max-height: 60vh; overflow-y: auto }` and `.links ul { max-height: 30vh; overflow-y: auto }` dropped. The panel itself scrolls; no nested scrollbars to fight.
- **Page-level overflow** — `.root { overflow: hidden }`. No horizontal/vertical scroll on the page shell.
- **Sticky-stack panel sections + meta-trail** — As the user scrolls inside the ArtifactPanel, each section (`impact-actions / meta / links / body-actions`) pins below the header (`top: var(--header-h)`) with a solid background. JS state `activeStickyKey` derived from `panel.scrollTop` ensures **only one block is sticky at any moment** — earlier rows get `class:passed` → `position: static` so they scroll away with content. (Without this, a shorter active block would leave a taller previous block visibly poking out underneath, since both would be pinned at the same `top:`.) When `body-actions` becomes the active sticky, `depth` and `updated_at` from the meta block fade-slide into the right side of the row (`pointer-events: none; aria-hidden`). 220ms ease-out; honours `prefers-reduced-motion`. Header z-index raised to 10.
- **Outgoing / Incoming collapse** — Each links section now has its own toggle (`+ N · Outgoing` / `− Hide`). Auto-collapsed on artifact change when list length > 8 to prevent the panel from blowing up on hub artifacts. Per-artifact state — toggle survives the 10s poll re-deriving identical edges (the auto-collapse $effect keys on `id`, not on length).

## [0.1.8] - 2026-05-06

### Fixed (F14, post-audit cleanup)

5-expert audit (TS / Frontend / Security / Performance / UX) on F11+F12+F13 returned 0 CRITICAL, 7 HIGH, ~12 MEDIUM, ~10 LOW. This entry closes all 7 HIGH + 7 MEDIUM/LOW; rest deferred to backlog.

**HIGH:**

- **TS-H1** — `renderBody` returns `SafeHtml = string & { readonly __safeHtml: unique symbol }`. Branded type makes it impossible to feed an unsanitised string into `{@html}` indistinguishably from sanitised output.
- **TS-H2** — `// TODO(marked-types)` comment near `marked.parse(...) as string`; the cast is correct only while `async: false`; revisit on marked >= 19.
- **FE-H1 (Matrix impact-mode)** — `app.css` impact-mode selector extended from `.node` to `:is(.node, .row-header, .col-header)`. Matrix headers now correctly fade when `impactRoot` is set.
- **FE-H2 (iframe Notification)** — `notificationPermission()` / `requestPermission()` / `fire()` in `entities/health/lib/notify.svelte.ts` now wrap `Notification.permission` access and `new Notification(...)` in try/catch. Sandboxed iframes / restrictive Safari contexts no longer crash the toggle effect.
- **UX-H1 (long code overflow)** — `.artifact-body :global(pre)` and `:global(pre code)` get `max-width: 100%; white-space: pre-wrap; word-break: break-word`. Long shell lines wrap inside the `<pre>` instead of cascading horizontal scroll to the panel.
- **PERF-H1 (lazy markdown renderer)** — `marked` + `DOMPurify` no longer ship in the first-paint bundle. ArtifactPanel dynamically imports `markdown-renderer` only when the user clicks "+ Show body". First-paint −21 KB gzip.

**MEDIUM/LOW:**

- **FE-M2** — `navigator.clipboard.writeText` falls back to a `<textarea>` + `document.execCommand('copy')` shim on non-secure (http://) contexts.
- **FE-M3** — `liveText` prefixed with zero-width-space + monotonic `liveSeq` counter so identical breach text re-announces in NVDA / VoiceOver.
- **FE-M4** — Notify-on first-fire-storm prevention: when user opts in mid-session, `prevHealthSnapshot` is primed with current state; existing blind_spots no longer re-fire as "new".
- **FE-L1** — `prefers-reduced-motion` media query selector broadened from `svg *` to `*, *::before, *::after`. HTML transitions (HealthBar `.pulse`, ArtifactPanel `.copy-md`) are now honoured.
- **UX-M1** — `title=` tooltips on Show downstream / Show upstream buttons explain semantics.
- **UX-M3** — `.links ul` capped at `max-height: 30vh; overflow-y: auto`. Epic with 50 children no longer pushes body section below the fold.
- **SEC-L1** — DOMPurify `afterSanitizeAttributes` hook forces `rel="noopener noreferrer"` on any anchor with `target="_blank"` (CWE-1022 reverse-tabnabbing guard).

**Tests** — 68 → 70: added markdown-renderer test for the noopener hook, notify test for the iframe-throw case.

**Bundle** — 64 KB raw / 21 KB gzip of `marked + DOMPurify` moved from first-paint chunk to lazy chunk. First-paint NFR re-checked: PASS with new headroom.

### Added (Tactical, F13)

- **Copy as markdown** — ArtifactPanel gets a "📋 Copy as markdown" button next to the impact actions. Click writes a markdown summary of the selected artifact to the clipboard: id + title + status/kind/R_eff line + Outgoing/Incoming lists + body excerpt (first 500 chars + `...`). Closes the loop "PR review needs PRD context" — paste straight into a GitHub PR description / Slack thread / commit message. Visual feedback: ✓ Copied (green) on success, ✗ Copy failed (red) on error, both auto-revert after 2s.
- **`widgets/artifact-panel/lib/markdown-export.ts`** — pure `buildMarkdownSummary(artifact, outgoing, incoming): string`. 6 vitest unit tests cover all fields, omitted Outgoing/Incoming when empty, R_eff formatting, body truncation past 500 chars, body section omitted when body is empty.

### Added (PRD-007 + RFC-006, F12)

- **Stale + blind-spot push notifications** — HealthBar gets a 🔔 / 🔕 toggle. First click triggers `Notification.requestPermission()`; on grant, the user opts in. When the 10s `/api/health` poll detects a new blind_spot, a stale_count increase, or an orphan_count increase, a browser notification fires (silent, tagged per category, throttled to ≥ 60s per category). Click on a notification focuses the tab and selects the affected artifact via the `notifyBus.pendingFocus` singleton.
- **Permission UX** — `🔔 Notify` (active) when granted + opted in; `🔕 Notify` (inactive) otherwise; `disabled` with explanatory tooltip when permission is `denied`. Hidden entirely when `'Notification' in window === false` (Firefox no-API users, SSR).
- **a11y** — hidden `aria-live="polite"` mirror in HealthBar (.sr-only), updates on each breach so screen-readers announce independently of the OS notification.
- **`entities/health/lib/notify.svelte.ts`** — pure functions (`snapshotFromHealth` / `detectBreaches` / `notificationsSupported` / `notificationPermission` / `requestPermission` / `fire`) + `$state notifyBus` + `focusArtifact`. 9 unit tests cover snapshot extraction, all 3 breach categories, permission branches, throttle window.
- **Settings persist** — `notify: boolean` field added to `Settings`. Default false. Loaded/saved via existing localStorage flow.
- **Vitest config** — `pool: 'threads'` (was default 'forks') to avoid macOS `kern.maxprocperuid` EAGAIN at 7+ test files.

### Added (PRD-006 + RFC-005, F11)

- **ArtifactPanel body preview** — toggle "+ Show body / − Hide body" reveals the full markdown body of the selected artifact rendered in-place. State persisted per session in `localStorage["forgeplan-web.bodyExpanded"]`. PRD bodies (with FR tables, code blocks, GFM checkboxes) now read inside the web UI without opening the file in an editor.
- **Decision impact drill-down** — two new buttons in ArtifactPanel: "Show downstream" runs forward BFS through normalised hierarchy edges (informs / refines / belongs-to / contains / supersedes); "Show upstream" runs backward BFS. Affected nodes glow `var(--accent)` + stroke 2px + drop-shadow; unrelated nodes fade to opacity 0.18 across 5 views (Force / Tree / Radial / Lanes / Matrix). Sankey + Sunburst do NOT participate — their hierarchy semantics already cover this. "Clear" button drops the impact mode.
- **`lib/markdown-renderer.ts`** — exports `renderBody(md)` using `marked` (GFM enabled) + DOMPurify (allow-list of safe tags + attrs). Throws → `<pre class="raw-fallback">` escape-html fallback. 6 unit tests cover XSS strip (`<script>`, `javascript:` href), GFM tables, task-list checkboxes.
- **`lib/impact-graph.ts`** — pure functions `computeDownstream(rootId, edges)` / `computeUpstream(rootId, edges)`. BFS bounded by `MAX_IMPACT_DEPTH = 8`. Direction normalised via `type-tier.ts#normaliseHierarchyEdge`. 7 unit tests cover linear chain, diamond, cycle, depth cap, non-hierarchy filter, upstream/downstream symmetry.
- **`highlight.svelte.ts` extension** — adds `impactRoot: string | null`, `impactDirection: 'down' | 'up'` to the shared $state. New exports `setImpactRoot(id, dir?)` and `impactedClass(id, impacted)`. Re-exported from both `entities/graph` and `widgets/dependency-graph/lib` for FSD compatibility.
- **Dependencies** — `marked@^18`, `dompurify@^3` (runtime); `@types/dompurify`, `happy-dom` (dev, for vitest DOM environment in markdown-renderer tests).
- **Tests** — 47 → 53 (+ 6 markdown-renderer + 7 impact-graph; 1 was duplicated cycle case in impact-graph that survives as extra coverage).

## [0.1.7] - 2026-05-05

### Added (PRD-005, F6 UX follow-ups)

- **RadialView cluster collapse** — clusters with ≥ 3 rings render a small "−/+" toggle near their centroid. Click or Enter/Space hides ring ≥ 2 (root + ring 1 stay visible); click again to expand. State stored per-view in `$state(Set<string>)`; fitToView re-fires on toggle so the new bbox fits.
- **ArrowKey navigation** between graph nodes in RadialView and ForceView. New shared lib `keyboard-nav.ts` with `pickNextNode(current, candidates, direction)` — cone-based (±60° around the cardinal axis), cost = `distance · (1 + 2·angle/π)`, falls back to nearest neighbour when the cone is empty so the user always moves. Each `<g class="node">` gets `data-id`; `onNodeKeydown` routes focus by id.

### Changed (PRD-005 + RFC-004, F5 audit cleanup)

- **`detectClusters`** extends `ClusterInfo` with `orbits` and `radii` (computed once in pass-2) and `ClusterDetectionResult` with `nodeAdjacency`. Both views read these instead of recomputing the orbit + ring-radius pipeline per render.
- **Sorted `counts.keys()` iteration** in the radius/maxR passes. `Map.keys()` returns insertion order, which depended on orbit-assignment order; without sorted iteration the `computeRingRadius` cache resolved ring 2 before ring 1 and produced a wrong ring 2 radius (visible regression: RFC + ADR sharing one orbit position). Two regression tests now fail against the pre-fix code.
- **Filter memoisation** in RadialView and ForceView — `filterArtifacts` / `filterEdges` / `scoreById` wrapped in `$derived.by` guarded by content signatures, so a 10s poll with identical payload no longer invalidates the layout.
- **ForceView each-block link key** changed from object identity to a stable `${source}>${target}:${relation}` string. Earlier every `rebuild()` recreated all `<line>` elements.
- **`force-cluster-repel`** typed via `Object.assign` (no unsafe cast); `ForceClusterRepelOptions<NodeT extends SimulationNodeDatum>`. `forceClusterRepel`'s cached cluster ids are now refreshed via explicit `.initialize?.(simNodes)` after re-bind. Drops redundant re-bind of `forceX/forceY/orbital` (their accessors already read `layout` fresh per tick). Early short-circuit when only one cluster.
- **RadialView `didFit`** is `$state(false)` with a layout-shape signature effect that resets it on substantial transitions (filter clears / dataset reload).
- **Zoom legibility floor 0.45** (was 0.2) for both views and RadialView's `fitToView`. Labels stay legible at min zoom.
- **`tsconfig.json`**: `noUncheckedIndexedAccess: true`. Fallout fixed in `cluster.svelte.ts`'s orphans-fill block.
- **18 → 24 vitest unit tests** in `template/src/widgets/dependency-graph/lib/`: 16 cluster-geometry, 2 radii cache regression, 6 keyboard-nav.

### Security

- **CVE-2024-47764** (cookie<0.7.0, GHSA-pxg6-pf52-xh8x) — closed via `template/package.json#overrides` (`"cookie": ">=0.7.0"`, resolved to 1.1.1). Practical impact ≈ 0 (we don't serialize user-controlled cookie values), but eliminates the open dependabot alert.

### Added (PRD-005 + RFC-004, F4-clustering)

- **`lib/cluster.svelte.ts`** — shared `detectClusters` / `computeOrbitRing` /
  `computeAnchoredAngles` / `computeRingRadius` / `ringCounts` and geometric
  constants (`MIN_CHORD`, `RING_GAP`, `INTER_CLUSTER_GAP`).
- **Geometry-first ring radii** — `computeRingRadius` is chord-based, not
  arc-based: `r ≥ MIN_CHORD / (2·sin(π/N))` for the same-ring chord, plus
  `r ≥ prev + RING_GAP` for the radial gap to the previous ring. Card
  centres sit exactly on the orbit; non-overlap is provable rather than
  empirical.
- **Compact orbit assignment** — `computeOrbitRing` maps each member to
  the position of its type within `TYPE_ORDER ∩ present-types` for that
  cluster. Missing types collapse inward (no empty ring).
- **Parent-anchored angular layout** — `computeAnchoredAngles` puts each
  ring N+1 member's angle at the circular mean (`atan2(Σ sin, Σ cos)`)
  of its inner-ring neighbours. Orphans fill the largest free angular
  gap. Connected artifacts cluster angularly; ring-1 nodes spread evenly.
- **Radial-around-largest cluster placement** — the largest cluster
  occupies the canvas centre; the rest sit on a regular polygon around
  it. `outerRadius = max(R_centre + INTER_CLUSTER_GAP + R_outer,
worstPair / (2·sin(π/M)))` covers both the radial separation and the
  chord between adjacent outer clusters. Edge-gap from centre to every
  outer cluster is uniform.
- **`lib/force-cluster-repel.ts`** — custom d3-force keeping cluster
  centroids apart (Coulomb-style strength=800, minDistance=250,
  alpha-scaled). Used by ForceView only.
- **ForceView clusters** — d3 simulation extended with `clusterX`/
  `clusterY` (centripetal pull), `forceClusterOrbital` (per-node target
  radius from cluster ring map), and `forceClusterRepel`. Initial
  positions seeded near each node's cluster centroid with ±10 px
  jitter. `prefers-reduced-motion` pre-ticks the simulation instead of
  animating.
- **Visible orbit rings** — RadialView orbit stroke opacity 0.08 → 0.16,
  dash 2 4 → 3 5 — visible to the viewer without competing with relation
  edges.

### Added

- `dev:playground` mode — `template/vite.config.ts` reads a `FORGEPLAN_CWD` override gated on `mode === 'playground'`; `npm run dev:playground` (root + template) points the SvelteKit server at `playground/.forgeplan/` instead of this repo's own workspace, so sandbox experiments don't pollute `.forgeplan/`. Plain `vite dev` is unchanged.
- `playground/` — local Forgeplan workspace seeded with the fictional "Helios" observability platform: 6 epics, 16 PRDs, 19 RFCs, 13 ADRs, 17 specs, 13 problems, 9 solutions, 26 evidence packs, 4 notes (≈123 artifacts), wired with ~80 typed dependency links across all kinds and lifecycle states. Used as dogfood data at realistic scale; not published, not copied to user projects.
- `bin/banner.mjs` — ANSI Shadow ASCII banner ("Forgeplan/Web", 24-bit orange) printed as the first line of `start()`. Respects `NO_COLOR`, `TERM=dumb`, non-TTY stdout, and `-q` / `--quiet`.
- `<NodeRef>` component + `nodeHover` Svelte action (`template/src/entities/graph/`) — single primitive for rendering an artifact id anywhere in the side panels. Replaces ad-hoc id renderings in `InsightsRail` (Recent / Agents / Drafts / Blocked / Cycles / Ready / Blind spots / Orphans / Stale / Lowest R_eff) and `ArtifactPanel` (header id, Outgoing / Incoming, parent epic). Hovering any of them now lights up the matching graph node and fades the rest of the graph.
- README.md / README.ru.md — "Local dev modes" subsection covering `npm run dev` vs `npm run dev:playground`.

### Changed (PRD-004, F2-graph UX)

- **FR-001** — Selection ring no longer encloses the status dot. Each view (where applicable) renders a dedicated `<rect class="selection-ring">` sized to the card content; the status dot stays independent.
- **FR-002..FR-006** — Hovering a graph node now highlights its connected edges (`.edge-active` — accent stroke, increased width) and dims unrelated edges (`.edge-dim` — opacity 0.25). Applied across all 5 views (Force / Tree / Radial / Matrix / Lanes); Matrix uses cell `<rect>` as the edge primitive.
- Hover fade is now **distance-based**: a BFS over `filteredEdges` scales node opacity by hop distance — direct neighbours stay near full opacity, distant nodes fade further, disconnected nodes drop to ~0.12. Smooth 180 ms ease-out transition on edges and nodes.
- The same fade now triggers for the **selected/opened** node (softer dim via `.graph.focus-soft`); hover takes priority over selection when both apply.
- Hover state moved from `widgets/dependency-graph/lib/` down to `entities/graph/lib/` so `widgets/insights-rail` and `widgets/artifact-panel` can share it without crossing FSD layers. The original module path is kept as a re-export shim — `// TODO(fsd-cleanup)` marks the follow-up to update the five graph views.

### Fixed

- `/api/health` `blind_spots` now render as `[{id,title,issue}]` objects in `InsightsRail` instead of `[object Object]`. `HealthResponse` type updated; the rail shows artifact id + title.

### Fixed (PRD-003, F1 frontend recovery + a11y)

- **FR-001** — `template/src/routes/+error.svelte` added. SvelteKit error boundary with styled fallback (status, message, "Go home" link); replaces the unstyled default error page.
- **FR-002** — All 5 graph view SVGs (`Force/Lanes/Matrix/Radial/Tree`) switched from `role="application"` to `role="img"` + descriptive `aria-label`. Screen readers no longer treat them as opaque interaction zones.
- **FR-003** — `InsightsRail.svelte` rows refactored from `<li role="button" tabindex="0">` (with `svelte-ignore` suppression) to nested `<li><button>`. Native focus order, no a11y rule bypass.
- **FR-004** — `prefers-reduced-motion` honoured across graph views via shared `motionDuration()` helper. d3 `.transition().duration(300)` becomes 0 for reduce-motion users; ForceView simulation settles fast (`alphaDecay(0.1).alphaMin(0.05)`).
- **FR-005** — `.has-panel` grid no longer mis-flows at viewport `< 1100 px`. Insights rail explicitly leaves the grid (`display: none` removes its cell) and `.has-panel` drops to a 3-column template with the artifact panel correctly placed.

## [0.1.6] - 2026-05-04

### Security (PRD-002, S1 tactical hardening)

- **CWE-78** — `FORGEPLAN_BIN` regex-validated at module load in `template/src/shared/server/forgeplan.ts`. Refuses spawn (returns `502` envelope) when the env var contains characters outside `[A-Za-z0-9_./:\-]`. Closes a Windows `shell:true` command-injection vector.
- **CWE-59** — `bin/forgeplan-web.mjs#update` now `lstat`s `.forgeplan-web/` before `rmSync`; refuses to operate when target is a symlink. Plus a `resolve()`-equality assert as defense-in-depth against future refactors.
- **CWE-770** — `template/src/shared/server/forgeplan.ts` enforces in-process spawn concurrency cap (4 simultaneous `forgeplan` processes). Bounds loopback / LAN-bound DoS surface.
- **CWE-1357** — `scripts/build.mjs#installRuntimeDeps` passes `--ignore-scripts` to `npm install`. Blocks transitive postinstall hooks from baking arbitrary code into published `dist/node_modules/`.

## [0.1.5] - 2026-05-04

### Added

- Marketing-style README rewrite + Russian translation (`README.ru.md`).
- `docs/` split: `USAGE.md` (end-user reference) and `CONTRIBUTING.md` (dev/release flow).
- `.github/assets/hero.png` — interactive map screenshot for the npm landing.
- `LICENSE` (MIT) added at repo root and declared in `package.json#files`.
- `CHANGELOG.md` added at repo root and declared in `package.json#files`.
- `.claude/rules/00-index.md` now lists rule 12 (`forgeplan-agent-dispatch`).

### Fixed

- Demo console block in both READMEs aligned to the actual `init` output.
- Cross-platform CI badge URL switched from relative to absolute (renders on the npm registry landing page, not only on GitHub).

## [0.1.4] - 2026-05-04

### Added

- `update` subcommand on `bin/forgeplan-web.mjs` — refreshes `./.forgeplan-web/`
  to the version bundled with the currently-resolved package, preserving
  `workspaceRoot` and `createdAt`.
- Feature-Sliced Design migration of `template/src/`:
  `app/`, `pages/`, `widgets/`, `entities/`, `shared/` replace the old
  `lib/` layout.
- Five graph view modes — Force, Lanes, Matrix, Radial, Tree —
  in `template/src/widgets/dependency-graph/ui/`.
- New `/api/blindspots` and `/api/journal` read-only endpoints.
- `.claude/rules/12-forgeplan-agent-dispatch.md` and `ADR-002` covering
  parallel sub-agent coordination via `forgeplan_dispatch` / `forgeplan_claim`.
- Skill scaffolds for `feature-sliced-design`, `svelte-code-writer`,
  `svelte-core-bestpractices` under `.claude/skills/`.
- `scripts/dev.mjs` entry point for the SvelteKit HMR loop.
- `CLAUDE.md` rewrite: 8 RED LINES, Routing table, Forge Mode permission zones,
  EvidencePack Structured Fields example, Git workflow section, Reference
  (guides) block linking to `guides/INDEX.md`.
- `guides/CLAUDE-MD-GUIDE.ru.md` and `guides/GIT-FLOW-GUIDE.ru.md` (authored
  methodological guides bundled into the repo).
- GitHub Branch Protection on `main` + `develop` (PR required, 3-OS smoke
  required, force-push blocked, delete blocked, `enforce_admins: true`).
- Rulesets: `release-branches-no-force-push` (id 15928537) and
  `tag-protection-semver` (id 15928584, target=tag, rules=`update`+`deletion`).

### Fixed

- **Windows CI was red since day 1.** `spawnSync('npm', ...)` and
  `spawn('forgeplan', ...)` could not invoke `.cmd` shims via
  `CreateProcess` without `shell: true`. Added `shell: process.platform === 'win32'`
  to the build pipeline (`scripts/build.mjs`), the bin probe
  (`bin/forgeplan-web.mjs`), and the live server driver
  (`template/src/shared/server/forgeplan.ts`). Smoke matrix is now green
  on `ubuntu-latest` × `macos-latest` × `windows-latest` × Node 22.
- `scripts/smoke.mjs` cleanup: `await server.exit` before `rmSync`, plus
  `maxRetries: 20` / `retryDelay: 100` on Windows to avoid `EBUSY` on the
  scratch dir held by the still-exiting child process.
- `forge-safety-hook.sh`: false-positive guard for text-only commands
  (`git commit -m`, `git log`, `gh pr create`, `echo`, `printf`, `cat <<`)
  so dangerous-looking strings inside commit messages and HEREDOC bodies no
  longer trigger the block. New explicit blocks for `forgeplan init --force`
  (override `FORGE_ALLOW_INIT_FORCE=1`) and direct push to
  `main`/`master`/`develop`/`release/*` (override
  `FORGE_ALLOW_PUSH_TO_PROTECTED=1`).

### Changed

- `actions/checkout@v4` → `@v5` and `actions/setup-node@v4` → `@v5` in both
  `smoke.yml` and `release.yml` (Node 24 default ahead of the June 2026 Node
  20 deprecation).
- `package.json#scripts.dev` now points to `scripts/dev.mjs` (was inline
  `cd template && npm run dev`).

## [0.1.3] - 2026-05-04

### Added

- Cross-platform smoke matrix workflow (`.github/workflows/smoke.yml`)
  on `ubuntu-latest`, `macos-latest`, `windows-latest` × Node 22.
- `.forgeplan/` workspace seeded with the package's own decision artifacts
  (RFC-001, ADR-001, EvidencePacks).

## [0.1.2] - 2026-05-04

### Added

- `repository` metadata in `package.json` for sigstore provenance — required
  by `npm publish --provenance` to attach the build's source revision to the
  signed artifact.

## [0.1.1] - 2026-05-04

Initial public release attempt. The Windows runtime path was silently
broken end-to-end and CI matrix was red — both addressed in 0.1.4.

## [0.1.0] - 2026-04-04

Internal release. Pre-built SvelteKit app published as a single
`@forgeplan/web` npm package, scaffolded into `.forgeplan-web/` of the
host project via `npx @forgeplan/web init -y`. No `npm install` at user
side: `dist/` ships its own `node_modules/` populated with
`--omit=dev --omit=peer`.

[Unreleased]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.11...HEAD
[0.1.11]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ForgePlan/forgeplan-web/releases/tag/v0.1.1
[0.1.0]: https://github.com/ForgePlan/forgeplan-web/releases/tag/v0.1.0
