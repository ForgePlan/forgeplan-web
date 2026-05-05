---
depth: standard
id: SPEC-014
kind: spec
links:
- target: PRD-016
  relation: refines
status: active
title: Multi-account hierarchy data model
---

# SPEC-014: Multi-account hierarchy data model

## Entity model

```
Organization (1)
   ├── Sub-account (N)   -- "tenant" in the new model
   │      ├── User (N)
   │      ├── Dashboard (N)
   │      └── ...
   └── Billing-Profile (1)
```

## Postgres schema (new tables)

```sql
CREATE TABLE organization (
  id            CHAR(26) PRIMARY KEY,    -- ULID
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  billing_profile_id CHAR(26) NOT NULL,
  rollup_billing BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE sub_account (
  id              CHAR(26) PRIMARY KEY,
  organization_id CHAR(26) NOT NULL REFERENCES organization,
  parent_sub_id   CHAR(26) REFERENCES sub_account,    -- for nesting
  name            TEXT NOT NULL,
  status          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  CONSTRAINT no_self_parent CHECK (id <> parent_sub_id)
);
CREATE INDEX idx_sub_account_org ON sub_account (organization_id);
```

Existing `tenant` table renamed to `sub_account` via migration; FK
references migrated atomically.

## Hierarchy traversal

Closure table for fast ancestor / descendant queries:

```sql
CREATE TABLE sub_account_closure (
  ancestor   CHAR(26) NOT NULL REFERENCES sub_account,
  descendant CHAR(26) NOT NULL REFERENCES sub_account,
  depth      SMALLINT NOT NULL,
  PRIMARY KEY (ancestor, descendant)
);
```

## RBAC scoping

Every claim includes `sub_account_id` (effective scope). Wildcard
`*` denotes "all sub-accounts in org" — only org-level admins receive
this claim.

## Migration from current single-tenant model

For each existing tenant `T`:
1. Create org `O` with same name
2. Create one sub-account `S` (= `T`)
3. Move `T`'s rows into `S` (FK references migrated)
4. Add `S` to closure table (self-loop, depth=0)

Tested for scale issues per EVID-020 (1k orgs × 50 sub-accounts).

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-016 | refines |
| ADR-011 | informs (ULID) |
| EVID-020 | informs (scale) |


