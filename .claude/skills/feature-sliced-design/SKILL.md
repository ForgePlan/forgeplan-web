---
name: feature-sliced-design
description: Architectural methodology for frontend apps (Feature-Sliced Design v2.1). Load this skill when designing or refactoring directory layout, deciding where a piece of UI/business code belongs, reviewing import boundaries, or auditing a project for FSD compliance. Provides the layer/slice/segment vocabulary, the import-direction rule, and SvelteKit-specific placement guidance.
---

<!-- TODO(no-upstream-skill): no published agent skill exists for FSD on skills.sh /
     awesome-claude-skills as of 2026-05-04. This file is hand-rolled from the public
     methodology at https://feature-sliced.github.io/documentation/ . If/when an
     official FSD skill ships, replace this with the upstream version. -->

# Feature-Sliced Design (FSD)

A scalable, opinionated architectural methodology for frontend apps. Source of
truth: <https://feature-sliced.github.io/documentation/>.

## Vocabulary

FSD organizes code along three orthogonal axes: **layers**, **slices**,
**segments**.

### Layers (top-level directories under `src/`)

Strict order, top → bottom. **Code on a layer may only import from layers
below it** (and from external packages). No upward or sibling imports across
slices.

| Order | Layer | Purpose | Sliced? |
|---|---|---|---|
| 1 | `app` | App entry, global providers, routing root, global styles | no |
| 2 | `processes` *(deprecated in v2.1)* | Cross-page flows (auth flow, checkout) | yes |
| 3 | `pages` | Page compositions (one slice per route) | yes |
| 4 | `widgets` | Self-contained UI blocks composed of features/entities | yes |
| 5 | `features` | User-facing interactions ("add to cart", "login form") | yes |
| 6 | `entities` | Business entities (`user`, `order`, `product`) | yes |
| 7 | `shared` | Reusable, business-agnostic code (UI kit, utils, API client) | no |

`app` and `shared` are **not sliced** — they have segments only.

### Slices (business domains within a layer)

A slice is one bounded business concept inside a sliced layer. Examples:
`features/auth-by-email`, `entities/user`, `widgets/header`.

**Slices on the same layer must not import each other.** If two slices need
shared logic, lift it to a lower layer (`entities`, then `shared`).

### Segments (technical role within a slice)

Standard segments inside any slice:

```
<slice>/
├── ui/           # presentation: components, styles
├── model/        # business logic: stores, $state, machines
├── api/          # data fetching, server endpoints
├── lib/          # slice-local helpers (pure functions)
├── config/       # slice-local constants, feature flags
└── index.ts      # public API barrel — the ONLY allowed import surface
```

Custom segments are allowed when justified.

## The two non-negotiable rules

1. **Layered imports go downward only.** `features/*` may import from
   `entities/*` or `shared/*`. It MUST NOT import from `widgets/*`,
   `pages/*`, `processes/*`, `app/*`, or any sibling `features/*`.
2. **Cross-slice access goes through the public API barrel.** Always
   `import { Foo } from '@/features/auth-by-email'` — never reach inside
   `@/features/auth-by-email/ui/Form.svelte` directly. The slice's `index.ts`
   is its contract.

Violating either rule is a defect. ESLint plugins
(`@feature-sliced/steiger`, `eslint-plugin-boundaries`) enforce them.

## Decision flow: where does this code go?

```
Is it business-agnostic? (Button, fetch wrapper, date util)
  → shared/

Is it a domain noun with its own data model? (User, Order, Product)
  → entities/<noun>/

Is it a user-driven verb tied to a domain? (login, addToCart, likePost)
  → features/<verb-by-context>/

Is it a self-contained UI block composed of features/entities?
  (Header, Sidebar, ProductCard with its actions)
  → widgets/<block>/

Is it a route composition?
  → pages/<route>/

Global setup (router, providers, root layout)?
  → app/
```

## SvelteKit integration

SvelteKit's file-based router lives in `src/routes/`, which is *not* the same
as FSD's `src/pages/`. Recommended hybrid:

```
src/
├── routes/                 # SvelteKit router — keep thin
│   ├── +layout.svelte      # mounts app/Providers
│   ├── +page.svelte        # imports a single page from src/pages/home
│   └── login/+page.svelte  # imports src/pages/login
├── app/
│   ├── providers/          # global stores, error boundary, theme
│   ├── styles/
│   └── index.ts
├── pages/
│   └── home/
│       ├── ui/HomePage.svelte
│       └── index.ts
├── widgets/
├── features/
├── entities/
└── shared/
    ├── ui/                 # design system primitives (.svelte)
    ├── api/                # fetch client, error mapper
    ├── lib/                # pure utils (date, format, …)
    └── config/             # env, constants
```

**Rules specific to SvelteKit:**

- `src/routes/**/+page.svelte` files MUST stay thin: import one composition
  from `pages/<slice>` and render it. No business logic in route files.
- `+page.server.ts` / `+page.ts` `load` functions belong in
  `pages/<slice>/api/` — re-exported from the route file.
- `+layout.svelte` mounts `app/providers/` only.
- Server hooks (`hooks.server.ts`) are part of `app/` (not sliced).
- Form actions (`+page.server.ts`) belong to a feature slice's `api/`
  segment when they encode a user verb.
- `lib/` (SvelteKit's `$lib` alias) maps to FSD's `shared/`. Configure
  `vite.config.ts` aliases so `@/features/...`, `@/entities/...`,
  `@/shared/...` resolve, while keeping `$lib` as a synonym for `@/shared`.

## Public API barrels

Every slice MUST expose its surface via `index.ts`:

```ts
// features/auth-by-email/index.ts
export { LoginForm } from './ui/LoginForm.svelte';
export { useAuthState } from './model/auth.svelte';
export type { AuthCredentials } from './model/types';
```

Do not re-export internal helpers, models, or types not meant for consumption.
The barrel is the slice's contract — changes to it are breaking changes.

## Checks an agent should run

When asked to add or move code:

1. Identify the layer first (using the decision flow above).
2. Identify the slice (existing or new).
3. Place the file in the correct segment.
4. Update or create the slice's `index.ts`.
5. Verify imports: `grep` for any new import that goes upward or
   cross-slice. If any is found, refactor — do not suppress.
6. If introducing a new slice, name it as `<noun>` (entities) or
   `<verb>-by-<context>` (features). Avoid generic names like
   `common`, `utils`, `helpers` — those belong in `shared/`.

## Common anti-patterns

- Putting domain logic in `shared/` because "it's reused".
  → Lift it to `entities/` instead.
- A `features/common/` slice.
  → Features cannot share via siblings; lift to `entities/` or `shared/`.
- `pages/` slice importing another `pages/` slice for shared layout.
  → Extract a `widgets/<layout>` block.
- Reaching into `features/x/ui/Foo.svelte` from outside the slice.
  → Add `Foo` to `features/x/index.ts` or extract a `widgets/`.
- Dumping everything into `src/lib/` because SvelteKit's `$lib` is
  convenient.
  → Treat `$lib` as `shared/` and put domain code in higher layers.

## References

- Methodology overview: <https://feature-sliced.github.io/documentation/docs/get-started/overview>
- Layers: <https://feature-sliced.github.io/documentation/docs/reference/layers>
- Public API rule: <https://feature-sliced.github.io/documentation/docs/reference/public-api>
- Steiger linter: <https://github.com/feature-sliced/steiger>
- SvelteKit + FSD discussion: <https://github.com/feature-sliced/documentation/discussions/581>
