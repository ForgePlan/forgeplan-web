import { describe, it, expect } from "vitest";
import {
  scoreSignature,
  logSignature,
  statsSignature,
  makeSignatureMemo,
} from "./memo";
import type { ScoreEntry } from "@/entities/score";
import type { ActivityEntry } from "@/entities/activity";

const score = (id: string, r_eff: number): ScoreEntry => ({ id, r_eff });
const entry = (p: Partial<ActivityEntry>): ActivityEntry => ({
  action: "update",
  artifact_id: "PRD-001",
  field: "status",
  new_value: "active",
  old_value: "draft",
  source: "cli",
  timestamp: "2026-06-01T00:00:00Z",
  ...p,
});

describe("scoreSignature", () => {
  it("is identical for equal content in different array instances", () => {
    expect(scoreSignature([score("a", 0.5)])).toBe(
      scoreSignature([score("a", 0.5)]),
    );
  });
  it("changes when r_eff changes", () => {
    expect(scoreSignature([score("a", 0.5)])).not.toBe(
      scoreSignature([score("a", 0.6)]),
    );
  });
});

describe("logSignature", () => {
  it("ignores non-semantic fields like source / artifact_id-only churn", () => {
    const a = logSignature([entry({ source: "cli" })]);
    const b = logSignature([entry({ source: "mcp" })]);
    expect(a).toBe(b);
  });
  it("reflects a status-value change", () => {
    expect(logSignature([entry({ new_value: "active" })])).not.toBe(
      logSignature([entry({ new_value: "deprecated" })]),
    );
  });
});

describe("statsSignature", () => {
  it("busts when the active count changes", () => {
    const base = {
      scores: [score("a", 0.5)],
      log: [entry({})],
      total: 10,
      activeCount: 5,
      blindSpotCount: 1,
      decayTotal: 0,
    };
    expect(statsSignature(base)).not.toBe(
      statsSignature({ ...base, activeCount: 6 }),
    );
  });
});

describe("makeSignatureMemo", () => {
  it("recomputes only when the signature changes", () => {
    const memo = makeSignatureMemo<number>();
    let calls = 0;
    const produce = () => {
      calls += 1;
      return calls;
    };
    expect(memo("sig-1", produce)).toBe(1);
    expect(memo("sig-1", produce)).toBe(1); // cached
    expect(calls).toBe(1);
    expect(memo("sig-2", produce)).toBe(2); // busted
    expect(calls).toBe(2);
  });
});
