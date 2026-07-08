---
depth: standard
id: EVID-104
kind: evidence
last_modified_at: 2026-07-08T15:14:32.244286+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: informs
status: draft
title: 'Security/governance review of PRD-039 (3D iso-map AC-5/NFR-006): PASS — rule-22 holds, 0 new server/network surface'
---

## Verdict

**PASS**

- **PASS** — no findings at or above Low attributable to this feature; PRD-039 AC-5 / NFR-006 (rule-22 read-only-proxy governance half) is satisfied on the security axis. Safe to activate on this axis.
- CONCERNS — *(not this)*
- BLOCKER — *(not this)*

One-line justification: the 3D isometric map minimap is a purely client-side render of already-existing read-only map data — it touches **zero** server route / `shared/server` files, adds **zero** new endpoints, **zero** spawn/write/mutation call sites, and its only network access is one same-origin read-only **GET** to the pre-existing, already-rule-22-amended `/api/map/layers/<zone>` endpoint. `three.js`/`@threlte` are a client-only lazy chunk that never reaches the server. This EVID closes the AC-5 governance half that guardian gate **EVID-102** flagged as "recorded nowhere" (its orchestrator instruction #1).

## Measurement (exactly what was checked)

**Claim under test:** the 3D-iso-map feature adds NO new server or network attack surface; rule-22 (`/api/*` is a read-only forgeplan proxy) holds.

**M1 — Did the iso feature touch any server route or `shared/server`?** (iso-scoped diff `f0ffeb7..HEAD`)
```
$ git diff --name-status f0ffeb7..3e948dd -- template/src/routes/api/ template/src/shared/server/
(no output — EMPTY)

$ git log --oneline 54a905c..HEAD -- template/src/routes/api/map/ template/src/shared/server/map.ts
e9c21b5 feat(idef0): E3 seam — render map-pack generated layers on descend
b64fd09 feat(idef0): composed-map Phase-1 core — entity, validator, layout, API
```
→ The iso feature touched **no** server file. `/api/map`, `/api/map/layers/[zone]`, and `shared/server/map.ts` were added by the **earlier** composed-map commits `b64fd09` / `e9c21b5` (PRD-036 / PRD-038 FR-002) and are already rule-22-amended in `.claude/rules/22-readonly-proxy.md`.

**M2 — Rule-22 sink grep over the new client widget + shared bus** (the exact grep the dispatch asked for):
```
$ grep -RInE "spawn|execFile|fetch\(|writeFileSync|POST|PUT|DELETE" \
      template/src/widgets/iso-map/ \
      template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts
iso-map/model/iso-view-state.render.test.ts:50: // ...no per-zone layer `fetch()` is   (test comment)
iso-map/model/iso-view-state.svelte.ts:367:   const res = await fetch(`/api/map/layers/${encodeURIComponent(zoneId)}`);
```
→ Exactly **one** production sink: a `fetch()` **GET** (no `method`/body/headers/credentials override → default GET) to the existing read-only `/api/map/layers/<zone>` endpoint, with `encodeURIComponent` on the id. No `spawn`, `execFile`, `writeFileSync`, `POST`, `PUT`, `DELETE`.

**M3 — Injection / remote-code / alternate-transport sweep over the whole iso feature:**
```
$ grep -RInE "eval\(|new Function|document.write|innerHTML|importScripts|XMLHttpRequest|WebSocket|EventSource|sendBeacon|new Worker" template/src/widgets/iso-map/
(no output — NONE)
```
→ Zero `eval` / `new Function` / DOM-sink / alternate network transport. The only dynamic import is `IsoMapCorner.svelte:22` `browser ? import('@/widgets/iso-map') : null` — a **static local module specifier** (Vite `@/` alias → `template/src/`), `browser`-guarded and `<svelte:boundary>`-wrapped. No user input reaches the import path; no remote script.

**M4 — The consumed endpoint is GET-only, read-only, path-traversal-defended** (read of the actual handlers):
- `routes/api/map/+server.ts` — exports only `GET`; delegates to `readMapFile()`.
- `routes/api/map/layers/[zone]/+server.ts` — exports only `GET`; rejects any `zone` failing `isValidZoneId` (`^[a-zA-Z0-9._-]+$` **and** explicit `!zone.includes("..")`) with HTTP 400 *before* filesystem access.
- `shared/server/map.ts` — `readMapFile` / `readMapLayerFile` use only `existsSync` + `readFileSync` from `node:fs`. No `spawn`, no write, no forgeplan invocation, no network.

**M5 — Dependency audit (`three`/`@threlte` at pinned versions):**
```
$ npm audit --audit-level=low --json   # in template/
vuln totals: {info:0, low:0, moderate:3, high:3, critical:0, total:6}
three/@threlte/draco/ktx advisories: []   ← none
```
→ Pinned `three ^0.185.1`, `@threlte/core ^8.5.16`, `@threlte/extras ^9.21.0`, `@types/three ^0.185.0` (dev) introduce **0** advisories. `three` is bundled into a **client-only lazy chunk** (verified by EVID-099/100: absent from the SSR `dist/index.js` and from eager entry chunks) — it never reaches the server runtime.

**M6 — vite draco/basis stub is a build-only, no-execution module:** `vite/stubs/three-loaders.ts` exports only empty declarations (`class DRACOLoader {}`, `class KTX2Loader {}`, `const DRACO_GLTF_CONFIG = {}`), referenced **only** from `vite.config.ts` `resolve.alias` onto exact deep specifiers (never the bare `three` package). It *removes* ~1.2 MB of unused WASM loader code — it reduces attack surface. `dist/` never executes `vite.config.ts` (rule 21).

## Result (concrete counts)

- **0** new spawn / execFile sites.
- **0** new mutating endpoints (`POST`/`PUT`/`DELETE`/`PATCH`) — the two map endpoints are `GET`-only.
- **0** new server route files added by the iso feature (`git diff` over `routes/api/` + `shared/server/` = empty).
- **0** filesystem write / mutation call sites (no `writeFileSync`/`mkdirSync`/`renameSync`/`unlink`).
- **0** new external-network egress (no external host; no XHR/WebSocket/EventSource/sendBeacon/Worker).
- **1** new server touchpoint total: a client `fetch()` **GET** to the already-allow-listed read-only `/api/map/layers/<zone>` (rule-22 amendment PRD-038 FR-002) — path-traversal-defended by `isValidZoneId`.
- **0** `eval`/`new Function`/remote-script/dynamic-remote-import sites.
- **0** new dependency advisories from `three`/`@threlte` (6 pre-existing advisories are all in the unrelated SvelteKit/Svelte/vite/ws/dompurify/devalue toolchain — see Residual risks).
- **STRIDE / OWASP:** no new surface in any category — Tampering (no browser→server mutation), Info-disclosure (traversal blocked; no external egress), Elevation (no new endpoint/spawn), A01/A03/A05/A06/A10 all clear.

## Interpretation (what it means for AC-5 / NFR-006)

PRD-039 **NFR-006** requires "**0** new server endpoints, **0** browser-initiated forgeplan mutations, and **0** spawn/write/network call sites; it reads only the existing GET-only `/api/map` + `/api/map/layers/<zone>` responses." Every one of those thresholds is met and independently verified against frozen git ground truth and the actual shipped source. **AC-5's governance half is satisfied → rule-22 holds → PASS** on the security/governance axis. (AC-5's *bundle-size-cap* half and AC-1/AC-3/FR-005 *browser render-proof* remain separate gates owned by ADR-011 and a tester EVID respectively — see next steps; they are outside this security audit's scope.)

## Congruence Level Justification (CL3)

**CL3 — same context.** This audit was run directly against the **actual shipped source** the PRD governs, on the exact review branch (`feat/idef0-3d-iso-view` @ `3e948dd`): the real route handlers, the real widget code, the real `package.json` pins, and `npm audit` against the real installed dependency tree — not a proxy, model, staging analogue, or prose summary. The measured artefact (the feature's server/network surface) *is* the artefact NFR-006 constrains, and the measurement method (git-diff scoping + rule-22 greps + handler reads + dependency audit) is exactly the "rule-22 verification greps" NFR-006 names as its own Measurement. Same system, same branch, same acceptance criterion → CL3 (penalty 0.0).

## Ground-truth verification

- Base..head: `54a905c..3e948dd` (merge-base with `develop` .. `HEAD`). The branch stacks the whole idef0 arc off an old develop base, so the merge-base diff carries ~100 unrelated already-shipped commits; the **iso-specific** delta is `f0ffeb7..3e948dd` (the range EVID-100 established; `f0ffeb7` present via `git cat-file -t`).
- Diff probe: `git diff --quiet 54a905c..3e948dd` → **DELTA=PRESENT** (232 files, 58048 insertions).
- Expected delta token: `widgets/iso-map` + `shared-drill-bus` + `IsoMapCorner` (source: PRD-039 FR-001/FR-003). Token probe: `find template/src/widgets/iso-map -type f` → **FOUND** (21 files); `shared-drill-bus.svelte.ts` **FOUND**; `IsoMapCorner.svelte` **FOUND**.
- Verdict floor from ground-truth gate: **PASS-eligible** (DELTA=PRESENT, tokens FOUND — the change genuinely landed; server-surface diff empty).

## Scope

### Reviewed
- `template/src/widgets/iso-map/**` (21 files) — the new 3D widget; primary new client surface.
- `template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts` — shared focus-chain bridge (FR-003).
- `template/src/widgets/dependency-graph/ui/IsoMapCorner.svelte` — Map-view-only mount + lazy dynamic import (FR-005) + honest-fallback boundary (FR-007).
- `template/src/routes/api/map/+server.ts`, `routes/api/map/layers/[zone]/+server.ts`, `shared/server/map.ts` — the read-only endpoints consumed (GET-only + read-only + traversal-defended; verified untouched by iso).
- `template/vite.config.ts` + `template/vite/stubs/three-loaders.ts` — build-only stub alias.
- `template/package.json` — the added deps; `npm audit` over the installed tree.
- PRD-039 (AC-5 / NFR-006), EVID-102 (requesting gate), EVID-100 (iso-scoped base).

### Not reviewed (out of scope)
- Functional correctness of the 3D↔2D sync, WebGL rendering, test coverage — covered by EVID-099/100/101/102.
- `routes/api/score/+server.ts` (Modified in the develop-base diff) + map-chat agent client — earlier composed-map/chat work, not the iso feature.
- Bundle-size-cap resolution (ADR-011) and browser render-proof (tester EVID) — separate AC gates.
- Deployed-environment DAST / `dist/` adapter-node runtime — static/source review only.

## Methodology

| Step | Detail |
|---|---|
| STRIDE | Tampering, Information disclosure (traversal / egress), Elevation (new endpoint/spawn) — none present |
| OWASP Top 10 | A01 Broken Access Control (traversal on `/layers/<zone>`), A03 Injection (eval/remote import/URL interp), A05 Misconfiguration (rule-22 boundary), A06 Vulnerable Components (three/@threlte), A10 SSRF (server outbound) — walked |
| Threat model depth | Facet walk over the actual attack surface (client render + one read-only GET); no DREAD (no Critical/High) |
| Scanners | see table |

### Scanners

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| npm audit | `npm audit --audit-level=low --json` (`template/`) | executed | 1 | 6 advisories (3 mod / 3 high / 0 crit); **0** in three/@threlte/draco/ktx |
| git ground-truth | `git diff f0ffeb7..HEAD -- routes/api shared/server` | executed | 0 | empty — iso touched no server surface |
| rule-22 grep | `grep -RInE "spawn\|execFile\|fetch\(\|writeFileSync\|POST\|PUT\|DELETE" widgets/iso-map/ shared-drill-bus.svelte.ts` | executed | 0 | 1 read-only GET (+1 test comment); no mutation verb |
| injection sweep | `grep -RInE "eval\(\|new Function\|document.write\|innerHTML\|importScripts\|XMLHttpRequest\|WebSocket\|EventSource\|sendBeacon\|new Worker" widgets/iso-map/` | executed | 0 | NONE |
| semgrep / gitleaks / trivy | — | skipped (not installed) | — | not on PATH; targeted greps + manual reads cover the rule-22 surface |

## Findings

None at or above Low severity **attributable to this feature**. This is not a bare "no findings": each falsifiable NFR-006 threshold (0 endpoints / 0 mutations / 0 spawn-write-network) was checked against frozen git ground truth and the actual source and affirmatively verified (see Measurement M1–M6 and Result). The single new server touchpoint is a read-only GET already covered by rule-22's `/api/map/layers/<zone>` amendment; injection sinks, alternate transports, and new dependency advisories are all zero.

## Residual risks

- **Pre-existing toolchain advisories (out of scope — NOT introduced by this feature).** `npm audit` reports 6 advisories in the existing template stack: `@sveltejs/kit` (mod, `query.batch` cross-talk), `svelte` (mod, SSR XSS / DOM-clobbering), `dompurify` (mod, `IN_PLACE` XSS), `devalue` (high, sparse-array DoS), `vite` (high, `server.fs.deny` bypass / launch-editor NTLM — dev-server only), `ws` (high, memory-disclosure/DoS — dev transport). None involve `three`/`@threlte`. Recommend a separate `npm audit` remediation pass, tracked apart from this feature.
- **Dev-only `server.fs.strict: false` in `vite.config.ts`** — Vite dev-server setting, pre-existing, not shipped in the pre-built `dist/` (adapter-node bundle, never runs vite). Not a runtime exposure of the published app.
- **`isValidZoneId` MVP scope** — single-segment top-level zone ids only; nested `<ancestor>/<zone>` paths are a documented follow-up (PRD-038 out of scope). Current guard correctly rejects nested/traversal input; re-review the guard when nesting is added.
- **Static/source review only** — no DAST against a live instance; read-only nature verified from source.

## Recommended next steps

- [→ guardian] Re-run the pre-activation gate: this EVID closes EVID-102 orchestrator-instruction #1 (AC-5 rule-22 governance half). Instruction #2 (browser render-proof / on-demand-load network trace — AC-1/AC-3/FR-005) remains for a `tester` EVID before activating PRD-039.
- [→ orchestrator] The rule-22 axis is clear; hold PRD-039 in draft only pending the render-proof EVID, then re-gate + activate PRD-039 / ADR-011 / RFC-036 together.
- [→ orchestrator, separate track] Schedule an `npm audit` remediation pass for the 6 pre-existing template-toolchain advisories (unrelated to this feature).

## References

- Artifact under review: PRD-039 (AC-5 / NFR-006)
- Requesting gate: EVID-102 (guardian CONCERNS — instruction #1 = "dispatch security-expert for rule-22 pass"); prior chain EVID-099 (tester), EVID-100 / EVID-101 (code-review); EVID-105 (guardian re-gate that flagged this EVID's earlier stub state)
- Iso-scoped diff base: `f0ffeb7..3e948dd` (per EVID-100); develop merge-base `54a905c`
- Independent runs: `git diff f0ffeb7..HEAD -- routes/api shared/server` (empty); rule-22 + injection greps over `widgets/iso-map/`; reads of both `/api/map*` handlers + `shared/server/map.ts` + `IsoMapCorner.svelte` + `iso-view-state.svelte.ts:362-381` + `vite.config.ts` + `vite/stubs/three-loaders.ts`; `npm audit --json` in `template/`

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: measurement

