---
depth: standard
id: RFC-027
kind: rfc
last_modified_at: 2026-05-25T17:39:58.630752+00:00
last_modified_by: claude-code/2.1.150
links:
- target: PRD-033
  relation: refines
status: active
title: Mulberry32-seeded ForceView init + degreeRank comparator across 5 views (PRD-033)
---

---
assigned_number: 27
author: nikitafedorov
created: 2026-05-25
depth: standard
id: RFC-027
prd: PRD-033
predicted_number: 27
slug: rfc-mulberry32-seeded-forceview-init-degreerank-comparator-across-5-views-prd
status: Draft
title: Mulberry32-seeded ForceView init + degreeRank comparator across 5 views (PRD-033)
updated: 2026-05-25
---

# RFC-027: Mulberry32-seeded ForceView init + degreeRank comparator across 5 views (PRD-033)

## Progress

```
Phase 1 (lib)        ░░░░░░░░░░░░░░░░░░░░░░░░  0/2  (  0%)
Phase 2 (views)      ░░░░░░░░░░░░░░░░░░░░░░░░  0/5  (  0%)
Phase 3 (tests)      ░░░░░░░░░░░░░░░░░░░░░░░░  0/2  (  0%)
─────────────────────────────────────────────────────────
TOTAL                                            0/9  (  0%)
```

---

## Summary

Заменить `Math.random()` в `ForceView.svelte` на детерминированный mulberry32-seeded PRNG, посеянный по `nodeId`. Добавить общий хелпер `degreeRank(id, edges)` и использовать его как secondary sort key во всех статичных видах (Tree / Matrix / Lanes) и как pre-sort шагу `RadialView`'s ring members.

## Motivation

Хаотичный визуал убивает доверие к viewer'у. См. PRD-033 / Problem. Реализация ALL-IN-ONE patch:

- Force ↔ детерминизм (FR-001 / AC-1)
- Static ↔ visible importance ranking (FR-002 / AC-2)
- Один и тот же `degreeRank` во всех 5 видах ↔ consistency (FR-004)

## Goals

- 0 вызовов `Math.random()` в `template/src/widgets/dependency-graph/`.
- Один `degreeRank(id, edges)` хелпер используется всеми 5 видами.
- Все существующие vitest тесты остаются зелёными.
- Новый тест `seeded-init.test.ts` проверяет hash-equality 10 mount'ов.
- Новый тест `degree-order.test.ts` проверяет degree-first ordering invariant.
- Никаких изменений в API `/api/graph` или формате `graph.edges`.

## Non-Goals

- Хранение позиций между сессиями (localStorage / forgeplan-web.json).
- Замена d3-force на другой движок (Cola, ELK, Dagre).
- R_eff-based secondary sort (PRD-033 §Out of Scope).
- Изменения в `SankeyView` и `SunburstView` — они уже детерминированы (см. survey).

## Options Considered

### Option A: Mulberry32 seeded init + degreeRank comparator (ONE shared lib)

**Description**:

`template/src/widgets/dependency-graph/lib/seeded-rand.ts` экспортирует:

```ts
// 32-bit FNV-1a hash, чтобы из nodeId получить seed.
export function hashStringFnv1a(s: string): number { /* ... */ }

// mulberry32 PRNG — детерминированный, 32-битное состояние.
export function mulberry32(seed: number): () => number { /* ... */ }

// Удобный wrapper: даёт стабильный (x, y) jitter в [-half, +half] для узла.
export function seededJitter(nodeId: string, half: number): { dx: number; dy: number };
```

`template/src/widgets/dependency-graph/lib/degree.ts` экспортирует:

```ts
export type DegreeMap = Map<string, number>;

export function buildDegreeMap(edges: Array<{ source: string; target: string }>): DegreeMap;

// Comparator factory. Возвращает stable, tie-breaks by `idKey(node)`.
export function byDegreeDesc(
  degree: DegreeMap,
  idKey: (n: { id: string }) => string,
): (a: { id: string }, b: { id: string }) => number;
```

Каждый view импортирует `byDegreeDesc(degreeMap, n => n.id)` и вставляет в свой comparator как secondary key. `ForceView` дополнительно использует `seededJitter(node.id, 20)` вместо `(Math.random() - 0.5) * 20`.

**Pros**:
- Один источник правды → consistency across views (FR-004).
- Маленькая поверхность изменений: 2 новых файла + 5 patch'ей по 5-15 строк каждый.
- Полностью обратно совместимо: degree-sort это secondary key, primary keys (kind / status / id) не меняются.
- Поддаётся unit-тестам тривиально.

**Cons**:
- Чуть-чуть лишнего кода (Map per render). Memoизация через `$derived` или `filter-memo.svelte.ts` паттерн снимает.
- Если в будущем добавится 6-й вид, нужно не забыть импортнуть.

### Option B: Per-view inline seeding + per-view degree sort

**Description**: каждый view сам пилит свой PRNG и свой degree comparator inline.

**Pros**:
- Нет общего lib слоя.

**Cons**:
- 5 копий PRNG → высокая вероятность расходимости.
- Дублирование тестов.
- Нарушает rule 24 (`shared/ui` ownership) аналогично — общая логика должна жить в одном месте.

### Option C: Не делать seed, оставить случайность; ввести degree sort только в Tree / Matrix / Lanes

**Description**: компромисс — только статичные виды.

**Pros**:
- Минимальные изменения.

