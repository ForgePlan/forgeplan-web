# Forgeplan workspace — `.gitignore` контракт

**Аудитория:** разработчики, использующие Forgeplan CLI / MCP в командной
работе. Также — agent-сессии (Claude Code, Cursor, и т.п.), которые могут
ошибочно классифицировать файлы как «cache/derived» при первом
коммите `.forgeplan/`.

**TL;DR:** в `.forgeplan/.gitignore` строго определённый список derived
state. Любая ошибка категоризации (особенно — `config.yaml` или `notes/`)
ломает командную работу, time-travel в `@forgeplan/web`, и общий граф
артефактов.

---

## Канонический `.forgeplan/.gitignore`

```gitignore
# Forgeplan derived/cache files — NOT committed.
# Source of truth: markdown в prds/, rfcs/, adrs/, specs/, epics/,
# evidence/, problems/, solutions/, refresh/, notes/
# + state YAML в state/
# + config.yaml (project config — committed!)

lance/                 # LanceDB vector index — derived from markdown
logs/                  # local audit/ops logs — per-machine
.lock                  # runtime mutex during reindex/validate
memory/                # per-agent contextual memory (Hindsight-style)
discovery/             # ephemeral research findings (см. примечание ниже)
trash/                 # soft-deleted artifacts (forgeplan delete)
.fastembed_cache/      # bge-m3 embedding model — ~600 MB
session.yaml           # runtime focus/claim state — per-machine
```

> **Примечание про `discovery/`** — gitignored по дефолту, потому что
> это short-lived research перед оформлением PRD/RFC. Если в команде
> практикуется обмен черновиками research, можно убрать строку и трекать
> их явно. Для большинства команд default подходит.

---

## Что НЕ должно попадать в `.gitignore`

