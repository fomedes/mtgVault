import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { connectToDatabase } from "@/lib/db";
import { DraftSession } from "@/lib/models/DraftSession";
import { CardSet } from "@/lib/models/CardSet";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { generateBooster } from "@/lib/game/booster";
import { createDraft } from "@/lib/game/draft";
import { sendDraftInvite } from "@/server/draft/notifications";
import {
  type ActiveSession,
  broadcastLobby,
  broadcastViews,
  checkpoint,
  clearSlotTimer,
  getSession,
  getSessionByCode,
  registerSession,
  startSlotTimer,
} from "@/server/draft/state";
import { completeDraft } from "@/server/draft/completion";
import { getPlayerView, autoPick, isComplete } from "@/lib/game/draft";

interface SocketUser {
  uid: string;
  email: string;
  role: "user" | "admin";
  displayName?: string;
}

function generateShortCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

export function registerLobbyHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;

  // Join personal notification room so server can push notifications.
  void socket.join(`user:${user.uid}`);

  // ── lobby:create ─────────────────────────────────────────────────────────
  socket.on(
    "lobby:create",
    async (
      payload: { setCode: string; timerMs: number; numPacks?: number },
      ack: (res: { ok: boolean; sessionId?: string; shortCode?: string; error?: string }) => void,
    ) => {
      try {
        await connectToDatabase();
        const { setCode, timerMs } = payload;
        const clampedTimer = Math.min(90_000, Math.max(30_000, timerMs ?? 60_000));
        const numPacks = Math.min(5, Math.max(1, payload.numPacks ?? 3));

        const cardSet = await CardSet.findOne(
          { code: setCode.toLowerCase(), enabled: true, cardsSyncedAt: { $exists: true } },
          { code: 1 },
        ).lean();
        if (!cardSet) return ack({ ok: false, error: "set_not_available" });

        const sessionId = randomUUID();
        let shortCode = generateShortCode();
        // Ensure uniqueness (collision astronomically rare for ≤20 users).
        while (await DraftSession.exists({ shortCode })) {
          shortCode = generateShortCode();
        }

        // Build a minimal lobby state WITHOUT calling createDraft — that
        // function requires ≥2 players and pre-generated packs, neither of
        // which exist yet.  createDraft is called only when lobby:start fires.
        const lobbyState: import("@/lib/game/draft").DraftState = {
          sessionId,
          setCode: setCode.toLowerCase(),
          format: "booster",
          timerMs: clampedTimer,
          numPacks,
          status: "lobby",
          players: [{
            uid: user.uid,
            displayName: user.displayName ?? user.email,
            seatIndex: 0,
            isConnected: false,
          }],
          allPacks: [[[]]],     // placeholder — replaced on start
          currentPacks: [[]],
          picks: [[]],
          pickedThisSlot: [false],
          round: 0,
          pickInRound: 0,
        };

        await DraftSession.create({
          sessionId,
          shortCode,
          setCode: setCode.toLowerCase(),
          timerMs: clampedTimer,
          hostUid: user.uid,
          players: [{ uid: user.uid, displayName: user.displayName ?? user.email, seatIndex: 0, isReady: false }],
          status: "lobby",
          draftState: lobbyState,
        });

        const active: ActiveSession = {
          state: lobbyState,
          shortCode,
          sockets: new Map([[user.uid, socket.id]]),
          disconnectTimers: new Map(),
          slotTimer: null,
        };
        registerSession(sessionId, active);

        void socket.join(sessionId);
        broadcastLobby(io, sessionId);
        ack({ ok: true, sessionId, shortCode });
      } catch (err) {
        console.error("[lobby:create]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── lobby:join ───────────────────────────────────────────────────────────
  socket.on(
    "lobby:join",
    async (
      payload: { shortCode: string },
      ack: (res: { ok: boolean; sessionId?: string; error?: string }) => void,
    ) => {
      try {
        const active = getSessionByCode(payload.shortCode);
        if (!active) return ack({ ok: false, error: "lobby_not_found" });

        const { sessionId } = active.state;
        if (active.state.status !== "lobby") return ack({ ok: false, error: "draft_already_started" });
        if (active.state.players.length >= 8) return ack({ ok: false, error: "lobby_full" });
        if (active.state.players.some((p) => p.uid === user.uid)) {
          // Reconnect to lobby.
          active.sockets.set(user.uid, socket.id);
          void socket.join(sessionId);
          broadcastLobby(io, sessionId);
          return ack({ ok: true, sessionId });
        }

        const seatIndex = active.state.players.length;
        const newPlayer = {
          uid: user.uid,
          displayName: user.displayName ?? user.email,
          seatIndex,
          isConnected: false,
        };
        active.state = {
          ...active.state,
          players: [...active.state.players, newPlayer],
          allPacks: [...active.state.allPacks, []],
          currentPacks: [...active.state.currentPacks, []],
          picks: [...active.state.picks, []],
          pickedThisSlot: [...active.state.pickedThisSlot, false],
        };
        active.sockets.set(user.uid, socket.id);

        await connectToDatabase();
        await DraftSession.updateOne(
          { sessionId },
          {
            $push: { players: { uid: user.uid, displayName: user.displayName ?? user.email, seatIndex, isReady: false } },
            $set: { draftState: active.state },
          },
        );

        void socket.join(sessionId);
        broadcastLobby(io, sessionId);
        ack({ ok: true, sessionId });
      } catch (err) {
        console.error("[lobby:join]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── lobby:ready ──────────────────────────────────────────────────────────
  socket.on("lobby:ready", (payload: { sessionId: string; ready: boolean }) => {
    const { sessionId } = payload;
    const activeSession = getSession(sessionId);
    if (!activeSession || activeSession.state.status !== "lobby") return;
    if (!activeSession.sockets.has(user.uid)) return;

    const players = activeSession.state.players.map((p) =>
      p.uid === user.uid ? { ...p } : p,
    );
    activeSession.state = { ...activeSession.state, players };
    broadcastLobby(io, sessionId);

    void connectToDatabase().then(() =>
      DraftSession.updateOne(
        { sessionId, "players.uid": user.uid },
        { $set: { "players.$.isReady": payload.ready } },
      ),
    );
  });

  // ── lobby:start ──────────────────────────────────────────────────────────
  socket.on(
    "lobby:start",
    async (
      payload: { sessionId: string },
      ack: (res: { ok: boolean; error?: string }) => void,
    ) => {
      try {
        const { getSession } = await import("@/server/draft/state");
        const activeSession = getSession(payload.sessionId);
        if (!activeSession) return ack({ ok: false, error: "session_not_found" });
        if (activeSession.state.status !== "lobby") return ack({ ok: false, error: "already_started" });
        if (user.uid !== activeSession.state.players[0]?.uid) return ack({ ok: false, error: "not_host" });
        if (activeSession.state.players.length < 2) return ack({ ok: false, error: "need_2_players" });

        const { sessionId, setCode, timerMs, numPacks = 3, players } = activeSession.state;
        const n = players.length;

        // Generate packs for every player × numPacks rounds.
        const allPacks: string[][][] = [];
        for (let i = 0; i < n; i++) {
          const roundPacks: string[][] = [];
          for (let r = 0; r < numPacks; r++) {
            const { cardIds } = await generateBooster(setCode);
            roundPacks.push(cardIds.map((id) => id.toString()));
          }
          allPacks.push(roundPacks);
        }

        const draftState = createDraft(
          sessionId,
          setCode,
          players.map((p) => ({ uid: p.uid, displayName: p.displayName })),
          allPacks,
          timerMs,
          numPacks,
        );
        // Mark all players who are currently socketed as connected.
        for (const p of draftState.players) {
          if (activeSession.sockets.has(p.uid)) {
            draftState.players[p.seatIndex].isConnected = true;
          }
        }

        activeSession.state = draftState;

        await connectToDatabase();
        await DraftSession.updateOne(
          { sessionId },
          { $set: { status: "drafting", startedAt: new Date(), draftState } },
        );

        io.to(sessionId).emit("draft:started");
        broadcastViews(io, sessionId, draftState, getPlayerView);

        startSlotTimer(io, socket, sessionId, () =>
          handleTimerExpiry(io, socket, sessionId),
        );

        ack({ ok: true });
      } catch (err) {
        console.error("[lobby:start]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── lobby:invite-friend ──────────────────────────────────────────────────
  socket.on(
    "lobby:invite-friend",
    async (
      payload: { sessionId: string; friendUid: string },
      ack: (res: { ok: boolean; error?: string }) => void,
    ) => {
      try {
        const { sessionId, friendUid } = payload;
        const activeSession = getSession(sessionId);
        if (!activeSession) return ack({ ok: false, error: "session_not_found" });
        if (activeSession.state.status !== "lobby") return ack({ ok: false, error: "not_in_lobby" });

        await connectToDatabase();

        // Verify accepted friendship before sending the invite.
        const pair = canonicalPair(user.uid, friendUid);
        const friendship = await Friendship.findOne({
          ...pair,
          status: "accepted",
        }).lean();

        if (!friendship) return ack({ ok: false, error: "not_friends" });

        const { shortCode } = activeSession;
        await sendDraftInvite(
          io,
          user.uid,
          user.displayName ?? user.email,
          friendUid,
          sessionId,
          shortCode,
        );

        ack({ ok: true });
      } catch (err) {
        console.error("[lobby:invite-friend]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── lobby:leave ──────────────────────────────────────────────────────────
  socket.on("lobby:leave", async (payload: { sessionId: string }) => {
    const { getSession } = await import("@/server/draft/state");
    const activeSession = getSession(payload.sessionId);
    if (!activeSession || activeSession.state.status !== "lobby") return;

    activeSession.state = {
      ...activeSession.state,
      players: activeSession.state.players.filter((p) => p.uid !== user.uid),
    };
    activeSession.sockets.delete(user.uid);
    void socket.leave(payload.sessionId);
    broadcastLobby(io, payload.sessionId);
  });
}

// ── Timer expiry handler (called by slot timer) ──────────────────────────────

export async function handleTimerExpiry(
  io: Server,
  socket: Socket,
  sessionId: string,
): Promise<void> {
  const { getSession } = await import("@/server/draft/state");
  const active = getSession(sessionId);
  if (!active || active.state.status !== "drafting") return;

  let state = active.state;
  // Auto-pick for every seat that hasn't picked yet.
  for (let i = 0; i < state.players.length; i++) {
    if (!state.pickedThisSlot[i]) {
      state = autoPick(state, i);
    }
  }
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
  startSlotTimer(io, socket, sessionId, () =>
    handleTimerExpiry(io, socket, sessionId),
  );
}
