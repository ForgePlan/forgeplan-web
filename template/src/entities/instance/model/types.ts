// SPEC-003 v1 — client-side mirror of `Instance` from `template/src/shared/server/registry.ts`.
// TODO(spec-003-keep-in-sync): when the registry schema bumps (`version: 2+`), update this
// interface and bump the importer call sites. Server is the source of truth; this copy
// exists so client code (`entities/instance/`) does not pull `node:fs`/`node:os` via the
// `@/shared/server` barrel — keeps the SSR/client boundary clean.

export type InstanceScope = "user" | "project";

export interface Instance {
  id: string;
  host: string;
  port: number;
  pid: number;
  scope: InstanceScope;
  workspaceRoot: string;
  projectName: string;
  startedAt: string;
  heartbeatAt: string;
  webVersion: string;
  forgeplanCli: string | null;
}

export interface InstancesPayload {
  instances: Instance[];
}
