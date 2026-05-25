---
depth: standard
id: PRD-033
kind: prd
last_modified_at: 2026-05-25T17:38:23.719753+00:00
last_modified_by: claude-code/2.1.150
status: draft
title: Graph layout normalization — deterministic seeding + degree-first sort across 5 views
---

---
assigned_number: 33
author: nikitafedorov
created: 2026-05-25
depth: standard
domain: general
epic: null
id: PRD-033
predicted_number: 33
priority: P1
projectType: web_app
slug: prd-graph-layout-normalization-deterministic-seeding-degree-first-sort-across-5
status: Draft
stepsCompleted: []
title: Graph layout normalization — deterministic seeding + degree-first sort across 5 views
updated: 2026-05-25
---

# PRD-033: Graph layout normalization — deterministic seeding + degree-first sort across 5 views

## Progress

```
Phase 0  ░░░░░░░░░░░░░░░░░░░░░░░░  0/0  (  0%)
─────────────────────────────────────────────────
TOTAL                               0/0  (  0%)
```

---

## Executive Summary

### Vision

Все пять видов графа (Force, Radial, Tree, Matrix, Lanes) показывают артефакты в одном и том же визуально устойчивом, осмысленном порядке: наиболее связанные узлы первыми, повторные рендеры одинакового набора данных дают одинаковую картинку.

### Problem

В текущей версии viewer'а `.forgeplan-web` пользователи жалуются, что «ноды расположены хаотично». Корни (по survey'у текущего кода):

1. `ForceView` инициализирует позиции через `Math.random()` — каждый перерендер при тех же данных даёт разную картинку. Воспроизводимость и доверие к layout'у нулевые.
2. Ни один из статичных видов (Radial / Tree / Matrix / Lanes) не учитывает степень узла. Сортировка только по `kind` + `id` lexicographically, поэтому PRD с 12 рёбрами и PRD с 0 рёбрами визуально неотличимы.
3. В `RadialView` порядок узлов внутри кольца зависит от порядка вставки в `Map`, который определяется обходом графа в `buildHierarchyAdjacency`. Это не контролируемое пользователем поведение.

**Impact**: пользователи теряют контекст между сессиями (тот же артефакт перемещается), важные узлы (PRD-эпики с высокой централизованностью) скрыты в общей куче, дашборд `/playground` (PRD-018 / EVID-022) перестал быть «единым источником истины», потому что Force-снимки фактически не повторяются.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Active maintainer проекта | смотрит граф ≥ 2 раз в неделю, ожидает узнавать форму | при каждом открытии Force layout «дышит», ориентиры теряются |
| Reviewer / staff | ищет узлы с высокой централизованностью (что блокирует много чего) | high-degree PRD растворены среди low-degree, видение приоритетов отсутствует |
| Новый контрибутор | впервые открывает граф, хочет понять «что важное» | без визуального ранжирования по связям выглядит как шум |

### Differentiators

