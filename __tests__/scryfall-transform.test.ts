import { describe, expect, it } from "vitest";
import {
  parseCollectorNumber,
  toCardDocument,
  toSetDocument,
} from "@/lib/mtg-api/transform";
import type { ScryfallCard, ScryfallSet } from "@/lib/mtg-api/types";

const NOW = new Date("2026-06-11T00:00:00Z");

const lions: ScryfallCard = {
  id: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a01",
  oracle_id: "aaaa1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a01",
  name: "Savannah Lions",
  set: "TST",
  collector_number: "12a",
  rarity: "rare",
  layout: "normal",
  colors: ["W"],
  color_identity: ["W"],
  type_line: "Creature — Cat",
  mana_cost: "{W}",
  cmc: 1,
  oracle_text: "",
  power: "2",
  toughness: "1",
  image_uris: {
    small: "https://cards.scryfall.io/small.jpg",
    normal: "https://cards.scryfall.io/normal.jpg",
    art_crop: "https://cards.scryfall.io/art.jpg",
  },
  legalities: { standard: "legal", modern: "legal" },
  booster: true,
};

const dfc: ScryfallCard = {
  id: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a02",
  oracle_id: "aaaa1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a02",
  name: "Branchloft Pathway // Boulderloft Pathway",
  set: "tst",
  collector_number: "253",
  rarity: "mythic",
  layout: "modal_dfc",
  color_identity: ["G", "W"],
  cmc: 0,
  card_faces: [
    {
      name: "Branchloft Pathway",
      type_line: "Land",
      colors: ["G"],
      image_uris: { normal: "https://cards.scryfall.io/front.jpg" },
    },
    {
      name: "Boulderloft Pathway",
      type_line: "Land",
      colors: ["W"],
      image_uris: { normal: "https://cards.scryfall.io/back.jpg" },
    },
  ],
  booster: true,
};

describe("parseCollectorNumber", () => {
  it("parses the numeric prefix", () => {
    expect(parseCollectorNumber("123")).toBe(123);
    expect(parseCollectorNumber("12a")).toBe(12);
  });

  it("sorts non-numeric numbers last", () => {
    expect(parseCollectorNumber("T5")).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("toCardDocument", () => {
  it("maps a normal card to the Mongo shape", () => {
    const doc = toCardDocument(lions, NOW);
    expect(doc).toMatchObject({
      scryfallId: lions.id,
      name: "Savannah Lions",
      set: "tst", // lowercased
      collectorNumber: "12a",
      collectorNumberValue: 12,
      rarity: "rare",
      rarityValue: 3,
      colors: ["W"],
      typeLine: "Creature — Cat",
      manaCost: "{W}",
      cmc: 1,
      layout: "normal",
      inBooster: true,
      power: "2",
      toughness: "1",
      cachedAt: NOW,
    });
    expect(doc.imageUris).toMatchObject({
      small: "https://cards.scryfall.io/small.jpg",
      artCrop: "https://cards.scryfall.io/art.jpg",
    });
    expect(doc.legalities).toMatchObject({ standard: "legal" });
  });

  it("aggregates DFC colors from faces and maps face images", () => {
    const doc = toCardDocument(dfc, NOW);
    expect(doc.colors.sort()).toEqual(["G", "W"]);
    expect(doc.imageUris).toBeUndefined();
    expect(doc.cardFaces).toHaveLength(2);
    expect(doc.cardFaces[0].imageUris?.normal).toBe(
      "https://cards.scryfall.io/front.jpg",
    );
    expect(doc.cardFaces[1].name).toBe("Boulderloft Pathway");
  });
});

describe("toSetDocument", () => {
  it("maps set metadata", () => {
    const scrySet: ScryfallSet = {
      id: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a99",
      code: "TST",
      name: "Test Set",
      set_type: "expansion",
      card_count: 4,
      released_at: "2026-01-15",
      icon_svg_uri: "https://svgs.scryfall.io/tst.svg",
    };
    const doc = toSetDocument(scrySet, NOW);
    expect(doc).toMatchObject({
      code: "tst",
      name: "Test Set",
      setType: "expansion",
      cardCount: 4,
      iconSvgUri: "https://svgs.scryfall.io/tst.svg",
      cachedAt: NOW,
    });
    expect(doc.releasedAt?.getUTCFullYear()).toBe(2026);
  });
});
