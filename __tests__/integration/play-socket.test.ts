import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { Deck } from "@/lib/models/Deck";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { registerPlayHandlers } from "@/server/play/lobby";
import { registerPlayEventHandlers } from "@/server/play/events";
import { registerPlayReconnectHandlers } from "@/server/play/reconnect";
import { removePlay } from "@/server/play/state";
import type { PlayerBoardView } from "@/lib/game/play";

let mongod: MongoMemoryServer;
let dbPath: string;
let httpServer: HttpServer;
let io: Server;
let port: number;

const boards = new Map<string, PlayerBoardView>();

beforeAll(async () => {
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "play-socket-"));
  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test-project";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";
  await connectToDatabase();

  // Seed a 10-card deck for each player.
  for (const uid of ["alice", "bob"]) {
    const cards = [];
    for (let i = 0; i < 10; i++) {
      const c = await Card.create({
        scryfallId: `sf-${uid}-${i}`,
        name: `${uid} Card ${i}`,
        set: "tst",
        collectorNumber: String(i),
        rarity: "common",
        cachedAt: new Date(),
      });
      cards.push({
        cardId: c._id,
        scryfallId: c.scryfallId,
        name: c.name,
        quantity: 1,
      });
    }
    await Deck.create({ userId: uid, name: `${uid} deck`, cards });
  }

  httpServer = createServer();
  io = new Server(httpServer);
  // Test auth middleware: trust the handshake uid (no Firebase in tests).
  io.use((socket, next) => {
    const uid = socket.handshake.auth?.uid as string;
    socket.data.user = {
      uid,
      email: `${uid}@test`,
      role: "user",
      displayName: uid,
    };
    next();
  });
  io.on("connection", (socket) => {
    registerPlayHandlers(io, socket);
    registerPlayEventHandlers(io, socket);
    registerPlayReconnectHandlers(io, socket);
  });

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
}, 180_000);

afterAll(async () => {
  io?.close();
  httpServer?.close();
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

// ── Client helpers ────────────────────────────────────────────────────────────

function connect(uid: string): Promise<ClientSocket> {
  const socket = ioClient(`http://localhost:${port}`, {
    auth: { uid },
    forceNew: true,
  });
  socket.on("play:board", (view: PlayerBoardView) => boards.set(uid, view));
  return new Promise((resolve) => socket.on("connect", () => resolve(socket)));
}

function emitAck<T>(
  socket: ClientSocket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve) =>
    socket.emit(event, payload, (res: T) => resolve(res)),
  );
}

function waitForBoard(
  uid: string,
  predicate: (v: PlayerBoardView) => boolean,
): Promise<PlayerBoardView> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const v = boards.get(uid);
      if (v && predicate(v)) {
        clearInterval(timer);
        resolve(v);
      }
    }, 10);
    setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`timeout waiting for ${uid} board`));
    }, 5000);
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── The flow ──────────────────────────────────────────────────────────────────

