export function relationClass(relation: string): string {
  const r = relation?.toLowerCase() ?? '';
  if (r === 'informs') return 'edge informs';
  if (r === 'risks' || r === 'risk') return 'edge risk';
  return 'edge';
}

export function relationFill(relation: string): string {
  const r = relation?.toLowerCase() ?? '';
  if (r === 'informs') return 'rgba(229, 229, 229, 0.65)';
  if (r === 'risks' || r === 'risk') return 'var(--accent)';
  return 'rgba(229, 229, 229, 0.85)';
}
