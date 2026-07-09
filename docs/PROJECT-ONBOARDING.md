# Онбординг проекта `@forgeplan/web`

> Текстовый двойник composed-map: тот же материал, что вы видите на «карте
> понимания» в UI, только словами. Это не эссе, а маршрут для новичка —
> прочитайте сверху вниз, и вы поймёте, **что это за проект и как он работает**.
>
> Источник — подтверждённая карта архитектуры `.forgeplan/map/map.json`
> (schema `forgeplan.map/v1`, `status: confirmed`): 4 зоны, 244 узла-модуля,
> 230 рёбер, 7 потоков. Проза наследует язык карты (§15 — русский);
> идентификаторы, пути модулей и имена правил оставлены дословно.

---

## 1. Что это

`@forgeplan/web` — крошечный **npm CLI** (`bin/forgeplan-web.mjs`), который
разворачивает в проекте пользователя уже собранный **SvelteKit-вьювер** его
Forgeplan-воркспейса. На стороне пользователя ничего не устанавливается:
`npx @forgeplan/web init -y` копирует self-contained приложение в
`.forgeplan-web/`, а `npx @forgeplan/web start` поднимает локальный сервер,
который **только читает** воркспейс — через `/api/*` он запускает
`forgeplan <cmd> --json` и транслирует JSON в браузер. Браузер опрашивает
эндпоинты каждые 10 секунд и рисует все PRD, RFC, ADR, Spec, Epic и
EvidencePack из `.forgeplan/` как интерактивный граф — force-directed в пяти
режимах плюс восьмой вид, зонированная composed-map. Вьювер физически не может
изменить воркспейс: за `/api/*` достижимы лишь read-only подкоманды.

Четыре поверхности репозитория (см. `CLAUDE.md`): `bin/` — zero-dep CLI;
`template/` — исходники SvelteKit (repo-internal, **не** публикуются);
`dist/` — пред-собранный образ `stable`, копируется дословно при `init`;
`dist-<name>/` — образы для не-дефолтных каналов (напр. `nightly`).

### Как читать карту (и этот документ)

Позвоночник чтения — четыре зоны слева направо, как течёт запрос:

```
z.surfaces  →  z.core  →  z.ui        (+ z.decisions — «почему код такой»)
Routes&API     Business     Widgets
входные       Logic        & UI
двери         ядро         представление
```

Разделы 2–3 идут по этому позвоночнику; раздел 4 проходит 7 потоков карты как
пронумерованные путешествия; раздел 5 — инварианты, которые новичок обязан
знать до первой правки.

---

## 2. Зоны

### `z.surfaces` — «Routes & API» (входные двери)

> Входные двери приложения: HTTP-маршруты, API-эндпоинты и оболочка UI — всё,
> через что запрос или пользователь попадает внутрь. Отсюда вызовы уходят в ядро.

Здесь живут две группы точек входа. **CLI-бинарь и его подкоманды:**
`bin/forgeplan-web.mjs` (маленький npm CLI — тот самый zero-install вьювер),
`bin/cli.mjs` (определяет команды через citty), `bin/commands/init.mjs`,
`bin/commands/start.mjs`, `bin/commands/update.mjs`; плюс скрипты сборки и
проверки `scripts/build.mjs`, `scripts/dev.mjs`, `scripts/smoke.mjs`.
**Веб-поверхности:** корневые `template/src/routes/+page.svelte` и
`+layout.svelte`, витрина `routes/playground/+page.svelte` и семейство
read-only эндпоинтов `template/src/routes/api/*` — `list`, `health`, `map`,
`instances`, `instance-status`, `update-check`, `snapshot`. При большом числе
однотипных точек входа зона схлопывает их в мега-узел «Entrypoint (18)».

Ключевые узлы с деталями:

- **`bin/commands/init.mjs`** — флаг `--scope user|project` (PRD-025 / RFC-021
  / ADR-004): пользовательский scope пишет в `~/.forgeplan-web/` и не трогает
  `.gitignore` хоста; проектный — историческое `<cwd>/.forgeplan-web/`. Без
  флага и без `-y` — интерактивный выбор.
- **`template/src/routes/api`** — серверные `/api/*` **только для чтения**:
  запускают `forgeplan <cmd> --json` в корне воркспейса и транслируют JSON. Ни
  одна мутирующая подкоманда через HTTP недостижима.
- **`scripts/build.mjs`** — гоняет `vite build` через `@sveltejs/adapter-node`,
  собирает `package.json` бандла из runtime-зависимостей `template/`, кладёт
  результат в `dist/` с build-манифестом (с 0.1.3 — Windows-совместимо,
  `shell: true`).
