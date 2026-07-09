# Claude Code plugins

This repo enables 11 Claude Code plugins from the
[`ForgePlan/marketplace`](https://github.com/ForgePlan/marketplace).
The marketplace is **not vendored** — Claude Code clones it into
`~/.claude/plugins/cache` on first start.

**Source of truth:** [`.claude/settings.json`](../.claude/settings.json)
keys `extraKnownMarketplaces.forgeplan` and `enabledPlugins`. To add /
remove a plugin for the whole team — flip the boolean there.

---

## Trust handshake (once per machine)

On first open of this repo Claude Code prompts:

1. **Trust folder** → `extraKnownMarketplaces` activates.
2. Install the `forgeplan` marketplace → **Yes**.
3. Install each enabled plugin → **Yes to all**.
4. Run `/reload-plugins` (or restart). Commands appear in `/help`,
   agents in `/agents`.

If the prompt didn't fire (e.g. resumed session): `/plugin marketplace
add github:ForgePlan/marketplace` then `/reload-plugins`.

---

## Installed plugins

| Plugin                      | What it gives                                                                                                                                             | Entry points                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `dev-toolkit`               | `/audit` (4-agent review), `/sprint`, `/recall`, `/report`, dev-advisor agent, safety hook, `forge-report` skill                                          | `/dev-toolkit:audit`, `/dev-toolkit:report`, ... |
| `forgeplan-workflow`        | `/forge-cycle`, `/forge-audit`, forge-advisor agent, methodology KB                                                                                       | `/forgeplan-workflow:forge-cycle`                |
| `forgeplan-orchestra`       | `/sync`, `/session` — **requires Orchestra MCP server `orch`**, not wired here. Plugin loads silently; `/sync` is a no-op.                                | `/forgeplan-orchestra:session`                   |
| `forgeplan-brownfield-pack` | C4 / DDD / MADR ingest mappings + playbooks (alpha)                                                                                                       | mappings, no commands                            |
| `fpf`                       | First Principles Framework: `/fpf`, `/fpf-decompose`, `/fpf-evaluate`, `/fpf-reason` + 224-section knowledge base                                         | `/fpf:fpf`, `/fpf:fpf-reason`                    |
| `laws-of-ux`                | `/ux-review`, `/ux-law`, ux-reviewer agent, auto-hint hook on `.html` / `.css` / `.jsx` / `.tsx` / `.vue` / `.svelte`                                     | `/laws-of-ux:ux-review`                          |
| `agents-core`               | 11 agents: debugger, code-reviewer, error-detective, performance-engineer, production-validator, coder, planner, researcher, reviewer, tester, tdd-london | `Agent({subagent_type: "agents-core:<name>"})`   |
| `agents-domain`             | 11 framework specialists: typescript-pro, frontend-developer, nextjs-developer, golang-pro, mobile-app-developer, ...                                     | `Agent({subagent_type: "agents-domain:<name>"})` |
| `agents-pro`                | 21 agents: security-expert, adr-architect, ddd-domain-expert, ml-developer, ui-designer, ...                                                              | `Agent({subagent_type: "agents-pro:<name>"})`    |
| `agents-github`             | 7 agents: pr-manager, issue-manager, release-manager, repo-architect, multi-repo-manager, project-board-manager, workflow-engineer                        | `Agent({subagent_type: "agents-github:<name>"})` |
| `agents-sparc`              | SPARC: specification → pseudocode → architecture → refinement + sparc-orchestrator (**experimental**)                                                     | `Agent({subagent_type: "agents-sparc:<name>"})`  |

---

## When to use what

| Situation                                        | Reach for                                                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Standard+ Forgeplan cycle in chat                | `/forgeplan-workflow:forge-cycle "<task>"` (wraps `route → new → validate → score → activate`)                              |
| Decision / system decomposition (Deep+)          | `/fpf:fpf-decompose` or `/fpf:fpf-reason` (3+ hypotheses → ADI), free even without LLM provider in `.forgeplan/config.yaml` |
| Frontend UX review of a Svelte / HTML change     | `/laws-of-ux:ux-review`                                                                                                     |
| Quick parallel code audit (smoke)                | `/dev-toolkit:audit`                                                                                                        |
| Multi-step task report (build / audit / migrate) | `/dev-toolkit:report` or `forge-report` skill                                                                               |
| Need to spawn a typed expert agent               | `Agent({subagent_type: "<plugin>:<name>"})` from `agents-{core,domain,pro,github}`                                          |

**Avoid for production work without explicit ask:** `agents-sparc`
(marked experimental).

---

## Conflicts and stacking

- **`forge-safety-hook.sh` runs from two sources** — the local
  `.claude/hooks/forge-safety-hook.sh` and `forgeplan-workflow/hooks/
scripts/forge-safety-hook.sh` both subscribe to `PreToolUse:Bash`.
  Hooks run sequentially; both are read-only checks, no state mutation.
  The duplicate is intentional defence in depth on `git push --force` /
  `rm -rf /` / `npm publish`.
- **Slash-command namespacing** prevents collisions — every plugin
  command is `/<plugin>:<cmd>`. Project-local commands (none here yet)
  would not need the prefix.
- **`agents-core:code-reviewer`** has no project-local override in this
  repo (`.claude/agents/` is absent). The plugin agent is what runs
  when you call `Agent({subagent_type: "agents-core:code-reviewer"})`.
- **`forgeplan-orchestra`** is enabled but inert — it needs the
  Orchestra MCP server `orch`, which is not wired in `.mcp.json`.
  Calling `/forgeplan-orchestra:sync` is a no-op (does not error). Wire
  `orch` separately if you want bidirectional Orchestra sync.

---

## Update / disable

```bash
# inside Claude Code:
/plugin marketplace update forgeplan       # pull newer plugin versions
/plugin disable <name>@forgeplan           # disable one plugin
/plugin uninstall <name>@forgeplan         # remove entirely

# or for the whole team — flip the boolean:
$EDITOR .claude/settings.json              # enabledPlugins.<name> = false
```

After editing `settings.json`, run `/reload-plugins` (or restart
Claude Code) for the change to take effect.

---

## Verification

After install, `/help` should list namespaced commands from each
plugin (e.g. `/dev-toolkit:audit`, `/fpf:fpf`, `/laws-of-ux:ux-review`).
`/agents` should show pluginned agent names. If commands are missing —
`/reload-plugins` and re-check `enabledPlugins` in `settings.json`.
