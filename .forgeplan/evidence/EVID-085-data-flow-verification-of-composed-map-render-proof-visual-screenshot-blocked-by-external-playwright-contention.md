---
depth: standard
id: EVID-085
kind: evidence
last_modified_at: 2026-07-03T01:45:49.792922+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: active
title: Data-flow verification of composed-map render-proof — visual screenshot blocked by external Playwright contention
---

## What this verifies

RFC-030 names the visual browser render-proof "the load-bearing Phase-1 gate" — this EVID records what was actually verifiable this wave and, honestly, what was NOT.

### Verified (HTTP/data-flow level, CL2)

1. Discovered and root-caused a pre-existing (not introduced this wave) dev-mode-only quirk in `template/src/shared/server/forgeplan.ts#readWorkspaceRoot()`: `APP_ROOT` is computed via a relative walk (`resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")`) that assumes the BUILT/bundled scaffold's file depth (`<scaffold>/server/chunks/<hash>.js`, per the file's own FIXME comment). Under raw `vite dev` (unbundled, running from `template/src/shared/server/forgeplan.ts` directly), this same math resolves `APP_ROOT` to `template/src`, so the parent-dir fallback becomes `template/` instead of the actual workspace root — meaning any `npm run dev` instance started without an explicit `FORGEPLAN_CWD` env var will never find `.forgeplan/map/map.json` at the real repo root, regardless of what's in it. Two already-running dev servers on this box (ports 5174, 5177 — started by earlier sessions, left untouched) both exhibit this: `curl :5174/api/map` / `curl :5177/api/map` both return the empty envelope `{"ok":true,"data":{}}`.
2. Started a THIRD, additive dev server (port 5179, `FORGEPLAN_CWD=/Users/explosovebit/Work/ForgePlanWeb npx vite dev --port 5179`) to work around the above without touching the other two. Confirmed via `curl :5179/api/map`: the full checkpoint document round-trips correctly — `schema: "forgeplan.map/v1"`, `canvas.grid: {cols:4, rows:2}` (the spike-grid ground truth), `composition.template: "grid-2x4"`, `entry_zone: "z.surfaces"` — i.e., the exact fixture content, served correctly end-to-end: file on disk → `readMapFile()` → `/api/map` → JSON envelope.

### NOT verified this wave (genuine gap, not swept under the rug)

The actual browser-rendered SVG canvas — zone slabs, node cards, edges, flow chips, the composed layout visually matching the 2×4 spike grid — was **not** screenshotted. The Playwright MCP browser (`mcp-chrome-9eded24` profile) is held exclusively by a different, already-running Chrome process (PID 19449, started 14:11, evidently owned by a concurrent session on this machine) — every `browser_navigate`/`browser_tabs` call fails with "Browser is already in use... use --isolated". This is external resource contention, not a code defect, and not something the orchestrator can safely resolve unilaterally (killing another session's live browser process was judged too risky/destructive to attempt without confirmation; the user was asked and did not respond within the turn). Port 5179 is left running for whoever next has browser access to complete this check.

## Structured Fields

verdict: supports
congruence_level: 2
evidence_type: measurement