- **`scripts/smoke.mjs`** — сквозной cross-platform smoke-тест: разворачивает
  пакет во временную директорию, подставляет заглушку `forgeplan` в PATH,
  поднимает сервер и проверяет 200 на `/api/health`, `/api/list`, `GET /`. Его
  гоняет CI на ubuntu/macos/windows × Node 22; прогоняйте перед каждым PR.

**Куда ведёт:** отсюда вызовы уходят в `z.core`.

### `z.core` — «Business Logic» (ядро)

> Ядро приложения: доменные сущности, use-case'ы и бизнес-логика. Сюда сходятся
> запросы с поверхностей, здесь принимаются решения и готовятся данные для
> отрисовки.

Ядро смешивает два «двигателя» проекта. **Слои SvelteKit по Feature-Sliced
Design:** оболочка `template/src/app`; десять доменных сущностей
`template/src/entities/*` (`activity`, `artifact`, `artifact-tabs`, `blocked`,
`claim`, `graph`, `health`, `instance`, `map`, `score`); шесть shared-сегментов
`template/src/shared/*` (`api`, `config`, `lib`, `server`, `services`, `ui`).
**CLI-механика и оснастка:** `bin`, `bin/commands`, `bin/lib`, `scripts`,
`config`, `docs`, `guides`, `playground`. Крупные группы схлопнуты в мега-узлы
«Entities (10)», «Shared (6)», «Docs (2)».

Ключевые узлы с деталями:

- **`template/src/shared/ui`** — каталог примитивов на базе `bits-ui`
  (PRD-018 / RFC-016): значки, разделители, скелетоны, спиннеры, карточки,
  алерты, прогресс-бары, основы форм, тумблеры, дисклоужеры (Tabs/Collapsible/
  Accordion), оверлеи, командная палитра. Маршрут `/playground` показывает
  каждый примитив по всем вариантам и размерам в обеих темах — это **контракт**
  того, как выглядит атом; верхние слои не переопределяют его через `:global()`
  (правило 24).
- **`bin`** — переведён на citty `^0.2.2` (ADR-003), единственную разрешённую
  runtime-зависимость: маршрутизация подкоманд, типизированные аргументы,
  авто-help. Разбит на `cli.mjs` + `commands/*.mjs` + `lib/*.mjs`.
- **`bin/lib`** — глобальный реестр запущенных инстансов в
  `~/.forgeplan-web/instances.json` (PRD-027 / RFC-023 / SPEC-003 / ADR-004):
  каждый сервер регистрирует себя (id, host, port, pid, scope, workspaceRoot,
  heartbeat…) и обновляет heartbeat каждые 30 с через атомарную запись с
  file-lock. HealthBar показывает переключатель при ≥2 живых инстансах.
- **`config`** — реестр образов и фиче-флагов (PRD-030 / RFC-026 / ADR-005):
  `stable` (дефолт, только стабильные флаги) и `nightly` (ранний доступ). Байты
  образов одинаковые — различается лишь зашитый набор флагов; флаг обязан
  «выпуститься» или быть удалён до истечения срока (сборка падает при жизни
  флага > три minor-версии).
- **`docs` / `guides`** — индекс документации (`USAGE.md`, `CONTRIBUTING.md`) и
  методических гайдов (как писать `CLAUDE.md` с учётом слабостей LLM; полный
  Git-Flow-гайд).
- **`playground`** — вымышленный repo-internal воркспейс «Helios» (~123
  артефакта) для прогонки вьювера на реалистичном объёме. В npm-пакет **не**
  публикуется.

**Куда ведёт:** ядро готовит данные и модель представления и передаёт их в
`z.ui`.

### `z.ui` — «Widgets & UI» (представление)

> Слой представления: виджеты, компоненты и страницы, из которых собирается
> интерфейс. Потребляет данные из ядра и отрисовывает их пользователю.

Составные UI-блоки `template/src/widgets/*` собираются в страницу
`template/src/pages/home`. Виджеты: `artifact-filters`, `artifact-panel`,
`artifact-tabs`, `composed-map`, `dependency-graph`, `health-bar`, `hints`,
`insights-rail`, `mosaic`, `stats-pulse`, `timeline`, `version-footer` (мега-узел
«Widgets (12)»).

Ключевые узлы с деталями:

