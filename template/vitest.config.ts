import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [svelte({ compilerOptions: { runes: true } })],
  test: {
    globals: false,
    // Threads pool — leaner than 'forks' (no child node processes,
    // worker threads share heap). Important on macOS where
    // kern.maxprocperuid caps simultaneous spawns and 'forks' (default)
    // hits EAGAIN with 7+ test files. Also no fork() == no
    // -node EAGAIN under load.
    pool: "threads",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.render.test.ts", "**/node_modules/**"],
        },
      },
      {
        // Component-render tests (SPEC-005 render surface): happy-dom +
        // Svelte's CLIENT runtime — the 'browser' resolve condition is what
        // makes `mount()` resolve to the client build instead of index-server.
        extends: true,
        resolve: { conditions: ["browser"] },
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/**/*.render.test.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@/app": r("./src/app"),
      "@/pages": r("./src/pages"),
      "@/widgets": r("./src/widgets"),
      "@/features": r("./src/features"),
      "@/entities": r("./src/entities"),
      "@/shared": r("./src/shared"),
    },
  },
});