- Чисто детерминированный seed по `nodeId` — без хранения позиций между сессиями, без localStorage, без бэкенда.
- Degree-first сортировка как secondary key поверх существующих kind/status/id сортировок — не ломает текущие визуальные ожидания, только обогащает.
- Применимо ко всем 5 видам одинаковым подходом: одна функция `degreeRank(nodeId)` переиспользуется везде.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | ForceView дважды-открытый при одинаковом наборе данных даёт идентичные начальные позиции | хэш `simNodes[0..n].x,y` после init (до запуска tick'ов) | random () | identical hash across 10 mount cycles | в RFC-acceptance | unit-тест snapshot в `force-cluster-repel.test.ts` (или новый `seeded-init.test.ts`) |
| SC-2 | В Tree / Matrix / Lanes / Radial узел с большим числом рёбер попадает раньше узла с меньшим числом рёбер в той же группе (kind или status или ring) | для каждой пары `(a, b)` в группе: `degree(a) > degree(b) ⇒ rank(a) < rank(b)` (≥ 1 пара существует, и нарушений в группе 0) | violations: 100 % групп с миксом degree | 0 narушений в каждой kind / status / ring группе | в RFC-acceptance | unit-тесты по детерминированному фикстуру с известными degree |
| SC-3 | Smoke test `node scripts/smoke.mjs` не регрессирует | exit code | 0 | 0 | каждый build | CI |
| SC-4 | Существующие тесты `template/src/widgets/dependency-graph/lib/*.test.ts` остаются зелёными | passed / total | 100 % | 100 % | каждый build | vitest |

---

## Product Scope

### MVP (In-Scope)

- Детерминированный seed для `ForceView`: одна функция `seededRand(seed)` (mulberry32 на хэше `nodeId + clusterId`) заменяет все `Math.random()` в `ForceView.svelte`.
- Degree-first sort comparator во всех статичных видах:
  - `TreeView`: secondary key после `kind`
  - `MatrixView`: secondary key после `kind`
  - `LanesView`: secondary key после `status` (внутри лейна)
  - `RadialView`: pre-sort `ids` каждого кольца по degree DESC перед `computeAnchoredAngles`
- Один общий хелпер `degreeRank(id, edges)` в `template/src/widgets/dependency-graph/lib/`.
- Unit-тесты на детерминизм (SC-1) и на ordering invariant (SC-2).

### Out of Scope

- Сохранение позиций между сессиями (localStorage / forgeplan-web.json). Это отдельный PRD.
- Изменение визуальной темы / цветов / типографики.
- Изменение API между `/api/graph` и фронтом. Только клиентский layout.
- Алгоритмическая замена d3-force на другую симуляцию (Cola, ELK, Dagre). Это Deep change → отдельный artifact.
- R_eff-based secondary sort из survey (Fix #5). Откладывается — даёт пользу < 0.5h × риск ≥ 1h.

### Growth Vision

- Если seed по `nodeId` приживётся — добавить «freeze layout» кнопку в Force, которая фиксирует текущий тики и записывает в `forgeplan-web.json` (read-only через `/api/instances` уже есть).
- Анализ centrality (PageRank / betweenness) поверх degree для более тонкого ранжирования. Только после measure'ов от пользователей.

---

## User Journeys

### Journey 1: Active maintainer открывает граф второй раз за день

**Цель пользователя**: найти тот же PRD-эпик, который смотрел утром.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Открывает `/` (ForceView default) | граф рендерится в той же конфигурации что утром: high-degree PRD на центральных орбитах, кластеры в тех же местах | seed детерминирован, инициализация одна и та же |
| 2 | Глаз сразу садится на знакомый кластер | maintainer находит нужный узел < 5 секунд | визуальная мемоизация работает |

**Результат**: оперативная работа, нет потери контекста между сессиями.

### Journey 2: Staff / reviewer ищет «что блокирует много чего»

**Цель пользователя**: найти PRD / RFC с наибольшим количеством исходящих `blocks` / входящих `informs`.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Открывает TreeView | внутри каждого kind-tier узлы упорядочены по degree DESC | high-impact PRD на верху лейна |
| 2 | Видит PRD-005 первым в строке `prd` | сразу понимает, что это самый «centric» узел | без degree-sort PRD-005 был бы где-то по алфавиту |
| 3 | Переключает на MatrixView | таблица отсортирована так же — диагональ читается как «importance density» | визуальный ranking sustained across views |

**Результат**: 30-секундный визуальный аудит вместо ручного `forgeplan graph`.

### Journey 3: Новый контрибутор впервые видит граф

**Цель пользователя**: понять «что главное».

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Открывает ForceView | центральные кластеры рендерятся стабильно, big-name PRD на оси | впечатление «здесь есть структура» |
| 2 | Hover на узел | связи подсвечиваются, очевидно, что hub'ы реально hub'ы | подтверждает визуальную ранжировку |

**Результат**: ниже cognitive load, выше доверие к viewer'у.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | User can re-open the ForceView and see node initial positions reproduce byte-identically across mounts for the same dataset | Journey 1 |
| FR-002 | Core | Must | User can scan TreeView / MatrixView / LanesView / RadialView and find high-degree nodes earlier in their respective groups (kind tier / status / ring) | Journey 2, 3 |
| FR-003 | UX | Should | User can apply a filter (kind / status / search) and see the same degree-first invariant hold within the filtered subgraph | Journey 2 |
| FR-004 | UX | Should | User can switch between views and observe a consistent "importance" ordering (high-degree first) across all five | Journey 2, 3 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | System shall not regress initial render time on a 100-artifact graph | ≤ 50 ms per view init | typical dev machine (M-class or x86_64 4-core) | manual timing via `performance.now()` in dev console; budget is generous because layout init is O(N log N) sort + degree map build |
| NFR-002 | Correctness | System shall keep all existing widget tests passing | 100 % pass | `npm run test:vitest` if present, else `node scripts/smoke.mjs` exit 0 | CI matrix (ubuntu / macos / windows, Node 22) |
| NFR-003 | Determinism | System shall produce identical layout hash across 10 consecutive mount cycles on the same dataset | hash equality | same `/api/list` response | new unit-test `seeded-init.test.ts` |

---

## Acceptance Criteria

### AC-1: ForceView determinism

```gherkin
Given a snapshot of `/api/list` with 30 mixed-kind artifacts and edges
When  ForceView is mounted 10 times in a row with the same input
Then  the initial node-position hash (sha1 over rounded x,y of each node after init, before any tick) is byte-identical across all 10 mounts
And   no call to `Math.random()` is reachable from ForceView.svelte (verified by grep)
```

### AC-2: degree-first ordering invariant

```gherkin
Given a graph fixture with at least one (high-degree, low-degree) pair within the same group (kind, status or ring)
When  TreeView / MatrixView / LanesView / RadialView computes its ordered list
Then  for every pair (a, b) within the same group where degree(a) > degree(b), the index of `a` is strictly less than the index of `b`
And   ties (degree(a) == degree(b)) fall back to existing tertiary key (id lexicographic)
```

### AC-3: no smoke regression

```gherkin
Given a freshly built dist/
When  `node scripts/smoke.mjs` is executed
Then  it exits with code 0
And   GET /, GET /api/health, GET /api/list all return 200
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| d3-force (already in template/package.json) | Technical | Ready | upstream |
| existing degree information (derivable from `/api/graph` edges) | Technical | Ready | this PRD |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Seeded init makes ForceView visually worse for some pathological graphs (degenerate cluster sizes) | Medium | Medium | Survey-stage A/B on `playground/.forgeplan/` (123 artifacts); keep `Math.random()` path behind a fall-back flag for one release before deletion if needed | RFC-author |
| R-2 | Degree-first sort surfaces noisy "informs"-only EVID nodes above intent-bearing PRD/RFC, hurting Tree readability | Medium | Low | Tier-aware degree: rank within kind tier only (not cross-kind). PRD compete with PRD, EVID with EVID. Already the structure of TreeView | RFC-author |
| R-3 | Hash function for seed collides for similar IDs (PRD-001 vs PRD-010) leading to twin nodes | Low | Low | Use 32-bit FNV-1a, not naive `id.length + i`. Test in `seeded-init.test.ts` | RFC-author |
| R-4 | Larger graphs (200+) hit performance ceiling on degree-map build per render | Low | Medium | Memoize degree map per `edges` reference (already a pattern in `filter-memo.svelte.ts`) | RFC-author |

---

## Timeline

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| PRD Approved | 2026-05-25 | this artifact validate PASS |
| RFC Approved | 2026-05-25 | RFC-NNN architecture decided |
| Implementation | 2026-05-25 | 5 view files + 1 lib helper + tests |
| EVID + activate | 2026-05-25 | smoke + vitest green, R_eff > 0 |
| PR open | 2026-05-25 | PR to `develop`, awaiting human merge |

---

## Stakeholders

| Role | Name | Sign-off |
|------|------|----------|
| Product Owner | nikitafedorov | [ ] |
| Engineering Lead | nikitafedorov | [ ] |
| Design | n/a (visual change inside catalogue) | [ ] |
| QA | smoke + vitest (automated) | [ ] |

---

## Affected Files

- `template/src/widgets/dependency-graph/ui/ForceView.svelte`
- `template/src/widgets/dependency-graph/ui/RadialView.svelte`
- `template/src/widgets/dependency-graph/ui/TreeView.svelte`
- `template/src/widgets/dependency-graph/ui/MatrixView.svelte`
- `template/src/widgets/dependency-graph/ui/LanesView.svelte`
- `template/src/widgets/dependency-graph/lib/cluster.svelte.ts` (pre-sort ring members)
- `template/src/widgets/dependency-graph/lib/` (new `degree.ts` + `seeded-rand.ts`)
- `template/src/widgets/dependency-graph/lib/*.test.ts` (new test for determinism + ordering invariant)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-005 | Earlier clustering layout (RadialView geometry-first) | active |
| RFC-004 | Geometry-first hierarchy clustering | active |
| PRD-016 | Multi-graph mosaic dashboard (consumer of all 5 views) | active |
| SPEC-001 | Sankey adaptive height / labels (sibling layout work) | active |
| SPEC-002 | Tree kind-as-row (sibling layout work) | active |

---

> **Next step**: создать RFC с конкретной алгоритмической раскладкой (mulberry32 seed, degreeRank comparator, ring pre-sort).



