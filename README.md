<div align="center">

# @forgeplan/web

<img src="https://raw.githubusercontent.com/ForgePlan/forgeplan-web/main/.github/assets/hero.png" alt="@forgeplan/web — interactive map for a Forgeplan workspace" width="100%">

### Browse your Forgeplan workspace as an interactive graph

A tiny **npm CLI** that scaffolds a **pre-built SvelteKit viewer** into your
project. Zero install at user side — `npx @forgeplan/web init -y` copies a
self-contained app, `npx @forgeplan/web start` opens a force-directed map
of every PRD, RFC, ADR, Spec, Epic, and EvidencePack in your `.forgeplan/`
workspace.

<br>

[![License: MIT](https://img.shields.io/badge/license-MIT-000.svg?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/npm/v/@forgeplan/web?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@forgeplan/web)
[![CI](https://img.shields.io/github/actions/workflow/status/ForgePlan/forgeplan-web/smoke.yml?branch=main&style=flat-square&label=smoke)](https://github.com/ForgePlan/forgeplan-web/actions/workflows/smoke.yml)
[![cross-platform](https://img.shields.io/badge/cross--platform-linux%20%7C%20macos%20%7C%20windows-blue?style=flat-square)](https://github.com/ForgePlan/forgeplan-web/actions/workflows/smoke.yml)

**[Forgeplan](https://github.com/ForgePlan/forgeplan)** ·
**[Documentation](docs/README.md)** ·
**[Usage](docs/USAGE.md)** ·
**[Releases](https://github.com/ForgePlan/forgeplan-web/releases)** ·
**[npm](https://www.npmjs.com/package/@forgeplan/web)**

<br>

[English](README.md) **·** [Русский](README.ru.md)

<br>

</div>

---

<div align="center">

```
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │  INIT  │ ─▶ │  COPY  │ ─▶ │  START │ ─▶ │ BROWSE │
    └────────┘    └────────┘    └────────┘    └────────┘
     verify       cp -r dist    spawn node     map @ 5174
```

**Read-only. Cross-platform. Zero install.**

</div>

---

## Why

<table>
<tr>
<td width="50%">

### Before

- `forgeplan list` → flat text, no relations
- Links between PRD ↔ RFC ↔ Evidence implicit
- ASCII mermaid via `forgeplan graph` is one-shot
- Reading raw markdown for the body of every artifact
- Spinning up a SvelteKit dev loop just to look at the data

</td>
<td width="50%">

### After

- Force-directed map of artifacts, sized by `R_eff`
- Typed edges (`informs`, `refines`, `supersedes`, …) as arrows
- Live, pannable, zoomable, **five view modes**
- Side panel renders the markdown body + links of the selection
- One `npx` — no install at user side, server boots in seconds

</td>
</tr>
</table>

## Install

```bash
# One-off (recommended)
npx @forgeplan/web init -y
npx @forgeplan/web start
```

```bash
# Or globally on PATH
npm install -g @forgeplan/web
forgeplan-web init -y
forgeplan-web start
```

Requires Node `^20.19.0 || >=22.12.0`, the `forgeplan` CLI on PATH, and a
`.forgeplan/` workspace in the current directory. Full reference —
[`docs/USAGE.md`](docs/USAGE.md).

## 60-Second Demo

```console
$ cd ~/projects/my-app/                     # first run, project has .forgeplan/

$ npx @forgeplan/web init -y
  → creating /Users/me/projects/my-app/.forgeplan-web
  → created .gitignore (added .forgeplan-web/)

  ✓ ready (no install needed)
    npx @forgeplan/web start
    # or: node .forgeplan-web/index.js

$ npx @forgeplan/web start
  → starting forgeplan-web on http://127.0.0.1:5174
    workspace: /Users/me/projects/my-app
  Listening on http://127.0.0.1:5174
```

> Subsequent runs show `→ updating ...` and `→ appended .forgeplan-web/ to
.gitignore` (idempotent — the line is added once and preserved).

Open the URL — your workspace renders as a force-directed graph. Filter
by kind, status, `R_eff` range; click any node to read its markdown body
and traversable links. The browser polls every 10 s, so changes on disk
appear in seconds (after `forgeplan reindex`).

## What you get

|                             |                                                                                                                       |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **📦 Zero install at user** | The package ships `dist/` with `node_modules/` baked in. `init` is a `cp -r`. No `npm install` runs at user side.     |
| **🪟 Truly cross-platform** | Smoke matrix on `ubuntu-latest` / `macos-latest` / `windows-latest` × Node 22, green on every push since v0.1.3.      |
| **🔒 Read-only by design**  | `/api/*` proxy invokes only read-only `forgeplan` subcommands (rule 22). The viewer **cannot mutate** your workspace. |
| **🌐 Five graph views**     | Force, Lanes, Matrix, Radial, Tree. Each picks a different question — flow, adjacency, hierarchy, parent/child.       |
| **⚡ Live polling**         | UI refreshes every 10 s. No manual reload, no websocket plumbing.                                                     |
| **🤖 Agent-aware**          | Hooks + CLAUDE.md + guides ship in this repo for safe AI-agent collaboration.                                         |
| **🏷️ Forgeplan-native**     | Speaks the methodology — PRDs, RFCs, ADRs, Evidence, `R_eff` scoring, structured links — out of the box.              |

## What it shows

| Surface                                                     | Source                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| Force-directed map of artifacts                             | `forgeplan list --json`                                      |
| Typed dependency edges                                      | `forgeplan graph --json`                                     |
| Side panel with full markdown body                          | `forgeplan get <id> --json`                                  |
| Live health bar                                             | `forgeplan health --json`                                    |
| Insights tabs (Recent / Agents / Blocked / Drafts / Health) | `forgeplan log --json`, `claims --json`, `blocked --json`, … |
| Filters (kind, status, `R_eff` range)                       | client-side, persisted in `localStorage`                     |

Full feature catalog — [`docs/USAGE.md`](docs/USAGE.md).

## Documentation

Three entry points — pick the one that matches what you need now.

| I want to...            | Start here                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Use the package**     | [`docs/USAGE.md`](docs/USAGE.md) — install, CLI, env vars, endpoints                |
| **Contribute**          | [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — layout, dev loop, CI, release flow |
| **Work with AI agents** | [`CLAUDE.md`](CLAUDE.md) · [`guides/INDEX.md`](guides/INDEX.md)                     |

## Dogfood

<table>
<tr>
<td align="center"><b>~200</b><br>LOC in the bin script</td>
<td align="center"><b>3</b><br>OS verified in CI</td>
<td align="center"><b>0</b><br>runtime deps in <code>bin/</code></td>
<td align="center"><b>~6 MB</b><br>tarball with bundled <code>node_modules</code></td>
</tr>
</table>

This repository follows its own methodology — every PRD, RFC, ADR and
EvidencePack lives in [`.forgeplan/`](./.forgeplan/), validated and scored
locally; nothing ships to `main` without `R_eff > 0`, an active artifact,
and a green smoke matrix.

## Contributing

```bash
# Branch from develop (main is touched only via release/* and hotfix/*)
git checkout develop && git pull
git checkout -b feature/my-thing

# Work the cycle: route → shape → build → smoke → evidence → activate → PR
# CI must be green on ubuntu/macos/windows × Node 22 before merge
gh pr create --base develop
```

Branch protection enforces the rules server-side — direct push to `main`
or `develop`, force-push to either, and tag rewrite on `v*.*.*` are
rejected with `GH006` / `GH013`. Full guide — [`CLAUDE.md`](CLAUDE.md).

## License

MIT — see [LICENSE](LICENSE).

<br>

<div align="center">

### Read-only. Cross-platform. Zero install.

**[→ Install now](#install)** then `npx @forgeplan/web start`.

<br>

<sub>Companion to <a href="https://github.com/ForgePlan/forgeplan">@ForgePlan/forgeplan</a> · <a href="README.ru.md">Русская версия</a></sub>

</div>
