import { describe, it, expect } from "vitest";
import {
  EasyBot,
  MediumBot,
  HardBot,
  makeSeededRandom,
  type BotCardInfo,
} from "@/lib/game/bot";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<BotCardInfo> = {}): BotCardInfo {
  return {
    id: overrides.id ?? "card-0",
    colors: overrides.colors ?? [],
    colorIdentity: overrides.colorIdentity ?? [],
    cmc: overrides.cmc ?? 2,
    rarity: overrides.rarity ?? "common",
    typeLine: overrides.typeLine ?? "Creature",
    ...overrides,
  };
}

function makeCardMap(cards: BotCardInfo[]): Map<string, BotCardInfo> {
  return new Map(cards.map((c) => [c.id, c]));
}

const SIMPLE_PACK = ["c1", "c2", "c3", "c4", "c5"];
const SIMPLE_CARDS = makeCardMap(
  SIMPLE_PACK.map((id) => makeCard({ id, colors: ["W"], cmc: 2, rarity: "common" })),
);

// ─── EasyBot ──────────────────────────────────────────────────────────────────

describe("EasyBot", () => {
  it("picks a card that is in the pack", () => {
    const bot = new EasyBot();
    const pick = bot.pick(SIMPLE_PACK, [], SIMPLE_CARDS, makeSeededRandom(42));
    expect(SIMPLE_PACK).toContain(pick);
  });

  it("is deterministic with a fixed seed", () => {
    const bot = new EasyBot();
    const rng = makeSeededRandom(1);
    const pick1 = bot.pick(SIMPLE_PACK, [], SIMPLE_CARDS, rng);
    const rng2 = makeSeededRandom(1);
    const pick2 = bot.pick(SIMPLE_PACK, [], SIMPLE_CARDS, rng2);
    expect(pick1).toBe(pick2);
  });
});

// ─── MediumBot ────────────────────────────────────────────────────────────────

describe("MediumBot", () => {
  const bot = new MediumBot();

  it("picks a card that is in the pack", () => {
    const pick = bot.pick(SIMPLE_PACK, [], SIMPLE_CARDS, makeSeededRandom(7));
    expect(SIMPLE_PACK).toContain(pick);
  });

  it("prefers rare over common before committing colours", () => {
    const pack = ["rare-1", "common-1"];
    const cards = makeCardMap([
      makeCard({ id: "rare-1", rarity: "rare", colors: ["R"] }),
      makeCard({ id: "common-1", rarity: "common", colors: ["G"] }),
    ]);
    const pick = bot.pick(pack, [], cards, makeSeededRandom(0));
    expect(pick).toBe("rare-1");
  });

  it("prefers on-colour cards after 3+ picks", () => {
    // Simulate 4 white picks already made.
    const pickedSoFar = ["w1", "w2", "w3", "w4"];
    const pickedCards: BotCardInfo[] = pickedSoFar.map((id) =>
      makeCard({ id, colors: ["W"] }),
    );

    const packIds = ["on-w", "off-r"];
    const packCards: BotCardInfo[] = [
      makeCard({ id: "on-w", colors: ["W"] }),
      makeCard({ id: "off-r", colors: ["R"] }),
    ];

    const allCards = makeCardMap([...pickedCards, ...packCards]);
    const pick = bot.pick(packIds, pickedSoFar, allCards, makeSeededRandom(0));
    expect(pick).toBe("on-w");
  });

  it("accepts colourless cards even when committed to colours", () => {
    const pickedSoFar = ["w1", "w2", "w3"];
    const pickedCards = pickedSoFar.map((id) => makeCard({ id, colors: ["W"] }));
    const packIds = ["colorless-1"];
    const packCards = [makeCard({ id: "colorless-1", colors: [] })];
    const allCards = makeCardMap([...pickedCards, ...packCards]);

    const pick = bot.pick(packIds, pickedSoFar, allCards, makeSeededRandom(0));
    expect(pick).toBe("colorless-1");
  });
});

// ─── HardBot ──────────────────────────────────────────────────────────────────

describe("HardBot", () => {
  const bot = new HardBot();

  it("picks a card that is in the pack", () => {
    const pick = bot.pick(SIMPLE_PACK, [], SIMPLE_CARDS, makeSeededRandom(99));
    expect(SIMPLE_PACK).toContain(pick);
  });

  it("strongly prefers mythic over common", () => {
    const pack = ["mythic-1", "common-1", "common-2"];
    const cards = makeCardMap([
      makeCard({ id: "mythic-1", rarity: "mythic", colors: ["R"] }),
      makeCard({ id: "common-1", rarity: "common", colors: ["R"] }),
      makeCard({ id: "common-2", rarity: "common", colors: ["R"] }),
    ]);
    // Even with noise the mythic should win consistently.
    const picks = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      picks.add(bot.pick(pack, [], cards, makeSeededRandom(seed)));
    }
    expect(picks.has("mythic-1")).toBe(true);
  });

  it("penalises off-colour cards after committing", () => {
    const pickedSoFar = ["w1", "w2", "w3", "w4"];
    const pickedCards = pickedSoFar.map((id) => makeCard({ id, colors: ["W"] }));

    const pack = ["off-rare", "on-common"];
    const packCards = [
      makeCard({ id: "off-rare", rarity: "rare", colors: ["B"] }),
      makeCard({ id: "on-common", rarity: "common", colors: ["W"] }),
    ];
    const allCards = makeCardMap([...pickedCards, ...packCards]);

    // off-rare has high rarity score (+25) but off-colour penalty (-20), net ~5.
    // on-common has base score 4 + on-colour bonus 15, net ~19. On-common should win.
    const pick = bot.pick(pack, pickedSoFar, allCards, makeSeededRandom(0));
    expect(pick).toBe("on-common");
  });

  it("rewards 2–4 CMC cards (curve bonus)", () => {
    // Zero picks → no colour commitment. Two cards same rarity, different CMC.
    const pack = ["mid-curve", "high-curve"];
    const cards = makeCardMap([
      makeCard({ id: "mid-curve", rarity: "common", cmc: 3 }),
      makeCard({ id: "high-curve", rarity: "common", cmc: 7 }),
    ]);
    const pick = bot.pick(pack, [], cards, makeSeededRandom(0));
    expect(pick).toBe("mid-curve");
  });
});

// ─── makeSeededRandom ─────────────────────────────────────────────────────────

describe("makeSeededRandom", () => {
  it("produces values in [0, 1)", () => {
    const rng = makeSeededRandom(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic given the same seed", () => {
    const seq1 = Array.from({ length: 10 }, makeSeededRandom(7));
    const seq2 = Array.from({ length: 10 }, makeSeededRandom(7));
    expect(seq1).toEqual(seq2);
  });
});
