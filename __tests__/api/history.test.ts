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

import { GET as historyGet } from "@/app/api/history/route";
import { connectToDatabase } from "@/lib/db";
import { SavedDeck } from "@/lib/models/SavedDeck";
import { User } from "@/lib/models/User";
import type { UserDoc } from "@/lib/models/User";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID = "history-user-001";

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

function historyRequest(kind?: string): Request {
  const url = kind
    ? `http://localhost/api/history?kind=${kind}`
    : "http://localhost/api/history";
  return new Request(url);
}

beforeAll(async () => {
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "history-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();
  await User.create({
    uid: UID,
    email: `${UID}@test.com`,
    displayName: "Test",
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
  await SavedDeck.deleteMany({});
  getCurrentUserMock.mockReset();
  getCurrentUserMock.mockResolvedValue(makeUser());
});

describe("GET /api/history", () => {
  it("returns all drafts when no kind filter is specified", async () => {
    await SavedDeck.create([
      { userId: UID, sessionId: "mp-1", setCode: "neo", cardIds: ["a", "b"], kind: "multiplayer" },
      { userId: UID, sessionId: "ph-1", setCode: "dom", cardIds: ["c"], kind: "phantom", difficulty: "easy" },
    ]);

    const res = await historyGet(historyRequest());
    const body = await res.json() as { drafts: unknown[] };

    expect(res.status).toBe(200);
    expect(body.drafts).toHaveLength(2);
  });

  it("returns all drafts when kind=all", async () => {
    await SavedDeck.create([
      { userId: UID, sessionId: "mp-1", setCode: "neo", cardIds: ["a"], kind: "multiplayer" },
      { userId: UID, sessionId: "ph-1", setCode: "dom", cardIds: ["b"], kind: "phantom", difficulty: "hard" },
    ]);

    const res = await historyGet(historyRequest("all"));
    const body = await res.json() as { drafts: unknown[] };

    expect(res.status).toBe(200);
    expect(body.drafts).toHaveLength(2);
  });

  it("filters to multiplayer only", async () => {
    await SavedDeck.create([
      { userId: UID, sessionId: "mp-1", setCode: "neo", cardIds: ["a"], kind: "multiplayer" },
      { userId: UID, sessionId: "ph-1", setCode: "dom", cardIds: ["b"], kind: "phantom", difficulty: "hard" },
    ]);

    const res = await historyGet(historyRequest("multiplayer"));
    const body = await res.json() as { drafts: Array<{ kind: string; sessionId: string }> };

    expect(res.status).toBe(200);
    expect(body.drafts).toHaveLength(1);
    expect(body.drafts[0].kind).toBe("multiplayer");
    expect(body.drafts[0].sessionId).toBe("mp-1");
  });

  it("filters to phantom only", async () => {
    await SavedDeck.create([
      { userId: UID, sessionId: "mp-1", setCode: "neo", cardIds: ["a"], kind: "multiplayer" },
      { userId: UID, sessionId: "ph-1", setCode: "dom", cardIds: ["b"], kind: "phantom", difficulty: "medium" },
    ]);

    const res = await historyGet(historyRequest("phantom"));
    const body = await res.json() as { drafts: Array<{ kind: string; difficulty?: string }> };

    expect(res.status).toBe(200);
    expect(body.drafts).toHaveLength(1);
    expect(body.drafts[0].kind).toBe("phantom");
    expect(body.drafts[0].difficulty).toBe("medium");
  });

  it("phantom rows include difficulty; multiplayer rows omit it", async () => {
    await SavedDeck.create([
      { userId: UID, sessionId: "mp-1", setCode: "neo", cardIds: ["a"], kind: "multiplayer" },
      { userId: UID, sessionId: "ph-1", setCode: "dom", cardIds: ["b"], kind: "phantom", difficulty: "hard" },
    ]);

    const res = await historyGet(historyRequest());
    const body = await res.json() as {
      drafts: Array<{ kind: string; difficulty?: string }>;
    };

    const mp = body.drafts.find((d) => d.kind === "multiplayer");
    const ph = body.drafts.find((d) => d.kind === "phantom");

    expect(mp?.difficulty).toBeUndefined();
    expect(ph?.difficulty).toBe("hard");
  });

  it("rejects an invalid kind value", async () => {
    const res = await historyGet(historyRequest("invalid"));
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated requests", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await historyGet(historyRequest());
    expect(res.status).toBe(401);
  });

  it("returns only the requesting user's own history", async () => {
    await SavedDeck.create([
      { userId: UID, sessionId: "mine", setCode: "neo", cardIds: ["a"], kind: "multiplayer" },
      { userId: "other-user", sessionId: "theirs", setCode: "dom", cardIds: ["b"], kind: "multiplayer" },
    ]);

    const res = await historyGet(historyRequest());
    const body = await res.json() as { drafts: Array<{ sessionId: string }> };

    expect(body.drafts).toHaveLength(1);
    expect(body.drafts[0].sessionId).toBe("mine");
  });

  it("paginates to at most 50 records", async () => {
    await SavedDeck.insertMany(
      Array.from({ length: 55 }, (_, i) => ({
        userId: UID,
        sessionId: `s-${i}`,
        setCode: "neo",
        cardIds: ["x"],
        kind: "multiplayer",
      })),
    );

    const res = await historyGet(historyRequest());
    const body = await res.json() as { drafts: unknown[] };

    expect(body.drafts).toHaveLength(50);
  });

  it("returns each row with sessionId, setCode, pickCount, completedAt, kind", async () => {
    await SavedDeck.create({
      userId: UID,
      sessionId: "mp-shape",
      setCode: "woe",
      cardIds: ["a", "b", "c"],
      kind: "multiplayer",
    });

    const res = await historyGet(historyRequest());
    const body = await res.json() as {
      drafts: Array<{ sessionId: string; setCode: string; pickCount: number; completedAt: string; kind: string; players: string[] }>;
    };

    expect(body.drafts[0]).toMatchObject({
      sessionId: "mp-shape",
      setCode: "woe",
      pickCount: 3,
      kind: "multiplayer",
    });
    expect(typeof body.drafts[0].completedAt).toBe("string");
    expect(Array.isArray(body.drafts[0].players)).toBe(true);
  });
});
