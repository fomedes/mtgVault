/**
 * Pure deck-stats engine (P9-01, D15-D16).
 * Zero I/O — takes a flat card list and returns comprehensive analytics.
 * Consumed by DeckStats, PoolStats, and future surfaces without duplication.
 */

export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type ColorKey = ManaColor | "C";

export interface StatCard {
  typeLine: string;
  manaCost: string;
  cmc: number;
  colors: string[];
  rarity: string;
  oracleText: string;
  quantity: number;
}

export interface DeckStatsResult {
  counts: {
    total: number;
    lands: number;
    nonland: number;
    creatures: number;
    instants: number;
    sorceries: number;
    artifacts: number;
    enchantments: number;
    planeswalkers: number;
    battles: number;
    others: number;
  };
  /** CMC buckets 0–7+; lands are EXCLUDED (counted in counts.lands instead). */
  curve: number[];
  colors: Record<ColorKey, number>;
  /** Mana-symbol pip counts from manaCost (W/U/B/R/G only). */
  pips: Record<ManaColor, number>;
  /** Average CMC of nonland cards. */
  avgCmc: number;
  rarity: Record<"common" | "uncommon" | "rare" | "mythic", number>;
  devotion: Record<ManaColor, number>;
  tags: { removal: number; cardAdvantage: number };
  archetypeHint: string | null;
}

const PIP_RE = /\{([WUBRG])\}/g;

const MANA_COLORS: ManaColor[] = ["W", "U", "B", "R", "G"];

// Keys are sorted by MANA_COLORS order (W<U<B<R<G), not alphabetically.
const COLOR_PAIR_NAMES: Record<string, string> = {
  WU: "Azorius",
  WB: "Orzhov",
  WR: "Boros",
  WG: "Selesnya",
  UB: "Dimir",
  UR: "Izzet",
  UG: "Simic",
  BR: "Rakdos",
  BG: "Golgari",
  RG: "Gruul",
};

const COLOR_NAMES: Record<ManaColor, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

function isLand(typeLine: string): boolean {
  return /\bLand\b/i.test(typeLine);
}

function isCreature(typeLine: string): boolean {
  return /\bCreature\b/i.test(typeLine);
}

function isInstant(typeLine: string): boolean {
  return /\bInstant\b/i.test(typeLine);
}

function isSorcery(typeLine: string): boolean {
  return /\bSorcery\b/i.test(typeLine);
}

function isArtifact(typeLine: string): boolean {
  return /\bArtifact\b/i.test(typeLine);
}

function isEnchantment(typeLine: string): boolean {
  return /\bEnchantment\b/i.test(typeLine);
}

function isPlaneswalker(typeLine: string): boolean {
  return /\bPlaneswalker\b/i.test(typeLine);
}

function isBattle(typeLine: string): boolean {
  return /\bBattle\b/i.test(typeLine);
}

const REMOVAL_PATTERNS = [
  /\bdestroy target\b/i,
  /\bexile target\b/i,
  /\bdeal[s]? \d+ damage to (target|any target|each creature|each opponent)\b/i,
  /\b-\d+\/-\d+\b/,
  /\bcounter target spell\b/i,
];

const CARD_ADVANTAGE_PATTERNS = [
  /\bdraw \w+ card[s]?\b/i,
  /\blook at the top \d+\b/i,
  /\bsearch your library\b/i,
  /\bright of way\b/i,
  /\b(creates?|put[s]?) \w+ treasure\b/i,
  /\bcreates? \w+ token[s]?\b/i,
];

function countPips(manaCost: string): Record<ManaColor, number> {
  const pips: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let match;
  PIP_RE.lastIndex = 0;
  while ((match = PIP_RE.exec(manaCost)) !== null) {
    const c = match[1] as ManaColor;
    pips[c]++;
  }
  return pips;
}

