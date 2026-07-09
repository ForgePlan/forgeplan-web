---
depth: standard
id: ADR-008
kind: adr
last_modified_at: 2026-07-02T13:03:15.141718+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-036
  relation: based_on
status: draft
title: 'Rule-22 amendment for the onboarding append-loop write endpoint: narrow POST job-file carve-out over daemon-port or deferral'
---

# ADR-008: Rule-22 amendment for the onboarding append-loop write endpoint

| Field | Value |
|---|---|
| Status | Draft — **HUMAN-GATED**: activation AND the rule-file edit require explicit user OK (PRD-036 Q4). This ADR does NOT amend `.claude/rules/22-readonly-proxy.md`; the Appendix carries the proposed text only. |
| Date | 2026-07-02 |
| Depth | Deep (governance / red-line adjacent — first write-capable exception to rule 22) |
| Decision drivers | security, governance-precedent, separation-of-duty, upstream-daemon-contract, single-origin UX |
| Decision-makers | claude-code/fable-5/adr-architect-task-3 (draft author) + explosivebit (human gate: activation + rule edit) |
| Supersedes | None |
| Superseded-by | (open) |

## Context

Rule 22 (`.claude/rules/22-readonly-proxy.md`) makes every `/api/*` endpoint in the forgeplan-web template a **read-only, GET-only proxy**. Its rationale is explicit: *"A drive-by request to `/api/...` should never delete a PRD or activate something"* — the package's ground truth is the git history of `.forgeplan/*.md`, and mutating it from a browser invalidates that. The rule is enforced three ways: the `READ_ONLY_SUBCOMMANDS` runtime backstop in `template/src/shared/server/forgeplan.ts`, review-time verification greps, and the verification bullet *"Every route file is `+server.ts` exporting `GET` only"*.

PRD-036 FR-012 (Phase 4 of the T4 program, EPIC-001 GATE-C track) requires an **append-loop job intake**: a user's explicit deeper-scan click in the onboarding chat records a validated job request under `.forgeplan/map/.jobs/<id>.req.json`. Per `docs/PROJECT-MAP-SPEC.md` §23 ("Headless bridge — CUT from MVP, verified impossible as a web route"), the web layer performs **FILE I/O ONLY** — it can never spawn `claude` (verified against `READ_ONLY_SUBCOMMANDS`, which only spawns the `forgeplan` binary and refuses every mutating subcommand). Job consumption, re-validation, and execution belong to a **local, user-started daemon in forgeplan CORE** (`forgeplan map serve`), which watches the `.jobs/` directory and runs the scoped, EMITTER-constrained, FIFO-serialized `claude -p` — outside this repo, permanently (PRD-036 Non-Goals).

