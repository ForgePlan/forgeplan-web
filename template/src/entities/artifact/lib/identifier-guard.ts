// Three-shape identifier guard for forgeplan-canonical identity (PROB-060).
// See RFC-015 D-3.
//
//   1. Display id (legacy or activated):       PRD-074
//   2. Draft display id with marker:           PRD-74?  (or %3F)
//   3. Slug (canonical, immutable):            prd-auth-system
//
// `?` is permitted in path segments by RFC 3986 §3.3 but most clients
// URL-encode it. SvelteKit decodes %3F before route handlers see the
// param, so the literal `?` form is what we match.
//
// Pure — no I/O, no allocations beyond regex match. Safe to call from
// reactive contexts and from request middleware.
const DISPLAY_RE = /^[A-Z]+-\d+\??$/;
const SLUG_RE = /^[a-z]+-[a-z0-9-]+$/;

export function isValidIdentifier(id: string): boolean {
  return DISPLAY_RE.test(id) || SLUG_RE.test(id);
}
