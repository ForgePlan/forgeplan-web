import { describe, expect, it } from "vitest";
import {
  addLeaf,
  changeView,
  clampSplit,
  countLeaves,
  emptyLayout,
  findLeaf,
  isValidLayout,
  leaves,
  removeLeaf,
  setSplitSize,
  singletonLayout,
  swapViews,
} from "./tree";
import type { Layout, Split } from "./types";

describe("singletonLayout", () => {
  it("creates a single leaf with view", () => {
    const l = singletonLayout("force");
    expect(l.root?.kind).toBe("leaf");
    if (l.root?.kind === "leaf") expect(l.root.view).toBe("force");
    expect(l.nextId).toBe(2);
  });
});

describe("countLeaves", () => {
  it("returns 0 for empty layout", () => {
    expect(countLeaves(emptyLayout().root)).toBe(0);
  });
  it("counts nested leaves", () => {
    const l = addLeaf(addLeaf(singletonLayout("force"), "tree"), "lanes");
    expect(countLeaves(l.root)).toBe(3);
  });
});

describe("addLeaf without target", () => {
  it("appends to a horizontal split with autolayout share", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    expect(l.root?.kind).toBe("split");
    expect(countLeaves(l.root)).toBe(2);
    if (l.root?.kind === "split") {
      const sum = l.root.sizes[0] + l.root.sizes[1];
      expect(Math.abs(sum - 100)).toBeLessThan(0.5);
      expect(l.root.orientation).toBe("row");
    }
  });

  it("respects MAX_LEAVES = 4", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    l = addLeaf(l, "lanes");
    l = addLeaf(l, "matrix");
    expect(countLeaves(l.root)).toBe(4);
    const blocked = addLeaf(l, "sankey");
    expect(countLeaves(blocked.root)).toBe(4);
  });
});

describe("addLeaf with target edge", () => {
  it("splits target horizontally on right edge", () => {
    let l = singletonLayout("force");
    const targetId = (l.root as { id: string }).id;
    l = addLeaf(l, "tree", { leafId: targetId, edge: "right" });
    expect(l.root?.kind).toBe("split");
    if (l.root?.kind === "split") {
      expect(l.root.orientation).toBe("row");
      expect((l.root.children[0] as { view: string }).view).toBe("force");
      expect((l.root.children[1] as { view: string }).view).toBe("tree");
    }
  });

  it("splits target vertically on top edge — new leaf becomes first child", () => {
    let l = singletonLayout("force");
    const id = (l.root as { id: string }).id;
    l = addLeaf(l, "tree", { leafId: id, edge: "top" });
    expect(l.root?.kind).toBe("split");
    if (l.root?.kind === "split") {
      expect(l.root.orientation).toBe("col");
      expect((l.root.children[0] as { view: string }).view).toBe("tree");
      expect((l.root.children[1] as { view: string }).view).toBe("force");
    }
  });

  it("does nothing if target leaf is missing", () => {
    const l = singletonLayout("force");
    const next = addLeaf(l, "tree", { leafId: "missing", edge: "right" });
    expect(countLeaves(next.root)).toBe(1);
  });
});

describe("removeLeaf", () => {
  it("collapses degenerate split when sibling remains alone", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    const treeLeaf = leaves(l.root).find((x) => x.view === "tree");
    expect(treeLeaf).toBeDefined();
    l = removeLeaf(l, treeLeaf?.id ?? "");
    expect(l.root?.kind).toBe("leaf");
    if (l.root?.kind === "leaf") expect(l.root.view).toBe("force");
  });

  it("returns empty when removing the only leaf", () => {
    let l = singletonLayout("force");
    const id = (l.root as { id: string }).id;
    l = removeLeaf(l, id);
    expect(l.root).toBeNull();
  });

  it("preserves remaining structure on three-leaf removal", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    l = addLeaf(l, "lanes");
    expect(countLeaves(l.root)).toBe(3);
    const lanesLeaf = leaves(l.root).find((x) => x.view === "lanes");
    expect(lanesLeaf).toBeDefined();
    l = removeLeaf(l, lanesLeaf?.id ?? "");
    expect(countLeaves(l.root)).toBe(2);
  });
});

describe("swapViews", () => {
  it("swaps view between two leaves; sizes unchanged", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    const ids = leaves(l.root).map((x) => x.id);
    expect(ids.length).toBe(2);
    const sizesBefore = (l.root as Split).sizes.slice();
    l = swapViews(l, ids[0]!, ids[1]!);
    const after = leaves(l.root).map((x) => x.view);
    expect(after).toEqual(["tree", "force"]);
    expect((l.root as Split).sizes).toEqual(sizesBefore);
  });

  it("noop when same id", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    const ids = leaves(l.root).map((x) => x.id);
    const before = JSON.stringify(l);
    l = swapViews(l, ids[0]!, ids[0]!);
    expect(JSON.stringify(l)).toBe(before);
  });
});

describe("setSplitSize", () => {
  it("clamps to [10, 90]", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    l = setSplitSize(l, [], 5);
    if (l.root?.kind === "split") expect(l.root.sizes[0]).toBe(10);
    l = setSplitSize(l, [], 95);
    if (l.root?.kind === "split") expect(l.root.sizes[0]).toBe(90);
  });

  it("ensures sum stays at 100", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    l = setSplitSize(l, [], 33.3);
    if (l.root?.kind === "split") {
      expect(Math.abs(l.root.sizes[0] + l.root.sizes[1] - 100)).toBeLessThan(0.5);
    }
  });
});

describe("changeView", () => {
  it("updates only the targeted leaf", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    const id = leaves(l.root)[0]?.id ?? "";
    l = changeView(l, id, "sankey");
    const views = leaves(l.root).map((x) => x.view);
    expect(views).toContain("sankey");
    expect(views).toContain("tree");
  });
});

describe("clampSplit", () => {
  it("returns 50 for non-finite", () => {
    expect(clampSplit(NaN)).toBe(50);
    expect(clampSplit(Infinity)).toBe(50);
  });
});

describe("isValidLayout", () => {
  it("accepts well-formed layouts", () => {
    const l = addLeaf(singletonLayout("force"), "tree");
    expect(isValidLayout(l)).toBe(true);
  });
  it("rejects malformed", () => {
    expect(isValidLayout(null)).toBe(false);
    expect(isValidLayout({ root: { kind: "weird" }, nextId: 1 })).toBe(false);
    const bad: Layout = {
      root: {
        kind: "split",
        orientation: "row",
        sizes: [60, 50],
        children: [
          { kind: "leaf", id: "a", view: "force" },
          { kind: "leaf", id: "b", view: "tree" },
        ],
      },
      nextId: 3,
    };
    expect(isValidLayout(bad)).toBe(false);
  });
});

describe("findLeaf", () => {
  it("finds nested leaf by id", () => {
    let l = singletonLayout("force");
    l = addLeaf(l, "tree");
    const id = leaves(l.root)[1]?.id ?? "";
    const found = findLeaf(l.root, id);
    expect(found?.kind).toBe("leaf");
  });
});
