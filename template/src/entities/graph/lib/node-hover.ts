import type { Action } from 'svelte/action';
import { setHovered, clearHovered } from './highlight.svelte';

export const nodeHover: Action<HTMLElement, string | null | undefined> = (
  node,
  initialId
) => {
  let currentId: string | null = normalize(initialId);

  const onEnter = () => {
    if (currentId) setHovered(currentId);
  };
  const onLeave = () => {
    clearHovered();
  };

  node.addEventListener('mouseenter', onEnter);
  node.addEventListener('mouseleave', onLeave);
  node.addEventListener('focusin', onEnter);
  node.addEventListener('focusout', onLeave);

  return {
    update(nextId: string | null | undefined) {
      currentId = normalize(nextId);
    },
    destroy() {
      node.removeEventListener('mouseenter', onEnter);
      node.removeEventListener('mouseleave', onLeave);
      node.removeEventListener('focusin', onEnter);
      node.removeEventListener('focusout', onLeave);
      clearHovered();
    }
  };
};

function normalize(id: string | null | undefined): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}
