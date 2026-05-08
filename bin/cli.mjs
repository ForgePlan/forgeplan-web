import { defineCommand } from "citty";
import { readPkgVersion } from "./lib/config.mjs";

export default defineCommand({
  meta: {
    name: "forgeplan-web",
    version: readPkgVersion() ?? "0.0.0",
    description:
      "Interactive realtime web map for a Forgeplan workspace. Ships a pre-built SvelteKit app — no npm install at user side.",
  },
  subCommands: {
    init: () => import("./commands/init.mjs").then((m) => m.default),
    update: () => import("./commands/update.mjs").then((m) => m.default),
    start: () => import("./commands/start.mjs").then((m) => m.default),
  },
});
