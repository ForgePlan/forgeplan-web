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

import { isValidZoneId, readMapFile, readMapLayerFile } from "./map";

const MAP_PATH = join("/fake/workspace", ".forgeplan", "map", "map.json");
const layerPath = (zone: string) =>
  join("/fake/workspace", ".forgeplan", "map", "layers", `${zone}.json`);

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

// PRD-038 FR-002 (E3 seam) — same 3 automatable contract rows as
// readMapFile, applied to the per-zone layer reader.
describe("readMapLayerFile", () => {
  beforeEach(() => {
    fsState.files = {};
  });

  it("mirrors a present, valid layer file verbatim", async () => {
    fsState.files[layerPath("z.decisions")] = JSON.stringify({
      schema: "forgeplan.map/v1",
      meta: { title: "z.decisions" },
    });
    const result = await readMapLayerFile("z.decisions");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        schema: "forgeplan.map/v1",
        meta: { title: "z.decisions" },
      });
    }
    expect(result.cmd).toBe("map:layer:read");
  });

  it("returns the honest empty envelope on a missing layer (ENOENT)", async () => {
    const result = await readMapLayerFile("z.no-layer-yet");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({});
    }
  });

  it("returns ok:false on malformed JSON without throwing", async () => {
    fsState.files[layerPath("z.core")] = "{ not valid json";
    const result = await readMapLayerFile("z.core");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.data).toEqual({});
      expect(result.error).toContain("invalid JSON");
    }
  });
});

describe("isValidZoneId", () => {
  it("accepts real zone ids", () => {
    expect(isValidZoneId("z.decisions")).toBe(true);
    expect(isValidZoneId("z.core")).toBe(true);
    expect(isValidZoneId("z-web_1")).toBe(true);
  });

  it("rejects path traversal and slash-bearing ids", () => {
    expect(isValidZoneId("../../etc/passwd")).toBe(false);
    expect(isValidZoneId("a/b")).toBe(false);
    expect(isValidZoneId("z..decisions")).toBe(false);
    expect(isValidZoneId("..")).toBe(false);
  });

  it("rejects empty and otherwise-invalid characters", () => {
    expect(isValidZoneId("")).toBe(false);
    expect(isValidZoneId("z decisions")).toBe(false);
    expect(isValidZoneId("z/decisions")).toBe(false);
  });
});
