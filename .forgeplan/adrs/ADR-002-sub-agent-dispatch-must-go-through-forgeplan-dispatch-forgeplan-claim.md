---
depth: standard
id: ADR-002
kind: adr
last_modified_at: 2026-05-04T13:50:41.701061+00:00
last_modified_by: claude-code/2.1.126
status: draft
title: Sub-agent dispatch must go through forgeplan_dispatch + forgeplan_claim
---

# ADR-002: Sub-agent dispatch must go through forgeplan_dispatch + forgeplan_claim

## Progress

```
Phase 0  ████████████████████████  3/3  (100%)
─────────────────────────────────────────────────
TOTAL                               3/3  (100%)
```

---

## Context

Во время работы над RFC-003 (template hardening + runes migration) был
выявлен системный пропуск методологии: sub-агенты дispatch'ились напрямую
через `Agent`-tool, минуя forgeplan-протокол `dispatch → claim → release`.
Симптомы:

1. **Невидимость для health-dashboard'а**: пока RFC-003 был в `draft`,
   а кодовые правки уже шли в файлах, `forgeplan health` не показывал ни
   одного активного claim'а — невозможно отследить кто-что-делает в момент
   `T`. Параллельный sprint риск double-assignment.
2. **Отсутствие conflict detection**: `forgeplan_dispatch` считает Jaccard
   overlap между файловыми скоупами артефактов. При прямом `Agent`-вызове
   эта проверка не выполняется — мы полагаемся на ручное распределение
   файлов в prompt'е.
3. **Отсутствие лога ассигнментов**: `claims/<id>.yaml` — durable record
   что-кому-когда-было-выдано. Без него после re-roll'а сессии невозможно
   восстановить историю.
4. **Несовместимость с многосессионной работой**: вторая сессия Claude Code
   без claims может redo одного и того же RFC.

Действующие правила покрывают артефакты (rule 11) и хост-изоляцию (rule
20), но не покрывают **дispatch агентов**. Этот ADR закрывает пробел.

## Decision

**Selected**: D — Mandatory `dispatch → claim → execute → release` для
любого sub-агента, поднимающего файловые правки в репо.

**Why Selected**: переводит координацию sub-агентов из «договорились в
голове orchestrator'а» в durable artifact (`claims/<id>.yaml`) с TTL и
ясным API. Закрывает все 4 пробела одной дисциплиной.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| A — Status quo (прямой Agent-tool) | Rejected | Нет видимости, нет conflict detection, нет durable лога. Симптомы наблюдались на RFC-003. |
| B — Optional dispatch (`SHOULD`, не `MUST`) | Rejected | Optional rules без enforcement дрейфят к нулевому соблюдению. |
| C — Только claim, без dispatch | Rejected | Claim без dispatch'а не предотвращает конфликты — Jaccard-проверка нужна. |
| D — Mandatory dispatch + claim для file-modifying sub-agents | **Chosen** | Закрывает все 4 пробела. Стоимость +2 MCP-вызова (~50мс) пренебрежима. |
| E — Распространить и на read-only агентов | Rejected | Дispatch для read-only бесполезен (нет conflict surface), добавляет overhead. |

## Consequences

### Positive
- `forgeplan_dispatch` строит план параллельной работы исходя из
  draft-артефактов и текущих claims — координация становится
  воспроизводимой функцией `f(workspace_state) → plan`.
- `forgeplan_claims` даёт live-view «кто-где» за ~10мс.
- Multi-session safety: вторая сессия видит claim'ы первой.
- `forgeplan_health.active_claim_count` — заметная сигнатура текущей
  работы (0 = idle, >0 = active sprint).

### Negative (trade-offs)
- На каждого sub-агента +2 MCP-вызова (~50мс каждый).
- Декомпозиция работы на forgeplan-артефакты ДО старта агентов —
  обязательна. Это feature, не bug (rule 11 уже это диктует).
- TTL claim'а (default 30 мин) — при crash'е sub-агента claim висит
  до expiry. Mitigation: `forgeplan_release --force`.

### Risks
- **R1**: Pure refactoring без id для claim'а. Mitigation: либо
  escalate до Standard (создать draft-артефакт), либо single-threaded
  работа orchestrator'а. Граница — параллелизм ≥2 агентов.
- **R2**: Sub-агенты могут не знать MCP API forgeplan'а. Mitigation:
  orchestrator делает claim/release сам на behalf of sub-agent
  (через явный `agent` параметр).

## Invariants

- **I1 — MUST claim before edit**: ни один sub-agent не модифицирует
  файлы repo до того как соответствующий forgeplan-артефакт claimed
  на его имя. Read-only агенты — исключение.
