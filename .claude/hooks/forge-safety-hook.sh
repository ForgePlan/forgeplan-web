#!/usr/bin/env bash
# Forgeplan-recommended safety hook — blocks dangerous commands.
# PreToolUse on Bash. Reads tool input JSON from stdin. Exit 2 = block.
set -uo pipefail

INPUT="$(cat)"

CMD=""
if command -v jq >/dev/null 2>&1; then
  CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
else
  CMD="$(printf '%s' "$INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
fi

[ -z "$CMD" ] && exit 0

# Skip text-only commands where dangerous-looking strings are message
# arguments, not commands to execute (false-positive guard).
case "$CMD" in
  "git commit "*|"git log"*|"git show"*|"git notes "*|"git tag "*|"git stash push -m"*) exit 0 ;;
  "echo "*|"printf "*|"cat <<"*|"cat << "*) exit 0 ;;
  "gh pr create"*|"gh pr edit"*|"gh pr comment"*|"gh issue create"*|"gh issue edit"*|"gh issue comment"*|"gh release create"*|"gh release edit"*) exit 0 ;;
esac

block() {
  printf '%s\n' "FORGE-SAFETY: blocked — $1" >&2
  exit 2
}

case "$CMD" in
  *"rm -rf /"*|*"rm -rf /*"*)                         block "rm -rf at filesystem root" ;;
  *"git push --force"*|*"git push -f "*)              block "force push (use --force-with-lease and ask first)" ;;
  *"git push origin main"*|*"git push origin master"*|*"git push origin develop"*|*"git push origin release/"*)
    [ "${FORGE_ALLOW_PUSH_TO_PROTECTED:-0}" = "1" ] || block "direct push to protected branch (main / master / develop / release/*). All changes go through PR — see guides/GIT-FLOW-GUIDE.ru.md §2.1 and §7.2 rule 5. To override after explicit user OK: FORGE_ALLOW_PUSH_TO_PROTECTED=1 git push ..." ;;
  *"git reset --hard origin/main"*)                   block "destructive reset against main; use a feature branch" ;;
  *"git branch -D main"*|*"git branch -D master"*)    block "deleting protected branch" ;;
  *"npm publish"*|*"pnpm publish"*|*"yarn publish"*)  block "package publish (release flow only — confirm with user)" ;;
  *"forgeplan init --force"*|*"forgeplan init -f "*)  [ "${FORGE_ALLOW_INIT_FORCE:-0}" = "1" ] || block "forgeplan init --force deletes ALL artifacts in .forgeplan/. Backup first: cp -r .forgeplan /tmp/forgeplan-bak-\$(date +%Y%m%d-%H%M%S). To override after backup: FORGE_ALLOW_INIT_FORCE=1 forgeplan init --force" ;;
  *":(){:|:&};:"*)                                    block "fork bomb" ;;
  *"chmod -R 777 /"*)                                 block "chmod 777 at root" ;;
  *"--no-verify"*)                                    block "bypassing git hooks (--no-verify)" ;;
esac

exit 0
