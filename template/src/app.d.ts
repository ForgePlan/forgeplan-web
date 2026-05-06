declare global {
  namespace App {}
  // PRD-012 / RFC-011: injected by Vite `define` from template/package.json#version.
  const __FORGEPLAN_WEB_VERSION__: string;
}

export {};
