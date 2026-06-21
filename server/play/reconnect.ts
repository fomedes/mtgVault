import type { Server, Socket } from "socket.io";
import { getPlayerView, setConnected } from "@/lib/game/play";
import {
  broadcastBoardViews,
  broadcastPlayLobby,
  getPlay,
  iteratePlays,
  RECONNECT_GRACE_MS,
} from "@/server/play/state";
import { sessionOnlySchema } from "@/server/play/schemas";

interface SocketUser {
  uid: string;
  email: string;
  role: "user" | "admin";
}

export function registerPlayReconnectHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;

  // ── play:rejoin — resend the full snapshot for this seat ────────────────────
  socket.on(
    "play:rejoin",
    (payload: unknown, ack: (res: { ok: boolean; error?: string }) => void) => {
      const parsed = sessionOnlySchema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

      const active = getPlay(parsed.data.sessionId);
      if (!active) return ack({ ok: false, error: "session_not_found" });

      // Cancel any pending grace timer.
      const existing = active.disconnectTimers.get(user.uid);
      if (existing) {
        clearTimeout(existing);
        active.disconnectTimers.delete(user.uid);
      }

      active.sockets.set(user.uid, socket.id);
      void socket.join(parsed.data.sessionId);

      if (active.board) {
        const seat = active.board.seats.findIndex((s) => s.uid === user.uid);
        if (seat === -1) return ack({ ok: false, error: "not_in_session" });
        active.board = setConnected(active.board, user.uid, true);
        socket.emit("play:board", getPlayerView(active.board, seat));
        broadcastBoardViews(io, parsed.data.sessionId);
      } else {
        broadcastPlayLobby(io, parsed.data.sessionId);
      }
      ack({ ok: true });
    },
  );
}

/**
 * On socket disconnect, start a grace timer per active play this seat was in.
 * Unlike the draft, there is no auto-action — the timer only flips `connected`
 * to false (and re-broadcasts) if the player has not rejoined in time.
 */
export function handlePlayDisconnect(io: Server, _socket: Socket, uid: string): void {
  for (const [sessionId, active] of iteratePlays()) {
    if (!active.sockets.has(uid)) continue;
    active.sockets.delete(uid);

    if (!active.board) {
      // Lobby: keep the seat, just drop the socket and refresh the roster.
      broadcastPlayLobby(io, sessionId);
      continue;
    }

    const existing = active.disconnectTimers.get(uid);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      active.disconnectTimers.delete(uid);
      if (!active.board) return;
      active.board = setConnected(active.board, uid, false);
      broadcastBoardViews(io, sessionId);
    }, RECONNECT_GRACE_MS);

    active.disconnectTimers.set(uid, timer);
  }
}