**Cons**:
- FR-001 (ForceView determinism) не выполняется.
- AC-1 fails.
- Main complaint пользователей про ForceView остаётся.

## Trade-off Analysis

| Критерий | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Complexity | low (2 lib files + 6 patches) | medium (5 inline copies) | very low (3 patches) |
| Migration risk | low (additive) | low (additive) | low (но не достигает FR-001) |
| Developer experience | high (one helper) | low (find-replace hunt) | medium |
| Test surface | 2 unit tests cover all | 5 sets of tests | 1 unit test, AC-1 fails |
| Future-proofing | high | low | low |
| Hits SC-1 | ✅ | ✅ | ❌ |
| Hits SC-2 | ✅ | ✅ | partial (Radial missed) |

**Verdict**: Option A.

## Proposed Direction

Option A. Подробный план в `## Implementation TODO` ниже.

## Risks & Open Questions

- R-1 (PRD R-1): pathological cluster sizes. **Mitigation**: ничего не делаем сверх — fallback не вводим, потому что mulberry32 на FNV-1a имеет 2^32 distinct seeds, а `nodeId` всегда unique → коллизий быть не должно. Если в `playground/.forgeplan/` (123 артефакта) layout визуально хуже — откатываем PRD pre-PR.
- R-3: hash collision. **Mitigation**: FNV-1a 32-bit, домен ~10^7 ID коллизия < 0.1%. Тест в `seeded-rand.test.ts`.
- Q-1: куда положить новые lib файлы? **Decision**: `template/src/widgets/dependency-graph/lib/` рядом с `force-cluster-repel.ts`, потому что они логически принадлежат widget'у, не shared. Если позже понадобится в других widget'ах — refactor в `shared/lib/`.
- Q-2: что с `SankeyView` / `SunburstView`? **Decision**: оставить как есть. Они уже детерминированы (proof: `sankey-layout.test.ts` / `sunburst-layout.test.ts` пишут snapshot'ы — если бы был random, они бы flaked).
- Q-3: degree включает self-edges? **Decision**: нет, фильтровать `source !== target` в `buildDegreeMap`. Self-edges в forgeplan графе теоретически не валидны.

---

## Acceptance Criteria

Mirror'ит PRD-033 AC.

- AC-1 (determinism): hash byte-identical 10 mount cycles. Тест: `seeded-init.test.ts`.
- AC-2 (degree-first): within every same-group pair, higher-degree first. Тест: `degree-order.test.ts`.
- AC-3 (no smoke regression): `node scripts/smoke.mjs` exit 0.

---

## Implementation TODO

### Phase 1 — lib (2 items)

- [ ] **P1.1** `template/src/widgets/dependency-graph/lib/seeded-rand.ts`: implement `hashStringFnv1a`, `mulberry32`, `seededJitter`. Pure functions, no state.
- [ ] **P1.2** `template/src/widgets/dependency-graph/lib/degree.ts`: implement `buildDegreeMap`, `byDegreeDesc`.

### Phase 2 — views (5 items)

- [ ] **P2.1** `ForceView.svelte`: replace `Math.random()` calls (around line 300 per survey) with `seededJitter(node.id, 20)`. Also pre-sort `simNodes` array by `byDegreeDesc(degree, n => n.id)` before passing to d3-force, so initial gravity centers on hubs.
- [ ] **P2.2** `RadialView.svelte`: before `computeAnchoredAngles`, sort each ring's `ids` array by `byDegreeDesc`. Pass sorted array to existing layout.
- [ ] **P2.3** `TreeView.svelte`: replace `kind.localeCompare + id.localeCompare` comparator with `kind primary → degree DESC secondary → id tertiary`.
- [ ] **P2.4** `MatrixView.svelte`: same as TreeView — add degree as secondary key.
- [ ] **P2.5** `LanesView.svelte`: add degree as secondary key after `status` order.

### Phase 3 — tests (2 items)

- [ ] **P3.1** `template/src/widgets/dependency-graph/lib/seeded-rand.test.ts`: assert `mulberry32(42)` first 5 values are deterministic, `hashStringFnv1a("PRD-001") !== hashStringFnv1a("PRD-010")`, `seededJitter("X", 20)` returns dx,dy in [-20, 20] and is identical for the same input.
- [ ] **P3.2** `template/src/widgets/dependency-graph/lib/degree-order.test.ts`: build a fixture graph with known degrees, assert the comparator places high-degree first in every same-group pair, and falls back to id for ties.

---

## Affected Files

- `template/src/widgets/dependency-graph/ui/ForceView.svelte`
- `template/src/widgets/dependency-graph/ui/RadialView.svelte`
- `template/src/widgets/dependency-graph/ui/TreeView.svelte`
- `template/src/widgets/dependency-graph/ui/MatrixView.svelte`
- `template/src/widgets/dependency-graph/ui/LanesView.svelte`
- `template/src/widgets/dependency-graph/lib/cluster.svelte.ts` (optional pre-sort hook for ring members)
- `template/src/widgets/dependency-graph/lib/seeded-rand.ts` (NEW)
- `template/src/widgets/dependency-graph/lib/degree.ts` (NEW)
- `template/src/widgets/dependency-graph/lib/seeded-rand.test.ts` (NEW)
- `template/src/widgets/dependency-graph/lib/degree-order.test.ts` (NEW)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-033 | parent | draft |
| PRD-005 / RFC-004 | prior geometry-first layout work | active |
| PRD-016 | mosaic consumer | active |





