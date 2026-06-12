import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectToDatabase } from "@/lib/db";
import { Deck } from "@/lib/models/Deck";
import { Card } from "@/lib/models/Card";
import { UserCollection } from "@/lib/models/UserCollection";
import {
  computeCategory,
  createDeck,
  getDeckDetail,
  getDeckSummaries,
  patchDeck,
} from "@/lib/game/deck";

let mongod: MongoMemoryServer;
let dbPath: string;

const USER_A = "deck-user-a";
const USER_B = "deck-user-b";

let cardSeq = 0;
async function seedCard(overrides: Partial<{
  scryfallId: string;
  name: string;
  typeLine: string;
  colors: string[];
  colorIdentity: string[];
  rarity: string;
  manaCost: string;
}> = {}) {
  cardSeq += 1;
  const c = new Card({
    scryfallId: overrides.scryfallId ?? `sf-auto-${cardSeq}`,
    name: overrides.name ?? "Test Card",
    set: "tst",
    collectorNumber: String(cardSeq),
    rarity: overrides.rarity ?? "common",
    typeLine: overrides.typeLine ?? "Creature — Human",
    manaCost: overrides.manaCost ?? "{1}{R}",
    colors: overrides.colors ?? ["R"],
    colorIdentity: overrides.colorIdentity ?? ["R"],
    cachedAt: new Date(),
  });
  return c.save();
}

beforeAll(async () => {
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "deck-"));

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
  await Deck.deleteMany({});
  await Card.deleteMany({});
  await UserCollection.deleteMany({});
});

// ── computeCategory (pure — no DB) ───────────────────────────────────────────

describe("computeCategory", () => {
  it("returns 'draft' when sourceDraftId is set", () => {
    expect(computeCategory({ sourceDraftId: "session-id", cards: [] }, new Map())).toBe("draft");
  });

  it("returns 'complete' for empty non-draft deck", () => {
    expect(computeCategory({ sourceDraftId: undefined, cards: [] }, new Map())).toBe("complete");
  });

  it("returns 'complete' when all non-basic cards are owned in sufficient quantity", () => {
    const cardId = new Types.ObjectId();
    const deck = {
      sourceDraftId: undefined,
      cards: [{ cardId, typeLine: "Creature", quantity: 2 }],
    };
    const owned = new Map([[cardId.toString(), 3]]);
    expect(computeCategory(deck, owned)).toBe("complete");
  });

  it("returns 'wishlist' when a non-basic card is not owned enough", () => {
    const cardId = new Types.ObjectId();
    const deck = {
      sourceDraftId: undefined,
      cards: [{ cardId, typeLine: "Creature", quantity: 4 }],
    };
    const owned = new Map([[cardId.toString(), 2]]);
    expect(computeCategory(deck, owned)).toBe("wishlist");
  });

  it("returns 'wishlist' when a non-basic card is not owned at all", () => {
    const cardId = new Types.ObjectId();
    const deck = {
      sourceDraftId: undefined,
      cards: [{ cardId, typeLine: "Sorcery", quantity: 1 }],
    };
    expect(computeCategory(deck, new Map())).toBe("wishlist");
  });

  it("ignores basic lands — does not treat them as unowned", () => {
    const basicId = new Types.ObjectId();
    const deck = {
      sourceDraftId: undefined,
      cards: [{ cardId: basicId, typeLine: "Basic Land — Forest", quantity: 20 }],
    };
    expect(computeCategory(deck, new Map())).toBe("complete");
  });

  it("returns 'complete' when deck has both basics (unowned) and non-basics (fully owned)", () => {
    const creatureId = new Types.ObjectId();
    const landId = new Types.ObjectId();
    const deck = {
      sourceDraftId: undefined,
      cards: [
        { cardId: creatureId, typeLine: "Creature", quantity: 4 },
        { cardId: landId, typeLine: "Basic Land — Island", quantity: 20 },
      ],
    };
    const owned = new Map([[creatureId.toString(), 4]]);
    expect(computeCategory(deck, owned)).toBe("complete");
  });
});

// ── Deck CRUD ────────────────────────────────────────────────────────────────

