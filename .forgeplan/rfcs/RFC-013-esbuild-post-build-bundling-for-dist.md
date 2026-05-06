---
depth: standard
id: RFC-013
kind: rfc
status: active
title: esbuild post-build bundling for dist/
---

---
id: RFC-013
title: "esbuild post-build bundling for dist/ behind --experimental flag"
status: Draft
author: nikitafedorovvvvv@gmail.com
created: 2026-05-06
updated: 2026-05-06
priority: P2
depth: standard
domain: general
projectType: cli_tool
informs: PRD-014
amends: ADR-001
---

# RFC-013: esbuild post-build bundling for dist/ behind --experimental flag

## Summary

После `vite build` + `adapter-node` запускать esbuild как пост-процесс, который инлайнит весь runtime-граф `template/build/index.js` в один файл. **Новый bundle-шейп публикуется параллельно со старым** (`dist/` legacy + `dist-experimental/` bundled) и активируется только флагом `npx @forgeplan/web init --experimental`. После периода обкатки (≥2 минорные версии без regression-issues) — флип дефолта и удаление legacy.

## Motivation

См. PRD-014. Цели те же. Феатура-флаг (`--experimental`) — для безопасного rollout: ранние пользователи опт-инят, мы ловим эджкейсы (динамические imports, CJS-only пакеты, новые SvelteKit chunks), default-flow остаётся стабильным.

## Goals / Non-Goals

### Goals

- G1: `dist-experimental/` после `npm run build` не содержит `node_modules/`, ≤3M.
- G2: `dist/` (legacy) продолжает существовать без изменений (`npm install --omit=dev` шаг сохраняется).
- G3: `bin/forgeplan-web.mjs init --experimental` копирует `dist-experimental/` вместо `dist/`.
- G4: Все `/api/*` endpoint'ы работают на обоих шейпах с тем же envelope.
- G5: tarball вмещает оба артефакта (≤16M total) — npm publish не падает.
- G6: Documentation (CLAUDE.md, rules 21/23, README) описывает оба шейпа и флаг.

### Non-Goals

- NG1: Минификация бандла.
- NG2: Дроп legacy `dist/` в этой итерации (отдельный PR после обкатки).
- NG3: Reduce client-side bundle.
- NG4: Поддержка `--experimental` флага в `start` (start читает `.forgeplan-web/index.js` независимо от того, как туда попал файл).

## Options Considered

### Option A: prune-only

Rejected: см. предыдущий вариант RFC; экономит ≤2.7M из 12M.

### Option B: esbuild bundle, default ON

Rejected по запросу пользователя: слишком рискованно перевести 100% юзеров без обкатки.

### Option C: esbuild bundle, behind --experimental flag (chosen)

Два артефакта в tarball, флаг переключает источник. Pros: безопасный rollout, A/B можно сравнить. Cons: tarball растёт (~14M → ~15.5M временно). Ok — это временно, флип через 1-2 минор'а.

### Option D: ship single bundled dist + `--legacy` to fall back

Rejected: меняет дефолт сразу (риск); пользователи без интернета на момент бага оказываются заблокированы; обратная совместимость хуже, чем флаг.

## Architecture

```
                ┌──────────────────────────────────────────────────┐
                │           scripts/build.mjs (dev / CI)           │
                ├──────────────────────────────────────────────────┤
                │  1. vite build         → template/build/         │
                │  2. emit pkg.json      → template/build/         │
                │  3. npm install        → template/build/n_m/     │
                │  4. copyToDist()       → dist/  (legacy, 14M)    │
                │  5. bundleExperimentalDist()                     │
                │     ├─ esbuild --bundle --packages=bundle        │
                │     ├─ patchHostDefault                          │
                │     └─ shape-asserts (no n_m, no server, ≤3M)    │
                │                        → dist-experimental/      │
                │                          (1.5M, single file)     │
                └──────────────────────────────────────────────────┘
                         │                          │
                         ▼                          ▼
                ┌─────────────────────┐    ┌─────────────────────┐
                │  npm tarball ships  │    │  npm tarball ships  │
                │  dist/   (legacy)   │    │ dist-experimental/  │
                └─────────────────────┘    └─────────────────────┘
                         │                          │
                         ▼                          ▼
       npx @forgeplan/web init          npx @forgeplan/web init --experimental
                         │                          │
                         ▼                          ▼
                ┌─────────────────────┐    ┌─────────────────────┐
                │  cp -r dist/        │    │  cp -r              │
                │     → .fp-web/      │    │  dist-experimental/ │
                │  (1696 files)       │    │     → .fp-web/      │
                │                     │    │  (62 files)         │
                └─────────────────────┘    └─────────────────────┘
                         │                          │
                         └──────────┬───────────────┘
                                    ▼
                            npx @forgeplan/web start
                                    │
                                    ▼
                          spawn(node, .fp-web/index.js)
                                    │
                                    ▼
                            sirv (client/) + SvelteKit /api/*
```