describe("play socket: lobby → start → actions", () => {
  it("runs a full game and never leaks the opponent's hand on the wire", async () => {
    const alice = await connect("alice");
    const bob = await connect("bob");

    const created = await emitAck<{
      ok: boolean;
      sessionId: string;
      shortCode: string;
    }>(alice, "playlobby:create", {
      formatLabel: "Test",
      playerCount: 2,
      lifeMode: "per-player",
      startingLife: 20,
    });
    expect(created.ok).toBe(true);
    const { sessionId, shortCode } = created;

    const aliceDeck = await Deck.findOne({ userId: "alice" }).lean();
    const bobDeck = await Deck.findOne({ userId: "bob" }).lean();

    expect(
      (
        await emitAck<{ ok: boolean }>(alice, "playlobby:set-deck", {
          sessionId,
          source: { kind: "deck", deckId: aliceDeck!._id.toString() },
        })
      ).ok,
    ).toBe(true);

    const joined = await emitAck<{ ok: boolean }>(bob, "playlobby:join", {
      shortCode,
    });
    expect(joined.ok).toBe(true);
    await emitAck(bob, "playlobby:set-deck", {
      sessionId,
      source: { kind: "deck", deckId: bobDeck!._id.toString() },
    });

    alice.emit("playlobby:ready", { sessionId, ready: true });
    bob.emit("playlobby:ready", { sessionId, ready: true });
    await delay(100);

    const start = await emitAck<{ ok: boolean }>(alice, "playlobby:start", {
      sessionId,
    });
    expect(start.ok).toBe(true);

    const aliceBoard = await waitForBoard(
      "alice",
      (v) => v.status === "playing",
    );
    const bobBoard = await waitForBoard("bob", (v) => v.status === "playing");

    // Each seat holds 7 cards.
    expect(aliceBoard.myHand).toHaveLength(7);
    expect(bobBoard.myHand).toHaveLength(7);

    // CRITICAL: none of Alice's hand instances appear in the payload Bob received.
    const bobKeys = new Set(Object.keys(bobBoard.cards));
    for (const id of aliceBoard.myHand) expect(bobKeys.has(id)).toBe(false);
    // And Bob's public seat view of Alice carries no hand/library arrays.
    const alicePublic = bobBoard.seats.find((s) => s.uid === "alice")!;
    expect(alicePublic.handCount).toBe(7);
    expect(Object.keys(alicePublic)).not.toContain("hand");

    // ── Concurrent moves on one instance converge ──────────────────────────────
    const playId = aliceBoard.myHand[0];
    await emitAck(alice, "play:action", {
      sessionId,
      action: {
        type: "MOVE_CARD",
        instanceId: playId,
        target: { kind: "battlefield", x: 0.5, y: 0.5 },
      },
    });
    await waitForBoard("bob", (v) =>
      v.battlefield.some((c) => c.instanceId === playId),
    );

    await Promise.all([
      emitAck(alice, "play:action", {
        sessionId,
        action: {
          type: "MOVE_ON_BATTLEFIELD",
          instanceId: playId,
          x: 0.1,
          y: 0.1,
        },
      }),
      emitAck(bob, "play:action", {
        sessionId,
        action: {
          type: "MOVE_ON_BATTLEFIELD",
          instanceId: playId,
          x: 0.9,
          y: 0.9,
        },
      }),
    ]);
    await delay(150);

    const aliceFinal = boards.get("alice")!;
    const bobFinal = boards.get("bob")!;
    const aPos = aliceFinal.battlefield.find((c) => c.instanceId === playId)!;
    const bPos = bobFinal.battlefield.find((c) => c.instanceId === playId)!;
    expect(aPos.x).toBeCloseTo(bPos.x);
    expect(aPos.y).toBeCloseTo(bPos.y);

    // ── Zone routing / reorder / flip survive the wire (regression guard) ───────
    // Before the schema fix these payloads were rejected or had `zone` stripped.
    const zoneId = aliceFinal.myHand[0];
    const playZoned = await emitAck<{ ok: boolean; error?: string }>(
      alice,
      "play:action",
      {
        sessionId,
        action: {
          type: "MOVE_CARD",
          instanceId: zoneId,
          target: { kind: "battlefield", zone: "creatures" },
        },
      },
    );
    expect(playZoned.ok).toBe(true); // optional x/y + zone accepted
    const bobZoned = await waitForBoard("bob", (v) =>
      v.battlefield.some(
        (c) => c.instanceId === zoneId && c.zone === "creatures",
      ),
    );
    expect(
      bobZoned.battlefield.find((c) => c.instanceId === zoneId)?.zone,
    ).toBe("creatures");

    const setZone = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: { type: "SET_ZONE", instanceId: zoneId, zone: "lands" },
    });
    expect(setZone.ok).toBe(true);
    await waitForBoard("bob", (v) =>
      v.battlefield.some((c) => c.instanceId === zoneId && c.zone === "lands"),
    );

    const flip = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: {
        type: "FLIP_UPSIDE_DOWN",
        instanceId: zoneId,
        upsideDown: true,
      },
    });
    expect(flip.ok).toBe(true);
    await waitForBoard("bob", (v) =>
      v.battlefield.some(
        (c) => c.instanceId === zoneId && c.upsideDown === true,
      ),
    );

    const reorder = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: { type: "REORDER_ZONE", zone: "lands", newOrder: [zoneId] },
    });
    expect(reorder.ok).toBe(true);

    // ── Ephemeral targeting arrow broadcasts to the other client ────────────────
    const arrowReceived = new Promise<{ by: number; source: string }>(
      (resolve) =>
        bob.once("play:arrow", (a: { by: number; source: string }) =>
          resolve(a),
        ),
    );
    const arrowAck = await emitAck<{ ok: boolean }>(alice, "play:arrow", {
      sessionId,
      source: playId,
      target: { kind: "seat", seat: 1 },
    });
    expect(arrowAck.ok).toBe(true);
    const arrow = await arrowReceived;
    expect(arrow.by).toBe(0); // derived server-side
    expect(arrow.source).toBe(playId);

    // ── Phase actions sync through the per-seat view ────────────────────────────
    const setPhase = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: { type: "SET_PHASE", phase: "combat" },
    });
    expect(setPhase.ok).toBe(true);
    const bobPhase = await waitForBoard("bob", (v) => v.phase === "combat");
    expect(bobPhase.phase).toBe("combat");

    const pass = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: { type: "PASS_TURN" },
    });
    expect(pass.ok).toBe(true);
    await waitForBoard("bob", (v) => v.activeSeat === 1 && v.phase === "untap");

    alice.disconnect();
    bob.disconnect();
  }, 30_000);
});

