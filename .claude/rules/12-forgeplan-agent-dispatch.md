# Sub-agent dispatch goes through forgeplan

Когда orchestrator (главный Claude Code-агент) запускает ≥2 параллельных
sub-агентов, которые **модифицируют файлы** в этом репо, координация
ОБЯЗАНА идти через forgeplan-протокол:

```
forgeplan_dispatch → forgeplan_claim → (sub-agent работает) → forgeplan_release
```

Это правило закреплено в ADR-002. Без него координация невидима для
`forgeplan_health`, нет conflict detection, нет durable лога ассигнментов,
ломается совместимость с multi-session работой.

## Required (orchestrator-side)

Перед запуском параллельных sub-агентов:

1. **`forgeplan_dispatch agents=N status=<status>`** — получить план
   (bucket'ы по агентам + serial queue для остатка). Read-only вызов;
   re-dispatch при изменении claim-set'а.
2. **`forgeplan_claim <id> agent="<sub-name>" ttl_minutes=<T> note="<short>"`**
   для каждого артефакта из непустого bucket'а. `agent` — identity именно
   sub-агента (не orchestrator'а), чтобы `claims --active` показывал кто
   реально исполняет.
3. Sub-агент стартует с инструкцией: работать только в файлах,
   относящихся к claimed артефакту.
4. **`forgeplan_release <id> agent="<sub-name>"`** — немедленно по
   завершении работы. Не batched, не отложено до следующего «когда
   удобно».

При crash sub-агента или зависании claim'а: `forgeplan_release <id>
--force` — orchestrator escape hatch.

## Required (sub-agent-side)

Если sub-агент получил инструкцию редактировать файлы в рамках
forgeplan-артефакта, и orchestrator явно не сделал claim — **остановись
и попроси orchestrator'а claim'нуть**. Не работай вне claim'а.

## Allowed без dispatch/claim

- Read-only sub-агенты (`Explore`, `search-specialist`, `code-analyzer`
  в audit-режиме, `Plan` без write). Они не порождают conflict surface.
- Однопоточная работа orchestrator'а напрямую (без sub-агентов) — claim
  опционален; rule 11 диктует наличие артефакта по другим основаниям.
- Tactical work, не требующий артефакта по rule 11 (one-line fix,
  README typo). Если нужно >1 параллельного агента даже для Tactical —
  escalate до Standard и оформи артефакт.

## Forbidden

- Запуск ≥2 параллельных sub-агентов с file-write без предшествующего
  `forgeplan_dispatch` + per-agent `forgeplan_claim`.
- Использование одного claim'а на нескольких параллельных sub-агентов
  одновременно (claim — exclusive).
- Игнорирование `overlap_threshold` warning'ов от `dispatch` (не пытайся
  поднять оба deferred-артефакта параллельно — дождись release).
- Длинноживущие claim'ы (>24h без работы): TTL'ом ограничено, но
  оставлять «на всякий случай» — против духа правила.

## Verification

- `forgeplan_health` во время активного sprint'а показывает
  `active_claim_count > 0`. По его завершении — `0`.
- `forgeplan_claims` (через MCP) во время работы показывает каждый
  занятый артефакт с правильным `agent_id`.
- Grep сессионных логов (если ведутся): каждому sub-agent invocation,
  пишущему в файлы, предшествует `forgeplan_claim` с тем же `agent`-id.

## Rationale

Координация sub-агентов «в голове» — нерепродьюсимая. `claims/<id>.yaml`
— durable артефакт, который видят `health`, `claims --active`, и который
переживает re-roll сессии. Стоимость — 2 MCP-вызова на агента (~50мс
каждый), что пренебрежимо относительно стоимости конфликта или
дублирования работы. Подробное обоснование альтернатив — ADR-002.
