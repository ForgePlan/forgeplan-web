import { describe, it, expect } from "vitest";
import {
  riskScore,
  nodeAtRisk,
  weakestInformingEvid,
  decayFactor,
  glowRadiusPx,
  daysRemaining,
  DECAY_WINDOW_MS,
  RISK_THRESHOLD,
  GLOW_R_MIN,
  GLOW_R_MAX,
} from "./risk-score";

const NOW = new Date("2026-06-30T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function inDays(d: number): string {
  return new Date(NOW.getTime() + d * DAY).toISOString();
}

describe("decayFactor", () => {
  it("is 1 when there is no valid_until (no expiry data → full decay weight)", () => {
    expect(decayFactor(null, NOW)).toBe(1);
    expect(decayFactor(undefined, NOW)).toBe(1);
  });

  it("is 0 when ≥ 90 days remain", () => {
    expect(decayFactor(inDays(91), NOW)).toBe(0);
  });

  it("is exactly 0 at the 90-day boundary (remaining === DECAY_WINDOW)", () => {
    const at90 = new Date(NOW.getTime() + DECAY_WINDOW_MS).toISOString();
    expect(decayFactor(at90, NOW)).toBe(0);
  });

  it("is 1 when already expired", () => {
    expect(decayFactor(inDays(-1), NOW)).toBe(1);
  });

  it("is 1 exactly at expiry (remaining === 0)", () => {
    const atNow = NOW.toISOString();
    expect(decayFactor(atNow, NOW)).toBe(1);
  });

  it("interpolates linearly inside the window (45d left → 0.5)", () => {
    expect(decayFactor(inDays(45), NOW)).toBeCloseTo(0.5, 5);
  });

  it("treats an unparseable date as no-expiry (factor 1)", () => {
    expect(decayFactor("not-a-date", NOW)).toBe(1);
  });
});

describe("riskScore — six RFC-008 reference cases", () => {
  // Case 1: high r_eff, far from decay → no risk.
  it("r_eff 0.9, 120d left → 0", () => {
    expect(riskScore({ r_eff: 0.9, valid_until: inDays(120) }, NOW)).toBe(0);
  });

  // Case 2: degraded r_eff but plenty of validity → decay_factor 0 zeroes it.
  it("r_eff 0.3, 200d left → 0 (decay gate)", () => {
    expect(riskScore({ r_eff: 0.3, valid_until: inDays(200) }, NOW)).toBe(0);
  });

  // Case 3: degraded r_eff, no expiry → risk = (1 - r_eff).
  it("r_eff 0.4, no valid_until → 0.6", () => {
    expect(riskScore({ r_eff: 0.4, valid_until: null }, NOW)).toBeCloseTo(
      0.6,
      5,
    );
  });

  // Case 4: degraded r_eff, mid-window decay → multiplicative.
  it("r_eff 0.5, 45d left → 0.25", () => {
    expect(riskScore({ r_eff: 0.5, valid_until: inDays(45) }, NOW)).toBeCloseTo(
      0.25,
      5,
    );
  });

  // Case 5: degraded r_eff, expired → full (1 - r_eff).
  it("r_eff 0.2, expired → 0.8", () => {
    expect(riskScore({ r_eff: 0.2, valid_until: inDays(-5) }, NOW)).toBeCloseTo(
      0.8,
      5,
    );
  });

  // Case 6: perfect r_eff, expired → still 0 (no evidence gap).
  it("r_eff 1.0, expired → 0", () => {
    expect(riskScore({ r_eff: 1.0, valid_until: inDays(-5) }, NOW)).toBe(0);
  });
});

describe("riskScore — boundaries and defaults", () => {
  it("defaults missing r_eff to 1 → 0 risk", () => {
    expect(riskScore({ valid_until: inDays(-5) }, NOW)).toBe(0);
    expect(riskScore({}, NOW)).toBe(0);
  });

  it("treats NaN r_eff as 1 → 0 risk", () => {
    expect(riskScore({ r_eff: Number.NaN, valid_until: null }, NOW)).toBe(0);
  });

  it("clamps r_eff above 1 to 0 risk (negative reffPart clamped)", () => {
    expect(riskScore({ r_eff: 1.5, valid_until: null }, NOW)).toBe(0);
  });

  it("clamps negative r_eff so risk never exceeds 1", () => {
    expect(riskScore({ r_eff: -0.5, valid_until: null }, NOW)).toBe(1);
  });

  it("is exactly 0 at the 90-day decay boundary even with low r_eff", () => {
    const at90 = new Date(NOW.getTime() + DECAY_WINDOW_MS).toISOString();
    expect(riskScore({ r_eff: 0.1, valid_until: at90 }, NOW)).toBe(0);
  });

  it("is full (1 - r_eff) exactly at expiry (remaining === 0)", () => {
    expect(
      riskScore({ r_eff: 0.3, valid_until: NOW.toISOString() }, NOW),
    ).toBeCloseTo(0.7, 5);
  });
});

