import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: getCurrentUserMock }));

import { GET as getShop } from "@/app/api/shop/route";
import { POST as purchase } from "@/app/api/shop/purchase/route";
import { connectToDatabase } from "@/lib/db";
import { creditWallet } from "@/lib/game/wallet";
import { Card } from "@/lib/models/Card";
import { CardSet } from "@/lib/models/CardSet";
import { Transaction } from "@/lib/models/Transaction";
import { User } from "@/lib/models/User";
import { UserCollection } from "@/lib/models/UserCollection";
import type { UserDoc } from "@/lib/models/User";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID = "shop-user-001";
const SET_CODE = "sht";

function makeUser(uid = UID): UserDoc {
  return { uid, email: `${uid}@t.com`, displayName: "Test", photoURL: "", role: "user", vaultCoins: 0, isAllowlisted: true } as unknown as UserDoc;
}

function makeCard(name: string, rarity: string, n: number) {
  return {
    scryfallId: `11111111-1111-4111-8000-${String(n).padStart(12, "0")}`,
    oracleId: `shop-oracle-${n}`,
    name,
    set: SET_CODE,
    collectorNumber: String(n),
    collectorNumberValue: n,
    rarity,
    rarityValue: 1,
    colors: ["R"],
    colorIdentity: ["R"],
    typeLine: "Creature",
    manaCost: "{R}",
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
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "shop-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();

  await User.create({ uid: UID, email: `${UID}@t.com`, displayName: "Test", photoURL: "", role: "user", vaultCoins: 0, isAllowlisted: true });

  await CardSet.create({ code: SET_CODE, name: "Shop Test Set", enabled: true, boosterPrice: 100, cachedAt: new Date(), cardsSyncedAt: new Date() });

  await Card.insertMany([
    ...Array.from({ length: 25 }, (_, i) => makeCard(`Common ${i}`, "common", i + 1)),
    ...Array.from({ length: 10 }, (_, i) => makeCard(`Uncommon ${i}`, "uncommon", i + 100)),
    ...Array.from({ length: 5 }, (_, i) => makeCard(`Rare ${i}`, "rare", i + 200)),
    ...Array.from({ length: 2 }, (_, i) => makeCard(`Mythic ${i}`, "mythic", i + 300)),
  ]);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

beforeEach(async () => {
  await User.updateOne({ uid: UID }, { $set: { vaultCoins: 0 } });
  await Transaction.deleteMany({ userId: UID });
  await UserCollection.deleteMany({ userId: UID });
  getCurrentUserMock.mockReset();
  getCurrentUserMock.mockResolvedValue(makeUser());
});

describe("GET /api/shop", () => {
  it("returns pack catalog and user balance", async () => {
    const res = await getShop();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.packs).toBeInstanceOf(Array);
    const pack = body.packs.find((p: { setCode: string }) => p.setCode === SET_CODE);
    expect(pack).toBeDefined();
    expect(pack.price).toBe(100);
    expect(body.balance).toBe(0);
  });
});

describe("POST /api/shop/purchase", () => {
  it("deducts VC, generates cards, and returns them", async () => {
    await creditWallet(UID, 200, "admin_grant");
    getCurrentUserMock.mockResolvedValue({ ...makeUser(), vaultCoins: 200 });

    const req = new Request("http://localhost/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setCode: SET_CODE, quantity: 1 }),
    });
    const res = await purchase(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(15);
    // first_purchase achievement credits +50 VC: 200 - 100 + 50 = 150
    expect(body.newBalance).toBe(100);
    expect(body.packCount).toBe(1);

    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.vaultCoins).toBe(150); // includes achievement reward

    const coll = await UserCollection.findOne({ userId: UID }).lean();
    expect(coll!.cards.length).toBeGreaterThan(0);
  });

  it("returns 402 when balance is insufficient", async () => {
    const req = new Request("http://localhost/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setCode: SET_CODE, quantity: 1 }),
    });
    const res = await purchase(req);
    expect(res.status).toBe(402);
  });

  it("returns 404 for an unknown set", async () => {
    await creditWallet(UID, 500, "admin_grant");
    getCurrentUserMock.mockResolvedValue({ ...makeUser(), vaultCoins: 500 });

    const req = new Request("http://localhost/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setCode: "zzz", quantity: 1 }),
    });
    const res = await purchase(req);
    expect(res.status).toBe(404);
  });

  it("no double-spend: concurrent purchases with only enough for one", async () => {
    await creditWallet(UID, 100, "admin_grant"); // enough for exactly 1 pack

    const makeReq = () =>
      new Request("http://localhost/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setCode: SET_CODE, quantity: 1 }),
      });

    const [r1, r2] = await Promise.all([purchase(makeReq()), purchase(makeReq())]);
    const statuses = [r1.status, r2.status].sort();

    expect(statuses).toEqual([200, 402]); // exactly one succeeds
    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.vaultCoins).toBeGreaterThanOrEqual(0); // never negative
  });
});
