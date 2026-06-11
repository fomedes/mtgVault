import type { Server, Socket } from "socket.io";
import {
  broadcastViews,
  checkpoint,
  clearSlotTimer,
  getSession,
  startSlotTimer,
} from "@/server/draft/state";
import { getPlayerView, pickCard, isComplete, seatForUid } from "@/lib/game/draft";
import { completeDraft } from "@/server/draft/completion";
import { handleTimerExpiry } from "@/server/draft/lobby";

interface SocketUser {
  uid: string;
  email: string;
  role: "user" | "admin";
}

export function registerDraftHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;

  socket.on(
    "draft:pick",
    async (
      payload: { sessionId: string; cardId: string },
      ack: (res: { ok: boolean; error?: string }) => void,
    ) => {
      try {
        const active = getSession(payload.sessionId);
        if (!active) return ack({ ok: false, error: "session_not_found" });
        if (active.state.status !== "drafting") return ack({ ok: false, error: "not_drafting" });

        const seatIndex = seatForUid(active.state, user.uid);
        if (seatIndex === -1) return ack({ ok: false, error: "not_in_session" });

        let state;
        try {
          state = pickCard(active.state, seatIndex, payload.cardId);
        } catch (err) {
          return ack({ ok: false, error: (err as Error).message });
        }

        active.state = state;
        checkpoint(payload.sessionId);
        ack({ ok: true });

        if (isComplete(state)) {
          clearSlotTimer(payload.sessionId);
          io.to(payload.sessionId).emit("draft:complete");
          broadcastViews(io, payload.sessionId, state, getPlayerView);
          await completeDraft(state);
          return;
        }

        broadcastViews(io, payload.sessionId, state, getPlayerView);

        // All players picked → advance already happened in pickCard; restart timer.
        if (state.pickedThisSlot.every(Boolean)) {
          startSlotTimer(io, socket, payload.sessionId, () =>
            handleTimerExpiry(io, socket, payload.sessionId),
          );
        }
      } catch (err) {
        console.error("[draft:pick]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );
}
