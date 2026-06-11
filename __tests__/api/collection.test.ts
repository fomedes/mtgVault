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
  vi,
} from "vitest";

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: getCurrentUserMock }));

import { GET as getCollection } from "@/app/api/collection/route";
import { GET as getExport } from "@/app/api/collection/export/route";
import { GET as getIds } from "@/app/api/collection/ids/route";
import { POST as grantCards } from "@/app/api/admin/collection/grant/route";
import { addCards } from "@/lib/game/collection";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { User } from "@/lib/models/User";
import { UserCollection } from "@/lib/models/UserCollection";
import type { UserDoc } from "@/lib/models/User";

let mongod: MongoMemoryServer;
let dbPath: string;

const SCRYFALL_ID_A = "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a01";
const SCRYFALL_ID_B = "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a02";
const USER_UID = "firebase-user-001";
const ADMIN_UID = "firebase-admin-001";

function makeUser(uid: string, role: "user" | "admin" = "user"): UserDoc {
  return {
    uid,
    email: `${uid}@test.com`,
    displayName: "Test",
    photoURL: "",
    role,
    vaultCoins: 0,
    isAllowlisted: true,
  } as unknown as UserDoc;
}

beforeAll(async () => {
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "coll-api-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test-project";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();

  await Card.insertMany([
    {
      scryfallId: SCRYFALL_ID_A,
      oracleId: "oracle-a",
      name: "Lightning Bolt",
      set: "m21",
      collectorNumber: "152",
      collectorNumberValue: 152,
      rarity: "common",
      rarityValue: 1,
      colors: ["R"],
      colorIdentity: ["R"],
      typeLine: "Instant",
      manaCost: "{R}",
      cmc: 1,
      oracleText: "Deal 3 damage.",
      flavorText: "",
      cardFaces: [],
      layout: "normal",
      legalities: new Map([["commander", "legal"]]),
      inBooster: true,
      cachedAt: new Date(),
    },
    {
      scryfallId: SCRYFALL_ID_B,
      oracleId: "oracle-b",
      name: "Counterspell",
      set: "m21",
      collectorNumber: "056",
      collectorNumberValue: 56,
      rarity: "uncommon",
      rarityValue: 2,
      colors: ["U"],
      colorIdentity: ["U"],
      typeLine: "Instant",
      manaCost: "{U}{U}",
      cmc: 2,
      oracleText: "Counter target spell.",
      flavorText: "",
      cardFaces: [],
      layout: "normal",
      legalities: new Map([["commander", "legal"]]),
      inBooster: true,
      cachedAt: new Date(),
    },
  ]);

  await User.insertMany([
    {
      uid: ADMIN_UID,
      email: "admin@test.com",
      displayName: "Admin",
      photoURL: "",
      role: "admin",
      vaultCoins: 0,
      isAllowlisted: true,
    },
    {
      uid: USER_UID,
      email: "user@test.com",
      displayName: "User",
      photoURL: "",
      role: "user",
      vaultCoins: 0,
      isAllowlisted: true,
    },
  ]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

beforeEach(async () => {
  await UserCollection.deleteMany({});
  getCurrentUserMock.mockReset();
});

describe("GET /api/collection", () => {
  it("returns 401 for unauthenticated requests", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await getCollection();
    expect(res.status).toBe(401);
  });

  it("returns empty collection for a new user", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID));
    const res = await getCollection();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entries).toEqual([]);
    expect(body.uniqueCards).toBe(0);
  });

  it("returns collection entries with card detail", async () => {
    const cardDoc = await Card.findOne({ scryfallId: SCRYFALL_ID_A }).lean();
    await addCards(USER_UID, [cardDoc!._id as Types.ObjectId], "admin");

    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID));
    const res = await getCollection();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].card.scryfallId).toBe(SCRYFALL_ID_A);
    expect(body.entries[0].quantity).toBe(1);
    expect(body.entries[0].obtainedVia).toContain("admin");
    expect(body.uniqueCards).toBe(1);
    expect(body.totalCards).toBe(1);
  });
});

describe("GET /api/collection/export", () => {
  beforeEach(async () => {
    const [cardA, cardB] = await Card.find(
      { scryfallId: { $in: [SCRYFALL_ID_A, SCRYFALL_ID_B] } },
      { _id: 1 },
    ).lean();
    await addCards(
      USER_UID,
      [cardA!._id as Types.ObjectId, cardA!._id as Types.ObjectId, cardB!._id as Types.ObjectId],
      "admin",
    );
  });

  it("returns text format with Nx prefix", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID));
    const req = new Request(
      "http://localhost/api/collection/export?format=text",
    );
    const res = await getExport(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("2x Lightning Bolt");
    expect(text).toContain("1x Counterspell");
  });

  it("returns mtgo format with space separator", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID));
    const req = new Request(
      "http://localhost/api/collection/export?format=mtgo",
    );
    const res = await getExport(req);
    const text = await res.text();
    expect(text).toContain("2 Lightning Bolt");
    expect(text).toContain("1 Counterspell");
    expect(text).not.toContain("2x");
  });

  it("returns 400 for invalid format", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID));
    const req = new Request(
      "http://localhost/api/collection/export?format=csv",
    );
    const res = await getExport(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/collection/ids", () => {
  it("returns empty array for new user", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID));
    const res = await getIds();
    const body = await res.json();
    expect(body.scryfallIds).toEqual([]);
  });

  it("returns owned scryfallIds", async () => {
    const cardDoc = await Card.findOne({ scryfallId: SCRYFALL_ID_A }).lean();
    await addCards(USER_UID, [cardDoc!._id as Types.ObjectId], "shop");

    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID));
    const res = await getIds();
    const body = await res.json();
    expect(body.scryfallIds).toContain(SCRYFALL_ID_A);
    expect(body.scryfallIds).not.toContain(SCRYFALL_ID_B);
  });
});

describe("POST /api/admin/collection/grant", () => {
  it("returns 403 for non-admin users", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(USER_UID, "user"));
    const req = new Request("http://localhost/api/admin/collection/grant", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: USER_UID,
        scryfallIds: [SCRYFALL_ID_A],
      }),
    });
    const res = await grantCards(req);
    expect(res.status).toBe(403);
  });

  it("grants cards to a target user", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(ADMIN_UID, "admin"));
    const req = new Request("http://localhost/api/admin/collection/grant", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: USER_UID,
        scryfallIds: [SCRYFALL_ID_A, SCRYFALL_ID_B],
      }),
    });
    const res = await grantCards(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.granted).toBe(2);

    const doc = await UserCollection.findOne({ userId: USER_UID }).lean();
    expect(doc!.cards).toHaveLength(2);
  });

  it("returns 404 for unknown target user", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(ADMIN_UID, "admin"));
    const req = new Request("http://localhost/api/admin/collection/grant", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "ghost-uid",
        scryfallIds: [SCRYFALL_ID_A],
      }),
    });
    const res = await grantCards(req);
    expect(res.status).toBe(404);
  });

  it("rejects invalid body (empty scryfallIds)", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(ADMIN_UID, "admin"));
    const req = new Request("http://localhost/api/admin/collection/grant", {
      method: "POST",
      body: JSON.stringify({ targetUserId: USER_UID, scryfallIds: [] }),
    });
    const res = await grantCards(req);
    expect(res.status).toBe(400);
  });
});
