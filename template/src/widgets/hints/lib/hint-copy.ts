// PRD-011 / RFC-010 NFR-005 — every hint string lives here, future-proof for
// i18n bundle injection. Rule `copy()` functions resolve through interpolate()
// against these templates; no inline copy in hint-rules.ts.
//
// COPY JARGON FIX (plan blocker B5 / FR-009 / R-3): the RFC copy table leaks
// the raw `R_eff` metric name ("rests on weak evidence (R_eff {x})"). FR-009
// and NFR-005 require plain language with no internal metric names, so the
// low-r-eff-critical template is rewritten to plain language here. Flag for
// copy-review.

export const HINT_COPY: Record<string, string> = {
  "stale-spike":
    "{n} artifacts went stale recently — review {topId} and others",
  "low-r-eff-critical": "{topId} is active but has weak supporting evidence",
  "valid-until-imminent":
    "{n} artifacts are at risk of decaying — schedule a refresh",
  "blind-spot-new": "{n} active artifacts have nothing supporting them yet",
  "orphan-detected": "{n} artifacts have no links — connect them or deprecate",
  "draft-too-old":
    "{topId} has been sitting as a stale draft — activate or delete",
  "velocity-drop": "Progress slowed {pct}% this week — drafts are piling up",
  "cycle-detected": "Dependency cycle detected: {chain}",
};

/**
 * Replace every `{key}` placeholder in `template` with `vars[key]`. Unknown
 * placeholders are left intact (so a missing var is visible, not silently
 * dropped). Pure and deterministic.
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    return v === undefined ? whole : String(v);
  });
}

/** Resolve a rule's copy template by id, then interpolate. Empty if unknown. */
export function renderCopy(
  ruleId: string,
  vars: Record<string, string | number>,
): string {
  const template = HINT_COPY[ruleId];
  if (template === undefined) return "";
  return interpolate(template, vars);
}
