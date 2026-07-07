// Throwaway dev spike (see +page.svelte header) — never server-rendered or
// prerendered. Root +layout.ts already sets ssr=false/prerender=false for
// the whole app; this local declaration keeps the route explicit on its own
// (three/@threlte are heavy — the browser-guarded import in +page.svelte is
// what actually keeps them out of the SSR/server bundle).
export const ssr = false;
export const prerender = false;
