import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readDismissedVersion,
  shouldShowUpdate,
  writeDismissedVersion,
} from "./session-dismiss";

describe("shouldShowUpdate (FR-011 gate)", () => {
  it("shows when there is an update and it is not dismissed", () => {
    expect(shouldShowUpdate(true, "0.3.0", null)).toBe(true);
    expect(shouldShowUpdate(true, "0.3.0", "0.2.0")).toBe(true);
  });

  it("hides when the latest version is the dismissed one", () => {
    expect(shouldShowUpdate(true, "0.3.0", "0.3.0")).toBe(false);
  });

  it("hides when there is no update", () => {
    expect(shouldShowUpdate(false, "0.3.0", null)).toBe(false);
    expect(shouldShowUpdate(undefined, null, null)).toBe(false);
    expect(shouldShowUpdate(true, null, null)).toBe(false);
  });
});

describe("session-dismiss persistence", () => {
  afterEach(() => {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    vi.restoreAllMocks();
  });

  it("round-trips the dismissed version through sessionStorage", () => {
    const store = new Map<string, string>();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(readDismissedVersion()).toBeNull();
    writeDismissedVersion("0.3.0");
    expect(readDismissedVersion()).toBe("0.3.0");
  });

  it("is SSR-safe when sessionStorage is absent", () => {
    expect(readDismissedVersion()).toBeNull();
    expect(() => writeDismissedVersion("0.3.0")).not.toThrow();
  });

  it("swallows a throwing sessionStorage (private mode / quota)", () => {
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(readDismissedVersion()).toBeNull();
    expect(() => writeDismissedVersion("0.3.0")).not.toThrow();
  });
});
