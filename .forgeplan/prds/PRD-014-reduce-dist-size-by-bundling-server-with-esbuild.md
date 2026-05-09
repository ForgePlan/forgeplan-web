---
depth: standard
id: PRD-014
kind: prd
status: active
title: Reduce dist/ size by bundling server with esbuild
---

---
id: PRD-014
title: "Reduce dist/ size by bundling server with esbuild"
status: Draft
author: nikitafedorovvvvv@gmail.com
created: 2026-05-06
updated: 2026-05-06
priority: P2
depth: standard
domain: general
projectType: cli_tool
stepsCompleted: []
---

# PRD-014: Reduce dist/ size by bundling server with esbuild

## Executive Summary

### Vision

Сократить вес опубликованного npm-пакета `@forgeplan/web` так, чтобы `npx @forgeplan/web init` копировал в `.forgeplan-web/` единичный файл сервера + статику, а не дерево из 48 npm-пакетов.

### Problem

Сейчас `dist/` весит **14M**, из которых **12M (≈86%)** — `dist/node_modules/`, накаченный `npm install --omit=dev` после `vite build`. Из 48 пакетов в `dist/node_modules/` ≈2.7M занимают компилятор-онли зависимости svelte (`acorn`, `aria-query`, `axobject-query`, `magic-string`, `esrap`, `zimmerframe`, `is-reference`, `locate-character`, `@jridgewell/*`), которые в runtime не нужны: `vite build` уже отработал, `.svelte`-файлы скомпилированы.

**Impact**:

- Пользователь скачивает «лишних» ~10M+ при каждом `npx @forgeplan/web init`.
- Каждый `init` копирует ~12K файлов в `.forgeplan-web/node_modules/` вместо ~5–10 (single bundle + статика).
- npm tarball на сервере хранит/раздаёт лишний вес каждой версии.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Forgeplan-юзер с slow link | Запускает `npx @forgeplan/web init` в чужой/CI среде | Долгая загрузка tarball, потом долгий `cp -r` 12K файлов |
| Maintainer пакета | Публикует релизы | Tarball-size badges и `npm publish` стоимость |

### Differentiators

- Решение не требует менять SvelteKit / adapter-node / vite config — это пост-процесс на artefact-этапе.
- Reversible: при необходимости можно вернуть `npm install --omit=dev` пайплайн без изменений в host-API.
- Не затрагивает `bin/` zero-deps инвариант (rule 23) — esbuild тут build-time tool.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | `dist/` ужимается ≥5× | `du -sh dist/` | 14M | ≤3M | до merge в main | `du -sh dist/` после `npm run build` |
| SC-2 | `dist/node_modules/` отсутствует | существование пути | exists (12M) | пути нет | до merge в main | `! test -d dist/node_modules` |
| SC-3 | Smoke `init` + `start` + 3 endpoint'а проходят | exit-codes + HTTP | новый функционал | 3/3 200 | до merge в main | `node scripts/smoke.mjs` или ручной curl |
| SC-4 | Holistic функциональный паритет | все `/api/*` отвечают как раньше | 100% | 100% | до merge в main | сравнение envelope shape вручную/тестами |

---

## Product Scope

### MVP (In-Scope)

- Замена `installRuntimeDeps()` в `scripts/build.mjs` на `bundleServer()` шаг через esbuild.
- Бандл `template/build/index.js` → `dist/index.bundled.mjs` (или сохранить имя `index.js` для обратной совместимости в bin script).
- Сохранение `client/`, `env.js`, `forgeplan-web-build.json`, `package.json` в `dist/` без изменений.
- Удаление шага `npm install --omit=dev` из build pipeline.
- Обновление `.claude/rules/21-template-purity.md`, `23-bin-zero-deps.md`, CLAUDE.md и README раздел про `dist/` shape.

### Out of Scope

- Минификация бандла (читабельность stack traces важнее).
- Замена adapter-node на custom adapter.
- Уменьшение `client/` (статика — отдельная задача).
- Дроп `env.js` (динамический import от SvelteKit, не бандлится).

### Growth Vision

- Опционально: `--sourcemap=external` + публикация `.map` рядом с бандлом для лучших stack traces (если кейсы появятся).
- Опционально: tree-shake d3-* подмодулей внутри бандла (д3 берётся только частично).

---

## User Journeys

### Journey 1: Forgeplan-юзер запускает `npx @forgeplan/web init` в чистом проекте

**Цель пользователя**: получить рабочий веб-просмотрщик `.forgeplan/` workspace'а.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | `npx @forgeplan/web init` | Копирует `dist/` → `.forgeplan-web/` за <1s | tarball ≤3M, copy ≤200 файлов |
| 2 | `npx @forgeplan/web start` | `node .forgeplan-web/index.js` биндится на 127.0.0.1:5174 | Bundle загружается ~50–100ms |
| 3 | Открывает `http://127.0.0.1:5174` | UI с force-graph, `/api/*` отвечают | Все endpoints как раньше |

**Результат**: рабочий веб-просмотрщик, без видимой пользователю разницы кроме скорости `init`.

### Journey 2: Maintainer публикует релиз

**Цель пользователя**: выкатить новую версию `@forgeplan/web`.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Тег + GitHub Release на `main` | `release.yml` запускает `npm publish` | `prepublishOnly` гонит `node scripts/build.mjs` |
| 2 | `npm publish --provenance` | tarball ≤3M | сейчас ~14M |
| 3 | npm registry показывает `unpacked size` | ~3M | сейчас ~14M |

