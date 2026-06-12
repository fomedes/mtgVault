/**
 * Bot draft strategies for phantom solo drafts (P7-01, P7-02, P7-03).
 *
 * Easy  — random pick from the pack.
 * Medium — commits to 2 colours from early picks; prefers on-colour cards.
 * Hard  — scores rarity + colour discipline + curve fit; highest score wins.
 *
 * All strategies accept an optional `rng` parameter so tests can inject
 * a seeded function for determinism.
 */

export interface BotCardInfo {
  id: string;
  colors: string[];
  colorIdentity: string[];
  cmc: number;
  rarity: "common" | "uncommon" | "rare" | "mythic";
  typeLine: string;
}

export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotStrategy {
  pick(
    pack: string[],
    pickedSoFar: string[],
    cards: Map<string, BotCardInfo>,
    rng?: () => number,
  ): string;
}

// ─── Easy ─────────────────────────────────────────────────────────────────────

export class EasyBot implements BotStrategy {
  pick(pack: string[], _picks: string[], _cards: Map<string, BotCardInfo>, rng = Math.random): string {
    return pack[Math.floor(rng() * pack.length)];
  }
}

// ─── Medium ───────────────────────────────────────────────────────────────────

const RARITY_SCORE_MED: Record<string, number> = { mythic: 4, rare: 3, uncommon: 2, common: 1 };

export class MediumBot implements BotStrategy {
  pick(
    pack: string[],
    pickedSoFar: string[],
    cards: Map<string, BotCardInfo>,
    rng = Math.random,
  ): string {
    const committedColors = topColors(pickedSoFar, cards, 2);

    // After 3+ picks, prefer cards that match committed colours.
    if (pickedSoFar.length >= 3 && committedColors.length > 0) {
      const onColor = pack.filter((id) => {
        const c = cards.get(id);
        if (!c) return false;
        return c.colors.length === 0 || c.colors.some((col) => committedColors.includes(col));
      });
      if (onColor.length > 0) {
        return onColor[Math.floor(rng() * onColor.length)];
      }
    }

    // Fallback: highest rarity first.
    return [...pack].sort((a, b) => {
      const sa = RARITY_SCORE_MED[cards.get(a)?.rarity ?? "common"] ?? 1;
      const sb = RARITY_SCORE_MED[cards.get(b)?.rarity ?? "common"] ?? 1;
      return sb - sa;
    })[0];
  }
}

// ─── Hard ─────────────────────────────────────────────────────────────────────

const RARITY_SCORE_HARD: Record<string, number> = { mythic: 40, rare: 25, uncommon: 10, common: 4 };

export class HardBot implements BotStrategy {
  pick(
    pack: string[],
    pickedSoFar: string[],
    cards: Map<string, BotCardInfo>,
    rng = Math.random,
  ): string {
    const committedColors = topColors(pickedSoFar, cards, 2);

    // CMC histogram for curve-fit bonus.
    const cmcCounts = new Map<number, number>();
    for (const id of pickedSoFar) {
      const c = cards.get(id);
      if (!c) continue;
      const cmc = Math.round(c.cmc);
      cmcCounts.set(cmc, (cmcCounts.get(cmc) ?? 0) + 1);
    }

    const scored = pack.map((id) => {
      const c = cards.get(id);
      if (!c) return { id, score: rng() * 0.01 };

      let score = RARITY_SCORE_HARD[c.rarity] ?? 4;

      // Colour discipline (applied after committing to colours).
      if (pickedSoFar.length >= 3 && committedColors.length > 0) {
        const onColor = c.colors.length === 0 || c.colors.some((col) => committedColors.includes(col));
        score += onColor ? 15 : -20;
      }

      // Curve: reward 2–4 CMC; penalise overloaded slots.
      const cmc = Math.round(c.cmc);
      if (cmc >= 2 && cmc <= 4) score += 8;
      if ((cmcCounts.get(cmc) ?? 0) >= 3) score -= 5;

      // Small noise so ties break unpredictably.
      score += rng() * 2;

      return { id, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].id;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function makeBotStrategy(difficulty: BotDifficulty): BotStrategy {
  if (difficulty === "medium") return new MediumBot();
  if (difficulty === "hard") return new HardBot();
  return new EasyBot();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topColors(picks: string[], cards: Map<string, BotCardInfo>, n: number): string[] {
  const count = new Map<string, number>();
  for (const id of picks) {
    const c = cards.get(id);
    if (!c) continue;
    for (const col of c.colors) {
      count.set(col, (count.get(col) ?? 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([col]) => col);
}

/**
 * Simple LCG seeded random — deterministic across runs.
 * Only for tests; production bots use Math.random().
 */
export function makeSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = Math.imul(s, 1664525) + 1013904223;
    return (s >>> 0) / 4294967296;
  };
}
