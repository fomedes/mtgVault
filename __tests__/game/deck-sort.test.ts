import { describe, expect, it } from "vitest";
import type { DeckCardDto } from "@/lib/api/deck-dto";
import { dominantColorRank, groupAndSort } from "@/lib/game/deck-sort";

function card(overrides: Partial<DeckCardDto> & { typeLine: string; name: string }): DeckCardDto {
  const { name, typeLine, cmc = 0, colors = [], colorIdentity = [], ...rest } = overrides;
  return {
    scryfallId: name.toLowerCase().replace(/\s/g, "-"),
    name,
    manaCost: "",
    typeLine,
    colors,
    colorIdentity,
    rarity: "common",
    cmc,
    imageUris: undefined,
    quantity: 1,
    ownedQty: 0,
    ...rest,
  };
}

describe("dominantColorRank", () => {
  it("returns 10 for colourless", () => {
    expect(dominantColorRank([])).toBe(10);
  });

  it("returns the lowest rank of W=0,U=1,B=2,R=3,G=4", () => {
    expect(dominantColorRank(["G"])).toBe(4);
    expect(dominantColorRank(["R", "G"])).toBe(3);
    expect(dominantColorRank(["W", "B"])).toBe(0);
    expect(dominantColorRank(["U", "R"])).toBe(1);
  });

  it("returns 5 for unknown colour codes", () => {
    expect(dominantColorRank(["X"])).toBe(5);
  });
});

describe("groupAndSort — type bucketing", () => {
  it("puts a plain creature in Creatures", () => {
    const groups = groupAndSort([card({ name: "Grizzly Bears", typeLine: "Creature — Bear" })]);
    expect(groups[0].key).toBe("Creatures");
    expect(groups[0].cards[0].name).toBe("Grizzly Bears");
  });

  it("puts Artifact Creature in Artifacts (not Creatures)", () => {
    const groups = groupAndSort([card({ name: "Ornithopter", typeLine: "Artifact Creature — Thopter" })]);
    expect(groups[0].key).toBe("Artifacts");
  });

  it("puts Enchantment Creature in Enchantments (not Creatures)", () => {
    const groups = groupAndSort([card({ name: "Nyxborn Shieldmate", typeLine: "Enchantment Creature — Human Soldier" })]);
    expect(groups[0].key).toBe("Enchantments");
  });

  it("puts Instant in Instants", () => {
    const groups = groupAndSort([card({ name: "Counterspell", typeLine: "Instant" })]);
    expect(groups[0].key).toBe("Instants");
  });

  it("puts Sorcery in Sorceries", () => {
    const groups = groupAndSort([card({ name: "Divination", typeLine: "Sorcery" })]);
    expect(groups[0].key).toBe("Sorceries");
  });

  it("puts basic land in Lands", () => {
    const groups = groupAndSort([card({ name: "Forest", typeLine: "Basic Land — Forest" })]);
    expect(groups[0].key).toBe("Lands");
  });

  it("unknown type goes to Other", () => {
    const groups = groupAndSort([card({ name: "Scheme", typeLine: "Scheme" })]);
    expect(groups[0].key).toBe("Other");
  });

  it("filters out empty groups", () => {
    const groups = groupAndSort([card({ name: "Forest", typeLine: "Basic Land — Forest" })]);
    const keys = groups.map((g) => g.key);
    expect(keys).not.toContain("Creatures");
    expect(keys).toContain("Lands");
  });
});

describe("groupAndSort — sort order within group", () => {
  it("sorts by CMC ascending", () => {
    const cards = [
      card({ name: "Titan", typeLine: "Creature — Giant", cmc: 6, colorIdentity: ["W"] }),
      card({ name: "Bear", typeLine: "Creature — Bear", cmc: 2, colorIdentity: ["G"] }),
    ];
    const [group] = groupAndSort(cards);
    expect(group.cards[0].name).toBe("Bear");
    expect(group.cards[1].name).toBe("Titan");
  });

  it("ties on CMC sort by colour rank (W before G)", () => {
    const cards = [
      card({ name: "Green 2-drop", typeLine: "Creature", cmc: 2, colorIdentity: ["G"] }),
      card({ name: "White 2-drop", typeLine: "Creature", cmc: 2, colorIdentity: ["W"] }),
    ];
    const [group] = groupAndSort(cards);
    expect(group.cards[0].name).toBe("White 2-drop");
    expect(group.cards[1].name).toBe("Green 2-drop");
  });

  it("ties on CMC + colour sort by name alphabetically", () => {
    const cards = [
      card({ name: "Zeal", typeLine: "Creature", cmc: 3, colorIdentity: ["R"] }),
      card({ name: "Anger", typeLine: "Creature", cmc: 3, colorIdentity: ["R"] }),
    ];
    const [group] = groupAndSort(cards);
    expect(group.cards[0].name).toBe("Anger");
    expect(group.cards[1].name).toBe("Zeal");
  });

  it("groups appear in canonical order: Creatures before Instants before Lands", () => {
    const cards = [
      card({ name: "Forest", typeLine: "Basic Land — Forest" }),
      card({ name: "Counterspell", typeLine: "Instant" }),
      card({ name: "Bear", typeLine: "Creature — Bear", cmc: 2 }),
    ];
    const keys = groupAndSort(cards).map((g) => g.key);
    expect(keys.indexOf("Creatures")).toBeLessThan(keys.indexOf("Instants"));
    expect(keys.indexOf("Instants")).toBeLessThan(keys.indexOf("Lands"));
  });
});
