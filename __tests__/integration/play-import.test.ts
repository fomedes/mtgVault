import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { Deck } from "@/lib/models/Deck";
import { resolveDeckLibrary, resolveDecklistLibrary } from "@/lib/game/play-import";

let mongod: MongoMemoryServer;
let dbPath: string;

beforeAll(async () => {
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "play-import-"));
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
  await Card.deleteMany({});
  await Deck.deleteMany({});
});

async function seedCard(name: string, opts?: { faces?: string[]; set?: string }) {
  const doc = await Card.create({
    scryfallId: `sf-${name.toLowerCase().replace(/\W+/g, "-")}`,
    name,
    set: opts?.set ?? "tst",
    collectorNumber: "1",
    rarity: "common",
    cachedAt: new Date(),
    cardFaces: (opts?.faces ?? []).map((f) => ({ name: f })),
  });
  return doc;
}

describe("resolveDeckLibrary", () => {
  it("expands quantities and enforces ownership", async () => {
    const card = await seedCard("Forest");
    const deck = await Deck.create({
      userId: "alice",
      name: "Mono Green",
      cards: [
        { cardId: card._id, scryfallId: card.scryfallId, name: "Forest", quantity: 4 },
      ],
    });

    const owned = await resolveDeckLibrary(deck._id.toString(), "alice");
    expect(owned.library).toHaveLength(4);
    expect(owned.library[0]).toEqual({ cardObjectId: card._id.toString(), scryfallId: card.scryfallId });

    // Another user cannot import Alice's deck.
    const stolen = await resolveDeckLibrary(deck._id.toString(), "mallory");
    expect(stolen.library).toHaveLength(0);
  });

  it("returns empty for a non-existent deck id", async () => {
    const res = await resolveDeckLibrary(new Types.ObjectId().toString(), "alice");
    expect(res.library).toHaveLength(0);
  });
});

describe("resolveDecklistLibrary", () => {
  it("matches names case-insensitively and reports unknown cards", async () => {
    const bolt = await seedCard("Lightning Bolt");
    const res = await resolveDecklistLibrary("4 lightning bolt\n2 Nonexistent Card");
    expect(res.library).toHaveLength(4);
    expect(res.library[0].scryfallId).toBe(bolt.scryfallId);
    expect(res.unknownCards).toEqual(["Nonexistent Card"]);
  });

  it("matches a DFC by its front-face name", async () => {
    const dfc = await seedCard("Delver of Secrets // Insectile Aberration", {
      faces: ["Delver of Secrets", "Insectile Aberration"],
    });
    const res = await resolveDecklistLibrary("1 Delver of Secrets");
    expect(res.library).toHaveLength(1);
    expect(res.library[0].scryfallId).toBe(dfc.scryfallId);
  });

  it("caps an oversized list at MAX_LIBRARY", async () => {
    await seedCard("Relentless Rats");
    const res = await resolveDecklistLibrary("999 Relentless Rats");
    expect(res.library.length).toBeLessThanOrEqual(250);
  });
});
