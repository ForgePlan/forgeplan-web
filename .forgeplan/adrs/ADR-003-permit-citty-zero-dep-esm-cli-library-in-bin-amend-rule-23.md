---
created: 2026-05-08
depth: standard
id: ADR-003
kind: adr
links:
- target: PRD-024
  relation: informs
problem_ref: PROB-003
status: active
title: Permit citty (zero-dep ESM CLI library) in bin/ — amend rule 23
updated: 2026-05-08
---

# ADR-003: Permit citty (zero-dep ESM CLI library) in bin/ — amend rule 23

## Progress

```
Phase 0  ░░░░░░░░░░░░░░░░░░░░░░░░  0/0  (  0%)
─────────────────────────────────────────────────
TOTAL                               0/0  (  0%)
```

---

## Context

`bin/forgeplan-web.mjs` сейчас парсит CLI вручную: `process.argv.slice(2)`,
`positional = argv.filter((a) => !a.startsWith("-"))`, `flags = new Set(...)`,
ручной `switch (cmd)` с case'ами `init / update / upgrade / start / serve /
run / help / -h / --help`. Файл уже 367 строк, и с каждой новой командой
читаемость падает квадратично:

- нет авто-help (текст хардкоднут в `help()` и не sync'ится с реальным
  списком флагов);
- нет type-coercion (флаг `--port 5174` приходит строкой, нужно `Number()`
  вручную);
- нет subcommand-scoped flags (`--force` валиден и для `init`, и для
  `update`, но смысл разный — текущий код не различает);
- нет интерактивных prompt'ов (нужны для GitHub issue #109 / #111 —
  выбор `--scope` user/project + список запущенных instance'ов).

Issue #109 (multi-instance management) поднимает 6 sub-issue'ев, среди
которых #111 (auto-detect existing scaffold + scope prompt), #115
(HealthBar Combobox со списком instance'ов), #112 (`update --scope`).
Каждая добавляет минимум один subcommand или интерактивный prompt.
Продолжать наращивать руками — путь к bug'ам в argv-парсинге
(уже наблюдалось: `flags.has("--no-experimental")` проверяется
side-effect-style внутри тела `update`, а не декларативно).

Rule 23 (`.claude/rules/23-bin-zero-deps.md`) сейчас прямо запрещает
любой third-party import в `bin/`:

> **Forbidden in `bin/`**:
> - Any `import` from a third-party package.
> - Any `require()` from `node_modules/` at the package root.

Это правило защищает cold-start `npx @forgeplan/web init` (нет
`npm install` на стороне пользователя — пакет ships pre-built `dist/`).
Но текущая дисциплина бинарна: либо ноль deps, либо «всё можно».
Нам нужна третья позиция — точечное исключение для одной библиотеки,
которая не нарушает фундаментальное обещание (zero install, fast
cold-start).

## Decision

**Selected**: разрешить **citty** (https://github.com/unjs/citty) как
**единственное** именованное исключение к rule 23. Другие CLI-библиотеки
(commander, yargs, oclif, cac) остаются запрещёнными. Версия пинуется
caret-range'ом на minor (`citty: ^X.Y.Z`); bump major/minor требует
re-evaluation этого ADR.

**Why Selected**: citty уникален в комбинации признаков, на которые
опирается rule 23:

- **Zero transitive runtime deps** — единственная dep, `consola`, тоже
  unjs zero-dep пакет. Полный install footprint для `bin/` ≈ 60 KB
  unpacked. Сравнение: commander — 1 dep, ~150 KB; yargs — 8 deps,
  ~600 KB; oclif — десятки deps, мегабайты.
- **ESM-native** — `bin/forgeplan-web.mjs` использует `import` /
  `node:` modules; CJS-shim'ы commander/yargs создают
  module-resolution квоты на cold-start.
- **~5KB minified, ~50ms cold-start delta** (измерим в EVID-XXX) —
  acceptable относительно текущего baseline'а `npx` (≈300ms до
  первого `console.log`).
- **Built-in prompt support** через re-export `consola.prompt` —
  закрывает требование #111 (interactive `--scope` selection) без
  второй зависимости (`prompts`, `inquirer`).
- **Subcommand model** маппится 1:1 на текущий `switch (cmd)` —
  миграция механическая, не архитектурная.
- **Maintainership** — unjs (Nuxt/Nitro экосистема, Pooya Parsa et al.),
  активно поддерживается, semver-disciplined.

Включается ровно одна библиотека: `consola` приходит транзитивно через
`citty`, отдельной строкой в `package.json#dependencies` НЕ
объявляется (это не «вторая dep», это implementation detail citty).

