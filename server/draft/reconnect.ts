import type { Server, Socket } from "socket.io";
import {
  broadcastViews,
  checkpoint,
  clearSlotTimer,
  getSession,
  iterateSessions,
  RECONNECT_GRACE_MS,
  startSlotTimer,
} from "@/server/draft/state";
import {
  autoPick,
  getPlayerView,
  isComplete,
  seatForUid,
  setConnected,
} from "@/lib/game/draft";
import { completeDraft } from "@/server/draft/completion";
import { handleTimerExpiry } from "@/server/draft/lobby";

interface SocketUser {
  uid: string;
  email: string;
  role: "user" | "admin";
}

export function registerReconnectHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;

  // ── draft:rejoin ─────────────────────────────────────────────────────────
  socket.on(
    "draft:rejoin",
    (
      payload: { sessionId: string },
      ack: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const active = getSession(payload.sessionId);
      if (!active) return ack({ ok: false, error: "session_not_found" });

      const seatIndex = seatForUid(active.state, user.uid);
      if (seatIndex === -1) return ack({ ok: false, error: "not_in_session" });

      // Cancel any pending auto-pick grace timer.
      const existing = active.disconnectTimers.get(user.uid);
      if (existing) {
        clearTimeout(existing);
        active.disconnectTimers.delete(user.uid);
      }

      active.state = setConnected(active.state, user.uid, true);
      active.sockets.set(user.uid, socket.id);
      void socket.join(payload.sessionId);

      // Send the full current view so the player can resume.
      const view = getPlayerView(active.state, seatIndex);
      socket.emit("draft:playerView", view);
      ack({ ok: true });
    },
  );
}

/** Called on socket disconnect to start the grace-period auto-pick timer. */
export function handleDisconnect(
  io: Server,
  socket: Socket,
  uid: string,
): void {
  // Find which active session this socket was part of.
  for (const [sessionId, active] of iterateSessions()) {
    if (!active.sockets.has(uid)) continue;

    active.sockets.delete(uid);
    active.state = setConnected(active.state, uid, false);

    if (active.state.status !== "drafting") continue;

    const seatIndex = seatForUid(active.state, uid);
    if (seatIndex === -1) continue;

    // Grace period: wait RECONNECT_GRACE_MS before auto-picking.
    const timer = setTimeout(async () => {
      active.disconnectTimers.delete(uid);
      if (active.state.status !== "drafting") return;
      if (active.state.pickedThisSlot[seatIndex]) return;

      const state = autoPick(active.state, seatIndex);
      active.state = state;
      checkpoint(sessionId);

      if (isComplete(state)) {
        clearSlotTimer(sessionId);
        io.to(sessionId).emit("draft:complete");
        broadcastViews(io, sessionId, state, getPlayerView);
        await completeDraft(state);
        return;
      }

      broadcastViews(io, sessionId, state, getPlayerView);

      if (state.pickedThisSlot.every(Boolean)) {
        startSlotTimer(io, socket, sessionId, () =>
          handleTimerExpiry(io, socket, sessionId),
        );
      }
    }, RECONNECT_GRACE_MS);

    active.disconnectTimers.set(uid, timer);
  }
}