function archetypeHint(
  dominant: ManaColor[],
  avgCmc: number,
  removalCount: number,
  cardAdvCount: number,
): string | null {
  if (dominant.length === 0) return null;

  let leanLabel: string;
  if (avgCmc <= 2.2) leanLabel = "Aggro";
  else if (avgCmc >= 3.8 || (removalCount + cardAdvCount) >= 6) leanLabel = "Control";
  else leanLabel = "Midrange";

  if (dominant.length === 1) {
    return `${COLOR_NAMES[dominant[0]]} ${leanLabel}`;
  }
  // Sort the dominant pair by canonical MTG colour order (W U B R G).
  const colorIndex = (c: ManaColor) => MANA_COLORS.indexOf(c);
  const sorted = dominant.slice(0, 2).sort((a, b) => colorIndex(a) - colorIndex(b));
  const key = sorted.join("") as string;
  const pairName = COLOR_PAIR_NAMES[key];
  return pairName ? `${pairName} ${leanLabel}` : `${dominant.join("")} ${leanLabel}`;
}

export function computeDeckStats(cards: StatCard[]): DeckStatsResult {
  const counts = {
    total: 0,
    lands: 0,
    nonland: 0,
    creatures: 0,
    instants: 0,
    sorceries: 0,
    artifacts: 0,
    enchantments: 0,
    planeswalkers: 0,
    battles: 0,
    others: 0,
  };

  const curve = new Array<number>(8).fill(0); // buckets 0-6, 7+
  const colors: Record<ColorKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const pips: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const rarity: Record<"common" | "uncommon" | "rare" | "mythic", number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    mythic: 0,
  };
  const devotion: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const tags = { removal: 0, cardAdvantage: 0 };

  let totalCmc = 0;

  for (const card of cards) {
    const qty = card.quantity;
    counts.total += qty;

    const land = isLand(card.typeLine);
    if (land) {
      counts.lands += qty;
    } else {
      counts.nonland += qty;
      const bucket = Math.min(Math.floor(card.cmc), 7);
      curve[bucket] += qty;
      totalCmc += card.cmc * qty;

      // Artifact and Enchantment take precedence so hybrid types (Artifact
      // Creature, Enchantment Creature) are bucketed under the non-creature
      // supertype. Creature, Instant, Sorcery are then mutually exclusive.
      if (isArtifact(card.typeLine)) counts.artifacts += qty;
      else if (isEnchantment(card.typeLine)) counts.enchantments += qty;
      else if (isPlaneswalker(card.typeLine)) counts.planeswalkers += qty;
      else if (isBattle(card.typeLine)) counts.battles += qty;
      else if (isCreature(card.typeLine)) counts.creatures += qty;
      else if (isInstant(card.typeLine)) counts.instants += qty;
      else if (isSorcery(card.typeLine)) counts.sorceries += qty;
      else counts.others += qty;

      // Pip counts (for devotion source / colour identity)
      const cardPips = countPips(card.manaCost);
      for (const c of MANA_COLORS) {
        if (cardPips[c] > 0) {
          pips[c] += cardPips[c] * qty;
          devotion[c] += cardPips[c] * qty;
        }
      }

      // Heuristic tags
      const oracle = card.oracleText ?? "";
      if (REMOVAL_PATTERNS.some((re) => re.test(oracle))) tags.removal += qty;
      if (CARD_ADVANTAGE_PATTERNS.some((re) => re.test(oracle))) tags.cardAdvantage += qty;
    }

    // Colour breakdown (by card.colors)
    if (card.colors.length === 0) {
      colors.C += qty;
    } else {
      for (const c of card.colors) {
        if (c in colors) {
          (colors as Record<string, number>)[c] += qty;
        }
      }
    }

    // Rarity
    const r = card.rarity as keyof typeof rarity;
    if (r in rarity) rarity[r] += qty;
  }

  const avgCmc = counts.nonland > 0 ? totalCmc / counts.nonland : 0;

  // Dominant colours: ordered by pip count descending
  const sortedByPips = MANA_COLORS.slice().sort((a, b) => pips[b] - pips[a]);
  const dominant = sortedByPips.filter((c) => pips[c] > 0).slice(0, 2);

  return {
    counts,
    curve,
    colors,
    pips,
    avgCmc: Math.round(avgCmc * 100) / 100,
    rarity,
    devotion,
    tags,
    archetypeHint: archetypeHint(dominant, avgCmc, tags.removal, tags.cardAdvantage),
  };
}
