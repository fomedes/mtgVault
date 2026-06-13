/**
 * In-memory session store + Mongo checkpoint layer.
 *
 * The source of truth for active drafts is the in-memory Map.
 * After every pick the state is serialised to MongoDB so a crash can be
 * recovered by re-loading from the DB.  Completed sessions are removed from
 * memory but kept in the DB.
 */

import type { Server, Socket } from "socket.io";
import { connectToDatabase } from "@/lib/db";
import { DraftSession } from "@/lib/models/DraftSession";
import type { DraftState } from "@/lib/game/draft";

export interface ActiveSession {
  state: DraftState;
  shortCode: string;
  /** seat uid → socketId (only connected seats) */
  sockets: Map<string, string>;
  /** seat uid → disconnect timer (grace period before auto-pick) */
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** per-slot pick timer (fires auto-pick when a player is too slow) */
  slotTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, ActiveSession>();
const shortCodeIndex = new Map<string, string>(); // shortCode → sessionId

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getSession(sessionId: string): ActiveSession | undefined {
  return sessions.get(sessionId);
}

export function getSessionByCode(shortCode: string): ActiveSession | undefined {
  const id = shortCodeIndex.get(shortCode.toUpperCase());
  return id ? sessions.get(id) : undefined;
}

export function registerSession(sessionId: string, active: ActiveSession): void {
  sessions.set(sessionId, active);
  shortCodeIndex.set(active.shortCode, sessionId);
}

export function iterateSessions(): IterableIterator<[string, ActiveSession]> {
  return sessions.entries();
}

export function removeSession(sessionId: string): void {
  const active = sessions.get(sessionId);
  if (active) shortCodeIndex.delete(active.shortCode);
  sessions.delete(sessionId);
}

/** Persists the current in-memory state to MongoDB (fire-and-forget is fine here). */
export function checkpoint(sessionId: string): void {
  const active = sessions.get(sessionId);
  if (!active) return;
  void connectToDatabase().then(() =>
    DraftSession.updateOne(
      { sessionId },
      {
        $set: {
          draftState: active.state,
          status: active.state.status,
          ...(active.state.status === "complete" ? { completedAt: new Date() } : {}),
        },
      },
    ),
  );
}

// ─── Timer helpers ─────────────────────────────────────────────────────────────

export const RECONNECT_GRACE_MS = 60_000;

/**
 * Broadcasts every player's personal view after a state change.
 * Nothing else about the full state is ever sent to clients.
 */
export function broadcastViews(
  io: Server,
  sessionId: string,
  state: DraftState,
  getPlayerView: (s: DraftState, i: number) => unknown,
): void {
  const active = sessions.get(sessionId);
  if (!active) return;
  for (const [uid, socketId] of active.sockets) {
    const seat = state.players.findIndex((p) => p.uid === uid);
    if (seat === -1) continue;
    const view = getPlayerView(state, seat);
    io.to(socketId).emit("draft:playerView", view);
  }
}

export function broadcastLobby(io: Server, sessionId: string): void {
  const active = sessions.get(sessionId);
  if (!active) return;
  io.to(sessionId).emit("lobby:state", {
    sessionId,
    shortCode: active.shortCode,
    setCode: active.state.setCode,
    players: active.state.players,
    status: active.state.status,
  });
}

export function startSlotTimer(
  io: Server,
  socket: Socket,
  sessionId: string,
  onExpire: () => void,
): void {
  const active = sessions.get(sessionId);
  if (!active) return;
  if (active.slotTimer) clearTimeout(active.slotTimer);

  const timerMs = active.state.timerMs;
  const expiresAt = Date.now() + timerMs;

  // Broadcast the deadline so clients can render a countdown.
  io.to(sessionId).emit("draft:timer", { expiresAt });

  active.slotTimer = setTimeout(() => {
    active.slotTimer = null;
    onExpire();
  }, timerMs);
}

export function clearSlotTimer(sessionId: string): void {
  const active = sessions.get(sessionId);
  if (!active?.slotTimer) return;
  clearTimeout(active.slotTimer);
  active.slotTimer = null;
}
