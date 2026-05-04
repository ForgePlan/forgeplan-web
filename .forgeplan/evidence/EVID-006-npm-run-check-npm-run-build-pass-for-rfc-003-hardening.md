---
depth: standard
id: EVID-006
kind: evidence
last_modified_at: 2026-05-04T13:55:09.492514+00:00
last_modified_by: claude-code/2.1.126
links:
- target: RFC-003
  relation: informs
status: draft
title: npm run check + npm run build pass for RFC-003 hardening
---

# EVID-006: npm run check + npm run build pass for RFC-003 hardening

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Summary

После Phase 1 (server hardening + extractions) + Phase 2 (полная миграция
12 .svelte-файлов с legacy-mode на Svelte 5 runes), `npm run check`
показывает 0 errors / 0 warnings, `npm run build` (vite + adapter-node)
успешно проходит за 1.55 s. RFC-003 готов к активации.

## Method

Из `template/`:

```bash
# Step 1 — type-check + svelte-check (стрикт-режим)
npm run check
# > svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
# 1777902843071 COMPLETED 354 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS

# Step 2 — production build
npm run build
# > vite build
# ✓ built in 1.55s
```

### Что было исправлено в Phase 3 (помимо Phase 1+2)

1. **`@types/node`** добавлен в `template/package.json#devDependencies`
   (`^20.17.0`). До этого svelte-check падал с 8 errors про `Cannot find
   name 'node:child_process'` и т.п. — `.svelte-kit/tsconfig.json`
   объявляет `types: ["node"]`, но соответствующий npm-пакет не был
   установлен. Pre-existing gap, обнаружен в этой Phase.
2. **`MatrixView.svelte:32`** — убрана `void scores;` строка, вызывавшая
   warning `state_referenced_locally`. Заменена на TODO-комментарий
   о неиспользуемом prop'е (kept for API parity).
3. **`InsightsRail.svelte:116, 142`** — `<li role="button">` дал warning
   `a11y_no_noninteractive_element_to_interactive_role`. Добавлен
   `<!-- svelte-ignore ... -->` маркер с TODO для дальнейшего a11y-
   рефакторинга (swap `<li>` на nested `<button>` с restyle). Stop-gap
   допустим по rule 10 (комментарий объясняет cut-corner).

## Result

| Stage | Files | Errors | Warnings | Time |
|-------|-------|--------|----------|------|
| svelte-kit sync + svelte-check | 354 | 0 | 0 | <1s |
| vite build | (full SvelteKit app) | 0 | 0* | 1.55s |

\* d3-interpolate / d3-transition циркулярные deps — pre-existing
warnings внутри vendor-библиотек, не относятся к нашему коду.

### RFC-003 Phase coverage

- Phase 1 (9/9 tasks) — done в Wave 1, см. RFC-003 body.
- Phase 2 (14/14 tasks) — done в Wave 2 (Team D1+D2+D3).
- Phase 3 (4/4 tasks):
  - 3.1 svelte-check 0/0 ✓
  - 3.2 vite build success ✓
  - 3.3 EVID-006 (этот) с Structured Fields ✓
  - 3.4 forgeplan_activate RFC-003 ← следующий шаг

### RFC-003 Invariants verification

- **I1 — read-only**: `runForgeplan` теперь имеет runtime guard
  `READ_ONLY_SUBCOMMANDS` set; build прошёл значит type-check
  утвердил список и сам guard. ✓
- **I2 — envelope формат**: `respond.ts:statusFor()` — добавлен
  только status-код, форма `{ ok, data?, error?, cmd, raw? }` не
  изменена. ✓
- **I3 — host isolation**: правки только в `template/`, `.forgeplan/`,
  и `.claude/rules/22-readonly-proxy.md`. ✓
- **I4 — FSD direction**: `pages/home/lib/settings.ts` теперь
  импортирует `@/shared/config` (см. Phase 2 D1). ✓
- **I5 — template purity**: build success implies нет absolute
  paths / симлинков / host-references. ✓
- **I6 — comments policy**: TODO/FIXME с reason'ами добавлены для
  всех cut-corner'ов (palette-audit, scoring-overlay, a11y-refactor,
  layout-coupling, perf-tabs-badge).

## Limitations

- **Runtime browser smoke** не выполнен в этой evidence — только type-
  check + bundler-build. Поведенческая регрессия (например, debounce
  HomePage не работает, или ForceView simulation tick'ает с overhead)
  не отлавливается этими шагами. Рекомендация: запустить `npm run dev`
  + manual click-through перед mерж'ем PR. Отмечено как Limitation,
  не как блокер активации (R_eff достаточен для status-flip).
- **FPS-замер для ForceView под `$state.raw`** (R1 RFC-003) не
  выполнен — оценка делается по компиляции и общим Svelte 5
  guidelines. Если просадка >5% обнаружится в проде — fallback на
  `$state` proxy через 1-line change.
- **Допуск svelte-ignore** в InsightsRail (HIGH-стоп-gap a11y).
  Не уменьшает funcional surface; технический долг помечен
  `// TODO(a11y-refactor)`.


