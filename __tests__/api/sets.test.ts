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

import { GET as setsGet } from "@/app/api/sets/route";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";
import { User } from "@/lib/models/User";
import type { UserDoc } from "@/lib/models/User";
import type { BlockGroup, SetSummary } from "@/lib/sets-grouping";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID = "sets-api-user";

function makeUser(): UserDoc {
  return {
    uid: UID,
    email: `${UID}@test.com`,
    displayName: "Test",
    photoURL: "",
    role: "user",
    vaultCoins: 0,
    isAllowlisted: true,
  } as unknown as UserDoc;
}

beforeAll(async () => {
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "sets-api-"));
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
  await CardSet.deleteMany({});
  getCurrentUserMock.mockReset();
  getCurrentUserMock.mockResolvedValue(makeUser());
});

describe("GET /api/sets", () => {
  it("returns grouped structure with blocks and standalone keys", async () => {
    await CardSet.create([
      { code: "dom", name: "Dominaria", enabled: true, cachedAt: new Date(), cardCount: 280 },
    ]);
    const res = await setsGet();
    const body = await res.json() as { blocks: unknown[]; standalone: unknown[] };
    expect(res.status).toBe(200);
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(Array.isArray(body.standalone)).toBe(true);
  });

  it("places block-assigned sets in blocks, others in standalone", async () => {
    await CardSet.create([
      { code: "rav", name: "Ravnica: City of Guilds", enabled: true, cachedAt: new Date(), block: "ravnica", blockName: "Ravnica: City of Guilds Block", blockOrder: 30, setOrderInBlock: 1, cardCount: 306 },
      { code: "gpt", name: "Guildpact", enabled: true, cachedAt: new Date(), block: "ravnica", blockName: "Ravnica: City of Guilds Block", blockOrder: 30, setOrderInBlock: 2, cardCount: 165 },
      { code: "dom", name: "Dominaria", enabled: true, cachedAt: new Date(), cardCount: 280 },
    ]);
    const res = await setsGet();
    const body = await res.json() as { blocks: BlockGroup[]; standalone: SetSummary[] };
    expect(body.blocks).toHaveLength(1);
    expect(body.blocks[0].id).toBe("ravnica");
    expect(body.blocks[0].sets).toHaveLength(2);
    expect(body.standalone).toHaveLength(1);
    expect(body.standalone[0].code).toBe("dom");
  });

  it("includes unsynced enabled sets with synced=false", async () => {
    await CardSet.create([
      { code: "dis", name: "Dissension", enabled: true, block: "ravnica", blockName: "Ravnica: City of Guilds Block", blockOrder: 30, setOrderInBlock: 3, cardCount: 0 },
    ]);
    const res = await setsGet();
    const body = await res.json() as { blocks: BlockGroup[] };
    expect(res.status).toBe(200);
    expect(body.blocks[0].sets[0].synced).toBe(false);
  });

  it("excludes disabled sets", async () => {
    await CardSet.create([
      { code: "dom", name: "Dominaria", enabled: false, cachedAt: new Date(), cardCount: 280 },
    ]);
    const res = await setsGet();
    const body = await res.json() as { blocks: unknown[]; standalone: unknown[] };
    expect(body.blocks).toHaveLength(0);
    expect(body.standalone).toHaveLength(0);
  });

  it("returns 401 for unauthenticated requests", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await setsGet();
    expect(res.status).toBe(401);
  });
});
