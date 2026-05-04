#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BIN = join(ROOT, "bin", "forgeplan-web.mjs");
const DIST = join(ROOT, "dist");
const SHIM = join(ROOT, "scripts", "test", "forgeplan-shim.mjs");
const IS_WIN = process.platform === "win32";

function log(line) {
  process.stdout.write(`[smoke] ${line}\n`);
}

function fail(line, code = 1) {
  process.stderr.write(`[smoke] FAIL: ${line}\n`);
  process.exit(code);
}

function ensureBuild() {
  if (existsSync(join(DIST, "index.js"))) {
    log("dist/ already built — reusing");
    return;
  }
  log("dist/ missing — running `node scripts/build.mjs`");
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "build.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) fail("build failed");
}

function setupShim(shimDir) {
  mkdirSync(shimDir, { recursive: true });
  if (IS_WIN) {
    const cmd = `@echo off\r\n"${process.execPath}" "${SHIM}" %*\r\n`;
    writeFileSync(join(shimDir, "forgeplan.cmd"), cmd);
  } else {
    const sh = `#!/usr/bin/env sh\nexec "${process.execPath}" "${SHIM}" "$@"\n`;
    const p = join(shimDir, "forgeplan");
    writeFileSync(p, sh);
    chmodSync(p, 0o755);
  }
}

function pickPort() {
  return 15700 + Math.floor(Math.random() * 200);
}

async function waitForListen(port, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await fetch(`http://127.0.0.1:${port}/api/health`)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function check(url, expectStatus = 200) {
  const r = await fetch(url).catch((e) => fail(`fetch ${url}: ${e.message}`));
  if (!r.ok && r.status !== expectStatus) {
    fail(`${url}: status ${r.status}, expected ${expectStatus}`);
  }
  return r;
}

async function main() {
  ensureBuild();

  const scratch = mkdtempSync(join(tmpdir(), "fpw-smoke-"));
  const shimDir = join(scratch, "shim");

  log(`scratch: ${scratch}`);

  mkdirSync(join(scratch, ".forgeplan"), { recursive: true });
  setupShim(shimDir);

  const PATH_KEY = IS_WIN ? "Path" : "PATH";
  const env = {
    ...process.env,
    [PATH_KEY]: `${shimDir}${IS_WIN ? ";" : ":"}${process.env[PATH_KEY] ?? process.env.PATH ?? ""}`,
  };

  const userGitignoreLine = "# pre-existing user line\nnode_modules/\n";
  writeFileSync(join(scratch, ".gitignore"), userGitignoreLine);

  log("init -y (run 1)");
  const initR = spawnSync(process.execPath, [BIN, "init", "-y"], {
    cwd: scratch,
    env,
    stdio: "inherit",
  });
  if (initR.status !== 0) fail(`init exit ${initR.status}`);

  if (!existsSync(join(scratch, ".forgeplan-web", "index.js"))) {
    fail("dist not copied to .forgeplan-web/index.js");
  }
  if (!existsSync(join(scratch, ".forgeplan-web", "node_modules"))) {
    fail(".forgeplan-web/node_modules missing");
  }

  const ENTRY_RE = /^[ \t]*\.forgeplan-web\/?[ \t]*$/gm;
  const gi1 = readFileSync(join(scratch, ".gitignore"), "utf8");
  const matches1 = gi1.match(ENTRY_RE) ?? [];
  if (matches1.length !== 1) {
    fail(
      `gitignore: expected 1 .forgeplan-web entry after first init, got ${matches1.length}`,
    );
  }
  if (!gi1.includes("# pre-existing user line")) {
    fail("gitignore: pre-existing user content was clobbered");
  }
  log(`gitignore: ${matches1.length} match (preserved user content)`);

  log("init -y --force (run 2 — must be idempotent)");
  const initR2 = spawnSync(process.execPath, [BIN, "init", "-y", "--force"], {
    cwd: scratch,
    env,
    stdio: "inherit",
  });
  if (initR2.status !== 0) fail(`init (run 2) exit ${initR2.status}`);

  const gi2 = readFileSync(join(scratch, ".gitignore"), "utf8");
  const matches2 = gi2.match(ENTRY_RE) ?? [];
  if (matches2.length !== 1) {
    fail(
      `gitignore: expected 1 .forgeplan-web entry after second init, got ${matches2.length} (idempotency broken)`,
    );
  }
  log(
    `gitignore: still ${matches2.length} match after second init (idempotent)`,
  );

  const port = pickPort();
  log(`start (PORT=${port})`);
  const server = spawn(process.execPath, [BIN, "start"], {
    cwd: scratch,
    env: { ...env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "inherit", "inherit"],
  });

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (!server.killed) server.kill(IS_WIN ? "SIGKILL" : "SIGTERM");
    // Windows: file handles inside .forgeplan-web/node_modules/ may linger
    // briefly after the server child receives the kill signal. Without
    // retries rmSync trips on EBUSY and the test reports failure even
    // though every assertion above passed. maxRetries / retryDelay are
    // Node-built-in (>= 14.14). force:true ignores ENOENT.
    rmSync(scratch, {
      recursive: true,
      force: true,
      maxRetries: IS_WIN ? 20 : 0,
      retryDelay: 100,
    });
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  const ready = await waitForListen(port);
  if (!ready) {
    cleanup();
    fail(`server did not respond on http://127.0.0.1:${port} within 15s`);
  }
  log("server is up");

  const health = await check(`http://127.0.0.1:${port}/api/health`).then((r) =>
    r.json(),
  );
  if (!health.ok) fail(`/api/health: ${JSON.stringify(health)}`);
  log(`/api/health: ok (project=${health.data?.project ?? "?"})`);

  const list = await check(`http://127.0.0.1:${port}/api/list`).then((r) =>
    r.json(),
  );
  if (!list.ok) fail(`/api/list: ${JSON.stringify(list)}`);
  log(`/api/list: ok (${(list.data ?? []).length} entries)`);

  const page = await check(`http://127.0.0.1:${port}/`);
  const text = await page.text();
  if (!text.includes("<!DOCTYPE html>") && !text.includes("<!doctype html>")) {
    fail("GET / did not return HTML");
  }
  log("GET /: ok (HTML returned)");

  cleanup();
  log("PASS");
}

main().catch((e) => fail(`unhandled: ${e?.stack ?? e}`));
