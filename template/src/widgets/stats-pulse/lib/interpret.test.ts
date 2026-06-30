import { describe, it, expect } from "vitest";
import {
  interpretHistogram,
  interpretDecay,
  interpretVelocity,
  interpretTransitions,
  interpretHealthScore,
} from "./interpret";
import { reffHistogram } from "./pulse-stats";
import type { ScoreEntry } from "@/entities/score";
import type { HealthScore } from "./health-score";

const score = (id: string, r_eff: number): ScoreEntry => ({ id, r_eff });

describe("interpretHistogram", () => {
  it("empty → warn with explicit copy", () => {
    const r = interpretHistogram(reffHistogram([]));
    expect(r.tone).toBe("warn");
    expect(r.copy).toMatch(/no evidenced artifacts/i);
  });
  it("mostly-strong → good", () => {
    const r = interpretHistogram(
      reffHistogram([score("a", 0.9), score("b", 0.8), score("c", 0.75)]),
    );
    expect(r.tone).toBe("good");
    expect(r.copy).toContain("strong evidence");
  });
  it("mostly-weak → bad", () => {
    const r = interpretHistogram(
      reffHistogram([score("a", 0.1), score("b", 0.2), score("c", 0.9)]),
    );
    expect(r.tone).toBe("bad");
    expect(r.copy).toMatch(/weak proof/);
  });
  it("each tone carries a distinct shape icon (colourblind safety)", () => {
    const good = interpretHistogram(reffHistogram([score("a", 0.9)]));
    const bad = interpretHistogram(
      reffHistogram([score("a", 0.1), score("b", 0.1)]),
    );
    expect(good.icon).not.toBe(bad.icon);
  });
});

describe("interpretDecay", () => {
  it("nothing decaying → good", () => {
    const r = interpretDecay({ atRisk: 0, stale: 0, staleDrafts: 0, total: 0 });
    expect(r.tone).toBe("good");
    expect(r.copy).toMatch(/nothing is stale/i);
  });
  it("stale or at-risk → bad with count", () => {
    const r = interpretDecay({ atRisk: 2, stale: 1, staleDrafts: 3, total: 6 });
    expect(r.tone).toBe("bad");
    expect(r.copy).toContain("3");
  });
  it("only stale drafts → warn", () => {
    const r = interpretDecay({ atRisk: 0, stale: 0, staleDrafts: 4, total: 4 });
    expect(r.tone).toBe("warn");
    expect(r.copy).toContain("4");
  });
});

describe("interpretVelocity", () => {
  const wk = (net: number) => ({
    week: "2026-06-01",
    weekStartMs: 0,
    activated: 0,
    deprecated: 0,
    draftsAdded: 0,
    net,
  });
  it("no weeks → warn", () => {
    expect(interpretVelocity([]).tone).toBe("warn");
  });
  it("positive recent net → good", () => {
    const r = interpretVelocity([wk(0), wk(3)]);
    expect(r.tone).toBe("good");
    expect(r.copy).toContain("+3");
  });
  it("negative recent net → bad", () => {
    expect(interpretVelocity([wk(-2)]).tone).toBe("bad");
  });
  it("flat week → warn", () => {
    expect(interpretVelocity([wk(0)]).tone).toBe("warn");
  });
});

describe("interpretTransitions", () => {
  it("no transitions → warn", () => {
    expect(interpretTransitions([]).tone).toBe("warn");
  });
  it("activations dominate → good", () => {
    const r = interpretTransitions([
      { from: "draft", to: "active", count: 5 },
      { from: "active", to: "deprecated", count: 1 },
    ]);
    expect(r.tone).toBe("good");
  });
  it("retirements with zero activation → bad", () => {
    const r = interpretTransitions([
      { from: "active", to: "deprecated", count: 3 },
    ]);
    expect(r.tone).toBe("bad");
    expect(r.copy).toMatch(/shrinking/);
  });
});

describe("interpretHealthScore", () => {
  const mk = (s: number): HealthScore => ({ score: s, components: [] });
  it("80+ → good", () => {
    expect(interpretHealthScore(mk(85)).tone).toBe("good");
  });
  it("60-79 → warn", () => {
    expect(interpretHealthScore(mk(70)).tone).toBe("warn");
  });
  it("<60 → bad", () => {
    expect(interpretHealthScore(mk(40)).tone).toBe("bad");
  });
  it("embeds the numeric score in copy", () => {
    expect(interpretHealthScore(mk(85)).copy).toContain("85");
  });
});