### Rule 23 patch (для референса implementer'а в PRD-024)

Текущий relevant фрагмент `.claude/rules/23-bin-zero-deps.md`:

```markdown
## Allowed in `bin/`

- `node:*` modules (`node:fs`, `node:child_process`, `node:path`,
  `node:url`, `node:os`, `node:crypto`, `node:util`).
- Relative imports of sibling `.mjs` files **inside `bin/`** ...

## Forbidden in `bin/`

- Any `import` from a third-party package.
- Any `require()` from `node_modules/` at the package root.
```

После реализации PRD-024 секция Allowed расширяется ровно до:

```markdown
## Allowed in `bin/` (amended by ADR-003)
- `node:*` modules (unchanged).
- Relative imports of sibling `.mjs` files inside `bin/` (unchanged).
- **citty** + **consola** (приходит транзитивно через citty re-export) —
  единственное именованное исключение для CLI-эргономики (subcommands,
  prompts, auto-help, type-coercion). См. ADR-003.
- Любой другой third-party import остаётся forbidden.
```

И Forbidden дополняется:

```markdown
- Any third-party import OTHER than `citty` (and its transitive `consola`).
- Adding any other entry to root `package.json#dependencies` to support
  the bin script.
```

Verification snippet rule 23 (тот, что в `## Verification`) обновляется:
allow-list bare specifier'ов добавляет `citty` + `consola`, остальные
по-прежнему FAIL'ят.

Эта правка — задача PRD-024 (Build phase), не этого ADR. ADR фиксирует
**решение**, не **диff**.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| A — Status quo: hand-rolled argv parsing | Rejected | Уже на пределе читаемости (367 строк, нет subcommand-scoped flags, нет prompts). #111/#115 умножат сложность. |
| B — commander | Rejected | 1 transitive dep, ~150 KB unpacked, CJS-first (ESM wrapper неполный); cold-start delta ~80ms; нет prompt'ов из коробки (придётся `prompts`/`inquirer` — вторая dep). |
| C — yargs | Rejected | 8 transitive deps, ~600 KB unpacked, CJS-first, тяжёлый. Сильнее всего бьёт `npx` cold-start. |
| D — oclif | Rejected | Designed for plugins/multi-binary CLIs; десятки deps; мегабайты. Overkill для 3-command bin. |
| E — cac | Rejected | Близко к citty по размеру, но менее активно поддерживается, нет встроенного prompt'а — пришлось бы добавить вторую dep. |
| F — citty | **Chosen** | 0 transitive non-unjs deps, ESM-native, prompt через `consola`, ~5KB, subcommand-friendly. См. Decision. |
| G — Самописный мини-парсер в `bin/parser.mjs` | Rejected | Отодвигает проблему: всё ещё нужно поддерживать coercion, prompts, help-генерацию. Стоимость поддержки ≥ библиотеки. |

## Consequences

### Positive

- `bin/forgeplan-web.mjs` декомпозируется на `bin/index.mjs` +
  `bin/commands/{init,update,start}.mjs` (уже намечено в PRD-024) —
  каждая команда self-contained, флаги декларативны.
- Auto-help sync'ится с реальным списком команд/флагов — нельзя
  «забыть обновить help()».
- Type-coercion (`number`, `boolean`, `string`) валидирует input до
  попадания в логику команды — fewer runtime surprises.
- `consola.prompt` open's путь к interactive flows (#111 scope picker,
  #115 instance selector) без второй dep.
- Rule 23 теперь имеет explicit shape — «ровно одна библиотека по
  имени», что проще audit'ить, чем «никаких deps» с фактическими
  workaround'ами.

### Negative (trade-offs)

- Cold-start `npx @forgeplan/web init` подрастает на ~50ms (≈15-17%
  от baseline ~300ms). На 1Gbit/s connection незаметно; на slow
  CI runners — заметно но допустимо.
