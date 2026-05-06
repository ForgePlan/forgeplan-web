---
depth: standard
id: RFC-005
kind: rfc
status: active
title: Markdown rendering + decision impact algorithm for PRD-006
---

# RFC-005: Markdown rendering + decision impact algorithm

## Summary

PRD-006 wants (a) artifact body rendered as HTML inside ArtifactPanel and
(b) downstream/upstream impact chain visually highlighted across 5 graph
views. This RFC pins the markdown library choice, the sanitisation
policy, the BFS algorithm for impact-graph, and the integration points
with `highlight.svelte.ts`.

## Motivation

Without a pinned RFC every iteration on lib choice or algorithm shape
collapses into ad-hoc decisions. Pinning here makes the implementation
mechanical.

## Algorithmic constants

```ts
const MAX_IMPACT_DEPTH = 8;
const HIERARCHY_RELATIONS = new Set([
  "informs",
  "refines",
  "belongs-to",
  "contains",
  "supersedes",
]);
```

## Markdown rendering — choice

| Option                 | Bundle (min)             | Notes                                               | Verdict                                    |
| ---------------------- | ------------------------ | --------------------------------------------------- | ------------------------------------------ |
| **marked + DOMPurify** | ~30 KB + ~20 KB = ~50 KB | GFM tables/code/checkboxes; widely used; simple API | **Chosen**                                 |
| markdown-it            | ~50 KB                   | Plugin ecosystem, GFM compliant, slower             | Rejected — overkill for static body render |
| micromark              | ~100 KB                  | Full CommonMark spec                                | Rejected — too heavy                       |
| Custom regex           | ~5 KB                    | XSS / maintenance disaster                          | Rejected                                   |

## Markdown rendering — config

```ts
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  gfm: true,
  breaks: false,
  smartypants: false,
  headerIds: false,
  mangle: false,
});

export function renderBody(md: string): string {
  let html = "";
  try {
    html = marked.parse(md) as string;
  } catch {
    return `<pre class="raw-fallback">${escapeHtml(md)}</pre>`;
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "strong",
      "em",
      "code",
      "pre",
      "ul",
      "ol",
      "li",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "hr",
      "input", // for `- [ ]` checkboxes (rendered disabled)
    ],
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "class",
      "type",
      "checked",
      "disabled",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
```

XSS guard layers:

1. DOMPurify removes `<script>`, `javascript:` URLs, `onerror=` etc.
2. CSP `script-src 'self'` (already in `template/src/hooks.server.ts`).
3. Svelte `{@html sanitised}` — only HTML strings flow through.

## Decision impact algorithm

`lib/impact-graph.ts` exports two pure functions:

```ts
export function computeDownstream(
  rootId: string,
  edges: GraphEdge[],
): Map<string, number>;

export function computeUpstream(
  rootId: string,
  edges: GraphEdge[],
): Map<string, number>;
```

Direction normalisation reuses `normaliseHierarchyEdge` from `type-tier.ts`.
`computeDownstream("PRD-001")` returns all RFCs that refine it + all EVIDs
that inform them, transitively. Cap at `MAX_IMPACT_DEPTH`.

Complexity: O(V + E) per BFS, V ≤ 300; bounded.

## Highlight integration

```ts
export const highlight = $state({
  hoveredId: null as string | null,
  impactRoot: null as string | null,
  impactDirection: "down" as "down" | "up",
});

export function setImpactRoot(
  id: string | null,
  dir: "down" | "up" = "down",
): void {
  highlight.impactRoot = id;
  highlight.impactDirection = dir;
}

export function impactedClass(
  id: string,
  impacted: Map<string, number> | null,
): string {
  if (!impacted || !impacted.has(id)) return "";
  const d = impacted.get(id)!;
  if (d === 0) return "node-impact-root";
  if (d <= 2) return "node-impacted-near";
  return "node-impacted-far";
}
```

5 views (Force/Tree/Radial/Lanes/Matrix) compute `impacted = $derived(...)`
and apply `impactedClass(node.id, impacted)` alongside existing
`nodeClass(...)`.

