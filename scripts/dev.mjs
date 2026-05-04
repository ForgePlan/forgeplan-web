#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMPLATE = join(ROOT, 'template');
const IS_WIN = process.platform === 'win32';

function log(line) {
  process.stdout.write(`[dev] ${line}\n`);
}

function fail(line, code = 1) {
  process.stderr.write(`[dev] FAIL: ${line}\n`);
  process.exit(code);
}

if (!existsSync(join(ROOT, '.forgeplan'))) {
  fail('no .forgeplan/ in repo root — run `forgeplan init -y` first');
}

if (!existsSync(join(TEMPLATE, 'node_modules'))) {
  log('template/node_modules missing — running `npm install` in template/');
  const installCmd = IS_WIN ? 'npm.cmd' : 'npm';
  const r = spawnSync(installCmd, ['install'], { cwd: TEMPLATE, stdio: 'inherit' });
  if (r.status !== 0) fail('template install failed');
}

const env = {
  ...process.env,
  FORGEPLAN_CWD: process.env.FORGEPLAN_CWD ?? ROOT,
  FORGEPLAN_BIN: process.env.FORGEPLAN_BIN ?? 'forgeplan',
};

log(`FORGEPLAN_CWD=${env.FORGEPLAN_CWD}`);
log(`FORGEPLAN_BIN=${env.FORGEPLAN_BIN}`);
log('starting vite dev on http://127.0.0.1:5174 …');

const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['run', 'dev'], {
  cwd: TEMPLATE,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
