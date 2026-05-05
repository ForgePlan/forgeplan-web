import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  // TODO(dev-only): `npm run dev:playground` (vite --mode playground)
  // points at the repo-local playground/ workspace. Plain `npm run dev`
  // leaves FORGEPLAN_CWD untouched — the server then falls back to the
  // repo root's .forgeplan/ via runForgeplan's default resolution.
  // `dist/` (shipped via init) never executes this file (rule 21).
  if (command === 'serve' && mode === 'playground' && !process.env.FORGEPLAN_CWD) {
    process.env.FORGEPLAN_CWD = resolve(__dirname, '..', 'playground');
  }

  return {
    plugins: [sveltekit()],
    build: {
      sourcemap: false
    },
    server: {
      port: 5174,
      strictPort: false,
      fs: {
        strict: false
      }
    }
  };
});
