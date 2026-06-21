import type { Server, Socket } from "socket.io";
import { applyAction, endGame, type BoardAction } from "@/lib/game/play";
import {
  broadcastBoardViews,
  broadcastPlayLobby,
  checkpoint,
  getPlay,
} from "@/server/play/state";
import { actionSchema, sessionOnlySchema } from "@/server/play/schemas";

interface SocketUser {
  uid: string;
  email: string;
  role: "user" | "admin";
}

export function registerPlayEventHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;

  // ── play:action — the single gameplay channel ──────────────────────────────
  socket.on(
    "play:action",
    (
      payload: unknown,
      ack: (res: { ok: boolean; version?: number; error?: string }) => void,
    ) => {
      try {
        const parsed = actionSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

        const active = getPlay(parsed.data.sessionId);
        if (!active?.board || active.status !== "playing") {
          return ack({ ok: false, error: "not_playing" });
        }

        // actorSeat is derived server-side — never trusted from the payload.
        const seat = active.board.seats.findIndex((s) => s.uid === user.uid);
        if (seat === -1) return ack({ ok: false, error: "not_in_session" });

        const action = parsed.data.action as BoardAction;
        let next;
        try {
          next = applyAction(active.board, seat, action);
        } catch (err) {
          return ack({ ok: false, error: (err as Error).message });
        }

        active.board = next;
        checkpoint(parsed.data.sessionId);
        ack({ ok: true, version: next.version });

        // Intentional reveal: ephemeral per-room emit of the actual identity,
        // never written to the shared log or any seat's persistent view.
        if (action.type === "REVEAL") {
          const inst = next.cards[action.instanceId];
          if (inst) {
            io.to(parsed.data.sessionId).emit("play:reveal", {
              by: seat,
              instanceId: inst.instanceId,
              cardObjectId: inst.cardObjectId,
              scryfallId: inst.scryfallId,
            });
          }
        }

        broadcastBoardViews(io, parsed.data.sessionId);
      } catch (err) {
        console.error("[play:action]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── play:end — host ends the game ───────────────────────────────────────────
  socket.on(
    "play:end",
    (payload: unknown, ack: (res: { ok: boolean; error?: string }) => void) => {
      try {
        const parsed = sessionOnlySchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

        const active = getPlay(parsed.data.sessionId);
        if (!active) return ack({ ok: false, error: "session_not_found" });
        if (user.uid !== active.config.hostUid) return ack({ ok: false, error: "not_host" });
        if (!active.board) return ack({ ok: false, error: "not_playing" });

        active.board = endGame(active.board);
        active.status = "ended";
        checkpoint(parsed.data.sessionId);

        io.to(parsed.data.sessionId).emit("play:ended");
        broadcastBoardViews(io, parsed.data.sessionId);
        broadcastPlayLobby(io, parsed.data.sessionId);
        ack({ ok: true });
      } catch (err) {
        console.error("[play:end]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );
}
