#!/usr/bin/env bash
# SessionStart hook — injects forgeplan-web project context as additionalContext.
# Outputs JSON per https://docs.claude.com/en/docs/claude-code/hooks
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

FP_HEALTH=""
if command -v forgeplan >/dev/null 2>&1; then
  FP_HEALTH="$(cd "$ROOT" && forgeplan health 2>/dev/null | head -20)"
fi

read -r -d '' CTX <<EOF || true
forgeplan-web rules index (must follow):
- Forgeplan artifact required for Standard+ work; R_eff > 0 + active before merge. See .claude/rules/11-forgeplan-required.md
- Comments policy: TODO/FIXME for unfinished/edge cases. See .claude/rules/10-comments-policy.md
- Never modify the host project from \`init\` — write only to \`.forgeplan-web/\`. See .claude/rules/20-init-host-isolation.md
- Template purity: no symlinks, no absolute paths, no host-package references in \`template/\`. See .claude/rules/21-template-purity.md
- SvelteKit \`/api/*\` endpoints are read-only proxies to \`forgeplan <cmd> --json\`. See .claude/rules/22-readonly-proxy.md
- Zero runtime deps in \`bin/\`: Node built-ins only (\`npx\` runs the script before any install). See .claude/rules/23-bin-zero-deps.md

Methodology: Forgeplan — OBSERVE → ROUTE → SHAPE → BUILD → PROVE → SHIP.
Run \`forgeplan health\` first. Single source of truth: .forgeplan/.

Hint protocol: every \`forgeplan\` output ends with \`Next:\` / \`Or:\` / \`Wait:\`
/ \`Done.\` / \`Fix:\` — execute the suggested next-action verbatim.

EvidencePack body MUST include \`## Structured Fields\` with verdict /
congruence_level / evidence_type — without them R_eff silently collapses to 0.1.

Repo at-a-glance: this IS the \`forgeplan-web\` npm package source.
- bin/forgeplan-web.mjs  zero-dep init CLI
- template/              SvelteKit app copied to .forgeplan-web/
- .forgeplan/            Forgeplan workspace for *this repo's own* development

Forgeplan health (current):
${FP_HEALTH}
EOF

printf '%s' "$(cat <<JSON
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$(printf '%s' "$CTX" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}}
JSON
)"
