import { describe, expect, it } from "vitest";
import { isHostConfigMissingError, sanitizeStderr } from "./snapshot";

describe("isHostConfigMissingError", () => {
  it("matches the canonical forgeplan 0.28+ stderr for missing config", () => {
    const stderr = "Error: No such file or directory (os error 2)\n";
    expect(isHostConfigMissingError(stderr)).toBe(true);
  });

  it("matches when surrounded by stack backtrace noise", () => {
    const stderr = `
zsh: command not found: _encode
Error: No such file or directory (os error 2)

Stack backtrace:
   0: __mh_execute_header
`;
    expect(isHostConfigMissingError(stderr)).toBe(true);
  });

  it("does not match unrelated reindex errors", () => {
    expect(isHostConfigMissingError("Error: lock timeout")).toBe(false);
    expect(isHostConfigMissingError("Error: corrupted Lance index")).toBe(
      false,
    );
  });

  it("does not match an empty stderr", () => {
    expect(isHostConfigMissingError("")).toBe(false);
  });

  it("requires both substrings (os error 2 alone is not enough)", () => {
    // Defensive: forgeplan could legitimately say `os error 2` for
    // something unrelated to a missing file (e.g. a permissions edge
    // case). Both phrases must co-occur to claim host_config_missing.
    expect(isHostConfigMissingError("internal: os error 2 raised")).toBe(false);
  });
});

describe("sanitizeStderr", () => {
  it("redacts absolute paths under /Users/", () => {
    const out = sanitizeStderr(
      "open '/Users/alice/Work/secret-project/.forgeplan/config.yaml' failed",
    );
    expect(out).not.toContain("/Users/alice");
    expect(out).toContain("<host>");
  });

  it("redacts /home/ and /private/var/ paths", () => {
    expect(sanitizeStderr("read /home/bob/.config")).toContain("<host>");
    expect(sanitizeStderr("write /private/var/tmp/x")).toContain("<host>");
  });

  it("redacts env-style assignments", () => {
    const out = sanitizeStderr("FORGEPLAN_API_KEY=sk-deadbeefcafe123");
    expect(out).not.toContain("sk-deadbeefcafe123");
    expect(out).toContain("FORGEPLAN_API_KEY=<redacted>");
  });

  it("preserves the diagnostically useful 'os error 2' substring", () => {
    // PRD-016 AC-6 requires the excerpt to keep this literal substring
    // so users can recognise the host_config_missing case.
    const out = sanitizeStderr(
      "Error: No such file or directory (os error 2) at /Users/alice/x",
    );
    expect(out).toContain("os error 2");
    expect(out).not.toContain("/Users/alice");
  });

  it("truncates at a word boundary for very long stderr", () => {
    const long = "x ".repeat(2000);
    const out = sanitizeStderr(long);
    expect(out.length).toBeLessThanOrEqual(1024);
    expect(out.endsWith("…")).toBe(true);
  });

  it("does not mangle short well-formed stderr", () => {
    const stderr = "Error: lock timeout after 5s";
    expect(sanitizeStderr(stderr)).toBe(stderr);
  });
});