**Результат**: меньше нагрузки на registry CDN и пользовательский download.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Build pipeline can produce a `dist/` без `node_modules/`, weighing ≤3M total | Journey 2 |
| FR-002 | Core | Must | `npx @forgeplan/web init -y` can copy the new shape into `.forgeplan-web/` без потери функциональности | Journey 1 |
| FR-003 | Core | Must | `npx @forgeplan/web start` can launch and serve on the configured PORT/HOST | Journey 1 |
| FR-004 | Core | Must | Все read-only endpoints `/api/*` (`list`, `health`, `graph`, `version`, `update-check`, `tree`, `score`, `journal`, `blindspots`, `claims`, `stale`, `log`, `order`, `blocked`, `get`) can respond с тем же envelope shape, что и до изменения | Journey 1 |
| FR-005 | Build | Must | Build pipeline can ensure `dist/env.js` сохранён рядом с бандлом (динамический import SvelteKit) | Journey 1 |
| FR-006 | Build | Should | Build pipeline can fail loudly if esbuild produces warnings/errors | Journey 2 |
| FR-007 | Docs | Must | Project docs (CLAUDE.md, rules 21/23, README) describe new `dist/` shape (single bundle, no `node_modules/`) | Journey 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Build pipeline shall complete | ≤30s on dev laptop | Cold cache (`vite build` + esbuild bundle) | `time npm run build` |
| NFR-002 | Size | `dist/` total shall be | ≤3M | After successful build | `du -sh dist/` |
| NFR-003 | Compatibility | Bundled server shall start under | Node ≥20.19 / 22.12 | Per `package.json#engines` | `node dist/index.js` exit + HTTP 200 |
| NFR-004 | Security | Build pipeline shall preserve | `--ignore-scripts` invariant | Transitive deps must not run lifecycle scripts (CWE-1357) | Audit `scripts/build.mjs` |
| NFR-005 | Reproducibility | Build shall be deterministic | Same SHA256 of `index.bundled.mjs` | Same lockfile + same Node version | `shasum dist/index.js` between runs |

---

## Acceptance Criteria

### AC-1: Single-file server bundle starts and responds

```gherkin
Given чистая директория /tmp/scratch с пустой `.forgeplan/`
And  npm run build только что завершился успешно
When `node /path/to/forgeplan-web/bin/forgeplan-web.mjs init -y --force` в /tmp/scratch
And  затем `node /path/to/forgeplan-web/bin/forgeplan-web.mjs start &`
And  curl http://127.0.0.1:5174/api/version
Then HTTP 200
And  body содержит `{"ok":true,"data":{"web":"...","cli":"..."}}`
```

### AC-2: dist/ не содержит node_modules

```gherkin
Given npm run build завершился успешно
When `du -sh dist/` и `test -d dist/node_modules`
Then du-sh показывает ≤3M
And  test -d возвращает exit-code != 0
```

### AC-3: SSR не сломан (графовая страница рендерится)

```gherkin
Given сервер запущен против реального workspace (этого репо)
When  curl http://127.0.0.1:5174/
Then  HTTP 200
And   body содержит `<!doctype html>` и хотя бы один `<script type="module"`
```

### AC-4: env vars пробрасываются

```gherkin
Given сервер запущен с FORGEPLAN_BIN=/custom/path/forgeplan
When сервер шеллит `forgeplan list --json`
Then используется именно /custom/path/forgeplan, а не дефолтный из PATH
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| esbuild ≥0.24 | Build-tool | Available | npm |
| @sveltejs/kit ≥2.59 | Framework | Already in template | local |
| @sveltejs/adapter-node ≥5.5 | Adapter | Already in template | local |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | esbuild не инлайнит динамический import `env.js` | High | Medium | Сохранять `env.js` рядом с бандлом явно в build-скрипте | Build pipeline |
| R-2 | Будущая версия SvelteKit добавит новые dynamic chunks | Low | High | В build-скрипт добавить ассерт «после bundle никаких импортов в `dist/server/chunks/*` нет» | Build pipeline |
| R-3 | esbuild ломает CJS-only пакет (например, `cookie`) | Low | Medium | Проверить smoke-тест после bundle; в крайнем случае использовать `--external` для проблемных пакетов | Build pipeline |
| R-4 | Stack traces после bundle менее читаемы | Medium | Low | Опц. external sourcemap (`--sourcemap=external`) если кейсы появятся | Build pipeline |
| R-5 | esbuild в `prepublishOnly` тянется на CI/CD как новая зависимость | Low | Low | Pin major version в `devDependencies` | Build pipeline |
| R-6 | rules 21, 23 содержат описания старого `dist/` shape | High | Low | Обновить тексты правил вместе с PR | Docs |

---

## Affected Files

- `scripts/build.mjs` — добавить `bundleServer()`, удалить `installRuntimeDeps()`
- `package.json` (root) — добавить `esbuild` в `devDependencies`
- `dist/` — выходной артефакт (генерируется, не commit)
- `.claude/rules/21-template-purity.md` — обновить описание `dist/` shape
- `.claude/rules/23-bin-zero-deps.md` — обновить замечание про `dist/node_modules/`
- `CLAUDE.md` — обновить параграф про architecture in one paragraph + repo layout
- `README.md` — если упоминает размер/шейп, синхронизовать

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| RFC-013 | Implementation plan (esbuild bundle approach) | tbd |
| ADR-001 | Original `dist/` host-isolation decision | active (will get amendment via this PRD's RFC) |

---

> **Next step**: создать RFC-013 с архитектурой бандла + эджкейсами.


