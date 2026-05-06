---
depth: standard
id: PRD-006
kind: prd
status: active
title: Web body preview + decision impact drill-down
---

# PRD-006: Web body preview + decision impact drill-down

## Problem

`@forgeplan/web` сегодня показывает каркас workspace — id / title / status /
R_eff / outgoing / incoming. Но **не показывает само решение**: чтобы прочитать
`## Decision` блока ADR или Functional Requirements PRD, пользователю
приходится открывать `.forgeplan/...md` в редакторе. Web превращается в
"оглавление без книги".

Параллельно: граф рисует прямые dependencies (1 hop), но не показывает
**downstream cascade** — на что повлияет если этот ADR протухнет, какие
PRDs от него зависят транзитивно, как просядет R_eff цепочки. Это главное
ценностное предложение forgeplan-методологии (weakest-link evidence math),
которое в UI сегодня **невидимо**.

**Impact**: PR-reviewer должен либо открыть ADR в редакторе (теряет real-time
context из web), либо доверять тому что автор PR описал в commit-message.
Stakeholder, не пишущий код, web вообще не использует — нет smysl без bodies.

## Target Users

| Персона                    | Описание                                       | Ключевая боль                                     |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Code reviewer              | смотрит PR, хочет проверить decision rationale | переключение web ↔ редактор; не видно downstream |
| Stakeholder (PM/architect) | не пишет код, хочет аудит decisions            | без bodies web бесполезен                         |
| New team member            | первый день в проекте, ищет где decisions      | каркас без content — onboarding fails             |

## Goals

| ID   | Criterion                                      | Metric                                                                          | Target                      | How to measure      |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------- | ------------------- |
| SC-1 | ArtifactPanel рендерит markdown body           | grep `marked` import + `<div class="body">`                                     | 1+ render call              | source review       |
| SC-2 | Body preview переключается toggle Show/Hide    | DOM evaluate `button[data-action="toggle-body"]` clickable                      | toggle present              | Playwright          |
| SC-3 | Decision impact subgraph drill-down доступен   | DOM evaluate `button[data-action="show-impact"]`                                | button present              | Playwright          |
| SC-4 | Downstream BFS выделяет цепь в graph view      | hover/click → `.node-impacted` class на 2+ nodes                                | works for non-leaf artifact | Playwright          |
| SC-5 | Markdown rendering не ломается на real PRDs    | open PRD-001..006 + RFC-001..005 — нет console errors                           | 0 errors                    | manual + Playwright |
| SC-6 | XSS-safe: arbitrary HTML в body не выполняется | inject `<script>alert()</script>` в test PRD body — `script` тег не выполняется | DOMPurify catches           | unit test           |
| SC-7 | Bundle size delta ≤ 80 KB                      | `du dist/_app/immutable/chunks/` before/after                                   | ≤ +80 KB minified           | shell               |
| SC-8 | svelte-check 0 errors / 0 warnings             | `npx svelte-check`                                                              | 0/0                         | shell               |
| SC-9 | smoke matrix 3-OS green                        | gh pr checks                                                                    | 3/3 pass                    | CI                  |

## Non-Goals

