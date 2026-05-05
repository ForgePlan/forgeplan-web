const FORGEPLAN = [
  "███████╗ ██████╗ ██████╗  ██████╗ ███████╗██████╗ ██╗      █████╗ ███╗   ██╗",
  "██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝██╔══██╗██║     ██╔══██╗████╗  ██║",
  "█████╗  ██║   ██║██████╔╝██║  ███╗█████╗  ██████╔╝██║     ███████║██╔██╗ ██║",
  "██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  ██╔═══╝ ██║     ██╔══██║██║╚██╗██║",
  "██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗██║     ███████╗██║  ██║██║ ╚████║",
  "╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝",
];

const WEB = [
  "██╗    ██╗███████╗██████╗ ",
  "██║    ██║██╔════╝██╔══██╗",
  "██║ █╗ ██║█████╗  ██████╔╝",
  "██║███╗██║██╔══╝  ██╔══██╗",
  "╚███╔███╔╝███████╗██████╔╝",
  " ╚══╝╚══╝ ╚══════╝╚═════╝ ",
];

const ORANGE_RGB = "\x1b[38;2;215;125;90m";
const RESET = "\x1b[0m";

function shouldUseColor(stream) {
  if ("NO_COLOR" in process.env) return false;
  if (process.env.TERM === "dumb") return false;
  return stream.isTTY === true;
}

export function printBanner({
  stream = process.stdout,
  quiet = false,
  color,
} = {}) {
  if (quiet) return;
  const useColor = color ?? shouldUseColor(stream);
  const o = useColor ? ORANGE_RGB : "";
  const r = useColor ? RESET : "";
  stream.write("\n");
  for (const line of FORGEPLAN) stream.write(`${o}${line}${r}\n`);
  stream.write("\n");
  for (const line of WEB) stream.write(`${o}${line}${r}\n`);
  stream.write("\n");
}

export const banners = { FORGEPLAN, WEB };
