import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectToDatabase } from "@/lib/db";
import { creditWallet, debitWallet, InsufficientFundsError } from "@/lib/game/wallet";
import { Transaction } from "@/lib/models/Transaction";
import { User } from "@/lib/models/User";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID = "wallet-test-user";

beforeAll(async () => {
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "wallet-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();

  await User.create({
    uid: UID,
    email: "wallet@test.com",
    displayName: "Wallet Test",
    photoURL: "",
    role: "user",
    vaultCoins: 0,
    isAllowlisted: true,
  });
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

beforeEach(async () => {
  await User.updateOne({ uid: UID }, { $set: { vaultCoins: 0 } });
  await Transaction.deleteMany({ userId: UID });
});

describe("creditWallet", () => {
  it("increases vaultCoins and records a transaction", async () => {
    const { newBalance } = await creditWallet(UID, 100, "admin_grant");
    expect(newBalance).toBe(100);

    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.vaultCoins).toBe(100);

    const tx = await Transaction.findOne({ userId: UID }).lean();
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe("credit");
    expect(tx!.amount).toBe(100);
    expect(tx!.balanceBefore).toBe(0);
    expect(tx!.balanceAfter).toBe(100);
    expect(tx!.reason).toBe("admin_grant");
  });

  it("accumulates balance across multiple credits", async () => {
    await creditWallet(UID, 50, "daily_bonus");
    const { newBalance } = await creditWallet(UID, 75, "daily_bonus");
    expect(newBalance).toBe(125);
  });
});

describe("debitWallet", () => {
  it("decreases vaultCoins and records a transaction", async () => {
    await creditWallet(UID, 200, "admin_grant");
    const { newBalance } = await debitWallet(UID, 100, "shop_purchase", { setCode: "mh2" });
    expect(newBalance).toBe(100);

    const txs = await Transaction.find({ userId: UID }).sort({ createdAt: 1 }).lean();
    const debitTx = txs[1];
    expect(debitTx.type).toBe("debit");
    expect(debitTx.amount).toBe(100);
    expect(debitTx.balanceBefore).toBe(200);
    expect(debitTx.balanceAfter).toBe(100);
  });

  it("throws InsufficientFundsError when balance is too low", async () => {
    await creditWallet(UID, 50, "admin_grant");
    await expect(debitWallet(UID, 100, "shop_purchase")).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
    // Balance must be unchanged
    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.vaultCoins).toBe(50);
  });

  it("prevents balance from going negative (concurrent debit race)", async () => {
    await creditWallet(UID, 100, "admin_grant");
    // Fire two concurrent debits of 100 each — only one should succeed.
    const results = await Promise.allSettled([
      debitWallet(UID, 100, "shop_purchase"),
      debitWallet(UID, 100, "shop_purchase"),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    expect(succeeded).toBe(1);
    expect(failed).toBe(1);

    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.vaultCoins).toBe(0); // never negative
    expect(user!.vaultCoins).toBeGreaterThanOrEqual(0);
  });
});