describe("deck CRUD", () => {
  it("creates an empty deck", async () => {
    const deck = await createDeck(USER_A, { name: "My Deck" });
    expect(deck.name).toBe("My Deck");
    expect(deck.cards).toHaveLength(0);
    expect(deck.category).toBe("complete");
  });

  it("creates a deck seeded with cards, aggregating duplicates into quantity", async () => {
    const card = await seedCard({ name: "Lightning Bolt", typeLine: "Instant" });
    const id = card._id.toString();

    const deck = await createDeck(USER_A, {
      name: "Bolt Deck",
      cardIds: [id, id, id, id],
    });
    expect(deck.cards).toHaveLength(1);
    expect(deck.cards[0].name).toBe("Lightning Bolt");
    expect(deck.cards[0].quantity).toBe(4);
  });

  it("stores sourceDraftId and returns category 'draft'", async () => {
    const deck = await createDeck(USER_A, {
      name: "Draft Deck",
      sourceDraftId: "draft-session-xyz",
    });
    expect(deck.sourceDraftId).toBe("draft-session-xyz");
    expect(deck.category).toBe("draft");
  });

  it("getDeckSummaries only returns decks owned by the requesting user", async () => {
    await createDeck(USER_A, { name: "A's deck" });
    await createDeck(USER_B, { name: "B's deck" });

    const [decksA, decksB] = await Promise.all([
      getDeckSummaries(USER_A),
      getDeckSummaries(USER_B),
    ]);

    expect(decksA).toHaveLength(1);
    expect(decksA[0].name).toBe("A's deck");
    expect(decksB).toHaveLength(1);
    expect(decksB[0].name).toBe("B's deck");
  });

  it("getDeckDetail returns null when requesting another user's deck", async () => {
    const deck = await createDeck(USER_A, { name: "Secret" });
    expect(await getDeckDetail(deck.id, USER_B)).toBeNull();
  });

  it("patchDeck renames a deck", async () => {
    const deck = await createDeck(USER_A, { name: "Old Name" });
    const updated = await patchDeck(deck.id, USER_A, { name: "New Name" });
    expect(updated?.name).toBe("New Name");
  });

  it("patchDeck adds a card by scryfallId", async () => {
    const card = await seedCard({ scryfallId: "sf-bolt-add", name: "Bolt" });
    const deck = await createDeck(USER_A, { name: "Test" });

    const updated = await patchDeck(deck.id, USER_A, { addCardScryfallId: card.scryfallId });
    expect(updated?.cards).toHaveLength(1);
    expect(updated?.cards[0].name).toBe("Bolt");
    expect(updated?.cards[0].quantity).toBe(1);
  });

  it("patchDeck increments quantity when the same card is added again", async () => {
    const card = await seedCard({ scryfallId: "sf-bolt-inc", name: "Bolt Inc" });
    const deck = await createDeck(USER_A, { name: "Test" });

    await patchDeck(deck.id, USER_A, { addCardScryfallId: card.scryfallId });
    const updated = await patchDeck(deck.id, USER_A, { addCardScryfallId: card.scryfallId });
    expect(updated?.cards).toHaveLength(1);
    expect(updated?.cards[0].quantity).toBe(2);
  });

  it("patchDeck decrements quantity and removes entry when quantity reaches 0", async () => {
    const card = await seedCard({ scryfallId: "sf-remove-test" });
    const deck = await createDeck(USER_A, {
      name: "Test",
      cardIds: [card._id.toString(), card._id.toString()],
    });

    const after1 = await patchDeck(deck.id, USER_A, { removeCardScryfallId: card.scryfallId });
    expect(after1?.cards[0].quantity).toBe(1);

    const after2 = await patchDeck(deck.id, USER_A, { removeCardScryfallId: card.scryfallId });
    expect(after2?.cards).toHaveLength(0);
  });

  it("patchDeck setCardQty removes entry when quantity is set to 0", async () => {
    const card = await seedCard({ scryfallId: "sf-qty-zero" });
    const deck = await createDeck(USER_A, { name: "Test", cardIds: [card._id.toString()] });

    const updated = await patchDeck(deck.id, USER_A, {
      setCardQty: { scryfallId: card.scryfallId, quantity: 0 },
    });
    expect(updated?.cards).toHaveLength(0);
  });

  it("patchDeck returns null and leaves deck unchanged when userId does not match", async () => {
    const deck = await createDeck(USER_A, { name: "Private" });
    const result = await patchDeck(deck.id, USER_B, { name: "Stolen" });
    expect(result).toBeNull();
    expect((await getDeckDetail(deck.id, USER_A))?.name).toBe("Private");
  });
});

// ── Ownership tracking ────────────────────────────────────────────────────────

describe("ownership tracking in deck detail", () => {
  it("ownedQty reflects user's collection quantity", async () => {
    const card = await seedCard({ scryfallId: "sf-owned-qty" });
    const deck = await createDeck(USER_A, {
      name: "Test",
      cardIds: [card._id.toString(), card._id.toString()],
    });

    await UserCollection.create({
      userId: USER_A,
      cards: [{
        cardId: card._id,
        quantity: 1,
        obtainedVia: ["shop"],
        firstObtainedAt: new Date(),
        lastObtainedAt: new Date(),
      }],
    });

    const detail = await getDeckDetail(deck.id, USER_A);
    expect(detail?.cards[0].quantity).toBe(2);
    expect(detail?.cards[0].ownedQty).toBe(1);
    expect(detail?.category).toBe("wishlist");
  });

  it("category is 'complete' when every non-basic is fully owned", async () => {
    const card = await seedCard({ scryfallId: "sf-fully-owned" });
    const deck = await createDeck(USER_A, {
      name: "Full",
      cardIds: [card._id.toString()],
    });

    await UserCollection.create({
      userId: USER_A,
      cards: [{
        cardId: card._id,
        quantity: 4,
        obtainedVia: ["shop"],
        firstObtainedAt: new Date(),
        lastObtainedAt: new Date(),
      }],
    });

    const detail = await getDeckDetail(deck.id, USER_A);
    expect(detail?.category).toBe("complete");
  });

  it("basic lands always report ownedQty equal to their deck quantity regardless of collection", async () => {
    const land = await seedCard({
      scryfallId: "sf-basic-forest",
      name: "Forest",
      typeLine: "Basic Land — Forest",
      colors: [],
      colorIdentity: ["G"],
    });
    const deck = await createDeck(USER_A, {
      name: "Land Deck",
      cardIds: Array(20).fill(land._id.toString()),
    });

    const detail = await getDeckDetail(deck.id, USER_A);
    expect(detail?.cards[0].ownedQty).toBe(20);
    expect(detail?.category).toBe("complete");
  });

  it("deck with no collection entry for a non-basic is 'wishlist'", async () => {
    const card = await seedCard({ scryfallId: "sf-unowned" });
    const deck = await createDeck(USER_A, {
      name: "Wishlist",
      cardIds: [card._id.toString()],
    });

    const detail = await getDeckDetail(deck.id, USER_A);
    expect(detail?.cards[0].ownedQty).toBe(0);
    expect(detail?.category).toBe("wishlist");
  });
});
