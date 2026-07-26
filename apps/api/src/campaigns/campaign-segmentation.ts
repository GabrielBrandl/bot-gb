export interface SegmentContact {
  id: string;
  phone: string;
  tags: Array<{ id: string }>;
  kanbanCards: Array<{ stageId: string }>;
}

export function resolveCampaignContactIds(
  contacts: SegmentContact[],
  tagIds?: string[],
  stageId?: string,
): string[] {
  let filtered = contacts;

  if (tagIds && tagIds.length > 0) {
    filtered = filtered.filter((c) => c.tags.some((t) => tagIds.includes(t.id)));
  }

  if (stageId) {
    filtered = filtered.filter((c) => c.kanbanCards.some((card) => card.stageId === stageId));
  }

  return filtered.map((c) => c.id);
}
