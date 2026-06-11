import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectToDatabase } from "@/lib/db";
import { generateBooster } from "@/lib/game/booster";
import { GAME_CONFIG } from "@/lib/game/config";
import { Card } from "@/lib/models/Card";
import { CardSet } from "@/lib/models/CardSet";

let mongod: MongoMemoryServer;
let dbPath: string;

const SET_CODE = "tst";

function makeCard(
  name: string,
  rarity: string,
  typeLine = "Creature",
  n: number,
) {
  return {
    scryfallId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    oracleId: `oracle-${n}`,
    name,
    set: SET_CODE,
    collectorNumber: String(n),
    collectorNumberValue: n,
    rarity,
    rarityValue: 1,
    colors: ["W"],
    colorIdentity: ["W"],
    typeLine,
    manaCost: "{W}",
    cmc: 1,
    oracleText: "",
    flavorText: "",
    cardFaces: [],
    layout: "normal",
    legalities: new Map(),
    inBooster: true,
    cachedAt: new Date(),
  };
}

beforeAll(async () => {
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "booster-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();

  await CardSet.create({
    code: SET_CODE,
    name: "Test Set",
    enabled: true,
    boosterPrice: 100,
    cachedAt: new Date(),
    cardsSyncedAt: new Date(),
  });

  const cards = [
    // 20 commons
    ...Array.from({ length: 20 }, (_, i) => makeCard(`Common ${i}`, "common", "Creature", i + 1)),
    // 10 uncommons
    ...Array.from({ length: 10 }, (_, i) => makeCard(`Uncommon ${i}`, "uncommon", "Instant", i + 100)),
    // 5 rares
    ...Array.from({ length: 5 }, (_, i) => makeCard(`Rare ${i}`, "rare", "Sorcery", i + 200)),
    // 2 mythics
    ...Array.from({ length: 2 }, (_, i) => makeCard(`Mythic ${i}`, "mythic", "Planeswalker", i + 300)),
    // 5 basic lands
    ...Array.from({ length: 5 }, (_, i) =>
      makeCard(`Forest ${i}`, "common", "Basic Land — Forest", i + 400),
    ),
  ];

  await Card.insertMany(cards);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

describe("generateBooster", () => {
  it("returns exactly 15 cards", async () => {
    const { cardIds } = await generateBooster(SET_CODE);
    expect(cardIds).toHaveLength(GAME_CONFIG.BOOSTER_SIZE);
  });

  it("throws for an unknown set", async () => {
    await expect(generateBooster("zzz")).rejects.toThrow();
  });

  it("rarity distribution is correct over many packs (statistical)", async () => {
    const PACKS = 200;
    let mythicCount = 0;
    let rareCount = 0;
    let uncommonCount = 0;
    let commonCount = 0;
    let landCount = 0;

    for (let i = 0; i < PACKS; i++) {
      const { cardIds } = await generateBooster(SET_CODE);
      // Fetch unique cards but iterate cardIds to preserve duplicates within a pack.
      const cardDocs = await Card.find({ _id: { $in: cardIds } }, { rarity: 1, typeLine: 1 }).lean();
      const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));
      for (const id of cardIds) {
        const c = cardMap.get(id.toString());
        if (!c) continue;
        if (c.typeLine.includes("Basic Land")) { landCount++; continue; }
        switch (c.rarity) {
          case "mythic": mythicCount++; break;
          case "rare": rareCount++; break;
          case "uncommon": uncommonCount++; break;
          case "common": commonCount++; break;
        }
      }
    }

    // Per pack: 10 C, 3 U, 1 R-or-M, 1 land
    const totalRareMythic = rareCount + mythicCount;

    // Uncommons: should be 3 per pack ± noise
    expect(uncommonCount).toBeGreaterThanOrEqual(PACKS * 2.5);
    expect(uncommonCount).toBeLessThanOrEqual(PACKS * 3.5);

    // Rares + mythics = 1 per pack
    expect(totalRareMythic).toBe(PACKS);

    // Mythic rate ~12.5% → expect 10–40 mythics in 200 packs
    expect(mythicCount).toBeGreaterThanOrEqual(5);
    expect(mythicCount).toBeLessThanOrEqual(60);

    // Lands: 1 per pack
    expect(landCount).toBe(PACKS);

    // Commons: 10 per pack
    expect(commonCount).toBeGreaterThanOrEqual(PACKS * 9);
    expect(commonCount).toBeLessThanOrEqual(PACKS * 11);
  });
});
