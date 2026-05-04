---
depth: standard
id: RFC-003
kind: rfc
last_modified_at: 2026-05-04T13:37:46.785844+00:00
last_modified_by: claude-code/2.1.126
status: draft
title: 'Template hardening: runes migration + read-only proxy enforcement'
---

---
id: RFC-003
title: "Template hardening: runes migration + read-only proxy enforcement"
status: Draft
author: claude-code
created: 2026-05-04
updated: 2026-05-04
depth: standard
---

# RFC-003: Template hardening: runes migration + read-only proxy enforcement

## Progress

```
Phase 1  ████████████████████████  9/9  (100%)
Phase 2  ░░░░░░░░░░░░░░░░░░░░░░░░  0/14 (  0%)
Phase 3  ░░░░░░░░░░░░░░░░░░░░░░░░  0/4  (  0%)
─────────────────────────────────────────────────
TOTAL                               9/27 ( 33%)
```

---

## Summary

Закрыть весь скоп находок аудита `template/` (HIGH/MEDIUM/LOW) одним
скоординированным рефакторингом: (1) перевести rule-22 из review-only в runtime
allow-list внутри `runForgeplan`, ужесточить regex id, добавить error code
mapping; (2) мигрировать все `.svelte` файлы с legacy mode (`export let`, `$:`,
`createEventDispatcher`, `<slot/>`) на Svelte 5 runes; (3) поднять enums
`GraphView`/`InsightTab` в `@/shared/config`, извлечь sizing/d3-barrel/
`reffBarColor` хелпер, починить d3-zoom cleanup, MatrixView keyed-each,
keyboard a11y, debounce localStorage settings.

## Motivation