- НЕ редактировать body из UI — read-only proxy сохраняется (rule 22).
- НЕ парсить YAML frontmatter в UI — server `/api/get/[id]` уже возвращает разобранный JSON.
- НЕ реализовывать collapsible nested headings — простой markdown→html достаточно.
- НЕ добавлять syntax highlighting кода в body — overkill для MVP, отдельный PRD при необходимости.
- НЕ показывать markdown в графовых views (Force/Tree/Radial/...) — body живёт только в ArtifactPanel.
- НЕ синхронизировать impact subgraph между Sankey/Sunburst views — F11 ограничен Force/Tree/Radial/Lanes/Matrix (5 views с node-class fade).

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                                                                    | Acceptance                                                                                             |
| ------ | ------------- | -------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| FR-001 | Core          | Must     | User can view rendered markdown body of selected artifact in ArtifactPanel                                     | Toggle button rendered; click expands `<div class="artifact-body">`; markdown→HTML conversion runs     |
| FR-002 | Core          | Must     | Body rendering sanitises HTML (XSS-safe)                                                                       | DOMPurify removes `<script>`, `javascript:` links, event handlers                                      |
| FR-003 | Core          | Must     | User can compute downstream impact of selected artifact (forward BFS through hierarchy edges)                  | New lib `impact-graph.ts` exports `computeDownstream(id, edges)`; returns Set<string> of dependent ids |
| FR-004 | Core          | Must     | User can compute upstream impact (backward BFS)                                                                | Same lib `computeUpstream(id, edges)`                                                                  |
| FR-005 | Core          | Must     | Selected artifact's downstream chain is visually highlighted in 5 graph views (Force/Tree/Radial/Lanes/Matrix) | New `.node-impacted` CSS class applied via existing `nodeClass()` extension                            |
| FR-006 | UX            | Should   | Toggle button persists body-shown preference per session                                                       | localStorage `forgeplan-web.bodyExpanded`                                                              |
| FR-007 | UX            | Should   | Body section shows R_eff propagation: chain of all R_eff values along impact path                              | small inline list "PRD-001 (1.0) → RFC-001 (0.9) → ADR-001 (0.8)"                                      |
| FR-008 | Documentation | Should   | CHANGELOG `[Unreleased]` describes FR-001..FR-007                                                              | grep references                                                                                        |

## Non-Functional Requirements

| ID      | Category    | Requirement                                                                    | Metric                                   | Method                           |
| ------- | ----------- | ------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------- |
| NFR-001 | Bundle      | New deps (marked + DOMPurify) total ≤ 80 KB minified                           | `du dist/_app/immutable/chunks/` delta   | shell                            |
| NFR-002 | Performance | Body render < 50ms on N=300 artifact PRD body                                  | console.time/timeEnd in dev              | manual                           |
| NFR-003 | Security    | XSS attack via `<script>alert(1)</script>` in body content does NOT execute    | inject test fixture, run Playwright eval | Playwright + DOMPurify behaviour |
| NFR-004 | A11y        | Body container reachable via keyboard (Tab → toggle button); aria-expanded set | DOM evaluate                             | Playwright                       |
| NFR-005 | Compat      | Smoke matrix 3-OS × Node 22 green                                              | gh pr checks                             | CI                               |

## Affected Files

- `template/src/widgets/artifact-panel/ui/ArtifactPanel.svelte` (modified — body section added)
- `template/src/widgets/dependency-graph/lib/impact-graph.ts` (new)
- `template/src/widgets/dependency-graph/lib/impact-graph.test.ts` (new)
- `template/src/widgets/dependency-graph/lib/highlight.svelte.ts` (modified — extend with impactedIds)
- `template/src/widgets/dependency-graph/ui/{ForceView,TreeView,RadialView,LanesView,MatrixView}.svelte` (modified — apply `.node-impacted`)
- `template/package.json` (new deps: marked, dompurify, @types/dompurify)
- `template/src/app/styles/app.css` (new `.node-impacted` token)
- `CHANGELOG.md`

## Related Artifacts

| Artifact | Relation                                                       | Status  |
| -------- | -------------------------------------------------------------- | ------- |
| RFC-005  | Architecture proposal — markdown lib choice + impact algorithm | planned |
| EVID-014 | Acceptance pack                                                | planned |

## Risks & Mitigations

| ID  | Risk                                                        | Probability | Impact   | Mitigation                                                                    |
| --- | ----------------------------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------- |
| R-1 | XSS via crafted artifact body content                       | Low         | Critical | DOMPurify on every render; CSP `script-src 'self'` already in place           |
| R-2 | Bundle bloat past 80 KB threshold                           | Medium      | Medium   | Tree-shake; consider lazy-load body renderer (only when toggle clicked)       |
| R-3 | Impact BFS O(N²) on dense workspaces (N=300)                | Low         | Low      | Visited Set caches; downstream rarely > 50 nodes per artifact                 |
| R-4 | Markdown content with non-standard syntax confuses marked   | Medium      | Low      | Test against real `.forgeplan/*.md` fixtures; fallback to plain `<pre>` block |
| R-5 | Body-show preference conflicts with reduced-motion settings | Low         | Low      | `prefers-reduced-motion` skips expand animation; toggle works regardless      |