Rule 22 already contains a body of amendment precedent, every instance read-only or side-effect-free: the `--version` flag-only exception (PRD-012/RFC-011), the `/api/update-check` network read (PRD-013/RFC-012), the `/api/instances` filesystem read (PRD-027/RFC-023/SPEC-003/ADR-004), the git-reconstruction spawns on `/api/snapshot` + `/api/timeline-events` (PRD-008/RFC-007 + PRD-016/RFC-015, landed via PR #158), and the side-effect-free `OPTIONS`/CORS carve-out on `/api/instance-status` (issue #134). **No write-capable exception exists today.** This ADR decides whether to introduce the first one, and in what shape — which is why it is Deep-depth, authored draft-only in this wave, and human-gated for activation.

Trigger: ARC C wave of EPIC-001 (T4), stacked on PRD-036 (parent) and SPEC-006. Phase 1 of the arc is fully rule-22 compliant (GET + readFile); this decision gates Phase 4 only.

## Decision

Adopt **Option A — a narrow, request-queue-only POST carve-out** for `/api/onboard/scan` (single atomic write of a UUID-named job file under `.forgeplan/map/.jobs/`, strict input validation, same-origin enforcement, bounded queue, no spawn, no other write path), paired with a GET-only `/api/onboard/jobs/[id]` status read — **with Option C's timing discipline**: no rule edit and no implementation now; the amendment (exact text in the Appendix) is applied only in the Phase-4 wave after a human activates this ADR with explicit OK.

The carve-out is worded to be the **only** non-GET data route ever permitted without a new superseding ADR.

## Decision drivers

- **DD-1 (RISK — rule-22 rationale)**: drive-by browser requests must never mutate the workspace ground truth (`.forgeplan/*.md` + Lance index). Source: rule 22 "Rationale"; RED LINE #7 in CLAUDE.md.
- **DD-2 (EMPIRICAL CONSTRAINT)**: a SvelteKit route cannot spawn `claude` — `runForgeplan` only spawns the `forgeplan` binary and refuses non-allow-listed subcommands. Execution must live outside this repo. Source: §23 "verified impossible as a web route"; `template/src/shared/server/forgeplan.ts`.
- **DD-3 (UPSTREAM DEPENDENCY)**: the daemon contract is fixed by §23 as a **file watcher** on `.forgeplan/map/.jobs/` (`forgeplan map serve`, forgeplan core) — not an HTTP server. Source: PROJECT-MAP-SPEC.md §23 "Headless bridge".
- **DD-4 (SEPARATION OF DUTY)**: intake (web: validate + record) is separated from execution (daemon: re-validate + spawn). A job file is **inert** without the user-started daemon — fail-safe by default. Source: §23 safety control #4.
- **DD-5 (DEFENSE IN DEPTH)**: the execution side already carries three EMITTER controls (denylist + `map-emitter-gate.sh` + guardian single-write). The intake side must add its own layer: UUID + zone validation, same-origin check, bounded queue, gitignored scratch directory. Source: §23 "EMITTER-safe needs THREE controls".
- **DD-6 (GOVERNANCE PRECEDENT COST)**: every carve-out erodes the blanket "GET-only" review property, the cheapest-to-verify invariant this repo has. Any amendment must be maximally narrow, self-limiting, and force a new ADR for any future write. Source: rule 22 amendment history (5 precedents, all read-only/side-effect-free).
- **DD-7 (SINGLE-ORIGIN UX)**: the deeper scan is triggered from the UI the user already has open (explicit-click-gated, §17/§23); a second origin/port introduces discovery, CORS, and failure-mode complexity in the critical onboarding path.

## Considered options

ADI cycle: `forgeplan_reason PRD-036` ran (2026-07-02, 3 hypotheses; its H3 — "Strict Rule-22 Compliant API", Very-High confidence — is the constraint this decision must not erode). Abduction below = the three candidate shapes; deduction = per-option consequence analysis; induction = the Decision outcome synthesis.

### Option A — narrow rule-22 carve-out: POST `/api/onboard/scan` writes a job-request file

The web route accepts `{ request_id: UUIDv4, zone }`, validates both against strict regexes plus zone-membership in the on-disk `map.json`, verifies same-origin, and performs exactly one atomic write: `.forgeplan/map/.jobs/<request_id>.req.json` (gitignored scratch). Never spawns anything. `/api/onboard/jobs/[id]` reads the daemon-written `.res.json` status, GET-only. Modeled on the rule's existing carve-out mechanics (OPTIONS/CORS on `/api/instance-status`; `/api/instances` filesystem read).

**Pro**:
- Preserves the invariant *behind* rule 22's rationale: the browser still cannot mutate the artifact ground truth — the job file is a **request queue entry**, not a mutation of `.forgeplan` decisions; `.jobs/` is gitignored scratch that never enters the artifact git history, and the daemon re-validates everything before acting.
- Fail-safe composition (DD-4): without the user-started daemon, an enqueued file does nothing, forever.
- Matches the §23 final design verbatim (DD-3): the core daemon stays a simple file watcher; no HTTP surface, no CORS, no port registry grows in the core repo.
- Single origin (DD-7): no discovery/handshake failure modes; the request either queues or errors visibly in the same UI.
- Narrow and diff-enforceable: one route, one write path, one filename scheme derived solely from a validated UUID — every constraint greppable, same style as the five existing amendments.

**Con**:
- Breaks the blanket "GET-only" property for the first time (DD-6): future reviews must check an exception list instead of one rule; precedent-creep risk is real — each amendment has historically invited the next.
- The drive-by surface does not vanish: a malicious local page could attempt cross-site POSTs to `localhost:<port>`. Same-origin enforcement + UUID/zone validation + queue cap bound this to "at worst, capped inert files in a gitignored scratch dir" — but if the daemon IS running, forged same-origin bypasses (browser bugs, misconfigured proxies) would indirectly trigger scoped scans. Residual risk is non-zero and must be accepted explicitly by the human gate.
- The daemon does not exist yet (forgeplan core, unshipped) — the intake contract is designed against a spec, not a running consumer (see Revisit Triggers).

**Verdict**: SUPPORTED — the only shape that satisfies DD-2/DD-3/DD-4/DD-7 simultaneously while keeping the amendment surface diff-enforceable; residual risk bounded and named.

### Option B — keep `/api/*` pure: the write moves to the bin/ CLI or the daemon's own port

Variant B1: `forgeplan map serve` exposes its own localhost HTTP port; the browser POSTs cross-origin to the daemon. Variant B2: no web write at all — the user triggers deeper scans from the CLI (`forgeplan map scan --zone …`).

**Pro**:
- Rule 22 stays byte-intact; the "viewer, not editor" story of `@forgeplan/web` is preserved without asterisks (DD-6 fully satisfied).
- B1 co-locates intake validation and execution in one process (no cross-repo req-file schema to version).
- B2 has zero new attack surface in either repo.

**Con**:
- B1 does not remove the drive-by write surface — it **relocates** it: any local page can POST to the daemon's port just as easily; the same-origin/validation burden reappears, now in the core repo, plus CORS headers (the web UI's origin differs from the daemon's), port discovery (a registry/handshake mechanism this repo would still have to build), and a second server to secure. The security gain over Option A is largely illusory while the complexity cost is real.
- B1 contradicts the fixed §23 daemon contract (DD-3): `forgeplan map serve` is specified as a `.jobs/` file watcher; making it an HTTP server is a cross-repo redesign this repo cannot decide unilaterally.
- B1 degrades UX semantics (DD-7): daemon down → opaque network error in the chat panel, vs Option A's honest "queued; daemon not detected" envelope.
- B2 abandons the product requirement: FR-012's in-UI deeper scan (§17's headline "next big thing") reduces to "go run a CLI command" — functionally equivalent to Option C for the user.

