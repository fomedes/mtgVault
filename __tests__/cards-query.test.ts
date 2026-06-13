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
  const base = {
    page: 1,
    pageSize: 60,
    sort: "collector" as const,
    powerOp: "eq" as const,
    toughnessOp: "eq" as const,
    ownedOnly: false,
  };

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

describe("buildCardFilter — Phase 10 params", () => {
  const base = {
    page: 1,
    pageSize: 60,
    sort: "collector" as const,
    powerOp: "eq" as const,
    toughnessOp: "eq" as const,
    ownedOnly: false,
  };

  it("power eq uses an exact string match", () => {
    const filter = buildCardFilter({ ...base, power: 3 }) as Record<string, unknown>;
    expect(filter.power).toBe("3");
    expect(filter.$expr).toBeUndefined();
  });

  it("power gte uses $expr/$toDouble", () => {
    const filter = buildCardFilter({ ...base, power: 3, powerOp: "gte" }) as Record<string, unknown>;
    expect(filter.$expr).toMatchObject({
      $gte: [{ $toDouble: { $ifNull: ["$power", "-1"] } }, 3],
    });
    expect(filter.power).toBeUndefined();
  });

  it("toughness eq uses an exact string match", () => {
    const filter = buildCardFilter({ ...base, toughness: 4 }) as Record<string, unknown>;
    expect(filter.toughness).toBe("4");
    expect(filter.$expr).toBeUndefined();
  });

  it("toughness gte uses $expr/$toDouble", () => {
    const filter = buildCardFilter({ ...base, toughness: 4, toughnessOp: "gte" }) as Record<
      string,
      unknown
    >;
    expect(filter.$expr).toMatchObject({
      $gte: [{ $toDouble: { $ifNull: ["$toughness", "-1"] } }, 4],
    });
  });

  it("power gte + toughness gte merges into $expr.$and", () => {
    const filter = buildCardFilter({
      ...base,
      power: 2,
      powerOp: "gte",
      toughness: 3,
      toughnessOp: "gte",
    }) as { $expr: { $and: unknown[] } };
    expect(filter.$expr.$and).toHaveLength(2);
  });

  it("ownedOnly=true with card IDs sets _id $in", () => {
    const ids = ["aaa", "bbb"];
    const filter = buildCardFilter({ ...base, ownedOnly: true }, ids) as Record<string, unknown>;
    expect(filter._id).toEqual({ $in: ids });
  });

  it("ownedOnly=false never sets _id", () => {
    const filter = buildCardFilter({ ...base, ownedOnly: false }, ["aaa"]) as Record<
      string,
      unknown
    >;
    expect(filter._id).toBeUndefined();
  });

  it("multi-set filter uses $in on set field", () => {
    const parsed = cardListQuerySchema.safeParse({ sets: "neo,mom" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const filter = buildCardFilter(parsed.data) as Record<string, unknown>;
    expect(filter.set).toEqual({ $in: ["neo", "mom"] });
  });

  it("sets takes priority over singular set", () => {
    const parsed = cardListQuerySchema.safeParse({ set: "neo", sets: "mom,one" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const filter = buildCardFilter(parsed.data) as Record<string, unknown>;
    expect(filter.set).toEqual({ $in: ["mom", "one"] });
  });
});

describe("cardListQuerySchema — Phase 10 defaults", () => {
  it("powerOp defaults to 'eq'", () => {
    const result = cardListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.powerOp).toBe("eq");
    expect(result.data.toughnessOp).toBe("eq");
    expect(result.data.ownedOnly).toBe(false);
  });

  it("rejects invalid powerOp value", () => {
    expect(cardListQuerySchema.safeParse({ powerOp: "lte" }).success).toBe(false);
  });

  it("rejects power > 20", () => {
    expect(cardListQuerySchema.safeParse({ power: "21" }).success).toBe(false);
  });

  it("coerces ownedOnly string to boolean", () => {
    const result = cardListQuerySchema.safeParse({ ownedOnly: "true" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ownedOnly).toBe(true);
  });

  it("rejects more than 20 set codes in sets", () => {
    const sets = Array.from({ length: 21 }, (_, i) => `s${i}`).join(",");
    expect(cardListQuerySchema.safeParse({ sets }).success).toBe(false);
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