Sankey + Sunburst SKIP impact mode — they already spatially encode
hierarchy; adding a third "fade" semantic confuses users.

## ArtifactPanel body section

```svelte
{#if artifact.body}
  <button
    type="button"
    class="ghost"
    data-action="toggle-body"
    aria-expanded={bodyExpanded}
    onclick={() => bodyExpanded = !bodyExpanded}
  >{bodyExpanded ? '− Hide body' : '+ Show body'}</button>

  {#if bodyExpanded}
    <div class="artifact-body">
      {@html renderBody(artifact.body)}
    </div>
  {/if}
{/if}

<div class="impact-actions">
  <button data-action="show-downstream"
    onclick={() => setImpactRoot(artifact.id, 'down')}>
    Show downstream
  </button>
  <button data-action="show-upstream"
    onclick={() => setImpactRoot(artifact.id, 'up')}>
    Show upstream
  </button>
  {#if highlight.impactRoot}
    <button onclick={() => setImpactRoot(null)}>Clear</button>
  {/if}
</div>
```

`bodyExpanded` persisted in localStorage `forgeplan-web.bodyExpanded`.

Body source: existing `/api/get/[id]` already returns `body` (verified
2026-05-06 via grep on the SvelteKit handler).

## Proposed Direction

Adopt the marked + DOMPurify + BFS-impact-graph approach end-to-end. PR
`feature/web-utilities-f11` → `develop`. Implementation runs in 7 phases
via parallel agents.

## Implementation Phases

1. **F11-T1** — install `marked` + `dompurify` + `@types/dompurify` (`--ignore-scripts`).
2. **F11-T2** — `lib/markdown-renderer.ts` (`renderBody(md)` + escapeHtml fallback).
3. **F11-T3** — `lib/impact-graph.ts` + `impact-graph.test.ts`.
4. **F11-T4** — extend `highlight.svelte.ts` with impactRoot / impactDirection / setImpactRoot / impactedClass.
5. **F11-T5** — `ArtifactPanel.svelte` body section + impact action buttons.
6. **F11-T6** — wire `.node-impact-root` / `.node-impacted-near` / `.node-impacted-far` CSS classes into 5 views.
7. **F11-T7** — CHANGELOG entry, full verify (svelte-check + vitest + smoke), commit per phase, push, PR.

## Options Considered

| Option                           | Description                                    | Verdict                                                       |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Server-side render markdown      | Add `body_html` to `/api/get` response         | Rejected — couples server to UI; rule 22 wants minimal server |
| Inline body bytes in `/api/list` | Avoid second fetch                             | Rejected — list polled 10s, would 10×-bloat traffic           |
| **Client-side render on demand** | Fetch via existing `/api/get` when panel opens | **Chosen** — minimal server change, lazy network              |
| First-parent-only impact graph   | Skip BFS, walk parent chain                    | Rejected — misses sibling cascade through evidence            |
| Full transitive closure cache    | Pre-compute server-side                        | Rejected — over-engineering for N=300                         |

## Invariants

- `renderBody(md)` returns sanitised HTML; never executes scripts.
- `computeDownstream` / `computeUpstream` return Maps; bounded by `MAX_IMPACT_DEPTH`.
- Sankey + Sunburst do NOT participate in impact highlight.
- Body section reachable via keyboard.
- Bundle delta ≤ 80 KB.

## Rollback Plan

1. Revert each F11-T\* commit independently.
2. Drop `template/package.json` deps `marked`, `dompurify`, `@types/dompurify`.
3. ArtifactPanel returns to id/title/links view; impact-graph lib stays but unused.

## Risks

- R-1 (XSS): mitigated by DOMPurify + CSP.
- R-2 (bundle ≤ 80 KB): tracked by NFR-001 in PRD-006.
- R-3 (BFS perf): bounded by V≤300, MAX_IMPACT_DEPTH=8.
- R-4 (marked throws on weird input): try/catch with `<pre>` fallback.

