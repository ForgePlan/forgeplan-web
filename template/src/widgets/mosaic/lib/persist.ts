import { browser } from "$app/environment";
import { GRAPH_VIEW_IDS, type GraphView } from "@/shared/config";
import { isValidLayout, singletonLayout } from "../model/tree";
import type { Layout, MosaicNode } from "../model/types";

const LAYOUT_KEY = "forgeplan-web:layout:v1";

export function loadLayout(fallbackView: GraphView = "force"): Layout {
  if (!browser) return singletonLayout(fallbackView);
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return singletonLayout(fallbackView);
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidLayout(parsed)) return singletonLayout(fallbackView);
    if (parsed.root && !allViewsKnown(parsed.root)) {
      // FIXME(layout-migration): a saved view id was removed from GRAPH_VIEWS;
      // safest fallback is to drop the layout rather than render a broken pane.
      return singletonLayout(fallbackView);
    }
    return parsed;
  } catch {
    // TODO(persisted-layout): corrupt JSON — silent fallback.
    return singletonLayout(fallbackView);
  }
}

export function saveLayout(layout: Layout): void {
  if (!browser) return;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // TODO(persisted-layout): quota exceeded or storage disabled.
  }
}

function allViewsKnown(node: MosaicNode): boolean {
  if (node.kind === "leaf") return GRAPH_VIEW_IDS.has(node.view);
  return allViewsKnown(node.children[0]) && allViewsKnown(node.children[1]);
}
