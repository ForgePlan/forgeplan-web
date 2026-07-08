# @forgeplan/web-agent

`@forgeplan/web-agent` is the optional, separately-published daemon-bridge
behind forgeplan-web's live onboarding chat (RFC-034 Pillar C / ADR-010). It
boots a persistent Claude Agent SDK session in a **read-only** profile
(`Read`/`Glob`/`Grep` + one in-process `show_on_map` tool; `Write`/`Edit`/
`Bash` denied), rooted at the project's `cwd`, and binds a WebSocket **on
`127.0.0.1` only**. The browser's `map-chat` widget talks to this daemon
directly — never through forgeplan-web's `/api/*` (which stays a read-only
proxy per rule 22) — streaming assistant prose back as `token` frames and
relaying each `show_on_map` tool call as a frame the map camera reacts to.

It is launched via `npx @forgeplan/web onboard-agent`, a spawn-only
subcommand in the core `@forgeplan/web` package (`bin/` never imports this
package — it only `child_process.spawn`s the binary shipped here, per
ADR-010, so the core package's `npx` weight is unaffected for the 99% of
users who only view the map). Directly: `npx @forgeplan/web-agent --cwd
<project-root> --port 7431`.

Guarantees: localhost-bind only (no `--host` flag exists by design), a
read-only Agent SDK profile enforced in `lib/profile.mjs`, and the daemon
uses the invoking user's own local Claude Code authentication — no API key
is baked in or required.
