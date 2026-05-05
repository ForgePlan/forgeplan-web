---
depth: standard
id: RFC-018
kind: rfc
links:
- target: ADR-001
  relation: informs
status: active
title: Schema migration framework for ClickHouse
---

# RFC-018: Schema migration framework for ClickHouse

## Summary

Standardise ClickHouse schema migrations. Supports forward + backward
migrations, dry-run, idempotency, and chunked execution for large
tables. Replaces hand-written SQL files in CI.

## Motivation

We have 8 hand-written migration SQL files; some take 6+ hours on
production-sized tables. No standard framework; teams accidentally
ship breaking migrations. Need a discipline before EPIC-006 / PRD-016
multiplies the migration count.

## Approach

Use `clickhouse-migrate` (open-source, Rust) wrapped with our
conventions:

- Per-migration: forward.sql + backward.sql
- Idempotent: `IF NOT EXISTS` / `IF EXISTS` on every DDL
- Chunked: large UPDATE/DELETE through `WHERE` ranges
- Locking: per-table advisory lock (Postgres-side) prevents
  concurrent migrations from same dev environment

## Goals

- Fail forward: zero-downtime migrations preferred
- Migrations are tested in CI against representative data shapes
- Rollback path documented and tested for every migration

## Migration test corpus

We will maintain a 100-row representative dataset per table; CI
runs every migration against it both forward and backward.

## Risks

- ClickHouse mutations are heavy; some changes need offline tooling
- Migration framework adds discipline that some teams may resist;
  socialise through ADR + ramp-up sessions

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-001 | informs (ClickHouse owns the surface) |
| SPEC-009 | informs (v1.3 schema migration is a use case) |