- Tarball вырастет на ~60 KB unpacked / ~25 KB packed. Текущий
  пакет ships `dist/` ≈ 11 MB, дополнительные 60 KB
  пренебрежимы (<0.6%).
- Rule 23 становится сложнее: вместо «ноль deps» — «ноль deps плюс
  citty». Всякий новый запрос «можно ещё одну?» теперь имеет
  прецедент. Mitigation: invariant'ы ниже + AI Guidance.
- citty — относительно молодая библиотека (v0.x). Major-bump может
  потребовать миграции. Mitigation: pin caret на minor; refresh
  trigger на major bump.

### Risks

- **R1 — citty вводит свою transitive dep, которая ломает zero-install
  обещание.** Mitigation: lockfile-проверка в PRD-024 evidence pack.
  `npm ls --omit=dev` после `npm i citty` должен показать ровно две
  записи: `citty`, `consola`. CI gate'ит регрессию.
- **R2 — cold-start regression больше прогноза (>100ms).** Mitigation:
  EVID-XXX измеряет `time npx @forgeplan/web --version` до/после;
  threshold 100ms — fail гейт.
- **R3 — citty deprecation / unmaintained drift.** Mitigation: refresh
  trigger «no commits to citty repo for 12 months» переоценивает ADR.
- **R4 — security advisory на citty или consola.** Mitigation:
  `npm audit` в CI; refresh trigger «medium+ CVE» — мгновенно.
- **R5 — Прецедент-вектор: «раз citty можно, то и chalk можно».**
  Mitigation: AI Guidance секция явно запрещает; PR review checklist
  спросит ADR-XXX для каждой новой dep.

## Invariants

- **I1 — Только citty + node:* + sibling `.mjs` в `bin/`.** Никакая
  другая npm-зависимость не импортируется из файлов `bin/*.mjs`.
- **I2 — citty version pinned to `^X.Y.Z` (caret minor)**, где X.Y.Z —
  версия на момент adoption (фиксируется в PRD-024). Major/minor bump
  требует re-evaluation ADR через `forgeplan reason ADR-003`.
- **I3 — Root `package.json#dependencies` содержит ровно ОДНУ запись
  для bin'а: `"citty": "^X.Y.Z"`.** `consola` не объявляется (приходит
  транзитивно). Других runtime deps на root уровне НЕТ
  (`devDependencies` для tooling — отдельная история, rule 23 их не
  ограничивает).
- **I4 — `bin/` не использует ничего из citty помимо: `defineCommand`,
  `runMain`, `consola.prompt`, базовые args (`type: 'string' |
  'number' | 'boolean'`).** Расширение surface'а (e.g. `consola.box`,
  кастомные renderer'ы) — отдельный ADR.
- **I5 — Verification snippet rule 23 обновлён**, его allow-list bare
  specifier'ов содержит ровно `citty` и `consola`.

## Evidence Requirements

- **E1 — Smoke test exit 0**: `node scripts/smoke.mjs` (или его новый
  эквивалент) после миграции на citty проходит на ubuntu/macos/windows
  matrix. CL3 test против `bin/` + `dist/`.
- **E2 — Bundle size delta < 10KB packed**: `npm pack --dry-run` до и
  после adopting citty. Diff packed-size < 10 KB. CL3 measurement.
- **E3 — Cold-start delta < 100ms**: `hyperfine 'node bin/forgeplan-web.mjs
  --version'` (10 warmups, 50 runs) до/после. Mean delta < 100ms.
  CL3 benchmark.
- **E4 — Rule 23 verification exits 0** с обновлённым allow-list:
  модифицированный grep-snippet (citty + consola в whitelist) выдаёт
  `OK` для каждого `bin/*.mjs`. CL3 test.
- **E5 — `npm ls --omit=dev`** в репо показывает ровно: `citty@^X.Y.Z`
  с одним child'ом `consola@*`, без других runtime entries. CL3 audit.