| Файл / папка     | Почему **обязательно** в git                                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config.yaml`    | Конфиг проекта (layout, embedding model, llm provider). Без него `forgeplan` 0.28+ падает с `os error 2` на любой подкоманде. Аналог `package.json` — часть проекта, не cache. Без него time-travel reconstruction в `@forgeplan/web` ломается. Новый контрибьютор клонирует репо — должен получить **тот же** forgeplan-experience. |
| `prds/*.md`      | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| `rfcs/*.md`      | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| `adrs/*.md`      | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| `specs/*.md`     | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| `epics/*.md`     | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| `evidence/*.md`  | first-class artifacts (R_eff scoring depends on these being shared)                                                                                                                                                                                                                                                                  |
| `problems/*.md`  | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| `solutions/*.md` | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| `refresh/*.md`   | first-class artifacts                                                                                                                                                                                                                                                                                                                |
| **`notes/*.md`** | first-class artifacts. `forgeplan_new note` создаёт `NOTE-NNN-*.md`. У них есть lifecycle (`draft → active → superseded`), они появляются в `forgeplan list/graph`, входят в `health` count. **Если gitignored — графы у разных членов команды разные**, backlog как NOTE теряется.                                                  |
| `state/*.yaml`   | lifecycle state of each artifact (status, claims, links). Без него после клона `forgeplan list` покажет всё как `draft`.                                                                                                                                                                                                             |

---

## Эффекты типичных ошибок категоризации

### `config.yaml` в gitignore (наиболее частая ошибка)

| Поверхность                               | Что ломается                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time-travel slider** в `@forgeplan/web` | `git worktree add` создаёт эфемерный checkout без `config.yaml` → `forgeplan reindex` падает с `os error 2` → reconstruction даёт generic `502 snapshot reconstruction failed`.                 |
| **Новый контрибьютор**                    | Клонирует репо → `forgeplan` использует дефолтный config, не проектный → разные embedding-модель, llm-провайдер, тайминги decay. Результаты `search` / `route` / `score` разные у разных людей. |
| **CI / smoke jobs**                       | Ephemeral runner получает не тот config — тесты `forgeplan validate` могут проходить локально и падать в CI.                                                                                    |
| **`forgeplan health`**                    | Может вообще не запуститься (CLI 0.28+ падает на любую подкоманду без config).                                                                                                                  |

### `notes/` в gitignore (вторая по распространённости ошибка)

| Поверхность                    | Что ломается                                                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Командный workspace**        | NOTE-артефакт создан локально → `forgeplan list` его показывает, но при коммите он не уезжает в репо → коллеги его не видят → разные графы артефактов.                                                                              |
| **`@forgeplan/web` viewer**    | Граф нодов отличается между машинами. У тебя 13 узлов, у коллеги 12 — потому что NOTE-001 (твой backlog) не приехал.                                                                                                                |
| **Time-travel reconstruction** | В `git worktree` старого SHA не будет тех NOTE, которых там не было — ОК. Но если NOTE удалили в новом коммите, локальный stale-файл останется, и diff с прошлым покажет «нода исчезла» там, где она просто никогда не коммитилась. |
| **R_eff / blindspots**         | NOTE могут влиять на decay rules / blindspot detection. Разные NOTE — разные риск-метрики.                                                                                                                                          |
| **PR-Diff overlays** (план)    | `git diff .forgeplan/` не покажет изменения NOTE → счётчики «+N ~M -K» врут.                                                                                                                                                        |

### `session.yaml` НЕ в gitignore (обратная ошибка)

`session.yaml` хранит **runtime state** — текущую фокус-задачу, last-activity, локальные claim-таймауты. Forgeplan пишет в него при **любой** операции.

| Эффект                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- |
| **Merge-конфликт на каждом PR** — каждый разраб генерит свой diff в `session.yaml`, `git pull` регулярно конфликтит. |
| **Шум в `git log`** — review теряется среди session-update коммитов.                                                 |
| **Race conditions** — если два разраба одновременно меняют один и тот же session-state, merge становится lossy.      |

### `state/` в gitignore (редкая, но фатальная ошибка)

`state/<ID>.yaml` — это **lifecycle state** артефакта (status, claims, links, valid_until). Если gitignored:

- После клона все артефакты выглядят как `draft` — независимо от того, что в репо есть `active` PRD с evidence.
- Activation-гейт `R_eff > 0` теряется между сессиями.
- Claims (multi-agent dispatch) исчезают при коммите.

---

## Как проверить свой workspace

```bash
# 1. что у тебя ignored
cat .forgeplan/.gitignore

# 2. что реально лежит на диске, но НЕ в git
git ls-files .forgeplan/ | wc -l                    # tracked
find .forgeplan -type f -not -path "*/lance/*" -not -path "*/logs/*" \
  -not -path "*/memory/*" -not -path "*/.fastembed_cache/*" | wc -l   # на диске

# 3. ключевая проверка — config.yaml на месте?
git ls-files .forgeplan/config.yaml                 # должен вернуть путь
test -f .forgeplan/config.yaml && echo "ok on disk" || echo "MISSING"

# 4. session.yaml НЕ должен быть tracked
git ls-files .forgeplan/session.yaml                # пусто = ok, путь = bad
```

Если `(3)` пустой или `(4)` вернул путь — workspace в дрейфе, см. миграцию.

---

## Миграция из неправильного состояния

Если уже накоммичено неправильно — починка идёт за **один коммит**:

```bash
# (a) убрать ошибочные ignores, добавить правильные
$EDITOR .forgeplan/.gitignore
# - удалить строки: config.yaml, notes/, state/ (если там есть)
# - добавить строку: session.yaml (если её нет)

# (b) синхронизировать tracking
git add .forgeplan/config.yaml                      # был ignored, теперь tracked
git add .forgeplan/notes/ 2>/dev/null               # если есть NOTE-файлы
git add .forgeplan/state/ 2>/dev/null               # если был ignored
git rm --cached .forgeplan/session.yaml 2>/dev/null # снять с tracking, файл на диске остаётся

# (c) ОДИН коммит с осмысленным message
git add .forgeplan/.gitignore
git commit -m "chore(forgeplan): align .forgeplan/.gitignore with canonical contract

- track config.yaml (project config, not cache)
- track notes/ (first-class artifact kind)
- ignore session.yaml (per-machine runtime state)

Without this alignment: time-travel reconstruction breaks,
team workspace state diverges between machines, merge conflicts
on every PR via session.yaml."
```

После merge — каждый член команды делает `git pull` + один раз `forgeplan reindex` (на случай если local lance/ устарел).

---

## Антипаттерны (для agent-сессий)

При первичной инициализации `.forgeplan/.gitignore` через ИИ-агента —
agent **может** ошибочно сгруппировать файлы по слабому семантическому
сходству. Конкретно встреченные ошибки:

1. **«Cache/derived files: lance/, logs/, config.yaml»** — `lance/` и
   `logs/` derived, `config.yaml` — нет. Не группировать в одной фразе.
2. **«Volatile state: session.yaml, notes/, memory/»** — `notes/` это
   **artifacts** (с lifecycle), не volatile.
3. **«Local-only: state/, config.yaml»** — `state/` определяет lifecycle
   и **должен** быть shared. Это часть source-of-truth.

При сомнениях: открой `forgeplan list --json` — если файл порождает
запись в `list`, он **artifact** и должен быть tracked. Если не
порождает (cache, log, lock, runtime state) — игнорируй.

---

## Связанные документы

- ADR-003 в репо Forgeplan: «Markdown is source of truth, Lance is derived».
- `forgeplan init` — НЕ создаёт `.forgeplan/.gitignore` сам, оставляет на
  усмотрение проекта (проверено на CLI 0.28).
- `@forgeplan/web` rule 22 (`template/src/routes/api/`) — read-only proxy
  тоже зависит от `config.yaml` присутствия в эфемерных worktree.
