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
import { registerPlayHandlers } from "@/server/play/lobby";
import { registerPlayEventHandlers } from "@/server/play/events";
import { registerPlayReconnectHandlers } from "@/server/play/reconnect";
import type { PlayerBoardView } from "@/lib/game/play";

let mongod: MongoMemoryServer;
let dbPath: string;
let httpServer: HttpServer;
let io: Server;
let port: number;

const boards = new Map<string, PlayerBoardView>();

beforeAll(async () => {
  const tmpRoot = path.resolve(import.meta.dirname, "../../node_modules/.cache/mongodb-tmp");
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
      cards.push({ cardId: c._id, scryfallId: c.scryfallId, name: c.name, quantity: 1 });
    }
    await Deck.create({ userId: uid, name: `${uid} deck`, cards });
  }

  httpServer = createServer();
  io = new Server(httpServer);
  // Test auth middleware: trust the handshake uid (no Firebase in tests).
  io.use((socket, next) => {
    const uid = socket.handshake.auth?.uid as string;
    socket.data.user = { uid, email: `${uid}@test`, role: "user", displayName: uid };
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
  const socket = ioClient(`http://localhost:${port}`, { auth: { uid }, forceNew: true });
  socket.on("play:board", (view: PlayerBoardView) => boards.set(uid, view));
  return new Promise((resolve) => socket.on("connect", () => resolve(socket)));
}

function emitAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, (res: T) => resolve(res)));
}

function waitForBoard(uid: string, predicate: (v: PlayerBoardView) => boolean): Promise<PlayerBoardView> {
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

    const created = await emitAck<{ ok: boolean; sessionId: string; shortCode: string }>(
      alice,
      "playlobby:create",
      { formatLabel: "Test", playerCount: 2, lifeMode: "per-player", startingLife: 20 },
    );
    expect(created.ok).toBe(true);
    const { sessionId, shortCode } = created;

    const aliceDeck = await Deck.findOne({ userId: "alice" }).lean();
    const bobDeck = await Deck.findOne({ userId: "bob" }).lean();

    expect(
      (await emitAck<{ ok: boolean }>(alice, "playlobby:set-deck", {
        sessionId,
        source: { kind: "deck", deckId: aliceDeck!._id.toString() },
      })).ok,
    ).toBe(true);

    const joined = await emitAck<{ ok: boolean }>(bob, "playlobby:join", { shortCode });
    expect(joined.ok).toBe(true);
    await emitAck(bob, "playlobby:set-deck", {
      sessionId,
      source: { kind: "deck", deckId: bobDeck!._id.toString() },
    });

    alice.emit("playlobby:ready", { sessionId, ready: true });
    bob.emit("playlobby:ready", { sessionId, ready: true });
    await delay(100);

    const start = await emitAck<{ ok: boolean }>(alice, "playlobby:start", { sessionId });
    expect(start.ok).toBe(true);

    const aliceBoard = await waitForBoard("alice", (v) => v.status === "playing");
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
      action: { type: "MOVE_CARD", instanceId: playId, target: { kind: "battlefield", x: 0.5, y: 0.5 } },
    });
    await waitForBoard("bob", (v) => v.battlefield.some((c) => c.instanceId === playId));

    await Promise.all([
      emitAck(alice, "play:action", { sessionId, action: { type: "MOVE_ON_BATTLEFIELD", instanceId: playId, x: 0.1, y: 0.1 } }),
      emitAck(bob, "play:action", { sessionId, action: { type: "MOVE_ON_BATTLEFIELD", instanceId: playId, x: 0.9, y: 0.9 } }),
    ]);
    await delay(150);

    const aliceFinal = boards.get("alice")!;
    const bobFinal = boards.get("bob")!;
    const aPos = aliceFinal.battlefield.find((c) => c.instanceId === playId)!;
    const bPos = bobFinal.battlefield.find((c) => c.instanceId === playId)!;
    expect(aPos.x).toBeCloseTo(bPos.x);
    expect(aPos.y).toBeCloseTo(bPos.y);

    alice.disconnect();
    bob.disconnect();
  }, 30_000);
});