// ── Reconnect, lobby list & face-down play ──────────────────────────────────────

/** Create a 2-player game, set both decks, ready up, and start it. */
async function startedGame(): Promise<{
  sessionId: string;
  shortCode: string;
  alice: ClientSocket;
  bob: ClientSocket;
}> {
  const alice = await connect("alice");
  const bob = await connect("bob");
  const created = await emitAck<{
    ok: boolean;
    sessionId: string;
    shortCode: string;
  }>(alice, "playlobby:create", {
    formatLabel: "T",
    playerCount: 2,
    lifeMode: "per-player",
    startingLife: 20,
  });
  const aliceDeck = await Deck.findOne({ userId: "alice" }).lean();
  const bobDeck = await Deck.findOne({ userId: "bob" }).lean();
  await emitAck(alice, "playlobby:set-deck", {
    sessionId: created.sessionId,
    source: { kind: "deck", deckId: aliceDeck!._id.toString() },
  });
  await emitAck(bob, "playlobby:join", { shortCode: created.shortCode });
  await emitAck(bob, "playlobby:set-deck", {
    sessionId: created.sessionId,
    source: { kind: "deck", deckId: bobDeck!._id.toString() },
  });
  alice.emit("playlobby:ready", { sessionId: created.sessionId, ready: true });
  bob.emit("playlobby:ready", { sessionId: created.sessionId, ready: true });
  await delay(100);
  await emitAck(alice, "playlobby:start", { sessionId: created.sessionId });
  await waitForBoard("alice", (v) => v.status === "playing");
  await waitForBoard("bob", (v) => v.status === "playing");
  return { ...created, alice, bob };
}

describe("play socket: reconnect + list + face-down", () => {
  it("play:rejoin rehydrates a game evicted from server memory", async () => {
    const { sessionId, alice, bob } = await startedGame();

    // Simulate a server restart: drop the in-memory session (DB checkpoint stays).
    removePlay(sessionId);
    const gone = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: { type: "DRAW", count: 1 },
    });
    expect(gone.ok).toBe(false); // no longer in memory

    const rejoined = await emitAck<{ ok: boolean }>(alice, "play:rejoin", {
      sessionId,
    });
    expect(rejoined.ok).toBe(true); // rehydrated from Mongo

    const after = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: { type: "DRAW", count: 1 },
    });
    expect(after.ok).toBe(true);

    alice.disconnect();
    bob.disconnect();
  }, 30_000);

  it("playlobby:list returns my games and friends' open tables", async () => {
    const bob = await connect("bob");
    const alice = await connect("alice");

    const pair = canonicalPair("alice", "bob");
    await Friendship.updateOne(
      pair,
      { $set: { ...pair, requesterUid: "alice", status: "accepted" } },
      { upsert: true },
    );

    const created = await emitAck<{ ok: boolean; sessionId: string }>(
      bob,
      "playlobby:create",
      {
        formatLabel: "Friendly",
        playerCount: 2,
        lifeMode: "per-player",
        startingLife: 20,
      },
    );

    type ListRes = {
      ok: boolean;
      myGames: { sessionId: string }[];
      openTables: { sessionId: string }[];
    };

    const aliceList = await emitAck<ListRes>(alice, "playlobby:list", {});
    expect(aliceList.ok).toBe(true);
    expect(
      aliceList.openTables.some((t) => t.sessionId === created.sessionId),
    ).toBe(true);

    const bobList = await emitAck<ListRes>(bob, "playlobby:list", {});
    expect(
      bobList.myGames.some((t) => t.sessionId === created.sessionId),
    ).toBe(true);
    expect(
      bobList.openTables.some((t) => t.sessionId === created.sessionId),
    ).toBe(false);

    alice.disconnect();
    bob.disconnect();
  }, 30_000);

  it("playing a hand card face down hides its identity from opponents", async () => {
    const { sessionId, alice, bob } = await startedGame();
    const handId = boards.get("alice")!.myHand[0];

    const res = await emitAck<{ ok: boolean }>(alice, "play:action", {
      sessionId,
      action: {
        type: "MOVE_CARD",
        instanceId: handId,
        target: { kind: "battlefield", zone: "creatures", faceDown: true },
      },
    });
    expect(res.ok).toBe(true);

    const aAfter = await waitForBoard(
      "alice",
      (v) => v.battlefield.some((c) => c.instanceId === handId && c.faceDown),
    );
    expect(aAfter.cards[handId]).toBeDefined(); // owner still knows the identity

    const bAfter = await waitForBoard("bob", (v) =>
      v.battlefield.some((c) => c.instanceId === handId),
    );
    expect(bAfter.cards[handId]).toBeUndefined(); // opponent sees position only

    alice.disconnect();
    bob.disconnect();
  }, 30_000);
});
