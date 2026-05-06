import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { spawn } from "node:child_process";
import { workspaceRoot } from "@/shared/server";

const ARTIFACT_RE = /([A-Z]+-\d+)/;
const GIT_TIMEOUT_MS = 10_000;
const RECORD_SEPARATOR = "\x1e";
const FIELD_SEPARATOR = "\x1f";

interface RawCommit {
  sha: string;
  isoDate: string;
  subject: string;
}

function spawnGitLog(): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolveResult) => {
    const child = spawn(
      "git",
      [
        "log",
        "--first-parent",
        `--format=%H${FIELD_SEPARATOR}%cI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`,
        "--",
        ".forgeplan/",
      ],
      {
        cwd: workspaceRoot(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolveResult({
        ok: false,
        stdout,
        stderr: `timeout after ${GIT_TIMEOUT_MS}ms`,
      });
    }, GIT_TIMEOUT_MS);
    child.stdout.on("data", (c) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolveResult({ ok: false, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolveResult({ ok: code === 0, stdout, stderr });
    });
  });
}

function parseLog(raw: string): RawCommit[] {
  const out: RawCommit[] = [];
  const records = raw.split(RECORD_SEPARATOR);
  for (const rec of records) {
    const trimmed = rec.replace(/^\n+/, "");
    if (!trimmed) continue;
    const fields = trimmed.split(FIELD_SEPARATOR);
    if (fields.length < 3) continue;
    out.push({
      sha: fields[0]!,
      isoDate: fields[1]!,
      subject: fields[2]!,
    });
  }
  return out;
}

function classifyCommit(
  subject: string,
): "activated" | "superseded" | "scored" | "created" {
  // FIXME(commit-classifier): heuristic over commit subjects — fragile if
  // commit conventions change. A future pass should derive this from
  // `forgeplan log --json` once that table durably tracks transitions.
  const s = subject.toLowerCase();
  if (s.includes("activate")) return "activated";
  if (s.includes("supersede") || s.includes("deprecate")) return "superseded";
  if (s.includes("evid-") || s.includes("score")) return "scored";
  return "created";
}

export const GET: RequestHandler = async () => {
  const r = await spawnGitLog();
  if (!r.ok) {
    return json(
      { ok: false, error: r.stderr || "git log failed", events: [] },
      { status: 502 },
    );
  }

  const commits = parseLog(r.stdout);
  const events = commits.map((c) => {
    const m = c.subject.match(ARTIFACT_RE);
    return {
      at: c.isoDate,
      kind: classifyCommit(c.subject),
      artifactId: m ? m[1]! : "(repo)",
      sha: c.sha,
      subject: c.subject,
    };
  });

  return json({ ok: true, events, count: events.length });
};
