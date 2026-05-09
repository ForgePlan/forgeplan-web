<div align="center">

# @forgeplan/web

<img src="https://raw.githubusercontent.com/ForgePlan/forgeplan-web/main/.github/assets/hero.png" alt="@forgeplan/web — интерактивная карта Forgeplan-воркспейса" width="100%">

### Смотри Forgeplan-воркспейс как интерактивный граф

Маленький **npm CLI**, который разворачивает в твоём проекте **уже собранный
SvelteKit-вьювер**. Без установок на стороне пользователя:
`npx @forgeplan/web init -y` копирует self-contained приложение,
`npx @forgeplan/web start` поднимает force-directed карту всех PRD, RFC,
ADR, Spec, Epic и EvidencePack из твоего `.forgeplan/`.

<br>

[![License: MIT](https://img.shields.io/badge/license-MIT-000.svg?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/npm/v/@forgeplan/web?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@forgeplan/web)
[![CI](https://img.shields.io/github/actions/workflow/status/ForgePlan/forgeplan-web/smoke.yml?branch=main&style=flat-square&label=smoke)](https://github.com/ForgePlan/forgeplan-web/actions/workflows/smoke.yml)
[![cross-platform](https://img.shields.io/badge/cross--platform-linux%20%7C%20macos%20%7C%20windows-blue?style=flat-square)](https://github.com/ForgePlan/forgeplan-web/actions/workflows/smoke.yml)

**[Forgeplan](https://github.com/ForgePlan/forgeplan)** ·
**[Документация](docs/README.md)** ·
**[Использование](docs/USAGE.md)** ·
**[Релизы](https://github.com/ForgePlan/forgeplan-web/releases)** ·
**[npm](https://www.npmjs.com/package/@forgeplan/web)**

<br>

[English](README.md) **·** [Русский](README.ru.md)

<br>

</div>

---

<div align="center">

```
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │  INIT  │ ─▶ │  COPY  │ ─▶ │  START │ ─▶ │ BROWSE │
    └────────┘    └────────┘    └────────┘    └────────┘
     verify       cp -r dist    spawn node     map @ 5174
```

**Read-only. Cross-platform. Без установок.**

</div>

---

## Зачем

<table>
<tr>
<td width="50%">

### До

- `forgeplan list` — плоский текст, без связей
- Связи PRD ↔ RFC ↔ Evidence — неявные
- ASCII-mermaid из `forgeplan graph` — одноразовый
- Чтобы прочитать тело артефакта — лезешь в markdown
- Поднимать SvelteKit-дев чтобы просто посмотреть данные

</td>
<td width="50%">

### После

- Force-directed карта артефактов, размер по `R_eff`
- Типизированные стрелки (`informs`, `refines`, `supersedes`, …)
- Живой, pannable, zoomable, **пять режимов отображения**
- Side-панель рендерит markdown-тело + переходы по связям
- Один `npx` — без установок, сервер поднимается за секунды

</td>
</tr>
</table>

## Установка

```bash
# Разово (рекомендуется)
npx @forgeplan/web init -y
npx @forgeplan/web start
```

```bash
# Или глобально на PATH
npm install -g @forgeplan/web
forgeplan-web init -y
forgeplan-web start
```

Требует Node `^20.19.0 || >=22.12.0`, бинарник `forgeplan` на PATH и
наличие `.forgeplan/` в текущей директории. Полная справка —
[`docs/USAGE.md`](docs/USAGE.md).

### Образы (images): `stable` (по умолчанию) и `nightly`

```bash
npx @forgeplan/web init -y                   # stable (по умолчанию)
npx @forgeplan/web init -y --image nightly   # pre-release ветка
```

Каждый релиз шипит два именованных **образа** (image) скаффолда. Байты
у обоих одинаковые — self-contained ~1.4 MB single-file bundle (без
`node_modules/`, никакого `npm install` на стороне пользователя);
разница в наборе фичефлагов, которые несёт каждый образ. v1 шипит оба
образа с **нулём** флагов — фреймворк готов к опт-ин фичам без того
чтобы пользователи `stable` за них платили.

- **`stable`** — дефолт для `init` / `update`. Шипит только флаги, чей
  rollout достиг stable.
- **`nightly`** — early-access ветка. Шипит все флаги, включая
  alpha/beta. Используй когда хочешь pre-release поведение и не против
  изменений между minor-версиями.

Сменить ветку: `npx @forgeplan/web update --image <name>`. Выбор
запоминается в `forgeplan-web.json` для будущих обновлений.

`--experimental` — устаревший alias для `--image nightly` (живёт ещё
один minor-релиз; удаляется в 0.3.0).

Maintainer-вью на образы и флаги: [`config/IMAGES.md`](config/IMAGES.md).

## Демо за 60 секунд

```console
$ cd ~/projects/my-app/                     # первый запуск, директория с .forgeplan/

$ npx @forgeplan/web init -y
  → creating /Users/me/projects/my-app/.forgeplan-web
  → created .gitignore (added .forgeplan-web/)

  ✓ ready (no install needed)
    npx @forgeplan/web start
    # or: node .forgeplan-web/index.js

$ npx @forgeplan/web start
  → starting forgeplan-web on http://127.0.0.1:5174
    workspace: /Users/me/projects/my-app
  Listening on http://127.0.0.1:5174
```

> Повторные запуски показывают `→ updating ...` и `→ appended
.forgeplan-web/ to .gitignore` (идемпотентно — строка добавляется один
> раз и сохраняется).

Открой URL — воркспейс отрендерится как force-directed граф. Фильтруй по
kind, status, диапазону `R_eff`; кликни узел — увидишь markdown-тело и
переходы по связям. Браузер опрашивает каждые 10 секунд, поэтому
изменения на диске появляются за пару секунд (после `forgeplan reindex`).

## Что получаешь

|                                     |                                                                                                                  |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **📦 Без установок у пользователя** | Пакет содержит один self-contained ~1.4 MB single-file bundle на каждый объявленный образ (`dist/` для `stable`, `dist-nightly/` для `nightly`). `init` — это `cp -r`. У пользователя ничего не ставится. |
| **🪟 По-настоящему cross-platform** | Smoke-матрица `ubuntu-latest` / `macos-latest` / `windows-latest` × Node 22, зелёная на каждом push с v0.1.3.    |
| **🔒 Read-only by design**          | `/api/*` дёргает только read-only подкоманды `forgeplan` (правило 22). Вьювер **не может** изменить воркспейс.   |
| **🌐 Пять видов графа**             | Force, Lanes, Matrix, Radial, Tree. Каждый отвечает на свой вопрос — поток, смежность, иерархия, parent/child.   |
| **⚡ Живой polling**                | UI обновляется каждые 10 секунд. Без ручного reload, без websocket-обвязки.                                      |
| **🤖 Agent-aware**                  | Hooks + CLAUDE.md + гайды лежат в репо для безопасной работы AI-агентов.                                         |
| **🏷️ Forgeplan-native**             | Говорит на языке методологии — PRD, RFC, ADR, Evidence, `R_eff` scoring, типизированные связи — из коробки.      |

## Что показывает

| Поверхность                                                 | Источник                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| Force-directed карта артефактов                             | `forgeplan list --json`                                      |
| Типизированные связи-стрелки                                | `forgeplan graph --json`                                     |
| Side-панель с markdown-телом                                | `forgeplan get <id> --json`                                  |
| Health-полоса вживую                                        | `forgeplan health --json`                                    |
| Insights-табы (Recent / Agents / Blocked / Drafts / Health) | `forgeplan log --json`, `claims --json`, `blocked --json`, … |
| Фильтры (kind, status, диапазон `R_eff`)                    | client-side, сохраняются в `localStorage`                    |

Полный каталог фич — [`docs/USAGE.md`](docs/USAGE.md).

## Документация

Три точки входа — выбирай ту, что соответствует твоей задаче сейчас.

| Я хочу…                    | Начать отсюда                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------- |
| **Использовать пакет**     | [`docs/USAGE.md`](docs/USAGE.md) — install, CLI, env, endpoints                     |
| **Контрибьютить**          | [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — layout, dev-loop, CI, release flow |
| **Работать с AI-агентами** | [`CLAUDE.md`](CLAUDE.md) · [`guides/INDEX.md`](guides/INDEX.md)                     |

## Dogfood

<table>
<tr>
<td align="center"><b>~1.4 МБ</b><br>на образ (esbuild-бандл)</td>
<td align="center"><b>~870 КБ</b><br>tarball (~3 МБ распакованный)</td>
<td align="center"><b>3 OS × Node 22</b><br>зелёная smoke-матрица</td>
<td align="center"><b>1 dep</b><br>в <code>bin/</code> (<code>citty</code>, 0 транзитивных)</td>
</tr>
</table>

Этот репозиторий использует свою же методологию — каждый PRD, RFC, ADR и
EvidencePack лежит в [`.forgeplan/`](./.forgeplan/) (на HEAD — 100+
артефактов, листать можно в этом же UI, который пакет шипит). Локально
валидируется и скорится; ничего не уходит в `main` без `R_eff > 0`,
активного артефакта и зелёной smoke-матрицы.

## Contributing

```bash
# Ветвимся от develop (main трогаем только через release/* и hotfix/*)
git checkout develop && git pull
git checkout -b feature/my-thing

# Цикл: route → shape → build → smoke → evidence → activate → PR
# CI должен быть зелёным на ubuntu/macos/windows × Node 22 до merge
gh pr create --base develop
```

Branch protection защищает правила на сервере — прямой push в `main` или
`develop`, force-push в любую из них, и rewrite тегов `v*.*.*` отвергаются
с `GH006` / `GH013`. Полный гайд — [`CLAUDE.md`](CLAUDE.md).

### Локальные dev-режимы

```bash
npm run dev              # HMR против собственного .forgeplan/ репо (100+ артефактов)
npm run dev:playground   # HMR против playground/.forgeplan/ (~123 засеянных Helios-артефакта)
```

`playground/` — вымышленный, repo-internal Forgeplan-воркспейс (PRD, RFC,
ADR, Spec, Epic, EvidencePack для несуществующей observability-платформы
«Helios»), нужный чтобы прогонять вьювер на реалистичном объёме данных —
фильтры, пять режимов отображения, плотность связей, производительность.
В пакет не публикуется и в проекты пользователей не копируется.

## Лицензия

MIT — см. [LICENSE](LICENSE).

<br>

<div align="center">

### Read-only. Cross-platform. Без установок.

**[→ Установить сейчас](#установка)** и `npx @forgeplan/web start`.

<br>

<sub>Спутник <a href="https://github.com/ForgePlan/forgeplan">@ForgePlan/forgeplan</a> · <a href="README.md">English version</a></sub>

</div>
