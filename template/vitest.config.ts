import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
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
