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

import { PATCH as patchPreferences } from "@/app/api/me/preferences/route";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import type { UserDoc } from "@/lib/models/User";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID = "prefs-user-001";

function makeUser(uid = UID): UserDoc {
  return {
    uid,
    email: `${uid}@test.com`,
    displayName: "Test",
    photoURL: "",
    role: "user",
    vaultCoins: 0,
    isAllowlisted: true,
  } as unknown as UserDoc;
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/me/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeAll(async () => {
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "prefs-"));

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
  await User.updateOne({ uid: UID }, { $unset: { preferences: 1 } });
  getCurrentUserMock.mockReset();
  getCurrentUserMock.mockResolvedValue(makeUser());
});

describe("PATCH /api/me/preferences", () => {
  it("persists a valid background id", async () => {
    const res = await patchPreferences(patchRequest({ background: "arcane" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.background).toBe("arcane");

    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.preferences?.background).toBe("arcane");
  });

  it("rejects an unknown background id", async () => {
    const res = await patchPreferences(patchRequest({ background: "../../etc/passwd" }));
    expect(res.status).toBe(400);

    const user = await User.findOne({ uid: UID }).lean();
    expect(user!.preferences?.background ?? "none").toBe("none");
  });

  it("rejects a missing background field", async () => {
    const res = await patchPreferences(patchRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated requests", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await patchPreferences(patchRequest({ background: "island" }));
    expect(res.status).toBe(401);
  });
});
