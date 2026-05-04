# Comments policy

Default: write no comments. Names should explain the *what*.

You MUST add a `TODO` or `FIXME` marker, however, in any of these cases:

- Unfinished work deferred for later.
- Known edge cases not handled now.
- Cut corners, temporary workarounds, stubs, mocks.
- Anything needing follow-up (refactor, perf, invariant verification).
- Suppressed errors / `eslint-disable` / `@ts-expect-error` / `// @ts-ignore`
  / `try { … } catch {}` without a clear reason in code.

Format:

```text
// TODO(<short reason>): <what to do>
// FIXME(<reason>): <the problem>
```

For shell:

```bash
# TODO(<short reason>): <what to do>
# FIXME(<reason>): <the problem>
```

Forbidden:

- Comments that restate what the code does (`// loop over entries`).
- Stale comments referencing removed code.
- "Why" comments that should be in the PR description or the driving
  Forgeplan artifact (PRD/RFC/ADR) instead — unless the why is a hidden
  invariant or surprise (e.g. an upstream bug being worked around).

This applies equally to JS/TS, Svelte, and shell.