- **E6 — `npm audit --omit=dev`** не репортит medium+ severity на
  citty или consola на момент adoption. CL2 audit (зависит от внешнего
  feed'а).

## Valid Until

**Дата**: 2027-05-08 (1 год от создания).

**Обоснование TTL**: решение архитектурно-консервативное (точечное
исключение, не сдвиг парадигмы); годовой horizon достаточен, чтобы
накопить evidence о cold-start стабильности и проверить, не появилось
ли в Node.js core stable аналога (`util.parseArgs` evolution,
`node:cli` proposal'ы). Раньше пере-оценивать без триггера — шум.

**Refresh Triggers** (когда пере-оценить досрочно):

- citty релизит major (v1 → v2) с breaking changes.
- Появляется CVE medium+ на citty или consola.
- Cold-start delta в production telemetry превышает 100ms на p50.
- Node.js core стабилизирует argv-parsing surface, покрывающий 80%+
  use-case'ов citty (`util.parseArgs` уже есть, но без subcommand
  модели).
- ≥1 новая запросов на «ещё одну npm-deps в `bin/`» — сигнал что
  правило слишком широко или слишком узко, нужно пере-обсудить.

## Pre-conditions (чеклист ДО реализации)

- [x] PRD-024 created и validated (implementation contract).
- [x] RFC-020 описывает архитектуру декомпозиции `bin/` на subcommands.
- [ ] Текущий version-pin citty зафиксирован в PRD-024 (минимальный
      `^0.X.Y` на момент adoption).
- [ ] Smoke test infrastructure (`scripts/smoke.mjs`) умеет валидировать
      exit code на 3 платформах.

## Post-conditions (Definition of Done)

- [ ] `.claude/rules/23-bin-zero-deps.md` обновлён по diff в Decision.
- [ ] `package.json#dependencies` содержит ровно `{"citty": "^X.Y.Z"}`.
- [ ] `bin/forgeplan-web.mjs` использует `defineCommand` / `runMain`
      из citty для всех subcommands (`init`, `update`, `start`, `help`).
- [ ] Все evidence'ы E1–E5 собраны и связаны через
      `forgeplan link EVID-XXX ADR-003 --relation supports`.
- [ ] R_eff(ADR-003) > 0; статус active.

## Admissibility

- **NOT**: добавлять ни одной third-party dep в `bin/` помимо citty.
  Каждая дополнительная требует **нового** ADR (не amendment этого).
- **NOT**: использовать citty в `template/` или `dist/` — те surface'ы
  имеют свои правила (`template/package.json#dependencies`,
  `scripts/build.mjs`). citty живёт только в `bin/`.
- **NOT**: импортировать `consola` напрямую (`import 'consola'`).
  Использовать только через citty re-export — иначе всплывёт как
  отдельная decllared dep и нарушит I3.
- **NOT**: вытаскивать citty в `peerDependencies` или `optionalDependencies`
  — runtime dep на bin'е, должен быть жёстким `dependencies`.

## Rollback Plan

**Triggers** (когда откатывать):

- citty полностью deprecated или unmaintained >12 месяцев.
- Cold-start regression >150ms сохраняется через 2+ patch-версии citty.
- Появляется critical CVE без fix-window <14 дней.

**Steps** (шаги отката):

1. Вернуть `bin/forgeplan-web.mjs` к hand-rolled argv-парсингу
   (git revert на коммит миграции; код всё ещё в истории).
2. Удалить `citty` из `package.json#dependencies`.
3. Удалить amendment-секцию из `.claude/rules/23-bin-zero-deps.md`,
   вернуть rule 23 к строгой «zero deps» формулировке.
4. Перевести ADR-003 в `superseded` через `forgeplan supersede`,
   ссылка на новый ADR с альтернативой (cac / самописный парсер /
   нативный `util.parseArgs`).
5. Cut patch-релиз с откатом.

**Blast Radius**: средний. Откат меняет публичный CLI surface
минимально (subcommand'ы остаются), но переписывает internal'ы
`bin/`. Пользователи не видят разницы; agents-coder'ы должны
будут переучить mental model.

## Weakest Link

R_eff(ADR-003) ограничивается **E3 (cold-start delta)** — это
единственный evidence, где measurement привязан к окружению (CPU,
disk, npm-cache state). На быстрой машине delta ~30ms, на slow
CI runner может быть ~80ms. Если choose CL2 (test против synthetic
benchmark, не production trace), penalty 0.1 → R_eff ≤ 0.9.

Стратегия: собрать E3 на трёх средах (local M-series Mac, ubuntu CI,
windows CI), брать MAX как worst-case; если worst-case <100ms — CL3.
Иначе — CL2 + flag в Risks.

## Affected Files

| File | Baseline Hash |
|------|---------------|
| `bin/forgeplan-web.mjs` | TBD-pre-migration |
| `bin/banner.mjs` | unchanged |
| `package.json` | adds `dependencies.citty` |
| `.claude/rules/23-bin-zero-deps.md` | adds amendment block |
| `.claude/rules/00-index.md` | unchanged (rule still listed as 23) |
| `scripts/smoke.mjs` | may need adjusting if it inspects argv shape |
| `README.md` | help-output snippet refreshes (if cited) |

(`Baseline Hash` заполняется implementer'ом в PRD-024 на момент
старта Build phase.)

## AI Guidance

> Правила для AI-агентов при работе с этим решением.

- **Когда расширяешь `bin/` новыми командами/флагами — используй citty
  `defineCommand`, не пиши руками argv-парсинг.** Subcommand'ы лежат
  в `bin/commands/<name>.mjs`, корень `bin/index.mjs` агрегирует
  через `subCommands`.
- **НЕ добавляй другую npm-deps в `bin/` без нового ADR.** Если
  кажется что нужно (chalk, ora, prompts, kleur) — либо найти эквивалент
  в citty/consola surface'е, либо открыть ADR-XXX с обоснованием
  через ту же таблицу Alternatives.
- **НЕ импортируй `consola` отдельной строкой.** Только через
  citty re-export (`import { consola } from 'citty'` если такой
  re-export существует; иначе — через args type или command context).
- **При генерации команд** — флаги декларативны (`args: { force:
  { type: 'boolean', description: '...' } }`), а не парсятся вручную
  внутри run-функции. Это invariant I4.
- **Если задача конфликтует с этим ADR** (например, пришёл запрос
  «давайте добавим commander для лучших help'ов») — raise it explicitly,
  не делай молча. ADR — binding decision.
- **При апгрейде citty** — checklist: smoke test E1, cold-start E3,
  audit E6. Любой regression — откат + патч-issue.

## Implementation Plan

### Phase 0: Foundation
- [ ] **0.1** Зафиксировать citty version в PRD-024 (`citty@latest` на момент старта).
- [ ] **0.2** Утвердить ADR-003 (этот документ) — `forgeplan validate ADR-003` 0 errors.

### Phase 1: Rule patch
- [ ] **1.1** Patch `.claude/rules/23-bin-zero-deps.md` — Allowed/Forbidden + Verification snippet.
- [ ] **1.2** Smoke что rule-23 verification exits 0 на текущем `bin/` (до citty migration — должна fail'ить, чтобы доказать что snippet boejcrhq).

### Phase 2: Migration
- [ ] **2.1** `npm i citty` (PRD-024 Wave 2).
- [ ] **2.2** Декомпозиция `bin/forgeplan-web.mjs` на `bin/index.mjs` + `bin/commands/*.mjs` (RFC-020 architecture).
- [ ] **2.3** `node scripts/smoke.mjs` — exit 0.
- [ ] **2.4** `hyperfine` cold-start measurement — собрать E3.
- [ ] **2.5** `npm pack --dry-run` size diff — собрать E2.
- [ ] **2.6** EvidencePack'и созданы и слинкованы; `forgeplan score ADR-003` показывает R_eff > 0.

### Phase 3: Activate
- [ ] **3.1** `forgeplan activate ADR-003`.
- [ ] **3.2** PR с `Refs: ADR-003`; merge через `release/v*`.

## Implementation Log

<!-- Add wave entries as sprints are completed:

### Wave 1 — 2026-MM-DD
| Task | Teammate | Status | Files |
|------|----------|--------|-------|
| 1.1 | ... | Done | .claude/rules/23-bin-zero-deps.md |
-->

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-024 | PRD | implements (the build-phase contract) |
| RFC-020 | RFC | based_on (architecture of decomposed bin/) |
| PROB-003 | ProblemCard | based_on (the maintainability problem) |
| ADR-001 | ADR | informs (rule-amendment pattern reference) |
| ADR-002 | ADR | informs (sub-agent dispatch — methodology consistency) |
| Issue #109 | GitHub | informs (multi-instance management driver) |
| Issue #111 | GitHub | informs (interactive scope prompt — citty/consola need) |




