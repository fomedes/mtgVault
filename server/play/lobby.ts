import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { connectToDatabase } from "@/lib/db";
import { PlaySession } from "@/lib/models/PlaySession";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { createBoard, type LifeMode, type SeatInit } from "@/lib/game/play";
import { resolveDeckLibrary, resolveDecklistLibrary } from "@/lib/game/play-import";
import {
  type ActivePlay,
  type LobbyPlayer,
  broadcastBoardViews,
  broadcastPlayLobby,
  checkpoint,
  ensurePlayLoadedByCode,
  getPlay,
  registerPlay,
} from "@/server/play/state";
import { sendPlayInvite } from "@/server/play/notifications";
import {
  createSchema,
  inviteSchema,
  joinSchema,
  listSchema,
  readySchema,
  sessionOnlySchema,
  setDeckSchema,
} from "@/server/play/schemas";

/** Summary card for the Play landing (rejoin list + friends' open tables). */
interface PlaySummary {
  sessionId: string;
  shortCode: string;
  formatLabel: string;
  status: "lobby" | "playing" | "ended";
  playerCount: number;
  seatedCount: number;
  hostName: string;
  playerNames: string[];
}

interface SocketUser {
  uid: string;
  email: string;
  role: "user" | "admin";
  displayName?: string;
}

function generateShortCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

/** Each player's own team in per-player mode; 2-and-2 split in shared-team mode. */
function teamFor(seatIndex: number, lifeMode: LifeMode): number {
  return lifeMode === "shared-team" ? seatIndex % 2 : seatIndex;
}

