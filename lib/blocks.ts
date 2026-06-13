export interface BlockEntry {
  id: string;
  name: string;
  order: number;
  setOrder: number;
}

/**
 * Single source of truth for block assignments (D18). Both the seed script
 * and the sync job read this so block data is deterministic regardless of
 * how a set entered the cache.
 */
export const BLOCK_REGISTRY: Readonly<Record<string, BlockEntry>> = {
  // Urza Block (1998–1999)
  usg: { id: "urza", name: "Urza Block", order: 10, setOrder: 1 },
  ulg: { id: "urza", name: "Urza Block", order: 10, setOrder: 2 },
  uds: { id: "urza", name: "Urza Block", order: 10, setOrder: 3 },
  // Onslaught Block (2002–2003)
  ons: { id: "onslaught", name: "Onslaught Block", order: 20, setOrder: 1 },
  lgn: { id: "onslaught", name: "Onslaught Block", order: 20, setOrder: 2 },
  scg: { id: "onslaught", name: "Onslaught Block", order: 20, setOrder: 3 },
  // Ravnica: City of Guilds Block (2005–2006)
  rav: { id: "ravnica", name: "Ravnica: City of Guilds Block", order: 30, setOrder: 1 },
  gpt: { id: "ravnica", name: "Ravnica: City of Guilds Block", order: 30, setOrder: 2 },
  dis: { id: "ravnica", name: "Ravnica: City of Guilds Block", order: 30, setOrder: 3 },
  // Return to Ravnica Block (2012–2013)
  rtr: { id: "return-to-ravnica", name: "Return to Ravnica Block", order: 40, setOrder: 1 },
  gtc: { id: "return-to-ravnica", name: "Return to Ravnica Block", order: 40, setOrder: 2 },
  dgm: { id: "return-to-ravnica", name: "Return to Ravnica Block", order: 40, setOrder: 3 },
} as const;

export function getBlockEntry(code: string): BlockEntry | undefined {
  return BLOCK_REGISTRY[code.toLowerCase()];
}