- **`template/src/widgets/dependency-graph`** — пять режимов графа: **Force**
  (что с чем связано, по умолчанию), **Lanes** (поток статусов), **Matrix**
  (смежность), **Radial** (иерархия: эпики в центре, evidence по краю), **Tree**
  (parent/child-декомпозиция). Названия видов дословны в UI, телеметрии и тестах.
- **`template/src/widgets/composed-map`** — **восьмой** вид, отдельный от семи:
  читает исключительно `/api/map`, владеет собственным типом узла `MapNode` и
  никогда не делит узлы с остальными видами (у тех источник — `ArtifactSummary`
  из другого поллера); совместимость — только по рёбрам (byte-exact `GraphEdge`).
  Показывает зонированную «карту понимания» — зоны, слои, узлы; при выборе flow
  путь подсвечивается анимированными стрелками с нумерованными шагами.
- **`template/src/widgets/hints`** — движок проактивных подсказок
  (PRD-011 / RFC-010): аномалии воркспейса как ранжированные скрываемые
  карточки над HealthBar. Восемь правил (всплеск stale, низкий R_eff у
  активного, скорое истечение `valid_until`, новые слепые пятна, сироты, старые
  черновики, падение скорости, циклы). Всё считается на клиенте — отдельного
  `/api/anomalies` нет и не будет.
- **`template/src/widgets/stats-pulse`** — вкладка Stats в InsightsRail:
  health-score воркспейса 0–100 из пяти взвешенных компонент плюс четыре графика
  (гистограмма R_eff, недельная скорость, переходы статусов за 90 дней, панель
  риска распада). Считается на клиенте; отдельный `/api/pulse` был отклонён как
  нарушающий read-only.

### `z.decisions` — «Decision Trail» (почему код такой)

> След решений проекта: EPIC → PRD → RFC → ADR → EVID со связями и
> доказательствами. Отвечает на вопрос «почему код устроен так». При большом
> числе артефактов схлопывается в группы по типу (PRD, RFC, ADR, EVID…), а не в
> одну карточку.

Это сам Forgeplan-воркспейс проекта, отрисованный как зона: `EPIC-001`,
серия `PRD-*`, `RFC-*`, `SPEC-*`, `ADR-001…ADR-009` и десятки `EVID-*`
(активные, часть superseded), схлопнутые в мега-группы «ADR (9)», «PRD»,
«RFC», «EVID» — всего ~180 узлов. Рёбра между ними — типизированные связи
Forgeplan: `informs`, `based_on`, `refines`, `supersedes` (плюс `imports` —
grep-подтверждённые код-зависимости в других зонах). У узла-`EVID` поле
`R_eff` всегда 0 — «неприменимо для этого вида», а не баг: R_eff считается для
**решений**, а не для доказательств. Эта зона — durable-ответ на «почему»:
каждый PRD/RFC/ADR здесь объясняет модуль из первых трёх зон.

---

## 3. Потоки (7 путешествий)

Потоки карты — это готовые «экскурсии» по узлам. При выборе flow в UI путь
подсвечивается, остальное затемняется. Ниже — дословные шаги из `map.json`.

**1. Request path** (`f.request`) — как приходит и рисуется запрос:

1. Запрос входит через routes/API — поверхностный слой.
2. Обрабатывается доменной логикой и сущностями (entities).
3. Отрисовывается виджетами, компонентами и страницами.
   Узлы: `routes/api/list/+server.ts` → `+layout.svelte` → `+page.svelte` →
   `shared/server` → `app` → `shared/ui` → `pages/home` → `widgets/composed-map`
   → `widgets/dependency-graph`.

**2. Render** (`f.render`) — путь отрисовки внутри веба:

1. Ядро готовит данные и модель представления.
2. Виджеты и страницы отрисовывают их в интерфейс.
   Узлы: `entities/map` → `entities/artifact` → `entities/graph` →
   `entities/score` → `shared/ui` → `widgets/composed-map` →
   `widgets/dependency-graph`.

**3. Entry points** (`f.entry`) — все точки входа приложения:

1. CLI/бинарь, HTTP-маршруты, API-эндпоинты — то, с чего начинается любой
   сценарий.
   Узлы: `bin/forgeplan-web.mjs` → `bin/cli.mjs` → `bin/commands/init.mjs` →
   `bin/commands/start.mjs` → `bin/commands/update.mjs`.

**4. Init** (`d.init`) — установка вьювера:

1. `init` резолвит `--scope user|project` и копирует self-contained образ в
   целевую директорию.
2. Через `bin/lib` регистрирует запущенный воркспейс в глобальном реестре
   инстансов.
   Узлы: `bin/commands/init.mjs` → `bin/lib`.

