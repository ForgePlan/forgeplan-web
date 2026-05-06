import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [svelte({ compilerOptions: { runes: true } })],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    // Threads pool — leaner than 'forks' (no child node processes,
    // worker threads share heap). Important on macOS where
    // kern.maxprocperuid caps simultaneous spawns and 'forks' (default)
    // hits EAGAIN with 7+ test files. Also no fork() == no
    // -node EAGAIN under load.
    pool: "threads",
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
