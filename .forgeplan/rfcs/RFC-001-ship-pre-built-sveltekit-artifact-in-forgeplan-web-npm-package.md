---
created: 2026-05-04
depth: standard
id: RFC-001
kind: rfc
status: active
title: ship pre-built sveltekit artifact in @forgeplan/web npm package
updated: 2026-05-04
---

# RFC-001: ship pre-built sveltekit artifact in @forgeplan/web npm package

## Summary

Сменить публикуемую модель `forgeplan-web` с «копировать `template/` исходники + запустить
`npm install` у пользователя» на «положить в tarball уже собранный SvelteKit
(adapter-node) с node_modules внутри, скопировать как есть в
`.forgeplan-web/`, стартовать сервер через `npx @forgeplan/web start`».
Переименовать пакет в scoped `@forgeplan/web`.

## Motivation

Текущая схема просит пользователя ждать `npm install` (≈10–60s, ≈ десятки MB)
сразу после `npx forgeplan-web init`, и любая сетевая/registry-ошибка ломает
старт. Цель — ноль установок на стороне пользователя: `npx @forgeplan/web init -y`
кладёт готовое к запуску приложение, `npx @forgeplan/web start` поднимает сервер.

Если не делать: сохраняется сложный двухступенчатый flow, который противоречит
маркетинговому обещанию «one command to run».

## Goals

- Один nstall-free шаг: `npx @forgeplan/web init -y` создаёт `.forgeplan-web/`
  с готовым к запуску бандлом (включая `node_modules/`).
- `npx @forgeplan/web start` (или `node .forgeplan-web/index.js`) запускает
  Node-сервер на детерминированном порту (5174 по умолчанию, override через `PORT`).
- Scoped имя `@forgeplan/web` опубликовано как public package.
- Bin script остаётся zero-dep (правило 23 не нарушено — он только копирует
  файлы и спавнит подпроцесс).
- `template/` остаётся в репо как источник правды для разработки; в npm
  tarball публикуется только результат сборки `dist/`.

## Non-Goals

- Уход от SvelteKit / смена UI-стека.
- Поддержка `adapter-static` (мы СНАЧАЛА всё ещё shell-out к `forgeplan` CLI —
  нужен Node-сервер).
- Поддержка платформ без Node (Deno/Bun) на этой итерации.

## Options Considered

### Option A: ship `template/` sources + run `npm install` at user (status quo)

**Pros**: маленький tarball; install ставит ровно нужные версии под платформу
пользователя.

**Cons**: главный pain — `npm install` каждый раз; сетевые сбои; плохой UX
для «look at this graph» сценария.

### Option B: adapter-node build + node_modules внутри `dist/`, ship dist/ as-is

**Описание**: на стадии `prepublishOnly` запускаем `vite build` в `template/`,
получаем `template/build/` (adapter-node). adapter-node генерирует
`build/package.json` с runtime-зависимостями. Запускаем
`npm install --omit=dev` внутри `build/`, получаем замкнутый `node_modules/`.
Копируем `template/build/` → `dist/`. В npm `files: [bin, dist, README.md]`.
В юзере `init` делает `cp -r dist/ .forgeplan-web/` без install.

**Pros**: ноль install на стороне пользователя; cold-start = время `cp -r`;
bin остаётся zero-dep; `template/` не загрязняется.

**Cons**: размер tarball вырастает (~5–15 MB sveltekit-runtime + d3); native-зависимостей
у нас нет (sveltekit pure JS), значит платформенно-нейтрально; необходимо
убедиться, что adapter-node не тянет devDeps в build runtime.

### Option C: bundle SvelteKit server в один файл (esbuild/ncc)

**Описание**: после `vite build` прогнать `@vercel/ncc` или esbuild
`--bundle --platform=node`, получить single-file `index.js` без `node_modules`.

**Pros**: минимальный tarball; нет «node_modules в npm-пакете».

**Cons**: SvelteKit + adapter-node плохо bundlable: dynamic imports маршрутов,
встроенные `import.meta.url` пути, server-side ESM. Хрупкий процесс,
часто ломается на минорных bumps. Высокий риск тонких runtime-багов.

## Trade-off Analysis

