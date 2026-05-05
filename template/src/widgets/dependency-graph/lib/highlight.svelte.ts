export const highlight = $state<{ hoveredId: string | null }>({
  hoveredId: null,
});

export function setHovered(id: string | null): void {
  highlight.hoveredId = id;
}

export function clearHovered(): void {
  highlight.hoveredId = null;
}

export function edgeClass(
  from: string,
  to: string,
  hovered: string | null,
): string {
  if (hovered === null) return "";
  if (hovered === from || hovered === to) return "edge-active";
  return "edge-dim";
}
