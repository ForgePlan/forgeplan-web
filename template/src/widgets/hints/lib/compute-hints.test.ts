import { describe, it, expect } from "vitest";
import { computeHints, rankHints, pruneSnoozed } from "./compute-hints";
import type { Hint, HintInput } from "./types";
import type { HealthResponse } from "@/entities/health";
import type { ScoreEntry } from "@/entities/score";
import type { ArtifactStatus } from "@/entities/artifact";

const NOW = new Date("2026-06-30T12:00:00Z");
const NOW_MS = NOW.getTime();

function emptyHealth(): HealthResponse {
  return {
    total: 0,
    by_kind: [],
    by_status: [],
    by_derived_status: [],
    blind_spots: [],
    orphans: [],
    active_stubs: [],
    stale_count: 0,
    at_risk: [],
    stale_drafts: [],
    next_actions: [],
    project: "test",
  };
}

function baseInput(overrides: Partial<HintInput> = {}): HintInput {
  return {
    artifacts: [],
    statusById: new Map(),
    kindById: new Map(),
    titleById: new Map(),
    edges: [],
    health: emptyHealth(),
    scores: [],
    cycles: [],
    velocityWeekly: [],
    prevStaleCount: 0,
    now: NOW,
    ...overrides,
  };
}

/**
 * Input that triggers several rules at once across all three severities:
 *  - cycle-detected (critical), low-r-eff-critical (critical)
 *  - blind-spot-new (warning)
 *  - orphan-detected (tip)
 */
function multiSignalInput(): HintInput {
  const scores: ScoreEntry[] = [{ id: "PRD-100", r_eff: 0.1 }];
  const statusById = new Map<string, ArtifactStatus>([["PRD-100", "active"]]);
  return baseInput({
    scores,
    statusById,
    cycles: [["RFC-200", "ADR-201"]],
    health: {
      ...emptyHealth(),
      blind_spots: [{ id: "PRD-300" }, { id: "PRD-301" }],
      orphans: ["NOTE-400", "NOTE-401"],
    },
  });
}

describe("rankHints", () => {
  it("orders critical > warning > tip", () => {
    const hints: Hint[] = [
      { id: "tip-a", severity: "tip", text: "", priority: 5 },
      { id: "crit-a", severity: "critical", text: "", priority: 1 },
      { id: "warn-a", severity: "warning", text: "", priority: 3 },
    ];
    expect(rankHints(hints).map((h) => h.id)).toEqual([
      "crit-a",
      "warn-a",
      "tip-a",
    ]);
  });

  it("same severity → stable priority asc, then id asc", () => {
    const hints: Hint[] = [
      { id: "b", severity: "warning", text: "", priority: 2 },
      { id: "a", severity: "warning", text: "", priority: 2 },
      { id: "z", severity: "warning", text: "", priority: 1 },
    ];
    expect(rankHints(hints).map((h) => h.id)).toEqual(["z", "a", "b"]);
  });
});

describe("computeHints — ranking & severity", () => {
  it("ranks critical hints ahead of warning/tip", () => {
    const out = computeHints(multiSignalInput());
    expect(out.length).toBeGreaterThanOrEqual(4);
    expect(out[0]!.severity).toBe("critical");
    const sevSeq = out.map((h) => h.severity);
    const lastCritical = sevSeq.lastIndexOf("critical");
    const firstTip = sevSeq.indexOf("tip");
    if (firstTip !== -1) expect(lastCritical).toBeLessThan(firstTip);
  });
});

describe("computeHints — dedupe (first-rule-wins, RFC R-2)", () => {
  it("keeps only the earliest rule when affectedIds[0] collides", () => {
    // stale-spike (priority 0) and draft-too-old (priority 5) both surface
    // the same stale draft id. Only stale-spike should survive.
    const input = baseInput({
      prevStaleCount: 0,
      health: {
        ...emptyHealth(),
        stale_count: 5,
        stale_drafts: [{ id: "RFC-007" }],
      },
    });
    const out = computeHints(input);
    const ids = out.map((h) => h.id);
    expect(ids).toContain("stale-spike");
    expect(ids).not.toContain("draft-too-old");
  });
});

describe("computeHints — snooze TTL filter (FR-008)", () => {
  it("hides a hint whose snooze has not expired", () => {
    const input = multiSignalInput();
    const snoozed = { "cycle-detected": NOW_MS + 60_000 };
    const out = computeHints(input, { snoozed, now: NOW });
    expect(out.map((h) => h.id)).not.toContain("cycle-detected");
  });

  it("resurfaces a hint once its snooze TTL has expired", () => {
    const input = multiSignalInput();
    const snoozed = { "cycle-detected": NOW_MS - 1 };
    const out = computeHints(input, { snoozed, now: NOW });
    expect(out.map((h) => h.id)).toContain("cycle-detected");
  });
});

describe("computeHints — determinism (NFR-003)", () => {
  it("same input twice → identical output", () => {
    const a = computeHints(multiSignalInput());
    const b = computeHints(multiSignalInput());
    expect(a).toEqual(b);
  });
});

describe("pruneSnoozed (auto-cleanup)", () => {
  it("drops expired entries, keeps live ones", () => {
    const out = pruneSnoozed(
      { live: NOW_MS + 1000, dead: NOW_MS - 1000, exact: NOW_MS },
      NOW_MS,
    );
    expect(out).toEqual({ live: NOW_MS + 1000 });
  });
});

describe("computeHints — NFR-001 timing (N=300)", () => {
  it("computes in well under 30ms for 300 artifacts", () => {
    const scores: ScoreEntry[] = [];
    const statusById = new Map<string, ArtifactStatus>();
    for (let i = 0; i < 300; i++) {
      const id = `PRD-${i}`;
      scores.push({ id, r_eff: i % 4 === 0 ? 0.1 : 0.8 });
      statusById.set(id, "active");
    }
    const input = baseInput({
      scores,
      statusById,
      health: {
        ...emptyHealth(),
        blind_spots: Array.from({ length: 20 }, (_, i) => ({ id: `B-${i}` })),
        orphans: Array.from({ length: 20 }, (_, i) => `O-${i}`),
      },
    });
    const start = performance.now();
    for (let i = 0; i < 50; i++) computeHints(input);
    const perRun = (performance.now() - start) / 50;
    expect(perRun).toBeLessThan(30);
  });
});
