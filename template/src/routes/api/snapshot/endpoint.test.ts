import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for RFC-015 D-4: the /api/snapshot failure payload MUST
// forward `error_code` + `stderr_excerpt` to the browser. They were dropped
// (only `{ ok, at, sha, error }` was serialised) — the 0.33 contract audit
// caught the dead wire. getSnapshot is stubbed so the test exercises only the
// endpoint's response construction, not the (spawn-heavy) reconstruction.
const { getSnapshotMock } = vi.hoisted(() => ({ getSnapshotMock: vi.fn() }));
vi.mock("@/shared/server", () => ({ getSnapshot: getSnapshotMock }));

import { GET } from "./+server";

const AT = "2026-01-01T00:00:00Z";

function call(at: string) {
  const url = new URL(
    `http://localhost/api/snapshot?at=${encodeURIComponent(at)}`,
  );
  // RequestHandler only reads `url`; the rest of the event is unused here.
  return GET({ url } as unknown as Parameters<typeof GET>[0]);
}

describe("/api/snapshot endpoint", () => {
  beforeEach(() => getSnapshotMock.mockReset());

  it("forwards error_code and stderr_excerpt on failure", async () => {
    getSnapshotMock.mockResolvedValue({
      ok: false,
      at: AT,
      sha: "a".repeat(40),
      error: "host workspace gitignored .forgeplan/config.yaml",
      error_code: "host_config_missing",
      stderr_excerpt: "Error: No such file or directory (os error 2)",
      status: 502,
    });

    const res = await call(AT);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error_code).toBe("host_config_missing");
    expect(body.stderr_excerpt).toBe(
      "Error: No such file or directory (os error 2)",
    );
    expect(body.error).toContain("config.yaml");
  });

  it("omits failure fields cleanly on success", async () => {
    getSnapshotMock.mockResolvedValue({
      ok: true,
      at: AT,
      sha: "b".repeat(40),
      snapshot: { sha: "b".repeat(40), artifacts: [], edges: [] },
      fromCache: null,
    });

    const res = await call(AT);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.snapshot).toBeDefined();
    expect(body.error_code).toBeUndefined();
    expect(body.stderr_excerpt).toBeUndefined();
  });

  it("rejects a malformed 'at' before reaching getSnapshot", async () => {
    await expect(call("not-an-iso")).rejects.toMatchObject({ status: 400 });
    expect(getSnapshotMock).not.toHaveBeenCalled();
  });
});
