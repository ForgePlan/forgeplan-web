import type { Action } from "svelte/action";
import { highlight, setHovered, clearHovered } from "./highlight.svelte";

export const nodeHover: Action<HTMLElement, string | null | undefined> = (
  node,
  initialId,
) => {
  let currentId: string | null = normalize(initialId);

  const onEnter = () => {
    if (currentId) setHovered(currentId);
  };
  // Deferred + guarded clear: mouseleave/focusout also fire synchronously
  // while Svelte tears the node down (view switch), where mutating $state is
  // forbidden (state_unsafe_mutation). The microtask escapes the teardown
  // phase; the guard keeps a hover set in between (leave A → enter B) intact.
  const clearIfStillHovered = (leftId: string | null) => {
    queueMicrotask(() => {
      if (leftId !== null && highlight.hoveredId === leftId) clearHovered();
    });
  };
  const onLeave = () => {
    clearIfStillHovered(currentId);
  };

  node.addEventListener("mouseenter", onEnter);
  node.addEventListener("mouseleave", onLeave);
  node.addEventListener("focusin", onEnter);
  node.addEventListener("focusout", onLeave);

  return {
    update(nextId: string | null | undefined) {
      currentId = normalize(nextId);
    },
    destroy() {
      node.removeEventListener("mouseenter", onEnter);
      node.removeEventListener("mouseleave", onLeave);
      node.removeEventListener("focusin", onEnter);
      node.removeEventListener("focusout", onLeave);
      clearIfStillHovered(currentId);
    },
  };
};

function normalize(id: string | null | undefined): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}
