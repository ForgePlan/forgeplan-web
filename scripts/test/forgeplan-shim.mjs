#!/usr/bin/env node
// Minimal forgeplan stub for CI smoke tests. Supports just enough subcommands
// for `bin/forgeplan-web.mjs init` and `start` to exercise the SvelteKit
// server's /api/* endpoints end-to-end without depending on the real
// forgeplan binary being installable on the runner.

const args = process.argv.slice(2);

if (args.includes('--version') || args[0] === '--version') {
  process.stdout.write('forgeplan 0.0.0-shim\n');
  process.exit(0);
}

const sub = args[0];

const stubs = {
  health: {
    project: 'shim',
    total: 0,
    by_kind: [],
    by_status: [],
    by_derived_status: [],
    orphans: [],
    blind_spots: [],
    at_risk: [],
    active_stubs: [],
    stale_count: 0,
    next_actions: [],
    possible_duplicates: [],
    _next_action: null,
  },
  list: [],
  graph: { nodes: [], edges: [] },
  order: [],
  blocked: [],
  claims: [],
  stale: [],
  log: [],
  score: [],
  tree: { roots: [] },
  blindspots: [],
  journal: [],
  init: { ok: true },
};

if (sub in stubs) {
  process.stdout.write(JSON.stringify(stubs[sub]) + '\n');
  process.exit(0);
}

if (sub === 'get') {
  process.stdout.write(JSON.stringify({ id: args[1] ?? null, body: '' }) + '\n');
  process.exit(0);
}

process.stdout.write(JSON.stringify({}) + '\n');
process.exit(0);
