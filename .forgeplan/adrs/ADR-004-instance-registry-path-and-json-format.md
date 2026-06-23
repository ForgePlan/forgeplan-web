---
created: 2026-05-08
depth: standard
id: ADR-004
kind: adr
links:
- target: PRD-027
  relation: informs
problem_ref: PROB-004
status: active
title: Instance registry path and JSON format
updated: 2026-05-08
---

# ADR-004: Instance registry path and JSON format

## Progress

```
Phase 0  ░░░░░░░░░░░░░░░░░░░░░░░░  0/0  (  0%)
─────────────────────────────────────────────────
TOTAL                               0/0  (  0%)
```

---

## Context

Issue #109 (multi-instance management) — пользователь часто запускает
несколько `npx @forgeplan/web start` одновременно: один для основного
проекта, второй для playground'а форgeplan'а, третий для review чужого
PR. Сейчас они независимы: каждый пишет в свой `.forgeplan-web/`,
слушает свой PORT, не знает о существовании других.

Sub-issue #115 (HealthBar Combobox) требует: на любом запущенном
instance'е в HealthBar'е показывается dropdown «другие активные
instance'ы» (label = workspace folder name + port + uptime), клик
переключает вкладку на тот instance. Sub-issue #113 (instance discovery
service) ставит более общий вопрос — как один процесс узнаёт о других.

Ни IPC-сокеты, ни broadcast (mDNS) сюда не подходят — слишком тяжёлая
машинерия для dev-tool'а с typical fan-out 1-3 instance'а на user.
Простейшая модель — общий registry-файл, который все instance'ы:

- *append* при `start` (свою запись),
- *prune* при `start` (чужие dead-записи),
- *read* через `/api/instances` endpoint когда UI просит список.

Решения, которые этот ADR закрывает:

1. **Где** на диске лежит registry.
2. **В каком формате** (JSON / SQLite / per-file).
3. **Как** writer'ы избегают друг друга (lock / atomic / nothing).
4. **Как** определяется liveness (PID / heartbeat / TTL).
5. **Что** делать при гонке.

Эти решения должны быть приняты ДО SPEC-003 (который описывает schema)
и ДО PRD-027 (который описывает реализацию `bin/commands/start.mjs` +
`template/src/shared/server/registry.ts`).

## Decision

**Selected**: 5 sub-decisions:

1. **Path: `~/.forgeplan-web/instances.json`.** Тот же родительский
   каталог, что и user-scope `dist/` из issue #111 (когда он будет
   реализован). Единая папка для всего, что @forgeplan/web хранит вне
   проекта.
2. **Format: single JSON file.** Schema формализуется в SPEC-003;
   корневой объект `{ schemaVersion: 1, instances: Instance[] }`,
   где `Instance = { pid, port, host, workspaceRoot, startedAt,
   heartbeatAt, version, scope }`.
3. **Write semantics: atomic via `writeFile(tmp) + rename(tmp, final)`.**
   POSIX rename внутри одной FS — атомарен; на Windows
   `fs.renameSync` атомарен на NTFS если target существует
   (`MoveFileEx` с `MOVEFILE_REPLACE_EXISTING`).
4. **Liveness: dual signal — PID alive + heartbeat fresh.** Проверка
   `process.kill(pid, 0)` (бросает `ESRCH` если процесс мёртв,
   `EPERM` если живой но чужой — оба значат «не наш зомби»). Дополнительно
   `Date.now() - heartbeatAt < 60_000` — fresh. Heartbeat обновляется
   instance'ом каждые 30 секунд.
5. **No locking.** Atomic rename + last-write-wins. На write
   instance читает текущее состояние, фильтрует stale, добавляет себя,
   пишет tmp, переименовывает. Окно race'а ~5ms (read+filter+write);
   при collision'е победитель overwrite'ит loser'а, но следующий
   heartbeat-tick (≤30s) восстановит.

**Why Selected**: каждое из 5 решений — самая простая интерпретация
требования issue #109/#113/#115:

- предсказуемый путь (#1) даёт одно место для всего state'а;
- JSON (#2) human-readable, debuggable через `cat`, не нуждается в
  native module (SQLite требует `better-sqlite3` или `node:sqlite`,
  оба ломают zero-dep aspiration в `dist/` или `bin/`);
- atomic rename (#3) — single OS-level primitive вместо самописного
  locking;
- двойной liveness probe (#4) ловит и crash (PID gone), и hang
  (heartbeat stale) — без false positive'ов на медленных машинах
  где event-loop замирает на 5-10s;
- no locking (#5) — допустимый компромисс при ≤10 concurrent instances
  per user. Race window узок, потеря записи восстанавливается
  следующим heartbeat'ом.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| A — SQLite (`better-sqlite3` или `node:sqlite`) | Rejected | Heavy: native module, build step, ~5MB unpacked. Хочется атомарных multi-instance write'ов «бесплатно», но atomic-rename даёт 95% того же результата без зависимости. Ломает zero-dep aspiration в `bin/` (rule 23) если writer живёт там. |
| B — Locked-file JSON (`proper-lockfile` или ручной `mkdirSync` lock) | Rejected | Adds dep или самописный lock-cleanup. Race window закрывается, но при ≤10 instances overhead ≥ benefit'а. Stale lock'и — известный foot-gun. |
| C — Per-instance file `~/.forgeplan-web/instances/<pid>.json` | Rejected | Удобно для write (нет race'ов), но плохо для read: реадеру нужно `readdir` + N×`readFile` вместо одного `readFile`. На 10 instance'ах — 11 syscalls вместо 1. Также сложнее snapshot'ить и debug'ить (`cat`). |
| D — XDG-compliant path (`$XDG_RUNTIME_DIR/forgeplan-web/instances.json` на Linux, `%APPDATA%` на Windows, `~/Library/Application Support/` на macOS) | Rejected | OS-correctness vs predictability — для dev-tool'а predictability важнее. XDG требует cross-platform shim'а; разный путь на разных OS усложняет support («where is my registry?»). Documented exception оправдан. |
| E — Tmpdir (`os.tmpdir()/forgeplan-web/instances.json`) | Rejected | Убираемый OS'ом при reboot — registry стирается между сессиями. Не критично (всё равно после reboot нет live instance'ов), но `~/.forgeplan-web/` уже есть как convention из #111 — лишний путь не нужен. |
| F — `~/.forgeplan-web/instances.json` + atomic rename + no lock | **Chosen** | Predictable path, zero deps, atomic enough for ≤10 instances, easy to debug/snapshot. |

## Consequences

### Positive

- Один путь, читаемый человеком: `cat ~/.forgeplan-web/instances.json`
  для debug.
- Zero new runtime deps: чистый `node:fs` + `node:path` + `node:os`
  + `process.kill` (probing).
- Атомарность write'а — не нужен ни lock-файл, ни coordination
  protocol.
- Snapshot/backup тривиален: один файл.
- Совместимо с rule 23 (никакого third-party в `bin/`) и rule 20
  (writes в `~/.forgeplan-web/` — не host project, не нарушает
  isolation).

### Negative (trade-offs)

- **No strong locking** — две одновременные `start`-команды могут
  потерять запись друг друга. Mitigation: heartbeat reconciliation в
  ≤30s (next tick rewrite'ит canonical state).
- **No cross-host federation** — registry per-user-per-machine. Если
  пользователь работает на двух машинах, instances не видят друг
  друга. Mitigation: out of scope (#109 явно про single-machine).
- **Path collision risk** — `~/.forgeplan-web/` в будущем может
  конфликтовать с другим использованием (например, Forgeplan CLI
  начнёт там что-то писать). Mitigation: namespace под
  `~/.forgeplan-web/instances.json` как peer для `dist/` (а не как
  catch-all файл).
- **Heartbeat overhead** — каждый instance будит timer каждые 30s
  на read+filter+write. Cost: ~5ms per tick × N instances. Negligible.
- **Read concurrency** — `/api/instances` endpoint читает файл на
  каждый request. На active dashboard polling-rate (10s) и 3 instances
  это ~9 read/min. Negligible.

### Risks

- **R1 — Race на write при одновременном `start` от двух процессов:
  один из них теряет запись.** Mitigation: heartbeat ≤30s
  восстанавливает; в худшем случае dropdown показывает 1 из 2
  instances в течение 30s. Acceptable UX.
- **R2 — `process.kill(pid, 0)` ложно возвращает «alive» для PID,
  переиспользованного OS** (process recycled другим приложением).
  Mitigation: dual signal — heartbeat freshness отсекает recycled PIDs
  (новый процесс не пишет в наш registry).
- **R3 — Corrupted JSON** (crash во время write до atomic rename).
  Mitigation: rename атомарен — partial-write остаётся в `tmp`,
  никогда не заменяет main файл. Stale `tmp` cleanup при следующем
  successful write.
- **R4 — Permission denied на `~/.forgeplan-web/`** (read-only home,
  exotic setup). Mitigation: graceful degradation — instance стартует
  без registry, log'ает warning, просто не показывается в dropdown'е.
  Не блокирует основной use-case.
- **R5 — schemaVersion bump ломает старые instance'ы.** Mitigation:
  reader'ы treat unknown `schemaVersion` как «empty registry»; writer'ы
  на новой версии overwrite'ят при следующем heartbeat'е.
- **R6 — Symlink attack на `~/.forgeplan-web/instances.json`** (атакующий
  создаёт symlink на чужой файл, наш write перезатирает). Mitigation:
  `lstatSync` перед write; если `isSymbolicLink()` — abort.
  Аналогично уже сделано в `bin/forgeplan-web.mjs` для `update` через
  `targetStat.isSymbolicLink()` (см. строки 222-230).

## Invariants

- **I1 — Atomic writes only.** Любой write в `instances.json` происходит
  через `writeFile(tmp) + rename(tmp, final)`. Прямой `writeFile(final)`
  запрещён.
- **I2 — Stale entries dropped on every `start` and on every heartbeat.**
  Каждая запись (`start`-time или heartbeat-time) выполняет
  `prune(instances)` — отбрасывает PID-dead и heartbeat-stale.
- **I3 — No instance writes another instance's entry.** Запись с
  `pid: 12345` принадлежит процессу 12345; другие instance'ы могут
  её только удалить (при stale-pruning), не модифицировать.
- **I4 — Heartbeat interval ≤ 30s, staleness threshold = 60s.**
  Несимметрия даёт буфер на event-loop pause / GC.
- **I5 — No fields beyond SPEC-003 schema.** Добавление поля к
  `Instance` — breaking change, требует bump'а `schemaVersion` и
  обновления SPEC-003 + ADR-004 update.
- **I6 — Path is `~/.forgeplan-web/instances.json` always.**
  Никакой env-override (`FORGEPLAN_WEB_REGISTRY=...`) на phase 1 —
  предсказуемость > flexibility. Если флаг понадобится — отдельный ADR.

## Evidence Requirements

- **E1 — 3-instance smoke test**: запустить 3 параллельных
  `node .forgeplan-web/index.js` (на разных портах), `cat
  ~/.forgeplan-web/instances.json` показывает все 3 записи. CL3 test.
- **E2 — Stale-pruning test**: kill -9 одного из 3 instance'ов;
  следующий `start` (или следующий heartbeat другого instance'а)
  drop'ает stale entry. CL3 test.
- **E3 — Atomic-rename test**: race-script запускает 10 одновременных
  write'ов в registry; после завершения JSON parseable, schema
  валидна, никаких partial-write артефактов. CL3 test.
- **E4 — PID-recycle robustness**: симулировать переиспользованный
  PID (записать запись с PID = 1; PID 1 живой как init, но heartbeat
  будет stale через 60s) — реадер должен отбросить. CL2 test
  (синтетический сценарий).
- **E5 — Symlink defence**: создать `~/.forgeplan-web/instances.json`
  как symlink на чужой файл; instance отказывается писать, log'ает
  warning. CL3 test.
- **E6 — Cross-platform**: matrix CI (ubuntu/macos/windows) проходит
  E1–E3. CL3 test.
- **E7 — Permission-denied graceful**: chmod 000 на
  `~/.forgeplan-web/`; instance стартует без registry, exit code 0,
  warning в logs, `/api/instances` отвечает `{ ok: false }` без crash.
  CL3 test.

## Valid Until

**Дата**: 2027-05-08 (1 год от создания).

**Обоснование TTL**: формат и path — публичный contract для tooling'а
других приложений (потенциально); годовой horizon разумен для
накопления usage data. Большие изменения (schema bump, federation)
скорее всего потребуют отдельного ADR'а, не refresh'а этого.

**Refresh Triggers** (когда пере-оценить досрочно):

- ≥2 случая corrupted-registry за месяц в production telemetry —
  сигнал что atomic rename недостаточно, нужен lock.
- ≥10 concurrent instances per user становится common case —
  сигнал что no-lock model wears out.
- Появляется требование cross-host federation (#109 evolutionary
  follow-up).
- Schema нуждается в breaking change (новый required field).
- Forgeplan CLI начинает писать в `~/.forgeplan-web/` — нужно явно
  разнести namespace'ы.

## Pre-conditions (чеклист ДО реализации)

- [x] PRD-027 created и validated.
- [x] SPEC-003 описывает schema (Instance + RegistryFile).
- [x] RFC-023 описывает архитектуру (writer flow в `bin/start.mjs`,
      reader flow в `template/src/shared/server/registry.ts`).
- [ ] User-scope `dist/` design (issue #111) согласован — registry path
      должен быть peer'ом, не дочкой.

## Post-conditions (Definition of Done)

- [ ] `bin/commands/start.mjs` пишет registry entry на startup и
      обновляет heartbeat каждые 30s.
- [ ] `bin/commands/start.mjs` prune'ит stale entries on startup.
- [ ] Process-exit hook (`SIGINT`/`SIGTERM`/normal exit) удаляет
      собственную запись.
- [ ] `template/src/routes/api/instances/+server.ts` (новый GET-endpoint)
      возвращает live instances. Покрывается amendment'ом rule 22 в
      PRD-029 (этот endpoint — не forgeplan-proxy, аналогично
      `update-check`).
- [ ] `template/src/shared/server/registry.ts` — pure read (без
      mutation). Mutation живёт в `bin/`.
- [ ] Все evidence'ы E1–E7 собраны и слинкованы.
- [ ] R_eff(ADR-004) > 0; статус active.

## Admissibility

- **NOT**: writing registry from a Svelte server route. Registry
  mutation лежит в `bin/` (start writes own entry, exit hook removes).
  Svelte routes только читают.
- **NOT**: extending registry path с env-override на phase 1 (см. I6).
- **NOT**: использовать `JSON.parse` без try/catch — corrupted
  registry должен degrade gracefully, не crash'ить.
- **NOT**: writing fields beyond SPEC-003 schema. Любое расширение —
  через bump `schemaVersion`.
- **NOT**: `process.kill(pid, 0)` без catch — `ESRCH` ожидаемый
  control-flow, не error.
- **NOT**: storing secrets / tokens / credentials в registry. Поля
  ограничены публичной meta'ой (pid, port, host, workspaceRoot,
  timestamps, version).
- **NOT**: следовать symlink'у на `~/.forgeplan-web/instances.json`
  при write — abort + warning (R6).

## Rollback Plan

**Triggers** (когда откатывать):

- Corrupted-registry incidents >2/month в issue tracker'е.
- Пользователь reports about ghost-instances в HealthBar dropdown'е,
  не decay'ат за минуты.
- Появляется fundamentally better механизм (например, IPC через
  абстрактный socket) и его cost/benefit лучше.

**Steps** (шаги отката):

1. Удалить `bin/commands/start.mjs` registry write/heartbeat hooks.
2. Удалить `template/src/routes/api/instances/+server.ts`.
3. Удалить `template/src/shared/server/registry.ts`.
4. Откатить amendment rule 22 (PRD-029) — endpoint allow-list
   снова без `instances`.
5. Удалить `~/.forgeplan-web/instances.json` cleanup hook (если был).
6. Перевести ADR-004 в `superseded`, ссылка на новый ADR.

**Blast Radius**: средний. Regress feature'а (HealthBar Combobox
теряет dropdown), но не ломает существующих single-instance users.
Файл `instances.json` на диске у пользователей становится мусором,
но не активным — следующий run просто его перезатирает или игнорит.

## Weakest Link

R_eff(ADR-004) ограничивается **E4 (PID-recycle robustness)** —
синтетический test, который невозможно полностью провести в CL3
без access'а к реально recycled PID (timing-dependent). CL2 penalty
0.1 → R_eff ≤ 0.9.

Дополнительно потенциально weak: **E7 (permission-denied)** на
Windows, где permission model отличается. Strategy: использовать
`fs.access` with `W_OK` flag на windows как proxy.

Если smoke E1–E3 на трёх платформах все CL3, R_eff(ADR-004)
прогнозируется в диапазоне 0.7–0.9.

## Affected Files

| File | Baseline Hash |
|------|---------------|
| `bin/commands/start.mjs` | new file (depends on PRD-024 decomposition) |
| `bin/forgeplan-web.mjs` | start() function reduced to delegating to bin/commands/start.mjs |
| `template/src/shared/server/registry.ts` | new file |
| `template/src/routes/api/instances/+server.ts` | new file |
| `.claude/rules/22-readonly-proxy.md` | amendment (PRD-029, not this ADR) |
| `~/.forgeplan-web/instances.json` | runtime artifact (not in repo) |

(`Baseline Hash` заполняется implementer'ом в PRD-027 на момент
старта Build phase.)

## AI Guidance

> Правила для AI-агентов при работе с этим решением.

- **Когда добавляешь поле в Instance** — обнови SPEC-003 schema,
  bump `schemaVersion`, обнови ADR-004 (Invariants + Affected Files).
  Не добавляй «just one more field» без artifact-trail.
- **Любая mutation registry — в `bin/`, не в Svelte routes.** Это
  invariant из rule 22 (read-only proxy) + Admissibility секция здесь.
- **При reading registry — всегда try/catch + schema-version check.**
  Corrupted/old-version → empty list, не crash.
- **Не используй third-party deps (lockfile, watcher, etc.) для
  registry на phase 1.** Если возникнет нужда — отдельный ADR
  с обоснованием.
- **Heartbeat interval — константа 30s, threshold — 60s.** Менять
  через константы в `bin/commands/start.mjs`, документировать в
  SPEC-003. Изменение требует update Invariants I4.
- **Symlink protection — обязательная.** Каждый write обязан
  `lstatSync` + reject если symlink (паттерн уже в `bin/forgeplan-web.mjs`
  строки 222-230).
- **Process-exit hook должен быть idempotent** (могут стрельнуть
  и `SIGINT`, и `exit`).

## Implementation Plan

### Phase 0: Foundation
- [ ] **0.1** SPEC-003 утвердить (schema froze).
- [ ] **0.2** ADR-004 (этот) активирован.

### Phase 1: Writer
- [ ] **1.1** `bin/commands/start.mjs` пишет own entry on start.
- [ ] **1.2** Heartbeat tick каждые 30s.
- [ ] **1.3** Process-exit hook удаляет own entry.
- [ ] **1.4** Atomic write (`writeFile(tmp) + rename(tmp, final)`).
- [ ] **1.5** Symlink defence (lstatSync + reject).
- [ ] **1.6** Stale-pruning on every write.

### Phase 2: Reader
- [ ] **2.1** `template/src/shared/server/registry.ts` — read + parse.
- [ ] **2.2** `template/src/routes/api/instances/+server.ts` GET endpoint.
- [ ] **2.3** Rule 22 amendment (PRD-029) для legalize этого endpoint'а.

### Phase 3: Evidence
- [ ] **3.1** Smoke E1 (3-instance) — local + matrix CI.
- [ ] **3.2** Smoke E2 (stale-prune) — kill -9 + verify.
- [ ] **3.3** Smoke E3 (atomic-race) — 10 concurrent writers.
- [ ] **3.4** Smoke E5 (symlink-defence).
- [ ] **3.5** EvidencePack'и созданы и слинкованы.

### Phase 4: Activate
- [ ] **4.1** `forgeplan score ADR-004` — R_eff > 0.
- [ ] **4.2** `forgeplan activate ADR-004`.

## Implementation Log

<!-- Add wave entries as sprints are completed:

### Wave 1 — 2026-MM-DD
| Task | Teammate | Status | Files |
|------|----------|--------|-------|
| 1.1 | ... | Done | bin/commands/start.mjs |
-->

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-027 | PRD | implements (registry write/read code) |
| RFC-023 | RFC | based_on (architecture) |
| SPEC-003 | Spec | based_on (schema) |
| PROB-004 | ProblemCard | based_on (multi-instance discoverability problem) |
| ADR-001 | ADR | informs (host isolation contract — symmetric to ~/.forgeplan-web/) |
| ADR-003 | ADR | informs (citty in bin/ — registry writer lives there) |
| Issue #109 | GitHub | informs (multi-instance management driver) |
| Issue #113 | GitHub | informs (instance discovery service) |
| Issue #115 | GitHub | informs (HealthBar Combobox UI consumer) |




