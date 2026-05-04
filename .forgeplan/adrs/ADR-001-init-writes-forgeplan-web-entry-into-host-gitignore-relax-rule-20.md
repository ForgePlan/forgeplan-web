---
created: 2026-05-04
depth: standard
id: ADR-001
kind: adr
status: active
title: init writes .forgeplan-web entry into host .gitignore (relax rule 20)
updated: 2026-05-04
---

# ADR-001: init writes .forgeplan-web entry into host .gitignore

## Context

`bin/forgeplan-web.mjs init` scaffolds a self-contained app into
`<cwd>/.forgeplan-web/`. Until now, rule 20 (`init-host-isolation.md`)
forbade writes to anything outside that directory — including the host's
`.gitignore`. The README told users to add the line themselves.

Practical issue: virtually every user forgets, then accidentally commits
the entire `.forgeplan-web/` (≈11 MB, including `node_modules/`) into
their git history. Cleaning that up after the fact is painful (`git
filter-repo` etc.) and the noise pollutes diffs and reviews.

## Decision

`init` automatically appends `.forgeplan-web/` to the host project's
`.gitignore` (creating the file if missing), unless the user passes
`--no-gitignore`.

**Selected**: opt-out auto-append.

**Why Selected**: protects users from the common foot-gun of committing
generated artefacts; the change is bounded (one line, one file,
idempotent), reversible (rm the line), and discoverable (init prints a
notice). The opt-out flag accommodates users with monorepo or
non-standard ignore strategies.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| A. Status quo (README only) | Rejected | Users keep forgetting; bad UX. |
| B. Print a warning if `.gitignore` lacks the line | Rejected | Noisy and still requires manual action. |
| C. Auto-append (opt-out via `--no-gitignore`) | **Chosen** | Default-safe, minimal blast radius, idempotent, reversible. |
| D. Auto-append + auto-stage `.gitignore` change | Rejected | Touches git index — far broader than file edits, surprising. |

## Consequences

### Positive
- Users can no longer accidentally commit `.forgeplan-web/`.
- `init` is now self-sufficient (no follow-up README step).
- README simplifies: removes the "add to .gitignore yourself" call-out.

### Negative (trade-offs)
- Rule 20 is no longer "writes only inside `.forgeplan-web/`" — its
  scope shrinks to "no host config writes other than the bounded
  `.gitignore` append".
- The bin script gains a small additional surface (read+append+regex).
- `git status` after `init` will now also show `.gitignore` modified
  (rule 20's verification step needs updating).

### Risks
- **R1**: `.gitignore` already contains a different rule that ends up
  conflicting (e.g., a negative `!.forgeplan-web/foo`). Mitigation: we
  only **append** — we never edit existing lines. Detection is
  per-line regex `^[ \t]*\.forgeplan-web\/?[ \t]*$`. Comments
  (`# .forgeplan-web/`) do not count as a match — that's fine; the
  append still produces a working ignore rule.
- **R2**: `.gitignore` not present on a non-git directory. Mitigation:
  we still write the file; this is harmless (an unused file). The user
  can delete it.
- **R3**: line-ending churn on Windows. Mitigation: preserve the file's
  existing newline convention; if file ends without newline, prepend
  one before our block.

## Invariants

- `init` writes to AT MOST two paths in the host: everything inside
  `.forgeplan-web/`, and the single `.gitignore` file at the host root
  (only when `--no-gitignore` is not passed).
- Append is idempotent: running `init` N times never produces more than
  one `.forgeplan-web/` ignore line.
- Append is bounded: only the marker comment + the ignore line are
  added. No other lines are reformatted, removed, or reordered.
- `--no-gitignore` is honoured silently — no read, no write, no log.

## Evidence Requirements

- Smoke test (added to `scripts/smoke.mjs` or as a new step) that runs
  `init -y` twice in a scratch directory and asserts `.gitignore`
  contains exactly one matching line.
- Smoke test for `--no-gitignore`: `init -y --no-gitignore` does not
  create or modify `.gitignore`.
- Manual verification: rule 20 verification command updated; passes.

## Rollback Plan

**Triggers**:
- Repeated user reports that the auto-append breaks their setup.
- Discovery of a corner case where the regex matches too broadly.

**Steps**:
1. Default the flag to opt-in: rename `--no-gitignore` → require
   `--gitignore` to enable.
2. Cut a patch release.
3. Update README + rule 20 again.

**Blast Radius**: small. Removing the append leaves user gitignores
intact; no data loss.

## Affected Files

| File | Note |
|------|------|
| `bin/forgeplan-web.mjs` | + `ensureGitignore()` step + `--no-gitignore` flag |
| `.claude/rules/20-init-host-isolation.md` | scope narrowed |
| `README.md` | drop "add to .gitignore yourself" call-out |
| `CLAUDE.md` | reflect new behaviour in "Hard requirements" |

## AI Guidance

- When implementing `init` features, treat `.gitignore` as the **only**
  permissible write outside `.forgeplan-web/`.
- Any new flag that would touch the host project requires a new ADR.
- The append is **always idempotent** — never produce duplicate lines
  in `.gitignore`.

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| RFC-001 | RFC | extends |