Both shapes expose the same handler (`@sveltejs/adapter-node` produces the
same Polka-shaped server). The only runtime difference: legacy resolves
imports via `dist/node_modules/`; experimental has them inlined into a
single file. `bin/forgeplan-web.mjs` doesn't know which shape it copied
beyond the `experimental` field in `forgeplan-web.json` (used by `update`).

## Proposed Direction

Use Option C (esbuild bundle behind `--experimental`):

1. **Keep the legacy pipeline byte-identical.** Existing users see no
   change until they pass `--experimental`. This is the safety net.
2. **Add `bundleExperimentalDist()` as a non-destructive post-step** that
   reads from `template/build/` (the same input the legacy pipeline
   already produced) and writes to a parallel `dist-experimental/`.
3. **Cap the bundle size at 3M** with a hard assertion in
   `scripts/build.mjs`. If a future svelte/kit upgrade silently bloats
   the bundle, the build fails loudly instead of growing the tarball.
4. **Wire `--experimental` flag into `bin/forgeplan-web.mjs`** to switch
   `SOURCE_DIST` between `dist/` and `dist-experimental/`. Persist the
   choice in `forgeplan-web.json` so `update` can refresh into the same
   shape (or override with `--no-experimental`).
5. **TODO markers** in `bin/` and `scripts/` flag the graduation path:
   after ≥2 minor versions without regressions, drop legacy `dist/`,
   rename `dist-experimental/` → `dist/`, remove the flag.

## Implementation Phases

### Phase 1: Build pipeline (scripts/build.mjs)

1. **Добавить `esbuild` в root `devDependencies`** (`^0.24.0`).
2. **Сохранить старый pipeline в нетронутом виде** до `copyToDist()`. Он продолжает писать в `dist/`.
3. **Добавить новую функцию `bundleExperimentalDist()`**, которая:
   - Запускается ПОСЛЕ `copyToDist()` (т.е. legacy `dist/` уже готов).
   - Создаёт чистую папку `dist-experimental/`.
   - Копирует `client/`, `env.js`, `forgeplan-web-build.json` из `dist/` в `dist-experimental/`.
   - Запускает esbuild bundle на `template/build/index.js` (или на `dist/index.js` — оба эквивалентны), пишет результат в `dist-experimental/index.js`.
   - Конфигурация:
     ```js
     {
       entryPoints: [join(TEMPLATE_BUILD, 'index.js')],
       outfile: join(DIST_EXPERIMENTAL, 'index.js'),
       bundle: true,
       platform: 'node',
       format: 'esm',
       target: 'node20',
       packages: 'bundle',
       banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
       logLevel: 'warning',
       legalComments: 'none',
       treeShaking: true,
     }
     ```
   - При warnings/errors — exit 1.
   - Patch HOST default 0.0.0.0 → 127.0.0.1 (тот же `patchHostDefault()`, переиспользовать).
   - Эмитит `dist-experimental/package.json`: `{name, version, private:true, type:"module", engines, scripts:{start:"node index.js"}}` (БЕЗ `dependencies`).
   - Эмитит `dist-experimental/forgeplan-web-build.json` с `experimental: true` маркером.
4. **Размерные ассерты** в конце `bundleExperimentalDist()`:
   - `! existsSync(join(DIST_EXPERIMENTAL, 'node_modules'))` → fail.
   - `du -sh dist-experimental` ≤3M (или ассерт через `statSync`).
   - `! existsSync(join(DIST_EXPERIMENTAL, 'server'))` (всё инлайнено) → fail.