Аудит выявил 6 HIGH (rule-22 allow-list drift, Svelte 5 legacy режим во всём
UI, 8 поллеров пишут в `localStorage` каждые 10 с, `runForgeplan` без runtime
guard, regex id шире rule-22, page→widget импорт enum'ов), 7 MEDIUM (cleanup
d3-zoom listeners, `StalePayload` в api-сегменте вместо model, дубликация
`reffTone` bucket'ов и константных размеров узла в 4-5 view-файлах,
полный sort на каждом тике, MatrixView keyed-each по индексу, walk `..`
от `import.meta.url`, рассогласованное именование segment'ов в `entities/
artifact/api/`), 7 LOW. Без починки: (а) rule-22 enforcement остаётся
ревью-зависимым, что приведёт к drift'у при росте allow-list'а; (б) гибрид
runes+legacy в Svelte 5 даст subtle reactivity bugs (особенно в `ForceView`
с d3-сим, мутирующей массивы in-place); (в) тысячи лишних `localStorage.
setItem` в час нагружают браузер пользователя.

## Goals

- Превратить allow-list rule-22 в runtime-инвариант (runtime-guard
  отвергает запрещённые subcommand'ы до spawn).
- Унифицировать UI на Svelte 5 runes (`$props`, `$state`, `$derived`,
  `$effect`, callback props, `{@render children?.()}`); ноль legacy
  конструкций после миграции.
- Закрыть все CRITICAL/HIGH/MEDIUM находки аудита; LOW — на best-effort.
- `npm run check` в `template/` проходит без ошибок и предупреждений
  Svelte 5.
- Сохранить публичный контракт `/api/*` (форма envelope не меняется,
  только status codes для error-cases).

## Non-Goals

- Миграция SvelteKit-stores (`shared/api/poller.ts`) на runes-classes
  — `writable` совместим с runes-компонентами через `$store`-syntax.
  Изменение откладывается.
- Введение новых subcommand'ов или мутирующих эндпоинтов — read-only
  контракт остаётся.
- Введение features-слоя FSD — приложение остаётся viewer'ом.
- ESLint-плагин для FSD-границ (`steiger`/`eslint-plugin-boundaries`)
  — отдельный артефакт.
- Замена hex-палитры на CSS-переменные (или наоборот) — `reffBarColor`
  возвращает то, что и сейчас inline-используется во view-файлах.

## Options Considered

### Option A: Big-bang refactor одним PR (выбран)

**Description**: Все правки в одной ветке, разбиты на 3 волны параллельных
sub-агентов (server hardening + types/segments + shared extractions →
runes migration по группам компонентов → валидация). Ровно один merge.

**Pros**:
- Нет промежуточных «полугибридных» состояний (часть компонентов на runes,
  часть на legacy — потенциальный источник subtle bugs).
- `reffBarColor` / `sizing.ts` / `d3.ts` сразу потребляются всеми 5
  view-файлами в одном PR.
- Один EvidencePack покрывает всё.

**Cons**:
- Большой diff — review-сложность.
- Сложнее изолировать регрессию: если что-то сломалось — больше площадь.

### Option B: Поэтапные PR per-Wave

**Description**: Wave 1 (server + types + extractions) → merge → Wave 2 part 1
(routes+pages) → merge → Wave 2 part 2 (graph widgets) → merge → Wave 2
part 3 (rest) → merge → Wave 3.

**Pros**:
- Маленькие PR, легче ревьюить.
- Можно catch регрессию в одной волне до старта следующей.

**Cons**:
- Между Wave 2 part 1 и part 3 кодовая база живёт в гибридном режиме
  runes+legacy 4-5 дней — риск D2 (миграция `ForceView` с d3-sim).
- 4 PR-цикла vs 1 = 4× ревью-overhead, 4× evidence-packs.
- Артефакт rule-22 расхождение остаётся открытым между Wave 1 merge и
  Wave 2 (если кто-то добавит роут в gap).

### Option C: Только enforcement, миграция на runes — отдельный RFC

**Description**: Этим RFC закрыть только rule-22 + extractions + bug fixes
(d3-zoom, debounce, sort hoist, MatrixView keyed-each, a11y). Миграция
на runes отделена в RFC-004.

**Pros**:
- Минимальный scope — быстрый merge.
- Runes-миграция получает свой ADR (`ForceView`+d3-sim — нетривиальная
  декомпозиция).

**Cons**:
- HIGH#1 аудита (legacy mode) остаётся открытым — drift гарантирован
  (новые компоненты будут писаться на runes, старые останутся legacy).
- Часть мелких fix'ов (debounce settings) проще делать в рамках runes-
  миграции через `$effect`, а не двойным проходом по файлу.

## Trade-off Analysis

| Критерий | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Complexity | high (1 PR) | low (4 PR) | low (1 PR) |
| Review burden | 1× big | 4× small | 1× small |
| Hybrid-state risk | none | 4-5 дней | бессрочно |
| Migration risk (`ForceView`) | high | high | deferred |
| Cost (artifacts) | 1 RFC + 1 EVID | 1 RFC + 4 EVID | 2 RFC + 2 EVID |
| Time-to-clean-tree | 1 cycle | 4 cycles | 2 cycles |
| Drift risk на allow-list | минимальный | средний (gap) | минимальный |

## Proposed Direction

**Option A**. Команда — ИИ-агент с возможностью параллельной работы внутри
sub-агентов; review-burden большого PR компенсируется тем, что (a) каждая
Wave-задача задокументирована в этом RFC + EvidencePack; (b) структура
изменений предсказуема (4 категории файлов: shared/server, entities,
widgets, pages); (c) hybrid-state runes+legacy — реальный риск
(`ForceView` мутирует `simNodes` in-place; смешанное состояние ломает
d3-sim в одном из вариантов `$state`/`$state.raw`), его лучше не
порождать вовсе.

## Risks & Open Questions

- **R1 — `ForceView` runes-миграция**: d3-force `simulation.tick()` мутирует
  массивы `simNodes`/`simLinks` in-place. Текущий legacy-pattern
  `simNodes = simNodes` форсит rerender. Под `$state` (proxy) — каждая
  внутренняя мутация триггерит реактивность (overhead). Под `$state.raw`
  — нет автотриггера, нужен `simNodes = [...simNodes]` в `tick`-handler'е.
  Решение: использовать `$state.raw` + явный shallow-clone в обработчике
  `tick`. Альтернатива: `$state` + замер перформанса; если просадка >5%
  — fallback на raw. Mitigation: prove с FPS-замером в EvidencePack.
- **R2 — Совместимость `writable` stores с runes-компонентами**:
  `shared/api/poller.ts` остаётся как `Writable`. Runes-компоненты
  читают через `$poller.store` syntax (auto-subscription) или
  `get(poller.store)`. Подтверждено в Svelte 5 docs (Non-Goals).
- **R3 — Hex/CSS-var палитра в `reffBarColor`**: Wave 1 Team C обнаружила,
  что во view-файлах используются CSS-переменные (`var(--good)`,
  `var(--accent)`, `var(--bad)`), не hex. Решение: `reffBarColor` возвращает
  ровно те значения, которые уже inline'ятся (parity preserved). Audit-
  гипотеза была неверна; маркер `// TODO(palette-audit)` оставлен в коде.
- **R4 — Rule-22 расширение allow-list**: добавление `blindspots` и
  `journal` требует записи в этом RFC + обновлённого правила. Рисковая
  поверхность: `journal` принимает `--limit` argv — должно быть
  валидировано regex'ом (уже сделано в `routes/api/log/+server.ts`,
  pattern переиспользован).
- **OQ1**: нужен ли отдельный ESLint-плагин для FSD-границ? — отложено
  в Non-Goals; следить, не появится ли cross-slice импорт после миграции.
- **OQ2**: оставить ли `entities/artifact/api/detail.ts` (one-shot
  fetcher) в `api/`-сегменте, или перенести в `lib/`? — оставляем в
  `api/`, имя файла достаточно говорящее; FSD не требует разделения
  poller vs one-shot fetcher по сегментам.

## Implementation Phases

### Phase 1: Server hardening + structural extractions (DONE — committed in working tree)

- [x] **1.1** Runtime allow-list `READ_ONLY_SUBCOMMANDS` в `runForgeplan` —
      отвергает любой subcommand вне списка до `spawn`.
- [x] **1.2** Regex id ужесточён до `/^[A-Z]+-[0-9]+$/` в `get/[id]/+server.ts`.
- [x] **1.3** Error code mapping в `respond.ts` (timeout→504, parse→500,
      forbidden→403, exit-code/stderr→400, default→502).
- [x] **1.4** `.claude/rules/22-readonly-proxy.md` обновлён — добавлены
      `blindspots`, `journal`, NOTE про raw-text fallback и требование
      Forgeplan-артефакта при расширении.
- [x] **1.5** `StalePayload` перенесён `entities/artifact/api/stale.ts`
      → `model/types.ts` (FSD segment discipline). Барреллы обновлены.
- [x] **1.6** `BlockedItem.waiting_on` удалён (нигде не читается).
- [x] **1.7** `entities/score/lib/score.ts` + `reffBarColor()` (CSS-var
      palette: `var(--good)`/`var(--accent)`/`var(--bad)`).
- [x] **1.8** Созданы `widgets/dependency-graph/lib/sizing.ts`
      (`CHAR_W`/`NODE_H`/`NODE_PAD_X`) и `widgets/dependency-graph/lib/d3.ts`
      (single side-effect import + re-exports).
- [x] **1.9** `@/shared/config/ui-prefs.ts` — single source of truth для
      `GRAPH_VIEWS`/`GraphView`/`GraphViewMeta`/`GRAPH_VIEW_IDS` +
      `InsightTab`/`INSIGHT_TAB_IDS`. `widgets/*/model/types.ts` —
      back-compat re-export.

### Phase 2: Runes migration (build)

- [ ] **2.1** `routes/+layout.svelte`: `<slot/>` → `let { children } =
      $props(); {@render children?.()}`.
- [ ] **2.2** `routes/+page.svelte`: проверить runes-совместимость
      (минимальный файл, импортирует `HomePage`).
- [ ] **2.3** `pages/home/ui/HomePage.svelte`: full runes-migration
      (`$props`, `$state`, `$derived`, `$effect`, callback props
      вместо on:select), debounce `saveSettings` ~250ms через `$effect`.
- [ ] **2.4** `pages/home/lib/settings.ts`: enum-импорты переехали с
      `@/widgets/*` на `@/shared/config`.
- [ ] **2.5** `widgets/dependency-graph/ui/DependencyGraph.svelte`:
      runes + callback prop `onSelect`.
- [ ] **2.6** `widgets/dependency-graph/ui/ForceView.svelte`: runes
      (`$state.raw` для simNodes/simLinks с явным shallow-clone в `tick`),
      импорт `sizing.ts` + `d3.ts`, `reffBarColor`, cleanup
      `select(svgEl).on('.zoom', null)`.
- [ ] **2.7** `widgets/dependency-graph/ui/TreeView.svelte`: runes,
      sizing/d3-barrel, reffBarColor, удаление пустого `onDestroy`,
      cleanup `.on('.zoom', null)`.
- [ ] **2.8** `widgets/dependency-graph/ui/RadialView.svelte`: runes,
      sizing/d3-barrel, reffBarColor, cleanup `.on('.zoom', null)`.
- [ ] **2.9** `widgets/dependency-graph/ui/MatrixView.svelte`: runes,
      sizing/d3-barrel, keyed-each `(n.id)` вместо индексного, cleanup
      `.on('.zoom', null)`.
- [ ] **2.10** `widgets/dependency-graph/ui/LanesView.svelte`: runes,
      sizing/d3-barrel, reffBarColor, cleanup `.on('.zoom', null)`.
- [ ] **2.11** `widgets/insights-rail/ui/InsightsRail.svelte`: runes,
      sort hoist в `$derived`, keyboard a11y для clickable `<li>`
      (выбор: `role="button" tabindex="0"` + keydown OR удалить
      `clickable` с outer и оставить только nested `<button>`).
- [ ] **2.12** `widgets/health-bar/ui/HealthBar.svelte`: runes.
- [ ] **2.13** `widgets/artifact-filters/ui/Filters.svelte`: runes
      ($bindable для kindFilter/statusFilter).
- [ ] **2.14** `widgets/artifact-panel/ui/ArtifactPanel.svelte`: runes
      (`$effect` для load(id) с проверкой equality), `aria-hidden="true"`
      на `×` glyph.

### Phase 3: Validation + activation

- [ ] **3.1** `cd template && npm run check` (svelte-kit sync + svelte-
      check) — 0 errors, 0 warnings.
- [ ] **3.2** `cd template && npm run build` (vite build) — успех.
- [ ] **3.3** EvidencePack (next sequential EVID id) с `## Structured Fields`
      (`verdict: passed`, `congruence_level: high`,
      `evidence_type: build_test`); `forgeplan link → RFC-003 informs`;
      `forgeplan score RFC-003` ⇒ R_eff > 0.
- [ ] **3.4** `forgeplan activate RFC-003`.

## Affected Files

Server / shared (Phase 1, done):

- `template/src/shared/server/forgeplan.ts`
- `template/src/shared/server/respond.ts`
- `template/src/routes/api/get/[id]/+server.ts`
- `.claude/rules/22-readonly-proxy.md`
- `template/src/entities/artifact/{api/stale.ts, model/types.ts, index.ts}`
- `template/src/entities/blocked/model/types.ts`
- `template/src/entities/score/{lib/score.ts, index.ts}`
- `template/src/widgets/dependency-graph/{lib/sizing.ts (new), lib/d3.ts (new), model/types.ts}`
- `template/src/widgets/insights-rail/model/types.ts`
- `template/src/shared/config/{ui-prefs.ts (new), index.ts (new)}`

UI / runes migration (Phase 2):

- `template/src/routes/{+layout.svelte, +page.svelte}`
- `template/src/pages/home/ui/HomePage.svelte`
- `template/src/pages/home/lib/settings.ts`
- `template/src/widgets/dependency-graph/ui/{DependencyGraph,ForceView,TreeView,RadialView,MatrixView,LanesView}.svelte`
- `template/src/widgets/insights-rail/ui/InsightsRail.svelte`
- `template/src/widgets/health-bar/ui/HealthBar.svelte`
- `template/src/widgets/artifact-filters/ui/Filters.svelte`
- `template/src/widgets/artifact-panel/ui/ArtifactPanel.svelte`

## Invariants

Что НИКОГДА не нарушается этим решением:

- **I1 — read-only**: ни один `/api/*` endpoint не вызывает мутирующий
  forgeplan-subcommand. Runtime-guard в `runForgeplan` отвергает
  `args[0] ∉ READ_ONLY_SUBCOMMANDS` до `spawn`. Изменение allow-list'а
  требует обновления и кода, и `.claude/rules/22-readonly-proxy.md`,
  и Forgeplan-артефакта.
- **I2 — публичный envelope формат не меняется**: `{ ok, data?, error?,
  cmd, raw? }` сохранён; меняются только HTTP status-коды для error-
  ветки.
- **I3 — host isolation**: ни одна правка не выходит за `template/` и
  `.claude/rules/22-readonly-proxy.md` (в этом репо). При копировании
  в `.forgeplan-web/` host project не страдает.
- **I4 — FSD direction**: импорты идут только сверху вниз. После
  миграции `pages/home/lib/settings.ts` импортирует `@/shared/config`,
  не `@/widgets/*`.
- **I5 — template purity**: ноль абсолютных путей, ноль симлинков, ноль
  ссылок на корневой `package.json` репозитория, ноль committed
  `node_modules/`.
- **I6 — comments policy**: только `TODO(reason)`/`FIXME(reason)` для
  cut-corner'ов; никаких комментариев «что делает».

## Rollback Plan

Сценарий 1 — runes-миграция ломает что-то в браузере (R1, `ForceView`):

```bash
git revert <Phase 2 commits>
# Phase 1 (server hardening + extractions) остаётся — не откатывается.
```

Phase 1 — чисто аддитивный (новые файлы + узкое ужесточение существующих)
и независимо полезен. Откат Phase 2 возвращает legacy-mode UI без
потери Phase 1 enforcement'а.

Сценарий 2 — runtime-guard в `runForgeplan` ложно срабатывает на
валидной команде (например, кто-то добавил роут до обновления списка):

```bash
# Hot-fix: добавить subcommand в READ_ONLY_SUBCOMMANDS И в rule-22 одним
# коммитом + Forgeplan-артефакт (не revert).
```

Сценарий 3 — error-code mapping в `respond.ts` ломает downstream
(например, фронтенд предполагал 502 для всех ошибок):

```bash
# Замена statusFor() на постоянный 502 — 1 коммит, обратимо.
```

Сценарий 4 — лифт enums в `@/shared/config` ломает back-compat re-export:

```bash
# Барреллы виджетов уже re-export'ят из shared/config. Если что-то всё
# же сломалось — вернуть локальное объявление в widgets/*/model/types.ts
# (revert конкретного файла), и shared/config продолжает существовать
# параллельно.
```

Точка не-возврата отсутствует: вся работа в одной ветке, до merge на
`main` всё откатывается обычным `git reset --hard origin/develop`.

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| EVID (next) | Evidence | informs RFC-003 (build/check pass) |
| ADR-001 | ADR | based_on (template purity contract) |

---

> **Next step**: validate → reason → Phase 2 build → evidence → activate.

