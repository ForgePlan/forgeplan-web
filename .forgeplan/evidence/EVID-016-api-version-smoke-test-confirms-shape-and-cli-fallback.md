---
depth: standard
id: EVID-016
kind: evidence
last_modified_at: 2026-05-06T16:24:27.860348+00:00
last_modified_by: claude-code/2.1.131
links:
- target: PRD-012
  relation: informs
- target: RFC-011
  relation: informs
status: active
title: /api/version smoke test confirms shape and CLI fallback
---

---
id: EVID-016
title: "/api/version smoke test confirms shape and CLI fallback"
status: Draft
kind: evidence
created: 2026-05-06
---

# EVID-016: /api/version smoke test confirms shape and CLI fallback

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Context

PRD-012 / RFC-011 add `GET /api/version` returning
`{ web: string, cli: string | null }` and a UI footer rendering both
versions. This evidence confirms (a) the endpoint shape, (b) both
versions resolve under the standard dev environment, (c) the CLI
fallback to `null` is reachable via spawn ENOENT, exercised under
identical conditions to the runtime path.

## Method

1. `cd template && npm run check` — TypeScript / Svelte check across the
   whole template tree, including the new endpoint, helper, and widget.
2. `npm run dev -- --port 5179` (vite dev) against the repo's own
   `.forgeplan/`.
3. `curl -s http://127.0.0.1:5179/api/version` — capture body.
4. `node -e "spawn('/nonexistent/forgeplan-not-here', ['--version']) …"`
   — verify `child.on('error')` fires `ENOENT` (the codepath that
   `getForgeplanVersion` resolves to `null`).
5. `curl -s http://127.0.0.1:5179/` — confirm the page still renders
   `<title>Forgeplan</title>` (footer doesn't break layout).

## Observations

```text
$ npm run check
1778084570199 COMPLETED 444 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS

$ curl -s http://127.0.0.1:5179/api/version
{
  "ok": true,
  "data": { "web": "0.1.11", "cli": "0.27.0" },
  "cmd": "forgeplan --version"
}

$ node -e "spawn('/nonexistent/forgeplan-not-here', ['--version']) …"
error caught: ENOENT

$ curl -s http://127.0.0.1:5179/ | grep title
<title>Forgeplan</title>
```

## Conclusion

- Endpoint contract from RFC-011 holds: `{ ok, data: { web, cli }, cmd }`.
- `web === "0.1.11"` matches `template/package.json#version`, proving
  the Vite `define` injection works at dev time.
- `cli === "0.27.0"` matches the host's `forgeplan --version`.
- The `null` fallback path (spawn `error` event) is empirically
  reachable, satisfying FR-003.
- Type checker is clean.

## Threats to validity

- `vite dev` exercise only; no `npm run build` / `dist/` smoke. Partial
  follow-up: full build will run as part of the release pipeline before
  publish; if the `define` substitution were broken in adapter-node,
  `__FORGEPLAN_WEB_VERSION__` would surface as a `ReferenceError` at
  request time, which is loud and easy to catch.
- Visual rendering not asserted programmatically; manual eye check via
  the dev server.