**5. Start** (`d.start`) — запуск сервера:

1. `start` переиспользует логику `init` для резолва scope (project vs user).
2. Спавнит сервер и регистрирует его в реестре инстансов (`bin/lib`) с
   heartbeat.
   Узлы: `bin/commands/start.mjs` → `bin/commands/init.mjs` → `bin/lib`.

**6. Map API** (`d.map-api`) — как composed-map получает данные:

1. `GET /api/map` читает `.forgeplan/map/map.json` на диске.
2. Через `shared/server` — тот же тонкий read-only прокси, что и остальные
   `/api/*` эндпоинты.
   Узлы: `routes/api/map/+server.ts` → `shared/server`.

**7. Decision trail** (`f.decisions`) — цепочка решений:

1. След решений проекта: EPIC → PRD → RFC → ADR, со связями и доказательствами.
   Узлы: `EPIC-001` → `PRD-036` → `RFC-030` → `SPEC-006` → `EVID-081` →
   `ADR-005` → `PRD-030`.

---

## 4. Инварианты, которые новичок обязан знать

Эти правила — не советы, а границы. Нарушение без явного `// TODO(...)` и
обоснования в Forgeplan-артефакте считается дефектом (`.claude/rules/00-index.md`).

- **Read-only proxy (правило 22).** Эндпоинты `template/src/routes/api/*` —
  `GET`-only и запускают только read-only подкоманды `forgeplan` (`list`,
  `health`, `graph`, `get`, `map`, `snapshot` через ephemeral git-worktree…).
  Мутации (`new`, `link`, `activate`, `reindex`…) недостижимы из браузера.
  `runForgeplan` проверяет `args[0] ∈ READ_ONLY_SUBCOMMANDS` перед spawn.
- **`bin/` — почти zero-dep (правило 23, ADR-003).** В `bin/` разрешены только
  `node:*`, относительные сиблинги и **одна** библиотека — `citty ^0.2.2`.
  Никаких `chalk` / `commander` / `yargs`. Корневой `package.json#dependencies`
  = ровно `{ "citty": "^0.2.2" }`.
- **Изоляция хоста при `init` (правило 20).** `init` пишет только внутрь
  целевого scope-каталога (`<cwd>/.forgeplan-web/` или `~/.forgeplan-web/`),
  с единственным исключением — идемпотентный append строки `.forgeplan-web/`
  в `.gitignore` хоста (только project-scope, отключается `--no-gitignore`).
  Никогда не трогает `package.json`, lock-файлы, `node_modules/` или
  `.forgeplan/` хоста.
- **Чистота `template/` (правило 21).** `template/` обязан оставаться
  `cp -r`-безопасным: без симлинков, без абсолютных путей, без ссылок на
  корневой `package.json` / `node_modules/` / `.git/`. Путь воркспейса
  читается из `forgeplan-web.json` или `FORGEPLAN_CWD`, бинарь — из
  `FORGEPLAN_BIN`.
- **`shared/ui` владеет примитивами (правило 24).** Верхние слои (`entities`,
  `widgets`, `pages`, `routes`) **композируют** примитивы, но не переопределяют
  их внутренности через `:global()`. Нужен новый вид — добавь `variant`/`size`
  примитиву и покажи на `/playground`.
- **Дисциплина Forgeplan-артефактов (правило 11).** Любая не-Tactical работа
  требует артефакта: перед merge — `active` статус и `R_eff > 0`. R_eff =
  `min(оценок evidence)` (слабое звено, не среднее); EvidencePack обязан нести
  секцию `## Structured Fields` (`verdict` / `congruence_level` /
  `evidence_type`), иначе парсер молча ставит CL0 → `R_eff = 0.1`.

### Красные линии (никогда)

Из `CLAUDE.md`: **не** `npm publish` вручную (релиз — только через
`release.yml`); **не** пушить в `main` / `develop` напрямую (только PR из
feature-веток); **не** активировать артефакт с `R_eff == 0`; **не**
`--no-verify` и **не** `forgeplan init --force` без бэкапа `.forgeplan/`.
Локальный хук `forge-safety-hook.sh` блокирует эти команды как страховку —
но помнить правила во время работы должны вы, а не хук.

---

_Этот документ — производный: он пересобирается из `.forgeplan/map/map.json` и
нарраций docs-сканера. Если карта расходится с кодом — источник истины код и
`CLAUDE.md`, карта отстаёт (Refs: PRD-038)._
