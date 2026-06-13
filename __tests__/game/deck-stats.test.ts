import { describe, expect, it } from "vitest";
import { computeDeckStats, type StatCard } from "@/lib/game/deck-stats";

function card(overrides: Partial<StatCard> & { typeLine: string }): StatCard {
  return {
    manaCost: "",
    cmc: 0,
    colors: [],
    rarity: "common",
    oracleText: "",
    quantity: 1,
    ...overrides,
  };
}

function repeat(c: StatCard, qty: number): StatCard {
  return { ...c, quantity: qty };
}

describe("computeDeckStats", () => {
  it("returns zero stats for an empty list", () => {
    const s = computeDeckStats([]);
    expect(s.counts.total).toBe(0);
    expect(s.counts.lands).toBe(0);
    expect(s.counts.nonland).toBe(0);
    expect(s.avgCmc).toBe(0);
    expect(s.curve.every((n) => n === 0)).toBe(true);
    expect(s.archetypeHint).toBeNull();
  });

  describe("lands are excluded from the curve", () => {
    it("basic land does not add to curve", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Basic Land — Forest", cmc: 0 }),
      ]);
      expect(stats.counts.lands).toBe(1);
      expect(stats.counts.nonland).toBe(0);
      expect(stats.curve.every((n) => n === 0)).toBe(true);
    });

    it("nonbasic land with cmc 0 does not pollute bucket 0", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Land — Island", cmc: 0, manaCost: "" }),
        card({ typeLine: "Creature — Human Wizard", cmc: 2, manaCost: "{1}{U}" }),
      ]);
      expect(stats.counts.lands).toBe(1);
      expect(stats.curve[0]).toBe(0); // land NOT in bucket 0
      expect(stats.curve[2]).toBe(1); // wizard IS in bucket 2
    });

    it("land-creature hybrid counts only as land", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Land Creature — Dryad", cmc: 0 }),
      ]);
      expect(stats.counts.lands).toBe(1);
      expect(stats.counts.creatures).toBe(0);
    });
  });

  describe("type counts", () => {
    it("counts creatures correctly", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Creature — Human", cmc: 1, quantity: 3 }),
        card({ typeLine: "Instant", cmc: 2 }),
      ]);
      expect(stats.counts.creatures).toBe(3);
      expect(stats.counts.instants).toBe(1);
    });

    it("counts artifact-creatures under artifacts only", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Artifact Creature — Golem", cmc: 3 }),
      ]);
      expect(stats.counts.artifacts).toBe(1);
      expect(stats.counts.creatures).toBe(0);
    });

    it("counts enchantment-creatures under enchantments only", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Enchantment Creature — God", cmc: 4 }),
      ]);
      expect(stats.counts.enchantments).toBe(1);
      expect(stats.counts.creatures).toBe(0);
    });

    it("counts planeswalkers", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Legendary Planeswalker — Liliana", cmc: 5 }),
      ]);
      expect(stats.counts.planeswalkers).toBe(1);
    });

    it("counts battles", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Battle — Siege", cmc: 3 }),
      ]);
      expect(stats.counts.battles).toBe(1);
    });
  });

  describe("mana curve", () => {
    it("buckets 7+ into index 7", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Sorcery", cmc: 8 }),
        card({ typeLine: "Sorcery", cmc: 10 }),
      ]);
      expect(stats.curve[7]).toBe(2);
    });

    it("quantity multiplies the bucket count", () => {
      const stats = computeDeckStats([
        repeat(card({ typeLine: "Instant", cmc: 2 }), 4),
      ]);
      expect(stats.curve[2]).toBe(4);
    });

    it("curve has exactly 8 buckets (0–7+)", () => {
      const stats = computeDeckStats([card({ typeLine: "Creature", cmc: 3 })]);
      expect(stats.curve).toHaveLength(8);
    });
  });

  describe("average CMC", () => {
    it("excludes lands from avgCmc", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Land", cmc: 0 }),
        card({ typeLine: "Land", cmc: 0 }),
        card({ typeLine: "Creature", cmc: 4 }),
        card({ typeLine: "Instant", cmc: 2 }),
      ]);
      // avg of 4+2 / 2 = 3.00
      expect(stats.avgCmc).toBe(3.0);
    });

    it("rounds to 2 decimal places", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Creature", cmc: 1 }),
        card({ typeLine: "Creature", cmc: 2 }),
        card({ typeLine: "Creature", cmc: 3 }),
      ]);
      expect(stats.avgCmc).toBe(2.0);
    });

    it("quantity is weighted correctly in avgCmc", () => {
      const stats = computeDeckStats([
        repeat(card({ typeLine: "Creature", cmc: 1 }), 3),
        repeat(card({ typeLine: "Creature", cmc: 4 }), 1),
      ]);
      // (3*1 + 1*4) / 4 = 7/4 = 1.75
      expect(stats.avgCmc).toBe(1.75);
    });
  });

  describe("colour breakdown", () => {
    it("colourless cards increment C", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Artifact", cmc: 2, colors: [] }),
      ]);
      expect(stats.colors.C).toBe(1);
    });

    it("multi-colour cards increment all relevant colours", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Creature", cmc: 2, colors: ["W", "U"], quantity: 2 }),
      ]);
      expect(stats.colors.W).toBe(2);
      expect(stats.colors.U).toBe(2);
    });

    it("lands count toward colour breakdown", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Land", colors: ["G"] }),
      ]);
      expect(stats.colors.G).toBe(1);
    });
  });

  describe("pip counts (devotion)", () => {
    it("counts single-pip correctly", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Creature", manaCost: "{1}{U}", cmc: 2 }),
      ]);
      expect(stats.pips.U).toBe(1);
      expect(stats.devotion.U).toBe(1);
    });

    it("counts double-pip correctly", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Creature", manaCost: "{U}{U}", cmc: 2 }),
      ]);
      expect(stats.pips.U).toBe(2);
    });

    it("pips are multiplied by quantity", () => {
      const stats = computeDeckStats([
        repeat(card({ typeLine: "Creature", manaCost: "{R}{R}", cmc: 2 }), 4),
      ]);
      expect(stats.pips.R).toBe(8);
    });

    it("lands do not count toward pips", () => {
      const stats = computeDeckStats([
        card({ typeLine: "Basic Land — Mountain", manaCost: "", cmc: 0 }),
      ]);
      expect(Object.values(stats.pips).every((n) => n === 0)).toBe(true);
    });
  });

  describe("rarity mix", () => {
    it("tallies all rarity buckets", () => {
      const stats = computeDeckStats([
        repeat(card({ typeLine: "Creature", rarity: "common" }), 10),
        repeat(card({ typeLine: "Creature", rarity: "uncommon" }), 4),
        card({ typeLine: "Creature", rarity: "rare" }),
      ]);
      expect(stats.rarity.common).toBe(10);
      expect(stats.rarity.uncommon).toBe(4);
      expect(stats.rarity.rare).toBe(1);
      expect(stats.rarity.mythic).toBe(0);
    });
  });

  describe("oracle-text heuristic tags", () => {
    it("detects removal — destroy target", () => {
      const stats = computeDeckStats([
        card({
          typeLine: "Instant",
          oracleText: "Destroy target creature.",
        }),
      ]);
      expect(stats.tags.removal).toBe(1);
    });

    it("detects removal — exile target", () => {
      const stats = computeDeckStats([
        card({
          typeLine: "Instant",
          oracleText: "Exile target permanent.",
        }),
      ]);
      expect(stats.tags.removal).toBe(1);
    });

    it("detects card advantage — draw cards", () => {
      const stats = computeDeckStats([
        card({
          typeLine: "Sorcery",
          oracleText: "Draw two cards.",
        }),
      ]);
      expect(stats.tags.cardAdvantage).toBe(1);
    });

    it("a card can be both removal and card advantage", () => {
      const stats = computeDeckStats([
        card({
          typeLine: "Instant",
          oracleText: "Exile target creature, then draw a card.",
        }),
      ]);
      expect(stats.tags.removal).toBe(1);
      expect(stats.tags.cardAdvantage).toBe(1);
    });

    it("tags are scaled by quantity", () => {
      const stats = computeDeckStats([
        repeat(
          card({ typeLine: "Instant", oracleText: "Destroy target creature." }),
          3,
        ),
      ]);
      expect(stats.tags.removal).toBe(3);
    });
  });

  describe("archetype hint", () => {
    it("returns null for a colourless deck", () => {
      const stats = computeDeckStats([
        repeat(card({ typeLine: "Artifact", cmc: 3, colors: [] }), 10),
      ]);
      expect(stats.archetypeHint).toBeNull();
    });

    it("identifies a single-colour aggro deck (low avgCmc)", () => {
      const stats = computeDeckStats([
        repeat(
          card({ typeLine: "Creature", cmc: 1, manaCost: "{R}", colors: ["R"], rarity: "common" }),
          20,
        ),
        repeat(card({ typeLine: "Basic Land — Mountain", cmc: 0, colors: [] }), 16),
      ]);
      expect(stats.archetypeHint).toMatch(/Red.*Aggro/i);
    });

    it("identifies a two-colour pair by guild name", () => {
      const uw = [
        repeat(card({ typeLine: "Creature", cmc: 3, manaCost: "{W}{W}", colors: ["W"] }), 10),
        repeat(card({ typeLine: "Creature", cmc: 3, manaCost: "{U}{U}", colors: ["U"] }), 10),
      ];
      const stats = computeDeckStats(uw);
      expect(stats.archetypeHint).toMatch(/Azorius/i);
    });

    it("returns a control hint for high avg CMC", () => {
      const stats = computeDeckStats([
        repeat(card({ typeLine: "Creature", cmc: 5, manaCost: "{B}{B}{B}", colors: ["B"] }), 12),
        repeat(card({ typeLine: "Land", cmc: 0, colors: [] }), 20),
      ]);
      expect(stats.archetypeHint).toMatch(/Control/i);
    });
  });

  describe("total counts", () => {
    it("counts.total sums all quantities including lands", () => {
      const stats = computeDeckStats([
        repeat(card({ typeLine: "Creature", cmc: 2 }), 24),
        repeat(card({ typeLine: "Basic Land" }), 16),
      ]);
      expect(stats.counts.total).toBe(40);
    });
  });
});
