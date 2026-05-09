---
depth: standard
id: EVID-008
kind: evidence
last_modified_at: 2026-05-04T13:52:03.498689+00:00
last_modified_by: claude-code/2.1.126
links:
- target: ADR-002
  relation: informs
status: deprecated
title: Rule 12 + ADR-002 protocol files exist and are indexed
---

# EVID-008: Rule 12 + ADR-002 protocol files exist and are indexed

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Summary

Verifies E1/E3 evidence requirements of ADR-002: новый файл правила
`12-forgeplan-agent-dispatch.md` создан в `.claude/rules/`, проиндексирован
в `00-index.md`, ADR-002 готов к активации.

## Method

Прямая ФС-проверка + grep `00-index.md`.

```bash
ls -la .claude/rules/12-forgeplan-agent-dispatch.md
# -rw-r--r-- ... 4.7K ... 12-forgeplan-agent-dispatch.md

grep -n "12-forgeplan-agent-dispatch" .claude/rules/00-index.md
# 12: | [12-forgeplan-agent-dispatch.md](./12-forgeplan-agent-dispatch.md) | ...
```

Артефакт ADR-002 прошёл `forgeplan_validate`: 0 MUST errors, 0 warnings.

## Result

- Rule file exists and is non-empty (4.7 KB).
- Index entry present at `00-index.md:12`.
- ADR-002 validate clean (0/0).
- ADR-002 invariants I1-I5 + AI Guidance written, Rollback Plan
  и Pre/Postconditions заполнены.

## Limitations

- E1 (грep по сессии — все sub-agent invocations с claim'ом) не может
  быть проверен этим evidence pack'ом — он verifies артефакты решения,
  не behavioral compliance. E1 будет накапливаться в Implementation
  Log следующих sprint'ов.
- E2 (`active_claim_count == 0` после sprint'а) проверен будет в EVID
  для RFC-003 после release всех claim'ов Wave 3.