### Phase 2: bin/forgeplan-web.mjs

1. Добавить флаг `--experimental` в parser `parseArgs()` (Set-based).
2. В `init()`:
   - Если `--experimental` → `SOURCE_DIST = join(PACKAGE_ROOT, 'dist-experimental')`.
   - Иначе → `SOURCE_DIST = join(PACKAGE_ROOT, 'dist')` (как сейчас).
   - В `forgeplan-web.json` записать `{ ..., experimental: true|false }` для трассируемости.
3. В `init()` напечатать pre-init notice если `--experimental`:
   ```
   ⚠ Using experimental bundled dist (single-file server, no node_modules/).
     Report issues at https://github.com/ForgePlan/forgeplan-web/issues
   ```
4. `start()` — без изменений (не знает про experimental).
5. Help text (`-h`/`--help`) — добавить `--experimental` в список флагов.

### Phase 3: package.json (root)

```diff
  "files": [
    "bin",
    "dist",
+   "dist-experimental",
    "README.md",
    ...
  ],
  "devDependencies": {
+   "esbuild": "^0.24.0"
  }
```

### Phase 4: Документация

- `CLAUDE.md`:
  - В «Architecture in one paragraph» добавить параграф про `dist-experimental/` как опциональный источник.
  - В «Repo layout» добавить `dist-experimental/`.
- `.claude/rules/21-template-purity.md` — отдельный раздел: «`dist-experimental/` shape».
- `.claude/rules/23-bin-zero-deps.md` — отдельный раздел про `dist-experimental/` (компонент пути зеро-deps не нарушает; `bin/` остаётся zero-dep).
- `README.md` — секция «Experimental: lightweight bundled dist» с примером `npx @forgeplan/web init --experimental` + упоминание ожидаемого размера.
- `CHANGELOG.md` — entry «feat(init): add `--experimental` flag for bundled dist (≈9× smaller)».

### Phase 5: Smoke + verify

```bash
# A) legacy path (no flag)
SCRATCH_A=$(mktemp -d)
mkdir -p "$SCRATCH_A/.forgeplan"
cd "$SCRATCH_A" && node /repo/bin/forgeplan-web.mjs init -y --force
test -d .forgeplan-web/node_modules || exit 1   # legacy: node_modules MUST exist
cat .forgeplan-web/forgeplan-web.json | grep -q '"experimental":false' || exit 1

# B) experimental path
SCRATCH_B=$(mktemp -d)
mkdir -p "$SCRATCH_B/.forgeplan"
cd "$SCRATCH_B" && node /repo/bin/forgeplan-web.mjs init -y --force --experimental
test ! -d .forgeplan-web/node_modules || exit 1  # experimental: NO node_modules
test $(du -sk .forgeplan-web | cut -f1) -le 3072 || exit 1
cat .forgeplan-web/forgeplan-web.json | grep -q '"experimental":true' || exit 1

# C) both shapes serve identical envelopes
for dir in "$SCRATCH_A" "$SCRATCH_B"; do
  cd "$dir"
  PORT=15999 HOST=127.0.0.1 node /repo/bin/forgeplan-web.mjs start &
  PID=$!
  sleep 2
  curl -fsS http://127.0.0.1:15999/api/version | grep -q '"ok":true' || { kill $PID; exit 1; }
  curl -fsS http://127.0.0.1:15999/ | grep -q '<!doctype html>' || { kill $PID; exit 1; }
  kill $PID
done
```

## API / Contract changes

### `bin/forgeplan-web.mjs init` (NEW flag)

```
Usage: npx @forgeplan/web init [options]

Options:
  -y, --yes            Auto-confirm (no prompts)
  --force              Overwrite existing .forgeplan-web/
  --no-gitignore       Skip .gitignore append
  --experimental       Use bundled dist (single-file server, no node_modules/) [EXPERIMENTAL]
  -h, --help           Print this help
```

### `dist-experimental/` shape (NEW)

| File | Content |
|------|---------|
| `dist-experimental/index.js` | self-contained ESM bundle (~750K) |
| `dist-experimental/env.js` | dynamic env loader (~2K, не бандлится) |
| `dist-experimental/client/` | static assets (без изменений vs legacy) |
| `dist-experimental/package.json` | без `dependencies` |
| `dist-experimental/forgeplan-web-build.json` | `{name, builtAt, entry, experimental: true}` |