describe("glowRadiusPx", () => {
  it("maps 0 → GLOW_R_MIN", () => {
    expect(glowRadiusPx(0)).toBe(GLOW_R_MIN);
  });

  it("maps 1 → GLOW_R_MAX", () => {
    expect(glowRadiusPx(1)).toBe(GLOW_R_MAX);
  });

  it("maps 0.5 → midpoint (8)", () => {
    expect(glowRadiusPx(0.5)).toBe(8);
  });

  it("clamps out-of-range scores", () => {
    expect(glowRadiusPx(-1)).toBe(GLOW_R_MIN);
    expect(glowRadiusPx(2)).toBe(GLOW_R_MAX);
  });
});

describe("daysRemaining", () => {
  it("returns null when no valid_until", () => {
    expect(daysRemaining(null, NOW)).toBeNull();
    expect(daysRemaining(undefined, NOW)).toBeNull();
  });

  it("returns positive whole days for a future expiry", () => {
    expect(daysRemaining(inDays(10), NOW)).toBe(10);
  });

  it("returns negative once expired", () => {
    expect(daysRemaining(inDays(-3), NOW)).toBe(-3);
  });

  it("returns null for an unparseable date", () => {
    expect(daysRemaining("nope", NOW)).toBeNull();
  });
});

describe("RISK_THRESHOLD — PRD-009 FR-002/SC-2 r_eff gate", () => {
  it("is pinned to 0.6 (RFC-008 `RISK_THRESHOLD = 0.6`)", () => {
    expect(RISK_THRESHOLD).toBe(0.6);
  });
});

describe("nodeAtRisk — glow gate is R_eff < 0.6 (FR-002/SC-2)", () => {
  it("glows below the threshold", () => {
    expect(nodeAtRisk(0.59)).toBe(true);
    expect(nodeAtRisk(0.3)).toBe(true);
    expect(nodeAtRisk(0)).toBe(true);
  });

  it("does NOT glow at or above the threshold (the F19 regression fix)", () => {
    expect(nodeAtRisk(0.6)).toBe(false);
    expect(nodeAtRisk(0.61)).toBe(false);
    expect(nodeAtRisk(0.9)).toBe(false);
    expect(nodeAtRisk(1)).toBe(false);
  });

  it("treats missing / NaN r_eff as healthy (R_eff = 1 → no glow)", () => {
    expect(nodeAtRisk(undefined)).toBe(false);
    expect(nodeAtRisk(Number.NaN)).toBe(false);
  });

  it("does not light a healthy 0.6..1.0 node — the 7-of-289 glance goal", () => {
    const reffs = [0.62, 0.7, 0.75, 0.8, 0.85, 0.95, 1.0];
    expect(reffs.filter(nodeAtRisk)).toHaveLength(0);
  });
});

describe("weakestInformingEvid — FR-009 hover tooltip", () => {
  const edges = [
    { from: "EVID-001", to: "RFC-008", relation: "informs" },
    { from: "EVID-002", to: "RFC-008", relation: "informs" },
    { from: "PRD-009", to: "RFC-008", relation: "refines" }, // not informs
    { from: "EVID-003", to: "RFC-009", relation: "informs" }, // other node
  ];
  const scores = new Map([
    ["EVID-001", 0.8],
    ["EVID-002", 0.2],
    ["EVID-003", 0.1],
  ]);

  it("returns the lowest-R_eff informing EVID for the node", () => {
    expect(weakestInformingEvid("RFC-008", edges, scores)).toBe("EVID-002");
  });

  it("ignores non-informs edges and edges to other nodes", () => {
    // RFC-009 is only informed by EVID-003 (0.1); PRD-009 refines, not informs.
    expect(weakestInformingEvid("RFC-009", edges, scores)).toBe("EVID-003");
  });

  it("returns null when no informing EVID exists", () => {
    expect(weakestInformingEvid("PRD-009", edges, scores)).toBeNull();
    expect(weakestInformingEvid("RFC-008", [], scores)).toBeNull();
  });

  it("matches case-insensitive relation and EVIDENCE- prefix", () => {
    const e = [{ from: "EVIDENCE-010", to: "ADR-001", relation: "INFORMS" }];
    expect(
      weakestInformingEvid("ADR-001", e, new Map([["EVIDENCE-010", 0.5]])),
    ).toBe("EVIDENCE-010");
  });

  it("breaks ties by id order for determinism", () => {
    const e = [
      { from: "EVID-009", to: "X-1", relation: "informs" },
      { from: "EVID-004", to: "X-1", relation: "informs" },
    ];
    const s = new Map([
      ["EVID-009", 0.3],
      ["EVID-004", 0.3],
    ]);
    expect(weakestInformingEvid("X-1", e, s)).toBe("EVID-004");
  });

  it("treats an unscored EVID as Infinity (never weakest if a scored one exists)", () => {
    const e = [
      { from: "EVID-100", to: "Y-1", relation: "informs" }, // unscored
      { from: "EVID-101", to: "Y-1", relation: "informs" },
    ];
    const s = new Map([["EVID-101", 0.4]]);
    expect(weakestInformingEvid("Y-1", e, s)).toBe("EVID-101");
  });
});