- **I2 — MUST release after work**: claim освобождается немедленно
  по завершении работы.
- **I3 — dispatch is read-only**: `forgeplan_dispatch` идемпотентен.
- **I4 — claim.agent — это identity sub-агента**, не orchestrator'а.
  Параметр `agent` в `forgeplan_claim` явный.
- **I5 — Один claim — один артефакт**: ≤1 артефакт на агента в bucket.

## Evidence Requirements

- E1: грep по сессии — все sub-agent invocations с file-write имеют
  предшествующий `forgeplan_claim` для соответствующего артефакта.
- E2: `forgeplan_health.active_claim_count == 0` после завершения
  sprint'а.
- E3: `.claude/rules/12-forgeplan-agent-dispatch.md` существует и
  листится в `00-index.md`.

## Valid Until

**Дата**: 2027-05-04 (1 год)

**Обоснование TTL**: правило поведенческое, не привязано к версии
MCP-API. Год — достаточный срок для accumulation evidence.

**Refresh Triggers**:
- forgeplan MCP меняет API `dispatch`/`claim`/`release`.
- ≥3 случаев игнорирования правила в session-логах за 30 дней.
- Появление альтернативного механизма координации (например,
  `forgeplan_session lock`).

## Rollback Plan

**Triggers**:
- Стоимость claim/release становится заметной (>200мс на агента).
- Появление альтернативного механизма координации в forgeplan,
  делающего claim'ы избыточными.
- ≥3 false-positive deadlock'ов на claim'ах за месяц.

**Steps**:
1. Удалить `.claude/rules/12-forgeplan-agent-dispatch.md`.
2. Убрать строку из `.claude/rules/00-index.md`.
3. Перевести ADR-002 в `superseded` через `forgeplan_supersede`
   ссылкой на новый ADR.

**Blast Radius**: только методология — кодовые правки никак не зависят
от наличия claims (advisory, не блокируют MCP). Откат — три
markdown-правки + status-flip.

## Preconditions

- [x] forgeplan MCP доступен в сессии (`.mcp.json`).
- [x] У orchestrator'а есть доступ к `forgeplan_dispatch`,
      `forgeplan_claim`, `forgeplan_release`, `forgeplan_claims`.
- [x] Sub-агенты получают prompt с явным указанием identity
      (для корректного `agent` в claim'е).

## Postconditions

- [x] `.claude/rules/12-forgeplan-agent-dispatch.md` существует.
- [x] `.claude/rules/00-index.md` содержит entry для rule-12.
- [x] ADR-002 в статусе `active`.
- [ ] При следующем sprint'е с ≥2 параллельными file-writing агентами
      orchestrator вызывает `dispatch` → `claim` → ... → `release`.
      Будет проверено в Implementation Log следующего ADR/RFC.

## AI Guidance

- **Orchestrator** перед запуском ≥2 параллельных file-writing
  sub-агентов:
  1. `forgeplan_dispatch agents=N status=draft` — получить bucket'ы.
  2. Для каждого непустого bucket — `forgeplan_claim <id>
     agent="<sub-name>"`.
  3. Запустить sub-агента с инструкцией работать только в файлах,
     связанных с claimed артефактом.
  4. После завершения — `forgeplan_release <id> agent="<sub-name>"`.
- **Sub-agent**: если получил file-write task без claim'а от
  orchestrator'а — остановись и запроси claim. Не работай вне claim'а.
- **Read-only sub-agents** (Explore, search, audit без write) —
  claim'ы не нужны. Граница — есть ли `Write`/`Edit`/`Bash` с
  side-effect.
- При `overlap_threshold > 0.3` warning'е от `dispatch` — не пытайся
  обойти, дождись release предыдущего claim'а.

## Implementation Plan

### Phase 0: Foundation
- [x] **0.1** Создан `.claude/rules/12-forgeplan-agent-dispatch.md`.
- [x] **0.2** Обновлён `.claude/rules/00-index.md`.
- [x] **0.3** ADR-002 активирован.

## Affected Files

| File | Reason |
|------|--------|
| `.claude/rules/12-forgeplan-agent-dispatch.md` | New rule defining the protocol |
| `.claude/rules/00-index.md` | Index entry for rule 12 |
| `.forgeplan/adrs/ADR-002-*.md` | This decision |

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| RFC-003 | RFC | informs (наблюдение симптомов на нём триггернуло этот ADR) |
| ADR-001 | ADR | based_on (host isolation contract — близкий по духу) |

