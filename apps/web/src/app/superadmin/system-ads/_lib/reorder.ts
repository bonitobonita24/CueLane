// Wave 7.8-T3 — moveItem, ported from [tenant]/admin/media/_lib/youtube.ts (same pure helper,
// duplicated locally rather than cross-route-group imported — route groups stay self-contained).
export function moveItem(ids: readonly string[], index: number, direction: 'up' | 'down'): string[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as string);
  return next;
}
