# Rules index

Each rule below is enforceable: a reviewer (human or agent) MUST be able to
verify it from the diff. Rules are written as imperatives. Violating a rule
without an explicit `// TODO(...)` and a justification in the driving
Forgeplan artifact is a defect.

| File | Topic |
|---|---|
| [10-comments-policy.md](./10-comments-policy.md) | TODO / FIXME usage |
| [11-forgeplan-required.md](./11-forgeplan-required.md) | Forgeplan artifact + R_eff > 0 required for non-trivial work |
| [20-init-host-isolation.md](./20-init-host-isolation.md) | `init` writes only to `.forgeplan-web/` — never the host project |
| [21-template-purity.md](./21-template-purity.md) | `template/` is copy-safe (no symlinks, no absolute paths, no host references) |
| [22-readonly-proxy.md](./22-readonly-proxy.md) | `/api/*` endpoints proxy only read-only `forgeplan` subcommands |
| [23-bin-zero-deps.md](./23-bin-zero-deps.md) | `bin/` uses Node built-ins only — no runtime npm dependencies |
