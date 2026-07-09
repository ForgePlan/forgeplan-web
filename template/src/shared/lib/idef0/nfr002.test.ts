import { describe, it, expect } from "vitest";
import { deriveIdef0 } from "./index";
import type { RawSnapshot } from "./types";

// NFR-002 (RFC-028): the deterministic pipeline must complete within the
// interactive frame budget (≤ 50 ms) at N ≥ 1000. The pipeline runs in a
// reactive effect between 10 s polls, not on scroll — so this is generous
// headroom, not an animation-frame constraint.
function bigSnapshot(n: number): RawSnapshot {
  const kinds = ["epic", "prd", "spec", "rfc", "adr", "evidence"];
  const nodes: NonNullable<RawSnapshot["nodes"]> = [];
  const edges: NonNullable<RawSnapshot["edges"]> = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ id: `N${i}`, title: `t${i}`, kind: kinds[i % kinds.length] });
    if (i > 0 && i % 3 === 0) {
      edges.push({ from: `N${i}`, to: `N${i - 3}`, relation: "refines" });
    }
    if (i % 2 === 0)
      edges.push({ from: `N${i}`, to: "N0", relation: "informs" });
  }
  return { nodes, edges };
}

describe("NFR-002 frame budget", () => {
  it("deriveIdef0 at N=1000 completes well under the 50ms budget", () => {
    const raw = bigSnapshot(1000);
    const opts = { threshold: 0.3, window: { offset: 0, limit: 50 } };
    deriveIdef0(raw, opts); // warm
    const RUNS = 20;
    const t0 = performance.now();
    for (let r = 0; r < RUNS; r++) deriveIdef0(raw, opts);
    const avg = (performance.now() - t0) / RUNS;
    // eslint-disable-next-line no-console -- measurement surfaced for the NFR-002 EVID
    console.log(
      `NFR-002 measured: ${avg.toFixed(2)}ms avg over ${RUNS} runs at N=1000`,
    );
    expect(avg).toBeLessThan(50);
  });
});
