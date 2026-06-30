// PRD-013 FR-011: the update affordance can be dismissed for the session
// without losing the dialog content. We persist the dismissed *latest*
// version in sessionStorage (not localStorage) so a fresh tab/session shows
// it again, and a NEWER release re-surfaces the button. Pure, SSR-safe.

const KEY = "forgeplan-web.update.dismissed-version";

export function readDismissedVersion(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeDismissedVersion(version: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KEY, version);
  } catch {
    // TODO(sessionStorage-quota): dismiss won't persist; the button reappears
    // on next poll/reload. Acceptable — worst case is the pre-FR-011 behaviour.
  }
}

// Whether the update button should be shown given the current update state and
// the dismissed version. Extracted as a pure function so FR-011 is unit-testable
// without mounting the widget.
export function shouldShowUpdate(
  hasUpdate: boolean | undefined,
  latest: string | null | undefined,
  dismissedVersion: string | null,
): boolean {
  return !!hasUpdate && !!latest && latest !== dismissedVersion;
}
