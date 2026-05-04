// Forgeplan-web is a thin client-side viewer that polls /api/* every 10s
// and renders d3-force / d3-zoom widgets requiring DOM access. SSR has no
// product value (no SEO, no first-paint speedup over a static shell) and
// only adds hydration mismatch risks on the runes/$state interop with d3.
// All routes render client-only.
export const ssr = false;
export const prerender = false;