**Verdict**: REFUTED for B1 (relocates rather than removes the risk, at higher complexity, against the fixed upstream contract). B2 collapses into Option C's outcome and is subsumed by its analysis.

### Option C — defer: ship Phases 1–3 without deeper-scan; decide when the core daemon lands

No amendment, no write endpoint. Phase 3 chat answers map-grounded questions client-side (§23 estimates ~80% coverage) and replies "not enough info — run a deeper scan?" pointing at the out-of-band `/map-build` re-run. The decision is retaken when `forgeplan map serve` actually ships.

**Pro**:
- Zero governance change until the consumer exists; the decision would be made against a running daemon, not a spec.
- Value loss is bounded: the poller + `meta.version` bump already deliver out-of-band refresh (PRD-036 FR-009); only the in-UI append loop is lost.
- No risk of designing an intake contract the daemon then contradicts.

**Con**:
- FR-012 is *already* human-gated behind this ADR — deferring the ADR itself leaves the Phase-4 gate **undefined** rather than defined-and-closed, which is strictly worse for the staged program (PRD-036 stages FR-012 explicitly on "the rule-22 amendment ADR").
- §23 has already fixed the daemon's interface (file watcher on `.jobs/`); waiting adds no information about the *shape* of the decision, only about its timing.
- Re-deciding later risks the analysis being redone under Phase-4 delivery pressure, without this wave's full context.

