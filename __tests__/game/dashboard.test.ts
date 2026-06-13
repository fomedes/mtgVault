import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { connectToDatabase } from "@/lib/db";
import { getDashboardData } from "@/lib/game/dashboard";
import { SavedDeck } from "@/lib/models/SavedDeck";
import { SoloDraftSession } from "@/lib/models/SoloDraftSession";
import { Deck } from "@/lib/models/Deck";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID = "dash-user-001";

beforeAll(async () => {
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "dash-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test";
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
  await Promise.all([
    SavedDeck.deleteMany({}),
    SoloDraftSession.deleteMany({}),
    Deck.deleteMany({}),
  ]);
});

describe("getDashboardData — draft counts split (D19)", () => {
  it("counts multiplayer and phantom drafts separately", async () => {
    await SavedDeck.create([
      { userId: UID, sessionId: "s1", setCode: "dom", cardIds: ["a", "b"] },
      { userId: UID, sessionId: "s2", setCode: "neo", cardIds: ["c"] },
    ]);
    await SoloDraftSession.create([
      { userId: UID, setCode: "dom", difficulty: "easy", status: "complete", draftState: {} },
      { userId: UID, setCode: "neo", difficulty: "hard", status: "drafting", draftState: {} },
    ]);

    const data = await getDashboardData(UID, 100);

    expect(data.stats.draftsMultiplayer).toBe(2);
    expect(data.stats.draftsPhantom).toBe(1); // only the completed solo draft
  });

  it("surfaces in-progress phantom drafts and recent decks as widgets", async () => {
    const solo = await SoloDraftSession.create({
      userId: UID,
      setCode: "woe",
      difficulty: "medium",
      status: "drafting",
      draftState: {},
    });
    await Deck.create({
      userId: UID,
      name: "Test Brew",
      cards: [
        { cardId: new mongoose.Types.ObjectId(), scryfallId: "x", name: "Card A", quantity: 2 },
        { cardId: new mongoose.Types.ObjectId(), scryfallId: "y", name: "Card B", quantity: 1 },
      ],
    });

    const data = await getDashboardData(UID, 0);

    expect(data.widgets.inProgress).toHaveLength(1);
    expect(data.widgets.inProgress[0]).toMatchObject({
      kind: "phantom",
      id: String(solo._id),
      href: `/solo-draft/${String(solo._id)}`,
    });

    expect(data.widgets.recentDecks).toHaveLength(1);
    expect(data.widgets.recentDecks[0]).toMatchObject({ name: "Test Brew", cardCount: 3 });
  });

  it("returns empty widgets for a user with no activity", async () => {
    const data = await getDashboardData("nobody", 0);
    expect(data.stats.draftsMultiplayer).toBe(0);
    expect(data.stats.draftsPhantom).toBe(0);
    expect(data.widgets.inProgress).toEqual([]);
    expect(data.widgets.recentDecks).toEqual([]);
    expect(data.widgets.achievements.total).toBeGreaterThan(0);
  });
});