### `dist/` shape (UNCHANGED)

Существующий шейп с `node_modules/` остаётся ровно как сейчас. Никаких изменений.

### `bin/forgeplan-web.mjs` (zero-deps инвариант сохраняется)

Только parser-флаг + переключение SOURCE_DIST. Никаких third-party imports.

### `package.json` (root)

`files` теперь содержит и `dist-experimental/`. tarball подрос до ~15.5M (временно).

## Invariants

Что НЕ должно нарушаться при реализации:

- I-1: `bin/` zero-deps инвариант (rule 23) — `bin/forgeplan-web.mjs` не получает третьесторонних imports.
- I-2: `init` host-isolation (rule 20) — `init --experimental` пишет ТОЛЬКО в `.forgeplan-web/` + 1 строку в `.gitignore`.
- I-3: read-only proxy (rule 22) — никаких новых spawn-targets в `template/src/routes/api/`.
- I-4: legacy `dist/` shape БЕЗ изменений в этой итерации (`init` без флага должен работать байт-в-байт как раньше).
- I-5: Контракт `/api/*` envelope (`{ok, data?, error?, cmd, raw?}`) идентичен на обоих шейпах.
- I-6: `dist-experimental/index.js` запускается под Node ≥20.19/22.12 (engines pin).
- I-7: Никаких lifecycle scripts транзитивных зависимостей при сборке (CWE-1357 мitigation): esbuild bundle не запускает postinstall.

## Rollback Plan

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-1 | esbuild не инлайнит динамический `env.js` | High | Medium | Явно копировать `env.js` в build pipeline |
| R-2 | esbuild ломается на новом svelte/kit upgrade | Low | Medium | Pin esbuild на minor; smoke в CI matrix |
| R-3 | tarball ≥16M (npm warning threshold) | Medium | Low | Мониторим; если близко — отделить артефакты по dist tags |
| R-4 | Пользователь put `--experimental` в production и сталкивается с regression | Medium | Medium | Notice в init output + README выделено как EXPERIMENTAL |
| R-5 | rules 21/23 содержат описания только legacy `dist/` | High | Low | Обновить тексты правил вместе с PR |
| R-6 | Удаление флага после флипа дефолта поломает users with `--experimental` в скриптах | Medium | Low | После флипа: флаг становится no-op (warning), удалить через ещё одну минорку |

**Rollback план**:
1. Если bundle ломается на конкретном пакете: добавить пакет в `external: [...]` esbuild config.
2. Если глобально проблема: `git revert` PR-коммитов, `dist-experimental/` исчезает из tarball, флаг становится no-op (или error). Пользователи с `--experimental` получают «not available in this version» сообщение.

## Acceptance criteria

- AC-1: `npm run build` успешно создаёт И `dist/`, И `dist-experimental/`.
- AC-2: `init` без флага копирует legacy → `.forgeplan-web/node_modules/` существует.
- AC-3: `init --experimental` копирует bundled → `.forgeplan-web/node_modules/` отсутствует, размер ≤3M.
- AC-4: оба шейпа отвечают `200` на `GET /` и `/api/version`.
- AC-5: `forgeplan-web.json` содержит поле `experimental: bool`.
- AC-6: `--help` упоминает `--experimental` с пометкой `[EXPERIMENTAL]`.
- AC-7: README секция описывает флаг + ожидаемый размер.
- AC-8: rules 21, 23 обновлены и валидны.

## Open questions

- OQ-1: Нужен ли `--no-experimental` для будущей супрессии после флипа дефолта? **Решение**: пока нет. Когда дефолт перевернётся, добавим `--legacy` симметрично.
- OQ-2: Версия esbuild — pin на minor (`^0.24.x`) или range? **Решение**: caret-pin на minor.
- OQ-3: Стоит ли логировать experimental usage статистикой? **Решение**: нет (privacy / нет телеметрии в проекте).

---

> **Next step**: реализовать Phase 1–4, прогнать AC-1..AC-8, собрать EvidencePack с CL3 measurement.

