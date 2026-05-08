import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { userScopePath, projectScopePath } from "./scope.mjs";

// TODO(109b-prompt): citty 0.2.2 does not export `prompt` or `consola`, and
// `consola` is not a transitive dep of citty in this lockfile (rule 23 — bin
// must stay zero third-party). Using node:readline/promises until citty bumps
// to a version that re-exports a prompt helper. RFC-021 §"Proposed Direction"
// references `import { prompt } from 'citty'` which does not exist yet.

const SCOPE_OPTIONS = ["user", "project"];

function isInteractiveTTY() {
  return Boolean(input.isTTY) && Boolean(output.isTTY);
}

export async function promptScope({ defaultChoice = "user" } = {}) {
  if (!isInteractiveTTY()) {
    const err = new Error(
      "no TTY detected; pass `--scope user|project` (or `-y` for project default).",
    );
    err.code = "ENOTTY";
    throw err;
  }
  if (!SCOPE_OPTIONS.includes(defaultChoice)) {
    defaultChoice = "user";
  }

  const userPath = userScopePath();
  const projPath = projectScopePath(process.cwd());
  const lines = [
    "Where to install the forgeplan-web scaffold?",
    `  1) user    — ${userPath}${defaultChoice === "user" ? "  (default)" : ""}`,
    `  2) project — ${projPath}${defaultChoice === "project" ? "  (default)" : ""}`,
    "",
  ];
  output.write(lines.join("\n"));

  const rl = createInterface({ input, output });
  try {
    const ans = (
      await rl.question(`scope [${defaultChoice}]: `)
    )
      .trim()
      .toLowerCase();
    if (ans === "") return defaultChoice;
    if (ans === "1" || ans === "u" || ans === "user") return "user";
    if (ans === "2" || ans === "p" || ans === "project") return "project";
    output.write(`invalid choice "${ans}"; using default "${defaultChoice}".\n`);
    return defaultChoice;
  } finally {
    rl.close();
  }
}

export async function promptConfirm({ message, defaultYes = true } = {}) {
  if (!isInteractiveTTY()) {
    const err = new Error("no TTY detected; cannot prompt for confirmation.");
    err.code = "ENOTTY";
    throw err;
  }
  const rl = createInterface({ input, output });
  const hint = defaultYes ? "Y/n" : "y/N";
  try {
    const ans = (await rl.question(`${message} [${hint}]: `)).trim().toLowerCase();
    if (ans === "") return defaultYes;
    return ans === "y" || ans === "yes";
  } finally {
    rl.close();
  }
}
