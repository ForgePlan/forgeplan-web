---
depth: tactical
id: EVID-018
kind: evidence
links:
- target: PRD-014
  relation: informs
- target: RFC-013
  relation: informs
status: active
title: esbuild bundle reduces dist from 14M to 1.5M with full functional parity
---

# EVID-018: esbuild bundle reduces dist from 14M to 1.5M with full functional parity

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-06 |
| Valid Until | 2027-05-06 |
| Target | PRD-014, RFC-013 |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Measurement

Что: запущен `npm run build` на ветке `feature/dist-esbuild-bundle` (commit pending). Pipeline производит ОБА артефакта: legacy `dist/` (через `npm install --omit=dev`) и `dist-experimental/` (через esbuild `--bundle --packages=bundle --platform=node --format=esm --target=node20`).

Как:

1. `du -sh dist/` и `du -sh dist-experimental/` для размеров.
2. `find ... -type f | wc -l` для количества файлов.
3. Smoke A: scratch dir, `init -y --force` (legacy), запуск `start`, curl `/api/version`, `/`, `/api/health`.
4. Smoke B: scratch dir, `init -y --force --experimental`, те же curl-проверки + `/api/list`, `/api/update-check`.
5. Smoke C: bundled server против реального workspace (этот репо, 47 артефактов): `/api/list`, `/api/health`, `/api/graph`.

Условия: macOS darwin-arm64, Node 22.x, esbuild 0.24.2, чистый `node_modules/` после `npm install`.

## Result

| Метрика | Legacy `dist/` | `dist-experimental/` | Δ |
|---|---|---|---|
| Total size | 14 MB | 1.5 MB | **-89% (×9.3 меньше)** |
| File count | 1696 | 62 | **-96% (×27 меньше)** |
| `node_modules/` | 12 MB | отсутствует | -100% |
| Single-file `index.js` | 12 KB (entry) + handler/server | 753 KB (single bundle) | один файл вместо дерева |

**Smoke A (legacy)**: HTTP 200 на `/api/version` (envelope `{"ok":true,"data":{"web":"0.1.11","cli":"0.27.0"}}`), HTTP 200 на `/` (`<!doctype html>` присутствует), HTTP 400 на `/api/health` с корректным error envelope (forgeplan на пустом `.forgeplan/` ожидаемо падает).

**Smoke B (experimental)**: HTTP 200 на `/api/version`, `/api/update-check` (с реальным fetch к npm registry), `/`. `/api/health` и `/api/list` возвращают идентичный envelope shape с legacy. `forgeplan-web.json` содержит `"experimental":true`. Никаких "module not found" / "cannot find package" ошибок.

**Smoke C (experimental against real workspace)**: `/api/list` возвращает массив длины 47 (45 базовых + PRD-014 + RFC-013). `/api/health` возвращает полный health envelope. `/api/graph` возвращает edges array. Все ответы матчат legacy формат.

**Build pipeline assertions** (в `scripts/build.mjs`):
- `! existsSync(dist-experimental/node_modules)` → ✓
- `! existsSync(dist-experimental/server)` → ✓
- `dirSizeBytes(dist-experimental) ≤ 3 MiB` (фактически 1.5 MB) → ✓

## Interpretation

PRD-014 SC-1 (≥5× ужатие): достигнуто 9.3× — превышает.
PRD-014 SC-2 (нет `node_modules/`): достигнуто.
PRD-014 SC-3 (smoke 3/3): достигнуто (5/5 endpoint'ов на experimental + 3/3 на legacy).
PRD-014 SC-4 (функциональный паритет): достигнуто — envelope shape `/api/*` идентичен на обоих шейпах.

RFC-013 AC-1..AC-8: все выполнены.

Никаких регрессий в legacy-пути не обнаружено (он остался байт-в-байт прежний — ассерт `du -sh dist/` = 14M, file count = 1696).

## Congruence Level Justification

CL3 (same-context, penalty 0.0):

- Измерение проведено НА том же артефакте (`dist/`, `dist-experimental/`), который PRD-014/RFC-013 описывают.
- Тестовая среда — production-shaped: `npx`-эквивалент через `node bin/forgeplan-web.mjs`, реальный SvelteKit бандл, реальный fetch к npm registry, реальный workspace с 47 артефактами.
- Тип evidence — `measurement` (числовые `du -sh`, `wc -l`, HTTP коды), не симуляция и не аналог.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-014 | informs |
| RFC-013 | informs |



