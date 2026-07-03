import { beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";

// SPEC-006 E1 — the 3 automatable endpoint-contract rows (RFC-030
// Implementation Phase 2 gate): present -> mirror, ENOENT -> ok-empty,
// malformed -> ok-false-no-throw. Filesystem is stubbed so this exercises
// only readMapFile's own branching, not real disk I/O.

const { fsState } = vi.hoisted(() => ({
  fsState: { files: {} as Record<string, string> },
}));

vi.mock("node:fs", () => ({
  existsSync: (p: string) =>
    Object.prototype.hasOwnProperty.call(fsState.files, p),
  readFileSync: (p: string) => {
    if (!(p in fsState.files)) {
      throw new Error("ENOENT: no such file or directory");
    }
    return fsState.files[p];
  },
}));

vi.mock("./forgeplan", () => ({ workspaceRoot: () => "/fake/workspace" }));

import { readMapFile } from "./map";

const MAP_PATH = join("/fake/workspace", ".forgeplan", "map", "map.json");

describe("readMapFile", () => {
  beforeEach(() => {
    fsState.files = {};
  });

  it("mirrors a present, valid file verbatim", async () => {
    fsState.files[MAP_PATH] = JSON.stringify({ schema: "forgeplan.map/v1" });
    const result = await readMapFile();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ schema: "forgeplan.map/v1" });
    }
    expect(result.cmd).toBe("map:read");
  });

  it("returns the honest empty envelope on a missing file (ENOENT)", async () => {
    const result = await readMapFile();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({});
    }
  });

  it("returns ok:false on malformed JSON without throwing", async () => {
    fsState.files[MAP_PATH] = "{ not valid json";
    await expect(readMapFile()).resolves.toMatchObject({ ok: false });
    const result = await readMapFile();
    if (!result.ok) {
      expect(result.data).toEqual({});
      expect(result.error).toContain("invalid JSON");
    }
  });
});
