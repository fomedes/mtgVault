export interface SetSummary {
  code: string;
  name: string;
  setType: string;
  cardCount: number;
  releasedAt: string | null;
  iconSvgUri: string;
  synced: boolean;
  block: string;
  blockName: string;
  blockOrder: number;
  setOrderInBlock: number;
}

export interface BlockGroup {
  id: string;
  name: string;
  order: number;
  yearRange: string | null;
  sets: SetSummary[];
}

export interface GroupedSets {
  blocks: BlockGroup[];
  standalone: SetSummary[];
  standaloneYearRange: string | null;
}

function computeYearRange(sets: SetSummary[]): string | null {
  const years = sets
    .map((s) => (s.releasedAt ? new Date(s.releasedAt).getFullYear() : null))
    .filter((y): y is number => y !== null);
  if (years.length === 0) return null;
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min}–${max}`;
}

export function groupSetsByBlock(sets: SetSummary[]): GroupedSets {
  const blockMap = new Map<string, BlockGroup>();
  const standalone: SetSummary[] = [];

  for (const set of sets) {
    if (!set.block) {
      standalone.push(set);
      continue;
    }
    const existing = blockMap.get(set.block);
    if (existing) {
      existing.sets.push(set);
    } else {
      blockMap.set(set.block, {
        id: set.block,
        name: set.blockName,
        order: set.blockOrder,
        yearRange: null,
        sets: [set],
      });
    }
  }

  for (const block of blockMap.values()) {
    block.sets.sort((a, b) => a.setOrderInBlock - b.setOrderInBlock);
    block.yearRange = computeYearRange(block.sets);
  }

  // Newest block first (descending order value)
  const blocks = Array.from(blockMap.values()).sort((a, b) => b.order - a.order);

  // Standalone already arrives sorted newest-first from the DB query; re-sort defensively
  standalone.sort((a, b) => {
    const aDate = a.releasedAt ? new Date(a.releasedAt).getTime() : 0;
    const bDate = b.releasedAt ? new Date(b.releasedAt).getTime() : 0;
    return bDate - aDate;
  });

  return { blocks, standalone, standaloneYearRange: computeYearRange(standalone) };
}
