import { describe, expect, it } from "vitest";
import {
  buildCardFilter,
  buildCardSort,
  cardListQuerySchema,
  escapeRegExp,
} from "@/lib/api/cards-query";

function parse(params: Record<string, string>) {
  return cardListQuerySchema.safeParse(params);
}

describe("cardListQuerySchema", () => {
  it("applies defaults", () => {
    const result = parse({});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(60);
    expect(result.data.sort).toBe("collector");
  });

  it("accepts a full valid query", () => {
    const result = parse({
      set: "NEO",
      name: "Boseiju",
      colors: "wug",
      rarity: "rare,mythic",
      type: "Creature",
      subtype: "Spirit",
      legal: "commander",
      cmcMin: "2",
      cmcMax: "4",
      page: "3",
      pageSize: "30",
      sort: "name",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.set).toBe("neo");
    expect(result.data.colors).toBe("WUG");
    expect(result.data.rarity).toEqual(["rare", "mythic"]);
  });

  it.each([
    ["set", { set: "$ne" }],
    ["set too long", { set: "abcdefgh" }],
    ["colors", { colors: "XY" }],
    ["rarity", { rarity: "legendary" }],
    ["type with operator chars", { type: "{$where}" }],
    ["legal", { legal: "kitchen-table" }],
    ["layout", { layout: "a{bad}" }],
    ["page", { page: "0" }],
    ["pageSize", { pageSize: "5000" }],
    ["cmc range inverted", { cmcMin: "5", cmcMax: "2" }],
    ["sort", { sort: "price" }],
  ])("rejects invalid %s", (_label, params) => {
    expect(parse(params).success).toBe(false);
  });
});

describe("escapeRegExp", () => {
  it("escapes every regex metacharacter", () => {
    const input = ".*+?^${}()|[]\\";
    const escaped = escapeRegExp(input);
    expect(new RegExp(escaped).test(input)).toBe(true);
    expect(() => new RegExp(escaped)).not.toThrow();
  });
});

describe("buildCardFilter", () => {
  const base = { page: 1, pageSize: 60, sort: "collector" as const };

  it("escapes user text in the name regex (no injection)", () => {
    const filter = buildCardFilter({ ...base, name: "a.*" }) as Record<
      string,
      { $regex: string }
    >;
    expect(filter.name.$regex).toBe("a\\.\\*");
  });

  it("single color becomes an $in on colorIdentity", () => {
    const filter = buildCardFilter({ ...base, colors: "WU" });
    expect(filter).toMatchObject({ colorIdentity: { $in: ["W", "U"] } });
  });

  it("colorless combines with colors via $or", () => {
    const filter = buildCardFilter({ ...base, colors: "WC" }) as {
      $or: unknown[];
    };
    expect(filter.$or).toEqual([
      { colorIdentity: { $in: ["W"] } },
      { colorIdentity: { $size: 0 } },
    ]);
  });

  it("type and subtype AND together on typeLine", () => {
    const filter = buildCardFilter({
      ...base,
      type: "Creature",
      subtype: "Spirit",
    }) as { $and: unknown[] };
    expect(filter.$and).toHaveLength(2);
  });

  it("legality uses the whitelisted format key", () => {
    const filter = buildCardFilter({ ...base, legal: "pauper" }) as Record<
      string,
      unknown
    >;
    expect(filter["legalities.pauper"]).toBe("legal");
  });

  it("cmc bounds become a range", () => {
    const filter = buildCardFilter({ ...base, cmcMin: 2, cmcMax: 4 });
    expect(filter).toMatchObject({ cmc: { $gte: 2, $lte: 4 } });
  });
});

describe("buildCardSort", () => {
  it("maps each sort key", () => {
    expect(buildCardSort("collector")).toMatchObject({
      collectorNumberValue: 1,
    });
    expect(buildCardSort("name")).toMatchObject({ name: 1 });
    expect(buildCardSort("cmc")).toMatchObject({ cmc: 1 });
    expect(buildCardSort("rarity")).toMatchObject({ rarityValue: -1 });
  });
});
