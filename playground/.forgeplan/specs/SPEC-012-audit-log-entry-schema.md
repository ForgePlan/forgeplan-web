---
depth: standard
id: SPEC-012
kind: spec
links:
- target: PRD-012
  relation: refines
status: active
title: Audit log entry schema
---

# SPEC-012: Audit log entry schema

## Schema

```sql
CREATE TABLE audit_log (
  id           CHAR(26) PRIMARY KEY,        -- ULID
  tenant_id    CHAR(26) NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL,
  actor_type   TEXT NOT NULL,               -- user | api_key | system | sdk
  actor_id     TEXT NOT NULL,
  action       TEXT NOT NULL,               -- e.g. "dashboard.delete"
  resource_type TEXT NOT NULL,              -- e.g. "dashboard"
  resource_id  TEXT,
  result       TEXT NOT NULL,               -- success | failure
  ip_address   INET,
  user_agent   TEXT,
  request_id   TEXT,
  payload      JSONB NOT NULL DEFAULT '{}',
  prev_hash    BYTEA NOT NULL,
  entry_hash   BYTEA NOT NULL,
  CONSTRAINT chk_chain CHECK (entry_hash <> prev_hash)
);
CREATE INDEX idx_audit_tenant_time ON audit_log (tenant_id, occurred_at DESC);
CREATE UNIQUE INDEX idx_audit_chain ON audit_log (tenant_id, entry_hash);
```

## Hash chain

```
entry_hash = SHA256(
  prev_hash || tenant_id || occurred_at || actor || action || resource || payload
)
```

The first entry per tenant uses `prev_hash = SHA256("helios-audit-genesis")`.

## Action namespace

`<resource>.<verb>` e.g. `dashboard.create`, `tenant.suspend`,
`api_key.rotate`. Allowed verbs: `create | update | delete | view |
list | export | suspend | resume | rotate | impersonate`.

## Append-only invariants

- No UPDATE on audit_log (enforced by RLS policy)
- No DELETE on audit_log within retention (enforced by RLS policy)
- Daily archive job moves entries older than 90d to parquet

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-012 | refines |
| RFC-014 | informs |


