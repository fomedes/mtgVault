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
  sets: SetSummary[];
}

export interface GroupedSets {
  blocks: BlockGroup[];
  standalone: SetSummary[];
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
        sets: [set],
      });
    }
  }

  for (const block of blockMap.values()) {
    block.sets.sort((a, b) => a.setOrderInBlock - b.setOrderInBlock);
  }

  const blocks = Array.from(blockMap.values()).sort((a, b) => a.order - b.order);
  standalone.sort((a, b) => {
    const aDate = a.releasedAt ? new Date(a.releasedAt).getTime() : 0;
    const bDate = b.releasedAt ? new Date(b.releasedAt).getTime() : 0;
    return bDate - aDate;
  });

  return { blocks, standalone };
}
