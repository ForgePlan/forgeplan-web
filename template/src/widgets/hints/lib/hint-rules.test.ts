import { describe, it, expect } from "vitest";
import {
  HINT_RULES,
  STALE_SPIKE_DELTA,
  LOW_R_EFF_THRESHOLD,
  BLIND_SPOT_MIN,
  ORPHAN_MIN,
  VELOCITY_DROP_FACTOR,
} from "./hint-rules";
import type { HintInput, HintRule } from "./types";
import type { HealthResponse } from "@/entities/health";
import type { WeekVelocity } from "@/widgets/stats-pulse/lib/pulse-stats";

const NOW = new Date("2026-06-30T12:00:00Z");

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

function rule(id: string): HintRule {
  const r = HINT_RULES.find((x) => x.id === id);
  if (!r) throw new Error(`rule ${id} not found`);
  return r;
}

function week(net: number): WeekVelocity {
  return {
    week: "2026-06-22",
    weekStartMs: 0,
    activated: 0,
    deprecated: 0,
    draftsAdded: 0,
    net,
  };
}

describe("HINT_RULES registry", () => {
  it("ships exactly 8 rules with unique stable ids", () => {
    expect(HINT_RULES).toHaveLength(8);
    const ids = HINT_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("stale-spike", () => {
  const r = rule("stale-spike");
  it("fires when stale_count jumps by >= STALE_SPIKE_DELTA", () => {
    const input = baseInput({
      prevStaleCount: 1,
      health: {
        ...emptyHealth(),
        stale_count: 1 + STALE_SPIKE_DELTA,
        stale_drafts: [{ id: "PRD-001" }, { id: "RFC-002" }],
      },
    });
    const m = r.match(input);
    expect(m).not.toBeNull();
    expect(m!.affectedIds).toEqual(["PRD-001", "RFC-002"]);
    expect(r.copy(input, m!)).toContain("PRD-001");
  });
  it("does not fire below the delta", () => {
    const input = baseInput({
      prevStaleCount: 2,
      health: { ...emptyHealth(), stale_count: 2 + STALE_SPIKE_DELTA - 1 },
    });
    expect(r.match(input)).toBeNull();
  });
  it("boundary: exactly the delta fires", () => {
    const input = baseInput({
      prevStaleCount: 0,
      health: { ...emptyHealth(), stale_count: STALE_SPIKE_DELTA },
    });
    expect(r.match(input)).not.toBeNull();
  });
});

describe("low-r-eff-critical", () => {
  const r = rule("low-r-eff-critical");
  it("fires for an active artifact below threshold", () => {
    const input = baseInput({
      scores: [{ id: "PRD-001", r_eff: 0.1 }],
      statusById: new Map([["PRD-001", "active"]]),
    });
    const m = r.match(input);
    expect(m).not.toBeNull();
    expect(m!.affectedIds).toEqual(["PRD-001"]);
  });
  it("does not fire for a non-active low score", () => {
    const input = baseInput({
      scores: [{ id: "PRD-001", r_eff: 0.1 }],
      statusById: new Map([["PRD-001", "draft"]]),
    });
    expect(r.match(input)).toBeNull();
  });
  it("boundary: r_eff exactly at threshold does not fire", () => {
    const input = baseInput({
      scores: [{ id: "PRD-001", r_eff: LOW_R_EFF_THRESHOLD }],
      statusById: new Map([["PRD-001", "active"]]),
    });
    expect(r.match(input)).toBeNull();
  });
  it("copy uses plain language, never leaks R_eff jargon (B5/FR-009)", () => {
    const input = baseInput({
      scores: [{ id: "PRD-001", r_eff: 0.1 }],
      statusById: new Map([["PRD-001", "active"]]),
    });
    const text = r.copy(input, r.match(input)!);
    expect(text).not.toMatch(/r_eff/i);
  });
});

describe("valid-until-imminent (degraded → at_risk)", () => {
  const r = rule("valid-until-imminent");
  it("fires from health.at_risk", () => {
    const input = baseInput({
      health: { ...emptyHealth(), at_risk: [{ id: "RFC-003" }] },
    });
    const m = r.match(input);
    expect(m).not.toBeNull();
    expect(m!.affectedIds).toEqual(["RFC-003"]);
    expect(r.copy(input, m!)).toContain("1");
  });
  it("does not fire with no at-risk artifacts", () => {
    expect(r.match(baseInput())).toBeNull();
  });
});

describe("blind-spot-new", () => {
  const r = rule("blind-spot-new");
  it("fires at >= BLIND_SPOT_MIN blind spots", () => {
    const input = baseInput({
      health: {
        ...emptyHealth(),
        blind_spots: [{ id: "PRD-001" }, { id: "PRD-002" }],
      },
    });
    expect(r.match(input)).not.toBeNull();
  });
  it("does not fire below the minimum", () => {
    const input = baseInput({
      health: { ...emptyHealth(), blind_spots: [{ id: "PRD-001" }] },
    });
    expect(BLIND_SPOT_MIN).toBe(2);
    expect(r.match(input)).toBeNull();
  });
});

describe("orphan-detected", () => {
  const r = rule("orphan-detected");
  it("fires at >= ORPHAN_MIN orphans", () => {
    const input = baseInput({
      health: { ...emptyHealth(), orphans: ["NOTE-009"] },
    });
    expect(ORPHAN_MIN).toBe(1);
    const m = r.match(input);
    expect(m).not.toBeNull();
    expect(m!.affectedIds).toEqual(["NOTE-009"]);
  });
  it("does not fire with no orphans", () => {
    expect(r.match(baseInput())).toBeNull();
  });
});

describe("draft-too-old (degraded → stale_drafts)", () => {
  const r = rule("draft-too-old");
  it("fires from health.stale_drafts", () => {
    const input = baseInput({
      health: {
        ...emptyHealth(),
        stale_drafts: [{ id: "RFC-007", age_hours: 900 }],
      },
    });
    const m = r.match(input);
    expect(m).not.toBeNull();
    expect(r.copy(input, m!)).toContain("RFC-007");
  });
  it("does not fire with no stale drafts", () => {
    expect(r.match(baseInput())).toBeNull();
  });
});

describe("velocity-drop", () => {
  const r = rule("velocity-drop");
  it("fires when last week net collapses below the factor of prev", () => {
    const input = baseInput({
      velocityWeekly: [week(10), week(2)], // 2 < 10*0.4=4
    });
    const m = r.match(input);
    expect(m).not.toBeNull();
    expect(m!.data?.pct).toBe(80);
  });
  it("does not fire when last week holds above the factor", () => {
    const input = baseInput({
      velocityWeekly: [week(10), week(5)], // 5 >= 4
    });
    expect(r.match(input)).toBeNull();
  });
  it("does not fire when prev week net is zero (div guard)", () => {
    const input = baseInput({ velocityWeekly: [week(0), week(0)] });
    expect(VELOCITY_DROP_FACTOR).toBe(0.4);
    expect(r.match(input)).toBeNull();
  });
  it("does not fire with fewer than two weeks", () => {
    expect(r.match(baseInput({ velocityWeekly: [week(10)] }))).toBeNull();
  });
});

describe("cycle-detected", () => {
  const r = rule("cycle-detected");
  it("fires from blocked.cycles and renders a chain", () => {
    const input = baseInput({ cycles: [["PRD-001", "RFC-002"]] });
    const m = r.match(input);
    expect(m).not.toBeNull();
    expect(m!.affectedIds).toEqual(["PRD-001", "RFC-002"]);
    const text = r.copy(input, m!);
    expect(text).toContain("PRD-001 → RFC-002 → PRD-001");
  });
  it("does not fire with no cycles", () => {
    expect(r.match(baseInput())).toBeNull();
  });
});
