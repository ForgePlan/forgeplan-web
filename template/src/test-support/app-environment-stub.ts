// Stub for SvelteKit's `$app/environment` virtual module, which vitest.config.ts
// cannot resolve (only the bare `svelte()` plugin is registered, not
// `sveltekit()`). Used only by the "dom" test project, aliased in
// vitest.config.ts, for modules (like poller.svelte.ts) that import `browser`
// from the real thing.
export const browser = true;
export const dev = true;
export const building = false;
export const version = "test";
