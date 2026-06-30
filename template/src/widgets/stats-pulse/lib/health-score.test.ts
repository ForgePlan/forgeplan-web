import { describe, it, expect } from "vitest";
import {
  computeHealthScore,
  healthBand,
  rEffHealthComponent,
  activationRatioComponent,
  evidenceFreshnessComponent,
  blindSpotComponent,
  velocityComponent,
  HEALTH_WEIGHTS,
  type HealthScoreInput,
} from "./health-score";
import type { ScoreEntry } from "@/entities/score";
import type { ActivityEntry } from "@/entities/activity";

const score = (id: string, r_eff: number): ScoreEntry => ({ id, r_eff });
const activate = (ts: string): ActivityEntry => ({
  action: "update",
  artifact_id: "PRD-001",
  field: "status",
  new_value: "active",
  old_value: "draft",
  source: "cli",
  timestamp: ts,
});

describe("health weights", () => {
  it("sum to exactly 1", () => {
    const sum = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("individual components clamp to [0,1]", () => {
  it("rEffHealth uses the median, immune to a single outlier", () => {
    const base = [score("a", 0.4), score("b", 0.4), score("c", 0.4)];
    const withOutlier = [...base, score("d", 1.0)];
    // median of [.4 .4 .4] = .4 ; median of [.4 .4 .4 1] = .4 too.
    expect(rEffHealthComponent(base)).toBeCloseTo(0.4);
    expect(rEffHealthComponent(withOutlier)).toBeCloseTo(0.4);
  });
  it("activationRatio handles empty workspace", () => {
    expect(activationRatioComponent(0, 0)).toBe(0);
    expect(activationRatioComponent(5, 10)).toBe(0.5);
  });
  it("evidenceFreshness = scored/total", () => {
    expect(evidenceFreshnessComponent(30, 60)).toBe(0.5);
    expect(evidenceFreshnessComponent(0, 0)).toBe(0);
  });
  it("blindSpot freedom inverts the ratio", () => {
    expect(blindSpotComponent(0, 10)).toBe(1);
    expect(blindSpotComponent(2, 10)).toBe(0.8);
    expect(blindSpotComponent(0, 0)).toBe(1);
  });
  it("velocity saturates and floors at zero", () => {
    expect(velocityComponent([])).toBe(0);
    expect(velocityComponent([activate("2026-06-01T00:00:00Z")])).toBeCloseTo(
      0.2, // net 1 / saturation 5
    );
  });
});

describe("computeHealthScore — determinism (FR-009)", () => {
  const input: HealthScoreInput = {
    scores: [score("a", 0.8), score("b", 0.6), score("c", 1.0)],
    activeCount: 8,
    totalCount: 10,
    blindSpotCount: 1,
    log: [activate("2026-06-01T00:00:00Z"), activate("2026-06-02T00:00:00Z")],
  };

  it("is referentially transparent — same input, same integer", () => {
    const a = computeHealthScore(input);
    const b = computeHealthScore(structuredClone(input));
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });

  it("matches the hand-computed weighted formula", () => {
    // median r_eff = 0.8 → 0.8 * .30 = .240
    // activation 8/10 = 0.8 → 0.8 * .20 = .160
    // evidence 3/10 = 0.3 → 0.3 * .20 = .060
    // blindspot 1-(1/10)=0.9 → 0.9 * .15 = .135
    // velocity: both activations same week → net 2 → 2/5=0.4 → 0.4 * .15 = .060
    // Σ = .655 → round(65.5) = 66
    expect(computeHealthScore(input).score).toBe(66);
  });

  it("exposes all five components for the breakdown tooltip (FR-010)", () => {
    const { components } = computeHealthScore(input);
    expect(components.map((c) => c.key).sort()).toEqual(
      [
        "activationRatio",
        "blindSpotScore",
        "evidenceFreshness",
        "rEffHealth",
        "velocityScore",
      ].sort(),
    );
  });

  it("gaming-resistance: adding one perfect-score artifact barely moves the score", () => {
    const gamed: HealthScoreInput = {
      ...input,
      scores: [...input.scores, score("z", 1.0)],
    };
    const delta = Math.abs(
      computeHealthScore(gamed).score - computeHealthScore(input).score,
    );
    // median + coverage shifts are bounded; nothing like the swing a mean
    // would give. Assert it stays small.
    expect(delta).toBeLessThanOrEqual(5);
  });
});

describe("healthBand thresholds", () => {
  it("80+ good, 60-79 warn, <60 bad", () => {
    expect(healthBand(80)).toBe("good");
    expect(healthBand(100)).toBe("good");
    expect(healthBand(79)).toBe("warn");
    expect(healthBand(60)).toBe("warn");
    expect(healthBand(59)).toBe("bad");
    expect(healthBand(0)).toBe("bad");
  });
});