**Verdict**: NEEDS-MORE-DATA as a standalone choice — but its **timing discipline is adopted**: this ADR stays draft, no rule edit and no implementation happen until the human gate opens at the Phase-4 wave. If the shipped daemon contradicts the `.jobs/` contract, the Revisit Trigger fires and a superseding ADR retakes the decision (Option C's "decide then" is thereby preserved as the escape path).

## Decision outcome

**Chosen option**: **Option A — narrow POST job-file carve-out**, activated only via the human gate, with Option C's escape path encoded as a Revisit Trigger.

Rationale mapped to drivers:

1. **DD-2 + DD-3** — execution cannot and must not live in this repo; the §23-fixed daemon is a file watcher, so the only intake shapes are "web writes a file" (A) or "no in-UI intake" (B2/C). A is the only one that delivers FR-012.
2. **DD-1 + DD-4** — the job file mutates no ground truth: it is an inert, gitignored, capped, schema-validated request that a separately-consented process may consume. The honest reading of rule 22's rationale ("never delete a PRD or activate something") is preserved; the letter ("GET only") is amended, narrowly.
3. **DD-5** — intake-side defense in depth (UUID + zone-membership validation, same-origin rejection, atomic single-path write, bounded queue) mirrors the execution side's three EMITTER controls; both layers are independently greppable from the diff.
4. **DD-6** — the amendment text (Appendix) is self-limiting: it declares itself the ONLY non-GET route and requires a superseding ADR for any future write, converting precedent-creep into an explicit governance event.
5. **DD-7** — single-origin keeps the onboarding path free of discovery/CORS failure modes that B1 would inject into the product's headline feature.

The decision is **reversible** by design (see Rollback plan): revert the rule amendment, delete the two route files, remove the gitignored `.jobs/` scratch — nothing enters the artifact history, no data migration exists.

Trust calculus (full-ADR bar ≥14): **F=5** (interface fully specified in §23 + Appendix), **G=4** (grounded in five shipped amendment precedents and the verified `READ_ONLY_SUBCOMMANDS` backstop; docked one point because the consuming daemon is unshipped — the intake contract is spec-verified, not integration-verified), **R=5** (first-party sources: the rule file, the spec, the code). **Sum 14 — proceed**; the G-gap is carried as Revisit Trigger 1 and Consequences/Negative, not papered over.

## Consequences

### Positive

- FR-012 (the program's append loop) gets a defined, closed, human-controlled gate instead of an undefined one.
- The artifact ground-truth invariant survives intact: browser writes are confined to an inert, gitignored request-queue directory; `.forgeplan/*.md` and the Lance index remain browser-unreachable.
- The forgeplan-core daemon contract stays minimal (file watcher — no HTTP, no CORS, no port registry), keeping the cross-repo seam to one versioned file schema.
- The amendment's constraint list is fully diff-enforceable in the style reviewers already know from the five existing rule-22 extensions.
- Fail-safe default: no daemon → queued files do nothing; the endpoint can report daemon absence honestly.

### Negative

- The blanket "every `/api/*` route is GET-only" review property — the cheapest security invariant this repo has — is permanently downgraded to "GET-only except the named exceptions"; every future audit pays that tax.
- A residual drive-by risk remains: if same-origin enforcement is ever bypassed (browser bug, reverse-proxy misconfiguration) while the daemon runs, a hostile local page could trigger scoped scans. Mitigations bound the blast radius (zone-validated, FIFO, EMITTER-append-only, guardian-revalidated) but do not zero it; acceptance of this residue is exactly what the human gate is for.
- The intake contract is designed against an unshipped consumer (forgeplan core daemon) — a real integration-mismatch risk, mitigated only by the Revisit Trigger, not by evidence available today.
- Precedent cost: this is the sixth amendment to rule 22 and the first write-capable one; the "viewer, not editor" pitch of `@forgeplan/web` now needs a footnote.

### Neutral

- Review burden shifts from "no writes" to "which writes" — more nuanced, not necessarily larger, given the greppable constraint list.
- `.forgeplan/map/.jobs/` becomes a cross-repo contract surface requiring a versioned `req/res` schema (Phase-4 RFC deliverable either way, under any option that ships FR-012).
- The queue-cap constant N and the same-origin mechanism are deliberately left TBD for the Phase-4 RFC — no invented numbers here.

## Affected Files

**In this wave: none.** This ADR modifies no file — it is a draft decision plus a proposed amendment text. Upon human-gated activation in the Phase-4 wave, the affected set is:

- `.claude/rules/22-readonly-proxy.md` — amended with the Appendix text (sections A/B/C below). Human-applied, never by an agent autonomously.
- `template/src/routes/api/onboard/scan/+server.ts` — NEW: the POST job-intake route.
- `template/src/routes/api/onboard/jobs/[id]/+server.ts` — NEW: the GET status route.
- `template/src/shared/server/` — NEW helper module for validated job-file I/O (name fixed by the Phase-4 RFC).
- `<workspaceRoot>/.forgeplan/map/.jobs/` — runtime scratch directory (gitignored; created on first accepted request).
- Out of scope permanently: `forgeplan map serve` daemon (forgeplan core repo); the EMITTER pipeline (marketplace repo).

## Rollback Plan

- **Before activation** (current state): deprecate ADR-008 with reason — nothing else exists; zero cleanup.
- **After activation but before implementation**: revert the rule-22 amendment commit; mark this ADR superseded by the corrective ADR. No code exists yet.
- **After implementation** (decision fails in practice — e.g., security incident via the intake path, or the shipped daemon contradicts the `.jobs/` contract):
  1. Delete the two route files (`onboard/scan`, `onboard/jobs/[id]`) and the shared job-I/O helper; the UI's deeper-scan affordance degrades to the Phase-3 out-of-band message.
  2. Revert the rule-22 amendment commit, restoring the blanket GET-only wording.
  3. Remove `<workspaceRoot>/.forgeplan/map/.jobs/` (gitignored — nothing in git history to clean).
  4. Author the superseding ADR (`supersedes ADR-008`) recording the failure evidence.
  - No data migration, no user-visible artifact loss: job files are ephemeral requests; the artifact ground truth was never touched.

## Compliance / Revisit Trigger — MUST

**This decision MUST be re-opened** when any trigger below fires:

- [ ] **Type**: event — forgeplan core ships `forgeplan map serve` with an interface other than a `.forgeplan/map/.jobs/` file watcher (e.g., HTTP/socket intake).
  - **Verification step**: core release notes / `forgeplan map serve --help` describe a non-file-watcher intake.
  - **Next-action**: author ADR-N+1 with `supersedes ADR-008`, re-running the A/B/C analysis against the real interface (Option C's preserved escape path).
- [ ] **Type**: event — the PRD-036 Phase-4 wave is scheduled (FR-012 enters an implementation plan).
  - **Verification step**: orchestrator opens the Phase-4 wave referencing FR-012.
  - **Next-action**: human review of this ADR → explicit user OK → activate ADR-008 → apply the Appendix text to `.claude/rules/22-readonly-proxy.md` in the same wave, never before.
- [ ] **Type**: date — 2027-01-02 (+6 months): if Phase 4 has not opened, re-confirm the decision still matches the program state or deprecate this ADR.
  - **Verification step**: check PRD-036 status and EPIC-001 GATE-C progress.
  - **Next-action**: renew (update this date) or deprecate with reason.

**Mark `[x]` to flag a trigger as fired.** Guardian blocks dependent artifacts while any trigger is `[x]` and unresolved.

## Invariants — SHOULD

What this decision MUST NEVER allow to be violated, even after activation:

- **INV-1**: The browser can never cause a write anywhere under `.forgeplan/` except `<workspaceRoot>/.forgeplan/map/.jobs/`, and that directory is gitignored — job files never enter the artifact git history.
- **INV-2**: No `/api/*` route ever spawns an agent/LLM process or any process at all in the intake path; job consumption and execution live exclusively in forgeplan core.
- **INV-3**: `POST /api/onboard/scan` is the ONLY non-GET data route under `/api/*`; any additional non-GET route requires a new ADR superseding this one plus a fresh rule-22 amendment.
- **INV-4**: A job file is inert without a separately user-started daemon — the web server alone can never complete an append loop.
- **INV-5**: This ADR's activation and the rule-file edit happen only with explicit human OK — never by an agent autonomously.

## Open questions — SHOULD

Intentionally deferred to the Phase-4 RFC (no invented numbers per house rules):

- Q1: pending-queue cap N (bound on `*.req.json` count before 429) — owner: Phase-4 RFC.
- Q2: same-origin enforcement mechanism (`Origin` header vs `Sec-Fetch-Site` vs a token minted by `GET /api/map`) — owner: Phase-4 RFC.
- Q3: response envelope when the daemon is absent (still enqueue with an advisory `daemon: "not-detected"` flag vs refuse) — owner: Phase-4 RFC.
- Q4: whether `/api/onboard/jobs/[id]` needs staleness semantics for orphaned `.res.json` (mirroring the `/api/instances` liveness sweep) — owner: Phase-4 RFC.
- Q5: `req/res` job-file schema version field and evolution policy (cross-repo contract with forgeplan core) — owner: Phase-4 RFC + core repo.

## References

- PRD-036 — parent (FR-012, Non-Goals, Q4 human gate); this ADR is `based_on` it.
- SPEC-006 — render contract (Phase-1 sibling; C5 GET `/api/map` shows the compliant baseline this ADR extends).
- EPIC-001 — program parent (T4 track, GATE-C).
- `docs/PROJECT-MAP-SPEC.md` §17, §23 — append-loop design, "Headless bridge" verification, safety controls #2/#4.
- `.claude/rules/22-readonly-proxy.md` — the rule under amendment; amendment precedents inside it: PRD-012/RFC-011 (`--version`), PRD-013/RFC-012 (`/api/update-check`), PRD-027/RFC-023/SPEC-003/ADR-004 (`/api/instances`), PRD-008/RFC-007 + PRD-016/RFC-015 (git-reconstruction, PR #158), issue #134 (`OPTIONS`/CORS on `/api/instance-status`).
- `template/src/shared/server/forgeplan.ts` — `READ_ONLY_SUBCOMMANDS` runtime backstop (DD-2 evidence).
- ADI: `forgeplan_reason PRD-036` (2026-07-02, 3 hypotheses; H3 rule-22 constraint Very-High).
- EvidencePack: to be minted at the Phase-4 prove step (CL3 test against the implemented route + greps) and linked `informs` before activation — activation additionally requires the human gate regardless of R_eff.

---

## Appendix — EXACT proposed amendment text for `.claude/rules/22-readonly-proxy.md`

**Human-gated. Nothing below is in force until this ADR is activated with explicit user OK and the rule file is edited in the Phase-4 wave. This repo's `.claude/rules/` files are NOT modified by this ADR.**

### A. New section — insert after "OPTIONS preflight + CORS carve-out (`/api/instance-status`)"

```markdown
## Allow-list extension: onboarding deeper-scan job intake (`/api/onboard/scan` + `/api/onboard/jobs/[id]`)

The onboarding append loop (PRD-036 FR-012 / ADR-008, PROJECT-MAP-SPEC §23) lets the
browser REQUEST a scoped deeper scan. Execution is NOT this repo's job: the request is
recorded as an inert job file consumed by a LOCAL, user-started daemon in forgeplan
core (`forgeplan map serve`), which performs its own validation before running any
agent. This is the FIRST and ONLY write-capable exception to the GET-only shape.

Constraints (every one enforceable from the diff):

- `/api/onboard/scan` exports `POST` only — the ONLY non-GET data route under
  `/api/*`. Any additional non-GET route requires a new ADR superseding ADR-008
  and a fresh amendment to this rule.
- Request body is JSON with exactly two fields: `request_id` (client-generated,
  validated against the strict UUID v4 regex
  `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) and
  `zone` (validated against `^z\.[a-z0-9][a-z0-9-]*$` AND against membership in
  the zones of the on-disk `.forgeplan/map/map.json`). Any other field or any
  validation failure → `400`, no filesystem access.
- Cross-origin requests are rejected before any filesystem access (same-origin
  check per the Phase-4 RFC's chosen mechanism). No CORS headers are ever set on
  this route.
- Exactly ONE filesystem write per accepted request:
  `<workspaceRoot>/.forgeplan/map/.jobs/<request_id>.req.json`, filename derived
  ONLY from the validated UUID, written atomically (tmp + rename). The `.jobs/`
  directory MUST be gitignored — job files never enter the artifact git history.
- Writes anywhere else are forbidden: the endpoint MUST NOT touch `.forgeplan/`
  markdown artifacts, the Lance index, `map.json` itself, or any path outside
  `.forgeplan/map/.jobs/`.
- Bounded queue: when the count of pending `*.req.json` files reaches the cap N
  (fixed by the Phase-4 RFC), the endpoint rejects with `429` and writes nothing.
  A duplicate `request_id` → `409`, no write.
- No spawn of any kind, no `forgeplan` invocation, no network. The web layer is
  file-I/O-only; consuming, validating, and executing jobs is exclusively the
  external daemon's responsibility (forgeplan core — never this repo).
- `/api/onboard/jobs/[id]` is `GET`-only: `id` validated against the same UUID v4
  regex; reads `<workspaceRoot>/.forgeplan/map/.jobs/<id>.res.json` (daemon-written
  status) via `readFileSync` only; missing file → `{ ok: true, data: { status:
  "pending" } }`-class envelope; never throws, never writes.
- Response shape mirrors the standard envelope: `{ ok, data: { request_id,
  status }, cmd: "onboard:scan", error? }`.
```

### B. Edit in "Required shape" — replace the bullet

> `- The endpoint method is \`GET\` only.`

with:

> `- The endpoint method is \`GET\` only — the sole exceptions are the side-effect-free \`OPTIONS\` preflight on \`/api/instance-status\` (CORS carve-out) and the file-I/O-only \`POST\` job intake on \`/api/onboard/scan\` (append-loop carve-out above).`

### C. Edits in "Verification" — replace the GET-only bullet and add two greps

Replace:

> `- Every route file is \`+server.ts\` exporting \`GET\` only (no \`POST\`, \`PUT\`, \`PATCH\`, \`DELETE\`) — the sole exception is the side-effect-free \`OPTIONS\` preflight on \`/api/instance-status\` (CORS carve-out above).`

with:

> `- Every route file is \`+server.ts\` exporting \`GET\` only (no \`PUT\`, \`PATCH\`, \`DELETE\`) — the sole exceptions are the side-effect-free \`OPTIONS\` preflight on \`/api/instance-status\` (CORS carve-out above) and the \`POST\` handler on \`/api/onboard/scan\` (append-loop job intake above), which MUST match every constraint of its extension section.`

Add:

> `- \`grep -RIn "writeFileSync\|renameSync\|mkdirSync\|appendFileSync" template/src/routes/api/ template/src/shared/server/\` must show write calls ONLY in the onboard job-intake path, and every written path must resolve under the literal \`.forgeplan/map/.jobs/\` join — no interpolation except the validated UUID filename.`
>
> `- \`template/src/routes/api/onboard/scan/+server.ts\` MUST NOT contain \`spawn\`, \`execFile\`, \`exec\`, or \`fetch(\` — the intake path is file-I/O-only.`

