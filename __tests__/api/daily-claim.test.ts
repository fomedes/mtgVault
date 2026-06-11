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

import { POST as claimBonus } from "@/app/api/daily-claim/route";
import { connectToDatabase } from "@/lib/db";
import { GAME_CONFIG } from "@/lib/game/config";
import { Transaction } from "@/lib/models/Transaction";
import { User } from "@/lib/models/User";
import type { UserDoc } from "@/lib/models/User";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID = "daily-user-001";

function makeUser(uid = UID): UserDoc {
  return { uid, email: `${uid}@test.com`, displayName: "Test", photoURL: "", role: "user", vaultCoins: 0, isAllowlisted: true } as unknown as UserDoc;
}

beforeAll(async () => {
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "daily-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();
  await User.create({ uid: UID, email: `${UID}@test.com`, displayName: "Test", photoURL: "", role: "user", vaultCoins: 0, isAllowlisted: true });
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

beforeEach(async () => {
  await User.updateOne({ uid: UID }, { $set: { vaultCoins: 0 }, $unset: { lastDailyBonusAt: 1 } });
  await Transaction.deleteMany({ userId: UID });
  getCurrentUserMock.mockReset();
  getCurrentUserMock.mockResolvedValue(makeUser());
});

describe("POST /api/daily-claim", () => {
  it("awards first-time bonus on first ever claim", async () => {
    const res = await claimBonus();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claimed).toBe(true);
    expect(body.bonus).toBe(GAME_CONFIG.FIRST_TIME_BONUS);
    expect(body.isFirstTime).toBe(true);
    expect(body.newBalance).toBe(GAME_CONFIG.FIRST_TIME_BONUS);
  });

  it("awards regular daily bonus on subsequent days", async () => {
    // Simulate yesterday's claim
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await User.updateOne({ uid: UID }, { $set: { lastDailyBonusAt: yesterday } });

    const res = await claimBonus();
    const body = await res.json();
    expect(body.claimed).toBe(true);
    expect(body.bonus).toBe(GAME_CONFIG.DAILY_BONUS);
    expect(body.isFirstTime).toBe(false);
  });

  it("does not award bonus twice in the same UTC day (idempotent)", async () => {
    await claimBonus(); // first claim today
    const res2 = await claimBonus(); // second claim same day
    const body = await res2.json();
    expect(body.claimed).toBe(false);
    expect(body.bonus).toBe(0);

    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.vaultCoins).toBe(GAME_CONFIG.FIRST_TIME_BONUS); // only one bonus
  });

  it("returns 401 for unauthenticated requests", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await claimBonus();
    expect(res.status).toBe(401);
  });
});
