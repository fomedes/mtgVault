import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { addCards, getCollectionStats } from "@/lib/game/collection";
import { connectToDatabase } from "@/lib/db";
import { UserCollection } from "@/lib/models/UserCollection";

let mongod: MongoMemoryServer;
let dbPath: string;

beforeAll(async () => {
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "coll-game-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test-project";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

beforeEach(async () => {
  await UserCollection.deleteMany({});
});

const uid = "user-abc";
const cardA = new Types.ObjectId();
const cardB = new Types.ObjectId();
const cardC = new Types.ObjectId();

describe("addCards", () => {
  it("creates a new collection document when none exists", async () => {
    await addCards(uid, [cardA], "admin");
    const doc = await UserCollection.findOne({ userId: uid }).lean();
    expect(doc).not.toBeNull();
    expect(doc!.cards).toHaveLength(1);
    expect(doc!.cards[0].cardId.toString()).toBe(cardA.toString());
    expect(doc!.cards[0].quantity).toBe(1);
    expect(doc!.cards[0].obtainedVia).toEqual(["admin"]);
  });

  it("increments quantity for an existing card", async () => {
    await addCards(uid, [cardA], "admin");
    await addCards(uid, [cardA], "admin");
    const doc = await UserCollection.findOne({ userId: uid }).lean();
    expect(doc!.cards).toHaveLength(1);
    expect(doc!.cards[0].quantity).toBe(2);
  });

  it("accumulates quantity when same cardId appears multiple times in input", async () => {
    await addCards(uid, [cardA, cardA, cardA], "shop");
    const doc = await UserCollection.findOne({ userId: uid }).lean();
    expect(doc!.cards[0].quantity).toBe(3);
  });

  it("merges source tags without duplicating via $addToSet", async () => {
    await addCards(uid, [cardA], "admin");
    await addCards(uid, [cardA], "admin");
    const doc = await UserCollection.findOne({ userId: uid }).lean();
    expect(doc!.cards[0].obtainedVia).toEqual(["admin"]);
  });

  it("tracks multiple distinct sources on the same card", async () => {
    await addCards(uid, [cardA], "admin");
    await addCards(uid, [cardA], "draft");
    const doc = await UserCollection.findOne({ userId: uid }).lean();
    expect(doc!.cards[0].obtainedVia).toContain("admin");
    expect(doc!.cards[0].obtainedVia).toContain("draft");
    expect(doc!.cards[0].quantity).toBe(2);
  });

  it("adds multiple distinct cards in one call", async () => {
    await addCards(uid, [cardA, cardB, cardC], "shop");
    const doc = await UserCollection.findOne({ userId: uid }).lean();
    expect(doc!.cards).toHaveLength(3);
    for (const entry of doc!.cards) {
      expect(entry.quantity).toBe(1);
      expect(entry.obtainedVia).toEqual(["shop"]);
    }
  });

  it("is a no-op for an empty cardIds array", async () => {
    await addCards(uid, [], "admin");
    const doc = await UserCollection.findOne({ userId: uid }).lean();
    expect(doc).toBeNull();
  });

  it("preserves firstObtainedAt and updates lastObtainedAt on subsequent calls", async () => {
    await addCards(uid, [cardA], "admin");
    const before = await UserCollection.findOne({ userId: uid }).lean();
    const firstAt = before!.cards[0].firstObtainedAt;

    await new Promise((r) => setTimeout(r, 2));

    await addCards(uid, [cardA], "admin");
    const after = await UserCollection.findOne({ userId: uid }).lean();
    expect(after!.cards[0].firstObtainedAt.getTime()).toBe(firstAt.getTime());
    expect(after!.cards[0].lastObtainedAt.getTime()).toBeGreaterThan(
      firstAt.getTime(),
    );
  });
});

describe("getCollectionStats", () => {
  it("returns zeros when no collection exists", async () => {
    const stats = await getCollectionStats("no-such-user");
    expect(stats).toEqual({ uniqueCards: 0, totalCards: 0 });
  });

  it("returns correct unique and total counts", async () => {
    await addCards(uid, [cardA, cardA, cardB], "admin");
    const stats = await getCollectionStats(uid);
    expect(stats.uniqueCards).toBe(2);
    expect(stats.totalCards).toBe(3);
  });
});
