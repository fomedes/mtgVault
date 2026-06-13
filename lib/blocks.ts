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
 *
 * Order values are chronological (higher = newer). Blocks were retired after
 * Ixalan (2017–2018); sets from Dominaria (2018) onward have no block.
 */
export const BLOCK_REGISTRY: Readonly<Record<string, BlockEntry>> = {
  // Ice Age Block (1995–1996)
  ice: { id: "ice-age", name: "Ice Age Block", order: 10, setOrder: 1 },
  all: { id: "ice-age", name: "Ice Age Block", order: 10, setOrder: 2 },
  csp: { id: "ice-age", name: "Ice Age Block", order: 10, setOrder: 3 }, // Coldsnap — retroactive third set

  // Mirage Block (1996–1997)
  mir: { id: "mirage", name: "Mirage Block", order: 20, setOrder: 1 },
  vis: { id: "mirage", name: "Mirage Block", order: 20, setOrder: 2 },
  wth: { id: "mirage", name: "Mirage Block", order: 20, setOrder: 3 },

  // Tempest Block (1997–1998)
  tmp: { id: "tempest", name: "Tempest Block", order: 30, setOrder: 1 },
  sth: { id: "tempest", name: "Tempest Block", order: 30, setOrder: 2 },
  exo: { id: "tempest", name: "Tempest Block", order: 30, setOrder: 3 },

  // Urza Block (1998–1999)
  usg: { id: "urza", name: "Urza Block", order: 40, setOrder: 1 },
  ulg: { id: "urza", name: "Urza Block", order: 40, setOrder: 2 },
  uds: { id: "urza", name: "Urza Block", order: 40, setOrder: 3 },

  // Masques Block (1999–2000)
  mmq: { id: "masques", name: "Masques Block", order: 50, setOrder: 1 },
  nem: { id: "masques", name: "Masques Block", order: 50, setOrder: 2 },
  pcy: { id: "masques", name: "Masques Block", order: 50, setOrder: 3 },

  // Invasion Block (2000–2001)
  inv: { id: "invasion", name: "Invasion Block", order: 60, setOrder: 1 },
  pls: { id: "invasion", name: "Invasion Block", order: 60, setOrder: 2 },
  apc: { id: "invasion", name: "Invasion Block", order: 60, setOrder: 3 },

  // Odyssey Block (2001–2002)
  ody: { id: "odyssey", name: "Odyssey Block", order: 70, setOrder: 1 },
  tor: { id: "odyssey", name: "Odyssey Block", order: 70, setOrder: 2 },
  jud: { id: "odyssey", name: "Odyssey Block", order: 70, setOrder: 3 },

  // Onslaught Block (2002–2003)
  ons: { id: "onslaught", name: "Onslaught Block", order: 80, setOrder: 1 },
  lgn: { id: "onslaught", name: "Onslaught Block", order: 80, setOrder: 2 },
  scg: { id: "onslaught", name: "Onslaught Block", order: 80, setOrder: 3 },

  // Mirrodin Block (2003–2004)
  mrd: { id: "mirrodin", name: "Mirrodin Block", order: 90, setOrder: 1 },
  dst: { id: "mirrodin", name: "Mirrodin Block", order: 90, setOrder: 2 },
  "5dn": { id: "mirrodin", name: "Mirrodin Block", order: 90, setOrder: 3 },

  // Kamigawa Block (2004–2005)
  chk: { id: "kamigawa", name: "Kamigawa Block", order: 100, setOrder: 1 },
  bok: { id: "kamigawa", name: "Kamigawa Block", order: 100, setOrder: 2 },
  sok: { id: "kamigawa", name: "Kamigawa Block", order: 100, setOrder: 3 },

  // Ravnica: City of Guilds Block (2005–2006)
  rav: { id: "ravnica", name: "Ravnica: City of Guilds Block", order: 110, setOrder: 1 },
  gpt: { id: "ravnica", name: "Ravnica: City of Guilds Block", order: 110, setOrder: 2 },
  dis: { id: "ravnica", name: "Ravnica: City of Guilds Block", order: 110, setOrder: 3 },

  // Time Spiral Block (2006–2007)
  tsp: { id: "time-spiral", name: "Time Spiral Block", order: 120, setOrder: 1 },
  plc: { id: "time-spiral", name: "Time Spiral Block", order: 120, setOrder: 2 },
  fut: { id: "time-spiral", name: "Time Spiral Block", order: 120, setOrder: 3 },

  // Lorwyn Block (2007)
  lrw: { id: "lorwyn", name: "Lorwyn Block", order: 130, setOrder: 1 },
  mor: { id: "lorwyn", name: "Lorwyn Block", order: 130, setOrder: 2 },

  // Shadowmoor Block (2008)
  shm: { id: "shadowmoor", name: "Shadowmoor Block", order: 140, setOrder: 1 },
  eve: { id: "shadowmoor", name: "Shadowmoor Block", order: 140, setOrder: 2 },

  // Shards of Alara Block (2008–2009)
  ala: { id: "shards-of-alara", name: "Shards of Alara Block", order: 150, setOrder: 1 },
  con: { id: "shards-of-alara", name: "Shards of Alara Block", order: 150, setOrder: 2 },
  arb: { id: "shards-of-alara", name: "Shards of Alara Block", order: 150, setOrder: 3 },

  // Zendikar Block (2009–2010)
  zen: { id: "zendikar", name: "Zendikar Block", order: 160, setOrder: 1 },
  wwk: { id: "zendikar", name: "Zendikar Block", order: 160, setOrder: 2 },
  roe: { id: "zendikar", name: "Zendikar Block", order: 160, setOrder: 3 },

  // Scars of Mirrodin Block (2010–2011)
  som: { id: "scars-of-mirrodin", name: "Scars of Mirrodin Block", order: 170, setOrder: 1 },
  mbs: { id: "scars-of-mirrodin", name: "Scars of Mirrodin Block", order: 170, setOrder: 2 },
  nph: { id: "scars-of-mirrodin", name: "Scars of Mirrodin Block", order: 170, setOrder: 3 },

  // Innistrad Block (2011–2012)
  isd: { id: "innistrad", name: "Innistrad Block", order: 180, setOrder: 1 },
  dka: { id: "innistrad", name: "Innistrad Block", order: 180, setOrder: 2 },
  avr: { id: "innistrad", name: "Innistrad Block", order: 180, setOrder: 3 },

  // Return to Ravnica Block (2012–2013)
  rtr: { id: "return-to-ravnica", name: "Return to Ravnica Block", order: 190, setOrder: 1 },
  gtc: { id: "return-to-ravnica", name: "Return to Ravnica Block", order: 190, setOrder: 2 },
  dgm: { id: "return-to-ravnica", name: "Return to Ravnica Block", order: 190, setOrder: 3 },

  // Theros Block (2013–2014)
  ths: { id: "theros", name: "Theros Block", order: 200, setOrder: 1 },
  bng: { id: "theros", name: "Theros Block", order: 200, setOrder: 2 },
  jou: { id: "theros", name: "Theros Block", order: 200, setOrder: 3 },

  // Khans of Tarkir Block (2014–2015)
  ktk: { id: "khans-of-tarkir", name: "Khans of Tarkir Block", order: 210, setOrder: 1 },
  frf: { id: "khans-of-tarkir", name: "Khans of Tarkir Block", order: 210, setOrder: 2 },
  dtk: { id: "khans-of-tarkir", name: "Khans of Tarkir Block", order: 210, setOrder: 3 },

  // Battle for Zendikar Block (2015–2016)
  bfz: { id: "battle-for-zendikar", name: "Battle for Zendikar Block", order: 220, setOrder: 1 },
  ogw: { id: "battle-for-zendikar", name: "Battle for Zendikar Block", order: 220, setOrder: 2 },

  // Shadows over Innistrad Block (2016)
  soi: { id: "shadows-over-innistrad", name: "Shadows over Innistrad Block", order: 230, setOrder: 1 },
  emn: { id: "shadows-over-innistrad", name: "Shadows over Innistrad Block", order: 230, setOrder: 2 },

  // Kaladesh Block (2016–2017)
  kld: { id: "kaladesh", name: "Kaladesh Block", order: 240, setOrder: 1 },
  aer: { id: "kaladesh", name: "Kaladesh Block", order: 240, setOrder: 2 },

  // Amonkhet Block (2017)
  akh: { id: "amonkhet", name: "Amonkhet Block", order: 250, setOrder: 1 },
  hou: { id: "amonkhet", name: "Amonkhet Block", order: 250, setOrder: 2 },

  // Ixalan Block (2017–2018) — last traditional block before the system was retired
  xln: { id: "ixalan", name: "Ixalan Block", order: 260, setOrder: 1 },
  rix: { id: "ixalan", name: "Ixalan Block", order: 260, setOrder: 2 },
} as const;

export function getBlockEntry(code: string): BlockEntry | undefined {
  return BLOCK_REGISTRY[code.toLowerCase()];
}