| Критерий | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Complexity (build) | низкая | средняя | высокая |
| User cold-start | медленный | быстрый | быстрый |
| Tarball size | малый | средний | малый |
| Migration risk | n/a | низкий | средний-высокий |
| Operational burden | низкий | низкий | средний (bundling fragility) |
| Запрос пользователя удовлетворён | нет | да | да (с риском) |

## Proposed Direction

**Option B**. Самое маленькое и предсказуемое изменение, удовлетворяющее
требованию «без npm install у пользователя». Option C можно рассмотреть позже
как оптимизацию, если tarball станет проблемой.

## Risks & Open Questions

- **R1**: размер tarball. Mitigation: измерить после первой сборки;
  если > 30 MB — рассмотреть Option C.
- **R2**: native-модули в транзитивных зависимостях. У текущих рантайм-зависимостей
  (`@sveltejs/kit` + `d3-*`) нативного кода нет, но при будущих апдейтах
  `npm install --omit=dev` внутри `build/` потенциально может затащить
  native add-on, который скомпилирован под платформу publish-runner.
  Mitigation: явно фиксировать pure-JS deps; добавить smoke-test «package
  installed на linux/macos/windows запускается».
- **R3**: правило 23 «zero-dep bin». Bin сам не тянет npm deps — он копирует
  pre-built dir и спавнит `node`. Правило не нарушено.
- **R4**: `npm publish` scoped пакета первой раз требует `--access public`.
  Mitigation: `publishConfig.access = "public"` в `package.json`.
- **OQ1**: оставлять ли `forgeplan-web` (unscoped) как deprecated alias?
  → Не сейчас; пакет ещё не опубликован.

## Implementation Phases

### Phase 1: build pipeline

- [x] **1.1** `template/svelte.config.js` — adapter-node настроен корректно
  (out: `build/`, дефолт ок).
- [x] **1.2** `scripts/build.mjs` (или `prepublishOnly` в root `package.json`):
  install template deps → `npm run build` в template → `npm install --omit=dev`
  внутри `template/build/` → `cp -r template/build dist/`.
- [x] **1.3** Очистка: `dist/` в `.gitignore`; `template/build/` уже там.

### Phase 2: package metadata

- [x] **2.1** `package.json`: `name = "@forgeplan/web"`,
  `publishConfig: { "access": "public" }`, `files: ["bin", "dist", "README.md"]`,
  `prepublishOnly`/`prepack`/`build` скрипты.
- [x] **2.2** Сохранить bin name `forgeplan-web` (короткое имя в CLI после
  `npm i -g` или через `npx`).

### Phase 3: bin rewrite

- [x] **3.1** `bin/forgeplan-web.mjs`: source = `dist/` вместо `template/`,
  убрать `npm install` шаг, принять флаг `-y` (silent ok).
- [x] **3.2** Подкоманда `start` — спавнит `node .forgeplan-web/index.js`,
  пробрасывает `PORT` (default 5174), `HOST` (default 127.0.0.1),
  `FORGEPLAN_CWD`, `FORGEPLAN_BIN`.
- [x] **3.3** Подкоманда `help` обновлена.

### Phase 4: docs & rules

- [x] **4.1** README: новый quick-start (`npx @forgeplan/web init -y` →
  `npx @forgeplan/web start`).
- [x] **4.2** CLAUDE.md: обновить repo layout и описание архитектуры.
- [x] **4.3** Правило 21 — `template/build/` всё ещё запрещён внутри
  `template/` published, но допустим как stage до копии в `dist/`.
- [x] **4.4** Правило 23 — bin остаётся zero-dep; `dist/` (с
  `node_modules/`) — отдельный артефакт, рулом не охватывается.

### Phase 5: prove

- [x] **5.1** Сборка локально, `node bin/forgeplan-web.mjs init -y` в
  `/tmp/scratch` с пустым `.forgeplan/`.
- [x] **5.2** `node bin/forgeplan-web.mjs start` → curl `localhost:5174/api/health`.
- [x] **5.3** EvidencePack со Structured Fields.

## Affected Files

- `package.json` (root)
- `bin/forgeplan-web.mjs`
- `scripts/build.mjs` (новый)
- `.gitignore`
- `README.md`
- `CLAUDE.md`
- `.claude/rules/21-template-purity.md`, `.claude/rules/23-bin-zero-deps.md`

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| EVID-001 | Evidence | informs (smoke test после реализации) |