export function registerPlayHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;

  // Join personal notification room (idempotent — draft lobby joins it too).
  void socket.join(`user:${user.uid}`);

  // ── playlobby:create ───────────────────────────────────────────────────────
  socket.on(
    "playlobby:create",
    async (
      payload: unknown,
      ack: (res: { ok: boolean; sessionId?: string; shortCode?: string; error?: string }) => void,
    ) => {
      try {
        const parsed = createSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });
        const { formatLabel, playerCount, lifeMode, startingLife } = parsed.data;

        await connectToDatabase();
        const sessionId = randomUUID();
        let shortCode = generateShortCode();
        while (await PlaySession.exists({ shortCode })) {
          shortCode = generateShortCode();
        }

        const host: LobbyPlayer = {
          uid: user.uid,
          displayName: user.displayName ?? user.email,
          seatIndex: 0,
          teamId: teamFor(0, lifeMode),
          isReady: false,
        };

        const active: ActivePlay = {
          sessionId,
          shortCode,
          status: "lobby",
          config: { formatLabel, playerCount, lifeMode, startingLife, hostUid: user.uid },
          players: [host],
          board: null,
          sockets: new Map([[user.uid, socket.id]]),
          disconnectTimers: new Map(),
        };
        registerPlay(sessionId, active);

        await PlaySession.create({
          sessionId,
          shortCode,
          status: "lobby",
          formatLabel,
          playerCount,
          lifeMode,
          startingLife,
          hostUid: user.uid,
          players: [
            { uid: host.uid, displayName: host.displayName, seatIndex: 0, teamId: host.teamId, isReady: false },
          ],
        });

        void socket.join(sessionId);
        broadcastPlayLobby(io, sessionId);
        ack({ ok: true, sessionId, shortCode });
      } catch (err) {
        console.error("[playlobby:create]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── playlobby:join ─────────────────────────────────────────────────────────
  socket.on(
    "playlobby:join",
    async (
      payload: unknown,
      ack: (res: { ok: boolean; sessionId?: string; error?: string }) => void,
    ) => {
      try {
        const parsed = joinSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

        const active = await ensurePlayLoadedByCode(parsed.data.shortCode);
        if (!active) return ack({ ok: false, error: "lobby_not_found" });

        const { sessionId } = active;
        if (active.status !== "lobby") return ack({ ok: false, error: "play_already_started" });

        // Rejoin if already seated.
        if (active.players.some((p) => p.uid === user.uid)) {
          active.sockets.set(user.uid, socket.id);
          void socket.join(sessionId);
          broadcastPlayLobby(io, sessionId);
          return ack({ ok: true, sessionId });
        }

        if (active.players.length >= active.config.playerCount) {
          return ack({ ok: false, error: "lobby_full" });
        }

        const seatIndex = active.players.length;
        const newPlayer: LobbyPlayer = {
          uid: user.uid,
          displayName: user.displayName ?? user.email,
          seatIndex,
          teamId: teamFor(seatIndex, active.config.lifeMode),
          isReady: false,
        };
        active.players = [...active.players, newPlayer];
        active.sockets.set(user.uid, socket.id);

        await connectToDatabase();
        await PlaySession.updateOne(
          { sessionId },
          {
            $push: {
              players: {
                uid: newPlayer.uid,
                displayName: newPlayer.displayName,
                seatIndex,
                teamId: newPlayer.teamId,
                isReady: false,
              },
            },
          },
        );

        void socket.join(sessionId);
        broadcastPlayLobby(io, sessionId);
        ack({ ok: true, sessionId });
      } catch (err) {
        console.error("[playlobby:join]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── playlobby:list — my rejoinable games + friends' open tables ────────────
  socket.on(
    "playlobby:list",
    async (
      payload: unknown,
      ack: (res: {
        ok: boolean;
        myGames?: PlaySummary[];
        openTables?: PlaySummary[];
        error?: string;
      }) => void,
    ) => {
      try {
        const parsed = listSchema.safeParse(payload ?? {});
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

        await connectToDatabase();

        const toSummary = (doc: {
          sessionId: string;
          shortCode: string;
          formatLabel: string;
          status: string;
          playerCount: number;
          hostUid: string;
          players: { uid: string; displayName?: string }[];
        }): PlaySummary => {
          const players = doc.players ?? [];
          return {
            sessionId: doc.sessionId,
            shortCode: doc.shortCode,
            formatLabel: doc.formatLabel,
            status: doc.status as PlaySummary["status"],
            playerCount: doc.playerCount,
            seatedCount: players.length,
            hostName:
              players.find((p) => p.uid === doc.hostUid)?.displayName ||
              "Unknown",
            playerNames: players.map((p) => p.displayName || "Player"),
          };
        };

        // Games the caller is already seated in and can rejoin.
        const myDocs = await PlaySession.find({
          "players.uid": user.uid,
          status: { $in: ["lobby", "playing"] },
        })
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean();

        // Accepted friends → their open (lobby) tables that aren't full.
        const friendships = await Friendship.find({
          status: "accepted",
          $or: [{ userA: user.uid }, { userB: user.uid }],
        }).lean();
        const friendUids = friendships.map((f) =>
          f.userA === user.uid ? f.userB : f.userA,
        );

        const openDocs = friendUids.length
          ? await PlaySession.find({
              hostUid: { $in: friendUids },
              status: "lobby",
            })
              .sort({ updatedAt: -1 })
              .limit(20)
              .lean()
          : [];

        const mySessionIds = new Set(myDocs.map((m) => m.sessionId));
        const myGames = myDocs.map(toSummary);
        const openTables = openDocs
          .map(toSummary)
          // Exclude full tables and any I'm already seated in (shown under myGames).
          .filter(
            (s) => s.seatedCount < s.playerCount && !mySessionIds.has(s.sessionId),
          );

        ack({ ok: true, myGames, openTables });
      } catch (err) {
        console.error("[playlobby:list]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── playlobby:ready ──────────────────────────────────────────────────────
  socket.on("playlobby:ready", (payload: unknown) => {
    const parsed = readySchema.safeParse(payload);
    if (!parsed.success) return;
    const active = getPlay(parsed.data.sessionId);
    if (!active || active.status !== "lobby") return;
    if (!active.players.some((p) => p.uid === user.uid)) return;

    active.players = active.players.map((p) =>
      p.uid === user.uid ? { ...p, isReady: parsed.data.ready } : p,
    );
    broadcastPlayLobby(io, parsed.data.sessionId);

    void connectToDatabase()
      .then(() =>
        PlaySession.updateOne(
          { sessionId: parsed.data.sessionId, "players.uid": user.uid },
          { $set: { "players.$.isReady": parsed.data.ready } },
        ),
      )
      .catch((err) => console.error("[playlobby:ready] persist failed:", err));
  });

  // ── playlobby:set-deck ─────────────────────────────────────────────────────
  socket.on(
    "playlobby:set-deck",
    async (
      payload: unknown,
      ack: (res: { ok: boolean; unknownCards?: string[]; error?: string }) => void,
    ) => {
      try {
        const parsed = setDeckSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

        const active = getPlay(parsed.data.sessionId);
        if (!active || active.status !== "lobby") return ack({ ok: false, error: "not_in_lobby" });
        const player = active.players.find((p) => p.uid === user.uid);
        if (!player) return ack({ ok: false, error: "not_in_session" });

        const { source } = parsed.data;
        const resolved =
          source.kind === "deck"
            ? await resolveDeckLibrary(source.deckId, user.uid)
            : await resolveDecklistLibrary(source.text);

        if (resolved.library.length === 0) {
          return ack({ ok: false, error: "empty_deck", unknownCards: resolved.unknownCards });
        }

        player.deckLibrary = resolved.library;
        player.deckSourceKind = source.kind;

        await connectToDatabase();
        await PlaySession.updateOne(
          { sessionId: parsed.data.sessionId, "players.uid": user.uid },
          { $set: { "players.$.deckSource": { kind: source.kind } } },
        );

        broadcastPlayLobby(io, parsed.data.sessionId);
        ack({ ok: true, unknownCards: resolved.unknownCards });
      } catch (err) {
        console.error("[playlobby:set-deck]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── playlobby:start ────────────────────────────────────────────────────────
  socket.on(
    "playlobby:start",
    async (payload: unknown, ack: (res: { ok: boolean; error?: string }) => void) => {
      try {
        const parsed = sessionOnlySchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

        const active = getPlay(parsed.data.sessionId);
        if (!active) return ack({ ok: false, error: "session_not_found" });
        if (active.status !== "lobby") return ack({ ok: false, error: "already_started" });
        if (user.uid !== active.config.hostUid) return ack({ ok: false, error: "not_host" });
        if (active.players.length < 2) return ack({ ok: false, error: "need_2_players" });
        if (!active.players.every((p) => p.isReady)) return ack({ ok: false, error: "not_all_ready" });
        if (!active.players.every((p) => p.deckLibrary && p.deckLibrary.length > 0)) {
          return ack({ ok: false, error: "not_all_decked" });
        }

        const seats: SeatInit[] = active.players
          .slice()
          .sort((a, b) => a.seatIndex - b.seatIndex)
          .map((p) => ({
            uid: p.uid,
            displayName: p.displayName,
            teamId: p.teamId,
            library: p.deckLibrary ?? [],
          }));

        const rngSeed = (Math.random() * 0xffffffff) >>> 0;
        const board = createBoard(parsed.data.sessionId, seats, {
          lifeMode: active.config.lifeMode,
          startingLife: active.config.startingLife,
          rngSeed,
        });
        for (const seat of board.seats) {
          if (active.sockets.has(seat.uid)) seat.connected = true;
        }

        active.board = board;
        active.status = "playing";

        await connectToDatabase();
        await PlaySession.updateOne(
          { sessionId: parsed.data.sessionId },
          { $set: { status: "playing", startedAt: new Date(), boardState: board } },
        );

        io.to(parsed.data.sessionId).emit("play:started");
        broadcastBoardViews(io, parsed.data.sessionId);
        checkpoint(parsed.data.sessionId);
        ack({ ok: true });
      } catch (err) {
        console.error("[playlobby:start]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── playlobby:invite-friend ────────────────────────────────────────────────
  socket.on(
    "playlobby:invite-friend",
    async (payload: unknown, ack: (res: { ok: boolean; error?: string }) => void) => {
      try {
        const parsed = inviteSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: "invalid_payload" });

        const active = getPlay(parsed.data.sessionId);
        if (!active) return ack({ ok: false, error: "session_not_found" });
        if (active.status !== "lobby") return ack({ ok: false, error: "not_in_lobby" });

        await connectToDatabase();
        const pair = canonicalPair(user.uid, parsed.data.friendUid);
        const friendship = await Friendship.findOne({ ...pair, status: "accepted" }).lean();
        if (!friendship) return ack({ ok: false, error: "not_friends" });

        await sendPlayInvite(
          io,
          user.uid,
          user.displayName ?? user.email,
          parsed.data.friendUid,
          parsed.data.sessionId,
          active.shortCode,
        );
        ack({ ok: true });
      } catch (err) {
        console.error("[playlobby:invite-friend]", err);
        ack({ ok: false, error: "server_error" });
      }
    },
  );

  // ── playlobby:leave ────────────────────────────────────────────────────────
  socket.on("playlobby:leave", (payload: unknown) => {
    const parsed = sessionOnlySchema.safeParse(payload);
    if (!parsed.success) return;
    const active = getPlay(parsed.data.sessionId);
    if (!active || active.status !== "lobby") return;

    active.players = active.players.filter((p) => p.uid !== user.uid);
    active.sockets.delete(user.uid);
    void socket.leave(parsed.data.sessionId);
    broadcastPlayLobby(io, parsed.data.sessionId);

    void connectToDatabase()
      .then(() =>
        PlaySession.updateOne(
          { sessionId: parsed.data.sessionId },
          { $pull: { players: { uid: user.uid } } },
        ),
      )
      .catch((err) => console.error("[playlobby:leave] persist failed:", err));
  });
}
