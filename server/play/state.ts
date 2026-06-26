/**
 * In-memory play-session store + Mongo checkpoint layer.
 *
 * The source of truth for active games is the in-memory Map; after every action
 * the board is serialised to MongoDB so a crash can be recovered by re-loading
 * from the DB. Ended sessions are removed from memory but kept in the DB.
 *
 * This mirrors server/draft/state.ts but keeps an entirely SEPARATE short-code
 * index and event vocabulary (`play:*` / `playlobby:*`) so the draft and play
 * suites never collide. Because a BoardState only exists once the host starts
 * the game, ActivePlay holds lobby metadata separately from `board`.
 */

import type { Server } from "socket.io";
import { connectToDatabase } from "@/lib/db";
import { PlaySession } from "@/lib/models/PlaySession";
import { getPlayerView, type BoardState, type LifeMode } from "@/lib/game/play";
import type { LibraryCard } from "@/lib/game/play-import";

export interface LobbyPlayer {
  uid: string;
  displayName: string;
  seatIndex: number;
  teamId: number;
  isReady: boolean;
  deckSourceKind?: "deck" | "decklist";
  /** Resolved starting library, kept in memory until the game starts. */
  deckLibrary?: LibraryCard[];
}

export interface PlayConfig {
  formatLabel: string;
  playerCount: number;
  lifeMode: LifeMode;
  startingLife: number;
  hostUid: string;
}

export interface ActivePlay {
  sessionId: string;
  shortCode: string;
  status: "lobby" | "playing" | "ended";
  config: PlayConfig;
  /** Lobby roster — authoritative before start; seats are derived from `board` after. */
  players: LobbyPlayer[];
  /** Live board — null until the host starts the game. */
  board: BoardState | null;
  /** seat uid → socketId (only connected seats) */
  sockets: Map<string, string>;
  /** seat uid → grace timer that flips `connected=false` after the grace period */
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const plays = new Map<string, ActivePlay>();
const shortCodeIndex = new Map<string, string>(); // shortCode → sessionId

export const RECONNECT_GRACE_MS = 60_000;

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getPlay(sessionId: string): ActivePlay | undefined {
  return plays.get(sessionId);
}

export function getPlayByCode(shortCode: string): ActivePlay | undefined {
  const id = shortCodeIndex.get(shortCode.toUpperCase());
  return id ? plays.get(id) : undefined;
}

export function registerPlay(sessionId: string, active: ActivePlay): void {
  plays.set(sessionId, active);
  shortCodeIndex.set(active.shortCode.toUpperCase(), sessionId);
}

/**
 * Return the live ActivePlay, rehydrating it from the Mongo checkpoint if the
 * server process no longer holds it in memory (e.g. after a free-tier restart).
 * `boardState` is checkpointed after every action, so a `playing`/`ended` session
 * is fully recoverable; a session evicted mid-lobby loses its resolved
 * `deckLibrary` (players simply re-pick a deck).
 */
export async function ensurePlayLoaded(
  sessionId: string,
): Promise<ActivePlay | undefined> {
  const existing = plays.get(sessionId);
  if (existing) return existing;

  await connectToDatabase();
  const doc = await PlaySession.findOne({ sessionId }).lean();
  if (!doc) return undefined;

  const active: ActivePlay = {
    sessionId: doc.sessionId,
    shortCode: doc.shortCode,
    status: doc.status,
    config: {
      formatLabel: doc.formatLabel,
      playerCount: doc.playerCount,
      lifeMode: doc.lifeMode,
      startingLife: doc.startingLife,
      hostUid: doc.hostUid,
    },
    players: (doc.players ?? []).map((p) => ({
      uid: p.uid,
      displayName: p.displayName ?? "",
      seatIndex: p.seatIndex,
      teamId: p.teamId ?? 0,
      isReady: p.isReady ?? false,
      deckSourceKind: p.deckSource?.kind ?? undefined,
    })),
    board: (doc.boardState as BoardState | null) ?? null,
    sockets: new Map(),
    disconnectTimers: new Map(),
  };
  registerPlay(sessionId, active);
  return active;
}

/** Like `getPlayByCode`, but rehydrates from Mongo when missing from memory. */
export async function ensurePlayLoadedByCode(
  shortCode: string,
): Promise<ActivePlay | undefined> {
  const existing = getPlayByCode(shortCode);
  if (existing) return existing;

  await connectToDatabase();
  const doc = await PlaySession.findOne({
    shortCode: shortCode.toUpperCase(),
  })
    .select({ sessionId: 1 })
    .lean();
  if (!doc) return undefined;
  return ensurePlayLoaded(doc.sessionId);
}

export function iteratePlays(): IterableIterator<[string, ActivePlay]> {
  return plays.entries();
}

export function removePlay(sessionId: string): void {
  const active = plays.get(sessionId);
  if (active) shortCodeIndex.delete(active.shortCode.toUpperCase());
  plays.delete(sessionId);
}

/** Persists the current in-memory board to MongoDB (fire-and-forget). */
export function checkpoint(sessionId: string): void {
  const active = plays.get(sessionId);
  if (!active) return;
  void connectToDatabase()
    .then(() =>
      PlaySession.updateOne(
        { sessionId },
        {
          $set: {
            boardState: active.board,
            status: active.status,
            ...(active.status === "ended" ? { endedAt: new Date() } : {}),
          },
        },
      ),
    )
    .catch((err) => console.error("[play checkpoint] persist failed:", err));
}

// ─── Broadcasts ─────────────────────────────────────────────────────────────

/**
 * Recomputes and sends every connected seat's personal view. Nothing about the
 * full board (hidden zones, rngSeed, opponents' hands) is ever sent to clients.
 */
export function broadcastBoardViews(io: Server, sessionId: string): void {
  const active = plays.get(sessionId);
  if (!active?.board) return;
  const board = active.board;
  for (const [uid, socketId] of active.sockets) {
    const seat = board.seats.findIndex((s) => s.uid === uid);
    if (seat === -1) continue;
    io.to(socketId).emit("play:board", getPlayerView(board, seat));
  }
}

export function broadcastPlayLobby(io: Server, sessionId: string): void {
  const active = plays.get(sessionId);
  if (!active) return;
  io.to(sessionId).emit("playlobby:state", {
    sessionId,
    shortCode: active.shortCode,
    status: active.status,
    formatLabel: active.config.formatLabel,
    lifeMode: active.config.lifeMode,
    startingLife: active.config.startingLife,
    playerCount: active.config.playerCount,
    hostUid: active.config.hostUid,
    players: active.players.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      teamId: p.teamId,
      isReady: p.isReady,
      hasDeck: Boolean(p.deckLibrary && p.deckLibrary.length > 0),
    })),
  });
}
