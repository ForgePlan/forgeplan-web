---
depth: standard
id: ADR-010
kind: adr
links:
- target: PRD-038
  relation: based_on
- target: ADR-003
  relation: informs
status: active
title: Agent SDK + onboarding daemon in a separate optional npm package launched by a spawn-only bin/ subcommand
---

## Context

Pillar C of the composed-map onboarding program (PRD-038) adds a **live local
onboarding agent**: the user asks questions in the web chat and a real Claude
Code session answers, driving the map camera. The fixed design (FD-1..FD-7): use
the user's LOCAL Claude Code via the **Claude Agent SDK**
(`@anthropic-ai/claude-agent-sdk`), running in a **localhost daemon-bridge** the
user launches (the SvelteKit server structurally cannot spawn `claude` — rule
22 keeps it a read-only mirror).

The trap (PRD-038 **Q1**): **ADR-003 / rule 23** pin `bin/` to a named
allow-list of exactly `node:*` + `citty`. The Agent SDK is a heavy third-party
dependency with a large transitive tree. It cannot enter `bin/` without a
decision, because `bin/` is what `npx @forgeplan/web` runs **before the user has
installed anything** — the whole point of ADR-003 is that no third-party
resolution happens at `npx` time.

## Decision

**Selected**: Ship the Agent SDK + onboarding daemon as a **separate, optional
npm package** (working name `@forgeplan/web-agent`), launched by a **spawn-only**
`bin/` subcommand.

`bin/forgeplan-web.mjs` gains an `onboard-agent` subcommand that does exactly one
new thing: `child_process.spawn` the separate package's binary (resolved from the
user's environment / `npx @forgeplan/web-agent`) and stream its output. **`bin/`
imports nothing from the agent package** — no `import`, no `require`, only a
`spawn` of an external process. ADR-003's allow-list (`node:*` + `citty` +
relative siblings) is therefore **untouched**: the core `@forgeplan/web` stays
lean and `npx`-fast for the 99% of users who only view the map; the agent is
opt-in and its heavy dependency tree is resolved **only** when a user
deliberately runs the agent.

**Why Selected**: it is the only option that keeps ADR-003's `npx`-latency
guarantee intact while still letting Pillar C "use what already exists" (the
Agent SDK). The spawn-only boundary is the same trust seam rule 22 uses for the
`forgeplan` CLI — a process boundary, not an import.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| **A — separate optional npm package + spawn-only `bin/` subcommand** | **Chosen** | Core stays lean + `npx`-fast (ADR-003 intact); SDK resolved only on deliberate agent use; process boundary mirrors rule 22's `forgeplan`/`git` spawn seam. |
| B — bundled `dist-agent/` image (esbuild-inline, PRD-030/ADR-005 shape) | Rejected | The image discipline (PRD-030) is for **viewer variants** copied by `init`; it would bloat every install with the SDK + its transitive tree even for users who never run the agent, and an esbuild single-file bundle of the Agent SDK (which itself spawns `claude`) is fragile. |
| C — extend the ADR-003 allow-list to admit the SDK into `bin/` | Rejected | Reintroduces the exact `npx`-time third-party resolution ADR-003 removed — every `init`/`start`/`update` would pay to resolve the SDK before doing its job, for a feature most users never touch. Directly violates ADR-003's invariant I3. |

## Consequences

### Positive
- Core `@forgeplan/web` unchanged in weight + `npx` latency; ADR-003 / rule 23
  hold verbatim (verified by the existing bin allow-list grep).
- The agent is strictly **opt-in**: no SDK, no `claude`, no API key for the
  view-only user.
- Security is a natural consequence of the process boundary: the daemon is a
  separate, user-launched, 127.0.0.1-bound process with a read-only agent
  profile — the web never gains a code-execution surface.

### Negative (trade-offs)
- A **second package** to publish + version (`@forgeplan/web-agent`), plus a
  documented spawn contract between the `onboard-agent` subcommand and that
  package's binary.
- The user must install / `npx` the agent package on first use (mitigated by a
  guided prompt from the `onboard-agent` subcommand when the package is absent).

### Risks
- **Version skew** between `@forgeplan/web` and `@forgeplan/web-agent` (mitigate:
  the daemon advertises a protocol version in its WebSocket probe; the web
  tolerates a missing/older daemon by staying in chat **Tier 0**).
- The spawn-only subcommand must **validate the agent package's presence** and
  fail with an actionable install hint, never a raw ENOENT.

## Invariants

- `bin/` imports only `node:*`, `citty`, and relative `bin/` siblings — the
  `onboard-agent` subcommand adds **only** a `child_process.spawn`, never an
  `import`/`require` of the agent package (rule 23 grep must still pass).
- The daemon binds **127.0.0.1 only** and is launched explicitly by the user.
- The agent runs a **read-only** profile: Read/Glob/Grep + read-only forgeplan
  MCP; no Write/Edit/Bash.
- The SvelteKit server (`/api/*`) is never involved in the agent path — the
  browser talks to the daemon directly (rule 22 intact).

## Evidence Requirements

- A spawn smoke: `bin onboard-agent` spawns the agent package binary (or emits
  the install hint when absent) — exit-code asserted.
- Rule-23 verification grep over `bin/` still reports OK (no new bare-specifier
  imports).
- The agent package's SDK options object denies Write/Edit/Bash and binds
  localhost only (asserted in the agent package's own tests).

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-038 | PRD | based_on (Pillar C, Q1) |
| ADR-003 | ADR | informs (the bin/ allow-list this preserves) |
| RFC (Pillar C daemon, pending) | RFC | based_on (the RFC that presumes this packaging) |

