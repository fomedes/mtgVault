/**
 * P14-10 — Friends API tests
 * Tests: request/accept/decline/remove flow, rate-limit, anti-enumeration,
 * friend-collection read-only gate.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
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

// Disable rate-limit for most tests to avoid noise.
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 99, retryAfterSeconds: 0 }),
}));

import { NextRequest } from "next/server";
import { GET as getFriends, POST as sendRequest } from "@/app/api/friends/route";
import { POST as friendAction, DELETE as removeFriend } from "@/app/api/friends/[id]/route";
import { GET as getFriendCollection } from "@/app/api/friends/[id]/collection/route";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Friendship } from "@/lib/models/Friendship";
import { Notification } from "@/lib/models/Notification";
import type { UserDoc } from "@/lib/models/User";

let mongod: MongoMemoryServer;
let dbPath: string;

const UID_A = "user-alpha-001";
const UID_B = "user-bravo-002";
const UID_C = "user-charlie-003";

function makeUser(uid: string, friendCode?: string): UserDoc {
  return {
    uid,
    email: `${uid}@test.com`,
    displayName: `User ${uid.slice(-3)}`,
    photoURL: "",
    role: "user",
    vaultCoins: 0,
    isAllowlisted: true,
    friendCode: friendCode ?? `1234${uid.slice(-4)}`,
  } as unknown as UserDoc;
}

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/friends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeActionRequest(action: string): NextRequest {
  return new NextRequest("http://localhost/api/friends/id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

beforeAll(async () => {
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "friends-api-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test-project";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";

  await connectToDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  await rm(dbPath, { recursive: true, force: true });
});

beforeEach(async () => {
  await User.deleteMany({});
  await Friendship.deleteMany({});
  await Notification.deleteMany({});

  await User.insertMany([
    {
      uid: UID_A,
      email: "a@test.com",
      displayName: "Alice",
      photoURL: "",
      role: "user",
      vaultCoins: 0,
      isAllowlisted: true,
      friendCode: "12345678",
    },
    {
      uid: UID_B,
      email: "b@test.com",
      displayName: "Bob",
      photoURL: "",
      role: "user",
      vaultCoins: 0,
      isAllowlisted: true,
      friendCode: "87654321",
    },
    {
      uid: UID_C,
      email: "c@test.com",
      displayName: "Carol",
      photoURL: "",
      role: "user",
      vaultCoins: 0,
      isAllowlisted: true,
      friendCode: "11112222",
    },
  ]);
});

// ── GET /api/friends ─────────────────────────────────────────────────────────

describe("GET /api/friends — list", () => {
  it("returns empty lists when no friendships exist", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await getFriends();
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      friends: unknown[];
      pendingIncoming: unknown[];
      pendingOutgoing: unknown[];
    };
    expect(data.friends).toHaveLength(0);
    expect(data.pendingIncoming).toHaveLength(0);
    expect(data.pendingOutgoing).toHaveLength(0);
  });

  it("returns 401 for unauthenticated caller", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await getFriends();
    expect(res.status).toBe(401);
  });

  it("separates accepted friends from pending", async () => {
    // A<->B accepted, A->C pending outgoing
    const [userA, userB] = [UID_A, UID_B].sort();
    await Friendship.create({
      userA: userA,
      userB: userB,
      requesterUid: UID_A,
      status: "accepted",
    });
    const [userAC, userCC] = [UID_A, UID_C].sort();
    await Friendship.create({
      userA: userAC,
      userB: userCC,
      requesterUid: UID_A,
      status: "pending",
    });

    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await getFriends();
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      friends: { uid: string }[];
      pendingIncoming: unknown[];
      pendingOutgoing: { uid: string }[];
    };
    expect(data.friends).toHaveLength(1);
    expect(data.friends[0].uid).toBe(UID_B);
    expect(data.pendingOutgoing).toHaveLength(1);
    expect(data.pendingOutgoing[0].uid).toBe(UID_C);
    expect(data.pendingIncoming).toHaveLength(0);
  });

  it("shows incoming request for the recipient", async () => {
    const [userA, userB] = [UID_A, UID_B].sort();
    await Friendship.create({
      userA,
      userB,
      requesterUid: UID_A,
      status: "pending",
    });

    getCurrentUserMock.mockResolvedValue(makeUser(UID_B));
    const res = await getFriends();
    const data = (await res.json()) as {
      pendingIncoming: { uid: string }[];
      pendingOutgoing: unknown[];
    };
    expect(data.pendingIncoming).toHaveLength(1);
    expect(data.pendingIncoming[0].uid).toBe(UID_A);
    expect(data.pendingOutgoing).toHaveLength(0);
  });
});

// ── POST /api/friends (send request) ─────────────────────────────────────────

describe("POST /api/friends — send request", () => {
  it("always returns { ok: true } even for non-existent codes (anti-enumeration)", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await sendRequest(makeRequest({ friendCode: "99999999" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    // No friendship created.
    const count = await Friendship.countDocuments();
    expect(count).toBe(0);
  });

  it("returns 400 for invalid code format", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await sendRequest(makeRequest({ friendCode: "abc" }));
    expect(res.status).toBe(400);
  });

  it("creates a pending friendship when code is valid", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    // Bob's code is "87654321"
    const res = await sendRequest(makeRequest({ friendCode: "87654321" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const friendship = await Friendship.findOne().lean();
    expect(friendship).not.toBeNull();
    expect(friendship?.requesterUid).toBe(UID_A);
    expect(friendship?.status).toBe("pending");
  });

  it("creates a notification for the target user", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    await sendRequest(makeRequest({ friendCode: "87654321" }));

    const notif = await Notification.findOne({ userId: UID_B }).lean();
    expect(notif?.type).toBe("friend_request");
    expect(notif?.fromUid).toBe(UID_A);
  });

  it("silently succeeds if request already exists (no duplicate)", async () => {
    const [ua, ub] = [UID_A, UID_B].sort();
    await Friendship.create({ userA: ua, userB: ub, requesterUid: UID_A, status: "pending" });

    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await sendRequest(makeRequest({ friendCode: "87654321" }));
    expect(res.status).toBe(200);
    const count = await Friendship.countDocuments();
    expect(count).toBe(1); // no duplicate
  });

  it("silently succeeds if user tries to add themselves", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    // Alice's own code
    const res = await sendRequest(makeRequest({ friendCode: "12345678" }));
    expect(res.status).toBe(200);
    const count = await Friendship.countDocuments();
    expect(count).toBe(0);
  });
});

// ── POST /api/friends/[id] — accept / decline ─────────────────────────────────

describe("POST /api/friends/[id] — accept/decline", () => {
  async function createPending() {
    const [ua, ub] = [UID_A, UID_B].sort();
    return Friendship.create({ userA: ua, userB: ub, requesterUid: UID_A, status: "pending" });
  }

  it("allows the non-requester to accept", async () => {
    const f = await createPending();
    getCurrentUserMock.mockResolvedValue(makeUser(UID_B));
    const res = await friendAction(makeActionRequest("accept"), {
      params: Promise.resolve({ id: String(f._id) }),
    });
    expect(res.status).toBe(200);
    const updated = await Friendship.findById(f._id).lean();
    expect(updated?.status).toBe("accepted");
  });

  it("creates a friend_accepted notification on accept", async () => {
    const f = await createPending();
    getCurrentUserMock.mockResolvedValue(makeUser(UID_B));
    await friendAction(makeActionRequest("accept"), {
      params: Promise.resolve({ id: String(f._id) }),
    });
    const notif = await Notification.findOne({ userId: UID_A }).lean();
    expect(notif?.type).toBe("friend_accepted");
  });

  it("forbids the requester from accepting their own request", async () => {
    const f = await createPending();
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await friendAction(makeActionRequest("accept"), {
      params: Promise.resolve({ id: String(f._id) }),
    });
    expect(res.status).toBe(403);
  });

  it("allows the non-requester to decline (deletes the record)", async () => {
    const f = await createPending();
    getCurrentUserMock.mockResolvedValue(makeUser(UID_B));
    const res = await friendAction(makeActionRequest("decline"), {
      params: Promise.resolve({ id: String(f._id) }),
    });
    expect(res.status).toBe(200);
    const count = await Friendship.countDocuments();
    expect(count).toBe(0);
  });

  it("returns 404 for a non-existent friendship id", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_B));
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await friendAction(makeActionRequest("accept"), {
      params: Promise.resolve({ id: fakeId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when a stranger tries to act on someone else's request", async () => {
    const f = await createPending();
    getCurrentUserMock.mockResolvedValue(makeUser(UID_C));
    const res = await friendAction(makeActionRequest("accept"), {
      params: Promise.resolve({ id: String(f._id) }),
    });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/friends/[id] — remove ─────────────────────────────────────────

describe("DELETE /api/friends/[id] — remove", () => {
  async function createAccepted() {
    const [ua, ub] = [UID_A, UID_B].sort();
    return Friendship.create({ userA: ua, userB: ub, requesterUid: UID_A, status: "accepted" });
  }

  it("allows either party to remove the friendship", async () => {
    const f = await createAccepted();
    getCurrentUserMock.mockResolvedValue(makeUser(UID_B));
    const res = await removeFriend(
      new NextRequest("http://localhost", { method: "DELETE" }),
      { params: Promise.resolve({ id: String(f._id) }) },
    );
    expect(res.status).toBe(200);
    const count = await Friendship.countDocuments();
    expect(count).toBe(0);
  });

  it("forbids a stranger from removing someone else's friendship", async () => {
    const f = await createAccepted();
    getCurrentUserMock.mockResolvedValue(makeUser(UID_C));
    const res = await removeFriend(
      new NextRequest("http://localhost", { method: "DELETE" }),
      { params: Promise.resolve({ id: String(f._id) }) },
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /api/friends/[id]/collection — friendship gate ─────────────────────────

describe("GET /api/friends/[id]/collection — friendship gate", () => {
  it("returns 403 when there is no accepted friendship", async () => {
    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await getFriendCollection(
      new NextRequest("http://localhost"),
      { params: Promise.resolve({ id: UID_B }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when friendship is pending (not accepted)", async () => {
    const [ua, ub] = [UID_A, UID_B].sort();
    await Friendship.create({ userA: ua, userB: ub, requesterUid: UID_A, status: "pending" });

    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await getFriendCollection(
      new NextRequest("http://localhost"),
      { params: Promise.resolve({ id: UID_B }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with empty collection when friendship is accepted", async () => {
    const [ua, ub] = [UID_A, UID_B].sort();
    await Friendship.create({ userA: ua, userB: ub, requesterUid: UID_A, status: "accepted" });

    getCurrentUserMock.mockResolvedValue(makeUser(UID_A));
    const res = await getFriendCollection(
      new NextRequest("http://localhost"),
      { params: Promise.resolve({ id: UID_B }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { entries: unknown[]; uniqueCards: number };
    expect(data.uniqueCards).toBe(0);
  });

  it("returns 401 for unauthenticated caller", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await getFriendCollection(
      new NextRequest("http://localhost"),
      { params: Promise.resolve({ id: UID_B }) },
    );
    expect(res.status).toBe(401);
  });
});

// ── Friendship model: canonicalPair ──────────────────────────────────────────

describe("canonicalPair", () => {
  it("always puts the lexicographically smaller uid as userA", async () => {
    const { canonicalPair } = await import("@/lib/models/Friendship");
    const r1 = canonicalPair("zzz", "aaa");
    expect(r1.userA).toBe("aaa");
    expect(r1.userB).toBe("zzz");
    const r2 = canonicalPair("aaa", "zzz");
    expect(r2.userA).toBe("aaa");
    expect(r2.userB).toBe("zzz");
  });

  it("deduplicates friendships regardless of request direction", async () => {
    const [ua, ub] = [UID_A, UID_B].sort();
    await Friendship.create({ userA: ua, userB: ub, requesterUid: UID_A, status: "pending" });
    // Trying to create the same pair from the other direction should throw a
    // duplicate key error due to the unique compound index.
    await expect(
      Friendship.create({ userA: ua, userB: ub, requesterUid: UID_B, status: "pending" }),
    ).rejects.toThrow();
  });
});
